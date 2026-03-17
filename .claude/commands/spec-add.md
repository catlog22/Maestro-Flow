---
name: spec-add
description: Add a spec entry (bug, pattern, decision, or rule) to the appropriate specs file
argument-hint: "<type> <content>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---
<purpose>
Add a knowledge entry to the project specs system, routing it to the correct file by category.
Each entry is timestamped and appended to learnings.md, then the relevant spec file is updated if the entry warrants a convention or rule change.
Supports four categories: bug fixes, patterns, architectural decisions, and quality rules.
</purpose>

<required_reading>
@~/.maestro/workflows/specs-add.md
</required_reading>

<context>
$ARGUMENTS -- expects `<type> <content>` where type is one of: bug, pattern, decision, rule, debug, test, review, validation

**Type-to-file mapping:**
| Type | Primary file | Secondary update |
|------|-------------|-----------------|
| `bug` | `learnings.md` | -- |
| `pattern` | `learnings.md` | `coding-conventions.md` |
| `decision` | `learnings.md` | `architecture-constraints.md` |
| `rule` | `learnings.md` | `quality-rules.md` |
| `debug` | `learnings.md` | `debug-notes.md` |
| `test` | `learnings.md` | `test-conventions.md` |
| `review` | `learnings.md` | `review-standards.md` |
| `validation` | `learnings.md` | `validation-rules.md` |
</context>

<execution>
Follow '~/.maestro/workflows/specs-add.md' completely.
</execution>

<error_codes>
| Code | Severity | Description | Stage |
|------|----------|-------------|-------|
| E001 | fatal | Category and content are both required -- usage: `<type> <content>` | parse_input |
| E002 | fatal | `.workflow/specs/` not initialized -- run Skill({ skill: "spec-setup" }) first | validate_entry |
| E003 | fatal | Invalid category -- must be one of: bug, pattern, decision, rule, debug, test, review, validation | parse_input |
</error_codes>

<success_criteria>
- [ ] Category parsed and validated as bug/pattern/decision/rule
- [ ] Entry appended to `.workflow/specs/learnings.md` with timestamp
- [ ] Relevant spec file updated (if type is pattern/decision/rule)
- [ ] Confirmation report displayed
</success_criteria>
