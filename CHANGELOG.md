# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-09-29

### Fixed

- The `Tasks` panel is now reactive per session. The component body contained an early `return null` for sessions without tasks, and a Solid component body runs only once — so the panel could keep showing the previous session's header with no rows, or never appear at all once a session gained tasks. Both the visibility check and the rows now use `Show` / `For`.
- Clicking the `Tasks` header re-reads the task files, so expanding always shows the latest state instead of waiting for the next poll.

### Added

- `tasksForSession`, the single tested place that decides which session's rows are rendered.
- `readAllTasks`, moved out of the TUI entrypoint into `src/tasks.ts` and covered by tests: multi-session reads, url-encoded session ids, and an unreadable file being skipped without blanking the panel.

## [0.1.1] - 2026-09-29

### Fixed

- The `tasks` tool no longer returns a structured `output` without declaring an output schema. The runtime rejected the result of **every** call with `Tool result declared output without an output schema`. Because the list was written to disk before the return, the failure was easy to miss: the sidebar kept updating, so the panel silently went stale instead of erroring visibly.

### Added

- `summarizeTasks` (`src/tasks.ts`), a pure helper that renders a one-line status summary such as `6 task(s): 3 done, 1 in progress, 2 pending.`, now used as the tool's text result.
- `test/tool.test.ts`, which loads the plugin entrypoint with a fake context and asserts the tool result shape so the regression above cannot come back.

## [0.1.0] - 2026-09-29

### Added

- `tasks` tool for OpenCode V2 that replaces the session task list in a single call.
- Bundled `task-planning` skill, registered through `ctx.skill.transform` so one install provides both the tool and the planning policy.
- `SKILL.md` frontmatter/body parser (`src/skill.ts`) with unit tests.
- Nesting support via `parent_id`, rendered depth-first with indentation.
- Live `Tasks` panel in the TUI sidebar (`sidebar.content`), collapsible by clicking the header.
- Theme-aware status colors and markers for `pending`, `in_progress`, `blocked`, `done`, and `cancelled`.
- Per-session JSON storage under `$XDG_STATE_HOME/opencode-tasks/`.
- Shared, dependency-free model module (`src/tasks.ts`) used by both entrypoints.
- Defensive input normalization (unknown statuses, missing fields, duplicate ids).
- Cycle-safe and orphan-safe task flattening.
- Unit test suite (`node:test`) covering normalization, flattening, and storage.
- TypeScript type-checking, Prettier formatting, and a GitHub Actions CI workflow.

[Unreleased]: https://github.com/smallnest/opencode2-tasks/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/smallnest/opencode2-tasks/releases/tag/v0.1.2
[0.1.1]: https://github.com/smallnest/opencode2-tasks/releases/tag/v0.1.1
[0.1.0]: https://github.com/smallnest/opencode2-tasks/releases/tag/v0.1.0
