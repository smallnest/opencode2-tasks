# Contributing

Thanks for your interest in improving `opencode2-tasks`! This project is small on purpose, so the contribution process is short.

## Getting started

```bash
git clone https://github.com/smallnest/opencode2-tasks.git
cd opencode2-tasks
npm install
```

- **Node.js ≥ 22.18** is required for development. The code uses native TypeScript type stripping and the built-in `node:test` runner, so there is no build step.
- The package ships as TypeScript sources. OpenCode loads `index.ts` and `tui.tsx` directly.

## Before you open a pull request

Run the same checks CI runs:

```bash
npm run check     # typecheck + format check + tests
```

Individual commands:

| Command | Purpose |
| --- | --- |
| `npm test` | Run the unit tests. |
| `npm run typecheck` | `tsc --noEmit` over the sources and tests. |
| `npm run format` | Format with Prettier (config in `.prettierrc.json`). |
| `npm run format:check` | Verify formatting without writing. |

## Guidelines

- **Keep the shared model shared.** Logic that both entrypoints need belongs in `src/tasks.ts`, not duplicated in `index.ts` and `tui.tsx`.
- **Keep `src/*.ts` dependency-free.** These modules must not import OpenCode. That is what makes the tests fast and the two runtimes consistent.
- **`skills/task-planning/SKILL.md` is shipped and registered at startup.** It is the single source of truth for the planning policy: edit the Markdown, not a copy in `index.ts`. It must keep a `description` in its frontmatter, or OpenCode will not advertise it to the model.
- **Test behavior, not glue.** Add cases to `test/tasks.test.ts` for new pure logic. Changes to rendering are verified manually against a running TUI.
- **Preserve the storage format.** Existing `~/.local/state/opencode-tasks/*.json` files must keep working. If the format must change, handle the old shape and note it in the changelog.
- **Update the docs.** User-visible changes need an entry under `Unreleased` in `CHANGELOG.md`, and the matching section in **both** `README.md` and `README_CN.md` kept in sync.

## Host-coupled dependencies

`@opencode/plugin`, `@opencode/theme`, `@opentui/core`, `@opentui/solid`, and `solid-js` are pinned to what the running OpenCode version ships, and `@opentui/solid` declares an **exact** `solid-js` peer. Bumping any of them alone makes `npm ci` fail with `ERESOLVE`, so Dependabot is configured to ignore them.

To move them, change all of them in one commit and re-run `npm install` to regenerate `package-lock.json`:

```bash
npm install @opencode/plugin@<version> @opencode/theme@<version> \
  @opentui/core@<version> @opentui/solid@<version> -D
npm run check
```

## Commit messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add ability to collapse individual sub-tasks
fix: keep orphaned tasks visible at the top level
docs: document the XDG state directory
chore: bump dev dependencies
```

## Reporting bugs

Open an issue with the [bug report template](https://github.com/smallnest/opencode2-tasks/issues/new?template=bug_report.yml). Please include your OpenCode version (`opencode --version`), Node version, and the relevant contents of `~/.local/state/opencode-tasks/` with any sensitive text removed.

## Code of conduct

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).
