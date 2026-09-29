import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { parseSkillDocument } from "../src/skill.ts"

describe("parseSkillDocument", () => {
  it("splits frontmatter from the body", () => {
    const document = parseSkillDocument("---\nname: Review\ndescription: Check the diff\n---\n# Body\ntext\n")
    assert.equal(document.name, "Review")
    assert.equal(document.description, "Check the diff")
    assert.equal(document.body, "# Body\ntext")
  })

  it("treats a document without frontmatter as all body", () => {
    const document = parseSkillDocument("# Just a body\n")
    assert.equal(document.name, undefined)
    assert.equal(document.description, undefined)
    assert.equal(document.body, "# Just a body")
  })

  it("treats an unterminated frontmatter block as body", () => {
    const markdown = "---\nname: Review\n# still going\n"
    const document = parseSkillDocument(markdown)
    assert.equal(document.name, undefined)
    assert.equal(document.body, markdown.trim())
  })

  it("handles CRLF line endings", () => {
    const document = parseSkillDocument("---\r\nname: Review\r\ndescription: D\r\n---\r\nBody\r\n")
    assert.equal(document.name, "Review")
    assert.equal(document.description, "D")
    assert.equal(document.body, "Body")
  })

  it("strips a BOM", () => {
    const document = parseSkillDocument("\uFEFF---\nname: Review\n---\nBody")
    assert.equal(document.name, "Review")
    assert.equal(document.body, "Body")
  })

  it("keeps colons inside a value", () => {
    const document = parseSkillDocument("---\ndescription: a: b: c\n---\nBody")
    assert.equal(document.description, "a: b: c")
  })

  it("unquotes quoted values", () => {
    const document = parseSkillDocument("---\nname: \"Quoted\"\ndescription: 'Single'\n---\nBody")
    assert.equal(document.name, "Quoted")
    assert.equal(document.description, "Single")
  })

  it("ignores comments, blank lines, and unknown keys", () => {
    const document = parseSkillDocument("---\n# a comment\n\nauthor: someone\nname: Review\n---\nBody")
    assert.equal(document.name, "Review")
    assert.equal(document.description, undefined)
  })

  it("allows an empty frontmatter block", () => {
    const document = parseSkillDocument("---\n---\nBody")
    assert.equal(document.name, undefined)
    assert.equal(document.body, "Body")
  })

  it("parses the skill shipped with this package", async () => {
    const markdown = await readFile(new URL("../skills/task-planning/SKILL.md", import.meta.url), "utf8")
    const document = parseSkillDocument(markdown)
    assert.ok(document.description, "the shipped skill must have a description or it will not be advertised")
    assert.match(document.name ?? "", /task/i)
    assert.ok(document.body.includes("##"), "the body should keep its headings")
    assert.ok(!document.body.startsWith("---"), "frontmatter must not leak into the body")
  })
})
