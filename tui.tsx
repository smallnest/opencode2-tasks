import { Plugin } from "@opencode/plugin/tui"
import type { RGBA } from "@opentui/core"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { STATUS_MARK, type FlatTask, type Task, flattenTasks, normalizeTasks, tasksDir } from "./src/tasks.ts"

/** How often the sidebar re-reads the task files written by the server plugin. */
const REFRESH_INTERVAL_MS = 1500

type Store = { bySession: Record<string, Task[]> }

/** Pick the text color for a task row from the active theme. */
function rowColor(context: Plugin.Context, status: string): RGBA | undefined {
  const text = context.theme?.text
  if (!text) return undefined
  if (status === "done") return text.feedback.success.base
  if (status === "blocked") return text.feedback.error.base
  if (status === "in_progress") return text.feedback.warning.base
  return text.muted
}

/**
 * Read every session's task file. A file that is mid-write is skipped rather
 * than failing the whole refresh.
 */
async function readStore(): Promise<Record<string, Task[]>> {
  const next: Record<string, Task[]> = {}
  let files: string[]
  try {
    files = await readdir(tasksDir())
  } catch {
    return next
  }
  await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        try {
          const sessionID = decodeURIComponent(file.slice(0, -5))
          next[sessionID] = normalizeTasks(JSON.parse(await readFile(join(tasksDir(), file), "utf8")))
        } catch {
          // Skip files that are missing or only half-written.
        }
      }),
  )
  return next
}

/** The sidebar panel: a collapsible, nested task list for the current session. */
function Tasks(props: {
  context: Plugin.Context
  store: Store
  view: { open: boolean }
  onToggle: () => void
  sessionID: string
}) {
  const rows = (): FlatTask[] => flattenTasks(props.store.bySession?.[props.sessionID] ?? [])
  if (rows().length === 0) return null

  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={1} onMouseDown={props.onToggle}>
        <text fg={props.context.theme.text.base}>{props.view.open ? "▼" : "▶"}</text>
        <text fg={props.context.theme.text.base}>Tasks</text>
      </box>
      {props.view.open
        ? rows().map((task) => (
            <text fg={rowColor(props.context, task.status)}>
              {"  ".repeat(task.depth) + STATUS_MARK[task.status] + " " + task.id + " " + task.summary}
            </text>
          ))
        : null}
    </box>
  )
}

/**
 * TUI entrypoint: mirrors the on-disk task list into a reactive store and
 * renders it in `sidebar.content`.
 *
 * Rendering is synchronous while the tasks come from files written by the
 * server process, so the store is refreshed on a short interval. The cleanup
 * function returned by `setup` stops the timer when the plugin unloads.
 */
export default Plugin.define({
  id: "opencode.tasks.tui",
  setup(context) {
    const [store, setStore] = context.storage.memory("opencode-tasks", {
      initial: { bySession: {} } satisfies Store,
    })
    // Collapse state, matching the built-in MCP section: persisted in memory
    // storage and toggled by clicking the section header.
    const [view, setView] = context.storage.memory("opencode-tasks-view", {
      initial: { open: true },
    })

    const refresh = async (): Promise<void> => {
      const next = await readStore()
      setStore((draft) => {
        draft.bySession = next
      })
    }

    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)

    context.ui.slot({
      append: "sidebar.content",
      render: (input) => (
        <Tasks
          context={context}
          store={store}
          view={view}
          sessionID={input.sessionID}
          onToggle={() =>
            setView((draft) => {
              draft.open = !draft.open
            })
          }
        />
      ),
    })

    return () => clearInterval(timer)
  },
})
