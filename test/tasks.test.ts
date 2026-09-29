import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"
import {
  STATUS_MARK,
  TASK_STATUSES,
  flattenTasks,
  isTaskStatus,
  loadTasks,
  normalizeTasks,
  saveTasks,
  tasksDir,
  tasksFile,
} from "../src/tasks.ts"

describe("isTaskStatus", () => {
  it("accepts every known status", () => {
    for (const status of TASK_STATUSES) assert.equal(isTaskStatus(status), true)
  })

  it("rejects unknown or non-string values", () => {
    for (const value of ["", "DONE", "running", 1, null, undefined, {}]) {
      assert.equal(isTaskStatus(value), false)
    }
  })
})

describe("normalizeTasks", () => {
  it("returns an empty list for non-arrays", () => {
    assert.deepEqual(normalizeTasks(undefined), [])
    assert.deepEqual(normalizeTasks(null), [])
    assert.deepEqual(normalizeTasks("nope"), [])
    assert.deepEqual(normalizeTasks({ tasks: [] }), [])
  })

  it("fills in defaults for missing fields", () => {
    assert.deepEqual(normalizeTasks([{}]), [{ id: "1", parent_id: null, status: "pending", summary: "" }])
  })

  it("coerces ids to strings and unknown statuses to pending", () => {
    assert.deepEqual(normalizeTasks([{ id: 7, status: "running", summary: "x" }]), [
      { id: "7", parent_id: null, status: "pending", summary: "x" },
    ])
  })

  it("treats an empty parent as a top-level task", () => {
    assert.equal(normalizeTasks([{ id: "T1", parent_id: "" }])[0]?.parent_id, null)
    assert.equal(normalizeTasks([{ id: "T1", parent_id: null }])[0]?.parent_id, null)
    assert.equal(normalizeTasks([{ id: "T1", parent_id: "T0" }])[0]?.parent_id, "T0")
  })

  it("drops duplicate ids, keeping the first occurrence", () => {
    const tasks = normalizeTasks([
      { id: "T1", summary: "first" },
      { id: "T1", summary: "second" },
    ])
    assert.deepEqual(
      tasks.map((task) => task.summary),
      ["first"],
    )
  })
})

describe("flattenTasks", () => {
  const task = (id: string, parent_id: string | null = null) => ({
    id,
    parent_id,
    status: "pending" as const,
    summary: id,
  })

  it("returns an empty list for an empty input", () => {
    assert.deepEqual(flattenTasks([]), [])
  })

  it("renders children directly under their parent, preserving sibling order", () => {
    const flat = flattenTasks([task("T1"), task("T1.1", "T1"), task("T1.2", "T1"), task("T2")])
    assert.deepEqual(
      flat.map((entry) => [entry.id, entry.depth]),
      [
        ["T1", 0],
        ["T1.1", 1],
        ["T1.2", 1],
        ["T2", 0],
      ],
    )
  })

  it("shows tasks with a missing parent at the top level", () => {
    const flat = flattenTasks([task("orphan", "missing")])
    assert.deepEqual(
      flat.map((entry) => [entry.id, entry.depth]),
      [["orphan", 0]],
    )
  })

  it("terminates on a parent cycle and still shows every task", () => {
    const flat = flattenTasks([task("a", "b"), task("b", "a")])
    assert.equal(flat.length, 2)
    assert.deepEqual([...flat.map((entry) => entry.id)].sort(), ["a", "b"])
  })

  it("ignores a self-parent", () => {
    const flat = flattenTasks([task("a", "a")])
    assert.deepEqual(
      flat.map((entry) => [entry.id, entry.depth]),
      [["a", 0]],
    )
  })
})

describe("STATUS_MARK", () => {
  it("has a marker for every status", () => {
    for (const status of TASK_STATUSES) assert.equal(typeof STATUS_MARK[status], "string")
  })
})

describe("storage", () => {
  let dir: string

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "opencode-tasks-"))
    process.env.XDG_STATE_HOME = dir
  })

  after(async () => {
    delete process.env.XDG_STATE_HOME
    dir = undefined as unknown as string
  })

  it("derives the directory and file paths from XDG_STATE_HOME", () => {
    assert.equal(tasksDir(), join(dir, "opencode-tasks"))
    assert.equal(tasksFile("ses_abc"), join(dir, "opencode-tasks", "ses_abc.json"))
  })

  it("percent-encodes ids that are unsafe as filenames", () => {
    assert.equal(tasksFile("a/b"), join(dir, "opencode-tasks", "a%2Fb.json"))
  })

  it("round-trips a list through save and load", async () => {
    const tasks = normalizeTasks([{ id: "T1", status: "done", summary: "ship it" }])
    await saveTasks("ses_roundtrip", tasks)
    assert.deepEqual(await loadTasks("ses_roundtrip"), tasks)
  })

  it("returns an empty list when nothing is stored", async () => {
    assert.deepEqual(await loadTasks("ses_missing"), [])
  })
})
