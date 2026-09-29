/**
 * Parsing for the bundled `SKILL.md` document.
 *
 * The plugin ships a skill file and registers it through `ctx.skill.transform`,
 * so the file stays the single source of truth (someone can also copy it into
 * `~/.config/opencode/skills/` by hand). OpenCode strips frontmatter when it
 * loads a skill from disk itself, so the plugin has to do the same before
 * handing the body to the API.
 *
 * This module has no OpenCode import, so it is unit tested in isolation.
 */

/** A parsed `SKILL.md`: frontmatter fields plus the body the model receives. */
export interface SkillDocument {
  /** Display name from frontmatter, when present. */
  name?: string
  /** One-line summary from frontmatter, when present. */
  description?: string
  /** Markdown body with the frontmatter block removed and outer blank lines trimmed. */
  body: string
}

/** Strip one layer of matching single or double quotes around a value. */
function unquote(value: string): string {
  const first = value[0]
  const last = value[value.length - 1]
  if (value.length >= 2 && first === last && (first === '"' || first === "'")) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Read a `SKILL.md` document: an optional leading `---` block of flat
 * `key: value` pairs, followed by the Markdown body.
 *
 * Only flat scalar frontmatter is interpreted. Nested YAML is left untouched in
 * the body rather than half-parsed; this plugin only ships `name` and
 * `description`. A document without frontmatter, or with an unterminated one,
 * is treated entirely as a body.
 */
export function parseSkillDocument(markdown: string): SkillDocument {
  const text = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const lines = text.split("\n")

  if (lines[0]?.trim() !== "---") return { body: text.trim() }

  // The closing delimiter is the next line that is exactly `---`.
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---")
  if (end === -1) return { body: text.trim() }

  const document: SkillDocument = {
    body: lines
      .slice(end + 1)
      .join("\n")
      .trim(),
  }

  for (const rawLine of lines.slice(1, end)) {
    const line = rawLine.trim()
    if (line === "" || line.startsWith("#")) continue

    const separator = line.indexOf(":")
    if (separator <= 0) continue

    const key = line.slice(0, separator).trim()
    const value = unquote(line.slice(separator + 1).trim())
    if (value === "") continue

    if (key === "name") document.name = value
    else if (key === "description") document.description = value
  }

  return document
}
