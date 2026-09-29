# Security Policy

## Supported versions

This project is pre-1.0. Security fixes are applied to the latest published version.

| Version | Supported |
| --- | --- |
| 0.1.x | ✅ |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately through GitHub's [Report a vulnerability](https://github.com/smallnest/opencode2-tasks/security/advisories/new) flow, or email **smallnest@gmail.com** with:

- A description of the issue and its impact.
- Steps to reproduce, or a proof of concept.
- The affected version(s) and your environment.

You can expect an acknowledgement within a few days. Once the issue is confirmed and fixed, a patched release will be published and the report credited unless you prefer otherwise.

## Threat model notes

This plugin reads and writes JSON files under the user's state directory and renders their contents in the terminal:

- It never executes task content; `summary` and `id` values are treated as inert text.
- It does not make network requests.
- Task files are plain JSON and can be inspected, edited, or deleted by the user at any time.
- Filenames are derived from a session id through `encodeURIComponent`, and the directory is not writable by other users by default.

Anything that breaks one of those assumptions is worth reporting.
