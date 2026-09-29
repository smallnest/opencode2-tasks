# Architecture

This document explains the design decisions behind `opencode2-tasks`. For installation and usage, see the [README](../README.md).

## The constraint: two runtimes, one state

OpenCode V2 loads a plugin's server entrypoint and its TUI entrypoint in **different processes**:

- The server entrypoint (`index.ts`, published as `.`) runs wherever sessions execute. It may be the bundled background service.
- The TUI entrypoint (`tui.tsx`, published as `./tui`) runs inside the terminal client, which can even be attached to a remote server.

The two cannot share module-level memory, and the TUI renders synchronously while the tool writes asynchronously. The plugin therefore treats **the filesystem as the single source of truth** and keeps the shared part of the model in `src/tasks.ts`.

```
┌────────────────────────────┐                ┌────────────────────────────┐
│ OpenCode server            │                │ OpenCode TUI               │
│                            │                │                            │
│ index.ts                   │                │ tui.tsx                     │
│  └─ ctx.tool.transform     │                │  └─ storage.memory(store)   │
│       └─ execute(input)    │                │  └─ setInterval(refresh)    │
│            └─ saveTasks ───┼──┐          ┌──┼───► readStore ──► <Tasks/>  │
└────────────────────────────┘  │          │  └────────────────────────────┘
                                ▼          │
                 $XDG_STATE_HOME/opencode-tasks/<session>.json
```

## Why `import type` in `index.ts`

`tui.tsx` imports `@opencode/plugin/tui` as a normal, runtime import, because the CLI runtime virtualizes it.

For the server entrypoint the specifier is resolved by the host rather than by the plugin's own `node_modules`, so `index.ts` imports it with `import type` only:

```ts
import type { Plugin } from "@opencode/plugin"

export default {
  id: "opencode.tasks",
  async setup(ctx: Plugin.Context) { … },
} satisfies Plugin.Plugin
```

`import type` is erased when the file is transpiled, so the module has **no runtime dependency** on the package. The exported object is exactly what `Plugin.define` returns — `define` is the identity function — so no wrapper call is needed. This gives full type-checking during development with zero runtime resolution risk.

## Data model and normalization

The tool schema is advisory. A model can send a number for an id, omit `summary`, invent a status, or reference a parent that does not exist. `normalizeTasks` turns all of that into a well-formed, de-duplicated list so the renderer never defends itself:

| Input | Normalized |
| --- | --- |
| non-array | `[]` |
| missing `id` | index-derived id (`"1"`, `"2"`, …) |
| numeric `id` | `String(id)` |
| unknown `status` | `"pending"` |
| missing `summary` | `""` |
| `parent_id: ""` or `null` | `null` (top level) |
| duplicate `id` | first occurrence kept |

## Ordering and cycle safety

`flattenTasks` builds a `parent_id → children` map and walks it depth-first, emitting each task with a computed `depth`. Two edge cases matter:

1. **Orphans** — a task whose `parent_id` names a task that is absent would be dropped by a naive walk. It is instead appended at depth 0, so nothing disappears.
2. **Cycles** — `A.parent = B` and `B.parent = A` would recurse forever. A `visited` set terminates the walk and flushes the remaining nodes at depth 0.

Both behaviors are covered by unit tests in `test/tasks.test.ts`.

## Storage

```
$XDG_STATE_HOME/opencode-tasks/<encodeURIComponent(sessionID)>.json
```

- `XDG_STATE_HOME` is honored, with `~/.local/state` as the fallback.
- Ids are URL-encoded so they are always safe filenames.
- Writes go through `mkdir(recursive)` + `writeFile`, so a reader can occasionally observe a partially written file; `readStore` catches the parse error and keeps the previous value.
- The stores are per session, so switching sessions in the TUI switches the visible list.

## Rendering

The TUI plugin:

1. Claims the `sidebar.content` slot with `append`, so it composes with the built-in sidebar instead of replacing it.
2. Keeps two pieces of in-memory state: the mirrored task store and the collapsed/open flag. Both use `context.storage.memory`, so they survive plugin hot reloads.
3. Polls every `REFRESH_INTERVAL_MS` (1500 ms) and mirrors the result into the reactive store.
4. Returns a cleanup function from `setup` that clears the interval, so disabling the plugin leaves no timer behind.

Colors come from the active theme's semantic tokens (`theme.text.feedback.{success,error,warning}.base` and `theme.text.muted`), so the panel follows any theme, including light and dark.

## Testing strategy

The pure logic and the storage paths live in `src/tasks.ts` with **no OpenCode imports**, which lets the test suite run on plain Node with the built-in `node:test` runner and type stripping — no bundler, no mocks, no DOM. The two entrypoints contain only glue, which the type-checker and OpenCode itself exercise.

## Why the skill is registered, not shipped as a file

OpenCode discovers skills from `~/.config/opencode/skills`, `.opencode/skills`, the compatibility directories, and explicit `skills` config entries — **not** from arbitrary directories inside an installed package. A `skills/` folder in an npm tarball is therefore inert: a user would have to find it and copy it by hand.

So `index.ts` registers the skill itself:

```ts
const skill = parseSkillDocument(await readFile(SKILL_FILE, "utf8"))
await ctx.skill.transform((editor) => {
  editor.add({
    id: "task-planning",
    name: skill.name,
    description: skill.description,
    path: fileURLToPath(SKILL_FILE),
    content: skill.body,
  } as Skill.Info)
})
```

Three details drive the implementation:

1. **`content` is the body, not the file.** OpenCode strips frontmatter when it loads a skill from disk, so the plugin does the same via `parseSkillDocument` before handing the text to the API. Shipping the raw file would leak `---` and YAML into the model's context.
2. **`description` is mandatory in practice.** A skill without one is never advertised: OpenCode filters `description === undefined` out of the list it shows the model.
3. **`autoinvoke` must not be `false`.** Only `autoinvoke === false` hides a skill; `undefined` and `true` both advertise it, so the field is simply omitted.

A missing or unreadable `SKILL.md` degrades to "tool only" instead of failing setup, so a partially installed package still works.

Because the plugin defines the skill, users must not also copy it into a discovery directory — duplicate ids resolve by registration order, which is not worth depending on. The README calls this out in troubleshooting.
