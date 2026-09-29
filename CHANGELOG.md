# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/smallnest/opencode2-tasks/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/smallnest/opencode2-tasks/releases/tag/v0.1.0
