import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
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
  readAllTasks,
  saveTasks,
  summarizeTasks,
  tasksDir,
  tasksFile,
  tasksForSession,
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

describe("tasksForSession", () => {
  const task = (id: string) => ({ id, parent_id: null, status: "pending" as const, summary: id })
  const bySession = {
    ses_a: [task("A1"), task("A2")],
    ses_b: [task("B1")],
  }

  it("returns only the requested session's rows", () => {
    assert.deepEqual(
      tasksForSession(bySession, "ses_a").map((row) => row.id),
      ["A1", "A2"],
    )
    assert.deepEqual(
      tasksForSession(bySession, "ses_b").map((row) => row.id),
      ["B1"],
    )
  })

  it("returns nothing for a session that has no tasks yet", () => {
    assert.deepEqual(tasksForSession(bySession, "ses_brand_new"), [])
  })

  it("returns nothing when no session has any tasks", () => {
    assert.deepEqual(tasksForSession({}, "ses_a"), [])
  })
})

describe("STATUS_MARK", () => {
  it("has a marker for every status", () => {
    for (const status of TASK_STATUSES) assert.equal(typeof STATUS_MARK[status], "string")
  })
})

describe("summarizeTasks", () => {
  const withStatus = (id: string, status: string) => ({ id, parent_id: null, status, summary: id })

  it("reports an empty list as cleared", () => {
    assert.equal(summarizeTasks([]), "Task list cleared.")
  })

  it("counts only the statuses that occur, most interesting first", () => {
    const tasks = normalizeTasks([
      withStatus("T1", "pending"),
      withStatus("T2", "pending"),
      withStatus("T3", "in_progress"),
      withStatus("T4", "done"),
      withStatus("T5", "done"),
      withStatus("T6", "done"),
    ])
    assert.equal(summarizeTasks(tasks), "6 task(s): 3 done, 1 in progress, 2 pending.")
  })

  it("renders in_progress as two words and keeps every status distinct", () => {
    const tasks = normalizeTasks(TASK_STATUSES.map((status, index) => withStatus(`T${index}`, status)))
    assert.equal(summarizeTasks(tasks), "5 task(s): 1 done, 1 in progress, 1 blocked, 1 pending, 1 cancelled.")
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

describe("readAllTasks", () => {
  let dir: string
  let previous: string | undefined

  before(async () => {
    previous = process.env.XDG_STATE_HOME
    dir = await mkdtemp(join(tmpdir(), "opencode-tasks-all-"))
    process.env.XDG_STATE_HOME = dir
  })

  after(async () => {
    if (previous === undefined) delete process.env.XDG_STATE_HOME
    else process.env.XDG_STATE_HOME = previous
    await rm(dir, { recursive: true, force: true })
  })

  it("returns an empty map when nothing has been stored yet", async () => {
    assert.deepEqual(await readAllTasks(), {})
  })

  it("returns every session's list, keyed by session id", async () => {
    await saveTasks("ses_a", normalizeTasks([{ id: "T1", status: "done" }]))
    await saveTasks("ses_b", normalizeTasks([{ id: "B1", status: "pending" }]))

    const all = await readAllTasks()
    assert.deepEqual(Object.keys(all).sort(), ["ses_a", "ses_b"])
    assert.equal(all.ses_a?.[0]?.status, "done")
    assert.equal(all.ses_b?.[0]?.id, "B1")
  })

  it("keeps sessions isolated from one another", async () => {
    // A brand-new session has no file, so it must read as empty and must not
    // inherit rows from any other session.
    assert.deepEqual(await loadTasks("ses_brand_new"), [])

    await saveTasks("ses_one", normalizeTasks([{ id: "T1", status: "done" }]))
    await saveTasks("ses_two", normalizeTasks([{ id: "T2", status: "pending" }]))

    const all = await readAllTasks()
    assert.equal(all.ses_brand_new, undefined)
    assert.deepEqual(
      all.ses_one?.map((task) => task.id),
      ["T1"],
    )
    assert.deepEqual(
      all.ses_two?.map((task) => task.id),
      ["T2"],
    )
  })

  it("normalizes what it reads back", async () => {
    await writeFile(join(dir, "opencode-tasks", "ses_raw.json"), JSON.stringify([{ id: 7, status: "nope" }]), "utf8")
    const all = await readAllTasks()
    assert.deepEqual(all.ses_raw, [{ id: "7", parent_id: null, status: "pending", summary: "" }])
  })

  it("skips an unreadable file without dropping the others", async () => {
    await writeFile(join(dir, "opencode-tasks", "ses_broken.json"), "{ half-written", "utf8")

    const all = await readAllTasks()
    assert.equal("ses_broken" in all, false)
    assert.ok("ses_a" in all, "a single bad file must not blank the panel")
  })

  it("decodes url-encoded session ids", async () => {
    await saveTasks("ses/with/slash", normalizeTasks([{ id: "T1" }]))
    const all = await readAllTasks()
    assert.ok("ses/with/slash" in all)
  })

  it("ignores files that are not .json", async () => {
    await writeFile(join(dir, "opencode-tasks", "notes.txt"), "ignore me", "utf8")
    const all = await readAllTasks()
    assert.equal("notes" in all, false)
  })
})
