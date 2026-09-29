import { Plugin } from "@opencode/plugin/tui"
import type { RGBA } from "@opentui/core"
import { For, Show } from "solid-js"
import { STATUS_MARK, type FlatTask, type Task, readAllTasks, tasksForSession } from "./src/tasks.ts"

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
 * The sidebar panel: a collapsible, nested task list for the **current**
 * session.
 *
 * Every session has its own list, so switching sessions switches the rows and a
 * brand-new session starts empty. Both the "is there anything to show" check and
 * the rows themselves have to be reactive: a Solid component body runs once, so
 * an early `return null` would freeze the decision at mount time and the panel
 * would never appear (or never disappear) as sessions change.
 */
function Tasks(props: {
  context: Plugin.Context
  store: Store
  view: { open: boolean }
  /** Toggles the section and re-reads the task files. */
  onToggle: () => void
  sessionID: string
}) {
  const rows = (): FlatTask[] => tasksForSession(props.store.bySession ?? {}, props.sessionID)

  return (
    <Show when={rows().length > 0}>
      <box flexDirection="column">
        <box flexDirection="row" gap={1} onMouseDown={props.onToggle}>
          <text fg={props.context.theme.text.base}>{props.view.open ? "▼" : "▶"}</text>
          <text fg={props.context.theme.text.base}>Tasks</text>
        </box>
        <Show when={props.view.open}>
          <For each={rows()}>
            {(task) => (
              <text fg={rowColor(props.context, task.status)}>
                {"  ".repeat(task.depth) + STATUS_MARK[task.status] + " " + task.id + " " + task.summary}
              </text>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

/**
 * TUI entrypoint: mirrors the on-disk task list into a reactive store and
 * renders it in `sidebar.content`.
 *
 * Rendering is synchronous while the tasks come from files written by the
 * server process, so the store is refreshed on a short interval. Clicking the
 * section header also re-reads immediately, so expanding always shows the
 * latest state rather than waiting for the next tick. The cleanup function
 * returned by `setup` stops the timer when the plugin unloads.
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
      const next = await readAllTasks()
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
          onToggle={() => {
            setView((draft) => {
              draft.open = !draft.open
            })
            // Fallback for the polling loop: re-read on click so expanding the
            // section always shows the latest state, even if the interval has
            // not fired yet or a previous refresh failed.
            void refresh()
          }}
        />
      ),
    })

    return () => clearInterval(timer)
  },
})
