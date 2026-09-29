/**
 * Regression tests for the tool the plugin registers.
 *
 * These load `index.ts` directly. That only works because the OpenCode imports
 * in it are `import type` and therefore erased by Node's type stripping — the
 * same property that keeps the plugin dependency-free at runtime.
 *
 * The important assertion is the shape of `execute`'s result: returning a
 * structured `output` without declaring an output schema makes the runtime
 * reject the call, which silently broke every `tasks` invocation.
 */

import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import type { Plugin } from "@opencode/plugin"

process.env.XDG_STATE_HOME = await mkdtemp(join(tmpdir(), "opencode-tasks-tool-"))

const { default: plugin } = await import("../index.ts")
const { tasksFile } = await import("../src/tasks.ts")

interface FakeTool {
  name: string
  description: string
  input: unknown
  options?: Record<string, unknown>
  execute: (input: unknown, context: { sessionID: string }) => Promise<Record<string, unknown>>
}

interface FakeSkill {
  id: string
  name: string
  description?: string
  path: string
  content: string
}

async function setup(): Promise<{ tools: FakeTool[]; skills: FakeSkill[] }> {
  const tools: FakeTool[] = []
  const skills: FakeSkill[] = []
  // A minimal stand-in for the plugin context: only the two transforms the
  // entrypoint uses. It is cast because the real editors expose more methods.
  const context = {
    tool: {
      transform: async (callback: (editor: { add: (tool: FakeTool) => void }) => void) =>
        callback({ add: (tool) => tools.push(tool) }),
    },
    skill: {
      transform: async (callback: (editor: { add: (skill: FakeSkill) => void }) => void) =>
        callback({ add: (skill) => skills.push(skill) }),
    },
  } as unknown as Plugin.Context

  await plugin.setup(context)
  return { tools, skills }
}

describe("tasks tool", () => {
  it("registers exactly one tool named `tasks`", async () => {
    const { tools } = await setup()
    assert.equal(tools.length, 1)
    assert.equal(tools[0].name, "tasks")
    assert.equal(tools[0].options?.codemode, false)
  })

  it("declares no structured output and returns only text", async () => {
    const { tools } = await setup()
    const result = await tools[0].execute(
      {
        tasks: [
          { id: "T1", status: "done", summary: "shipped" },
          { id: "T2", status: "pending", summary: "later" },
        ],
      },
      { sessionID: "ses_tool_shape" },
    )

    assert.equal("output" in result, false, "returning `output` without an output schema fails the call")
    assert.equal(typeof result.content, "string")
    assert.match(result.content as string, /^2 task\(s\): 1 done, 1 pending\.$/)
  })

  it("persists the normalized list to disk", async () => {
    const { tools } = await setup()
    await tools[0].execute(
      {
        tasks: [
          { id: "T1", status: "done", summary: "shipped" },
          { id: 2, status: "bogus", summary: "normalized" },
        ],
      },
      { sessionID: "ses_tool_persist" },
    )

    const stored: unknown = JSON.parse(await readFile(tasksFile("ses_tool_persist"), "utf8"))
    assert.deepEqual(stored, [
      { id: "T1", parent_id: null, status: "done", summary: "shipped" },
      { id: "2", parent_id: null, status: "pending", summary: "normalized" },
    ])
  })

  it("treats a missing list as a clear", async () => {
    const { tools } = await setup()
    const result = await tools[0].execute({}, { sessionID: "ses_tool_clear" })
    assert.equal(result.content, "Task list cleared.")
  })

  it("registers the bundled skill with a description and no frontmatter", async () => {
    const { skills } = await setup()
    assert.equal(skills.length, 1)
    assert.equal(skills[0].id, "task-planning")
    assert.ok(skills[0].description)
    assert.ok(!skills[0].content.startsWith("---"))
    assert.ok(skills[0].path.endsWith("SKILL.md"))
  })
})
