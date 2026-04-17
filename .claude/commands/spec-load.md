---
name: spec-load
description: Load relevant specs and lessons for current context (used by agents before execution)
argument-hint: "[--category <type>] [--with-lessons] [keyword]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
<purpose>
Load and display relevant spec files for the current working context, optionally filtered by category.
Designed for agents to call before execution to internalize project conventions, constraints, and learnings.
Returns matched sections with file references ranked by relevance.
</purpose>

<required_reading>
@~/.maestro/workflows/specs-load.md
</required_reading>

<context>
$ARGUMENTS -- optional `--category <type>` flag and/or keyword to filter specs

**Category filter** (matches frontmatter `category` field):
| Category | Files loaded |
|----------|-------------|
| `general` | `learnings.md` |
| `exploration` | _(reserved)_ |
| `planning` | `architecture-constraints.md` |
| `execution` | `coding-conventions.md`, `quality-rules.md` |
| `debug` | `debug-notes.md` |
| `test` | `test-conventions.md` |
| `review` | `review-standards.md` |
| `validation` | `validation-rules.md` |
| `all` (default) | All spec files |

**Keyword:** If provided, search within loaded files for matching sections.
If no arguments, loads all specs for the active phase/task context.

**Flags:**
- `--with-lessons` — Also search `.workflow/learning/lessons.jsonl` for entries with `category: "gotcha"`, `"antipattern"`, or `"pattern"` relevant to the keyword or current context. Appends matched lessons after spec output. This bridges the gap between specs (prescriptive rules) and lessons (discovered knowledge).
</context>

<execution>
Follow '~/.maestro/workflows/specs-load.md' completely.
</execution>

<error_codes>
| Code | Severity | Description | Stage |
|------|----------|-------------|-------|
| E001 | fatal | `.workflow/specs/` not initialized -- run `/spec-setup` first | detect_context |
| W001 | warning | No matching specs found for keyword -- showing all specs in category instead | load_specs |
</error_codes>

<success_criteria>
- [ ] Category filter parsed correctly (or defaults to all)
- [ ] Spec files resolved and read
- [ ] Keyword filtering applied if provided
- [ ] If `--with-lessons`: lessons.jsonl searched for gotcha/antipattern/pattern entries matching context
- [ ] If `--with-lessons`: matched lessons displayed after specs (max 10, newest first)
- [ ] Results displayed with file:line references
- [ ] Relevant specs loaded into agent context
- [ ] Next step: proceed with current task using loaded specs as context
</success_criteria>
