---
name: spec-load
description: Load relevant specs and lessons for current context (used by agents before execution)
argument-hint: "[--category <type>] [--keyword <word>] [--with-lessons]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
<purpose>
Load and display relevant spec files for the current working context.
Supports filtering by category (file-level) and keyword (entry-level via `<spec-entry>` tags).
</purpose>

<required_reading>
@~/.maestro/workflows/specs-load.md
</required_reading>

<context>
$ARGUMENTS -- optional flags and keyword

**Category-to-file mapping (1:1, same as spec-add):**
| Category | File loaded |
|----------|------------|
| `coding` | `coding-conventions.md` |
| `arch` | `architecture-constraints.md` |
| `quality` | `quality-rules.md` |
| `debug` | `debug-notes.md` |
| `test` | `test-conventions.md` |
| `review` | `review-standards.md` |
| `learning` | `learnings.md` |
| `all` (default) | All spec files |

**Flags:**
- `--category <type>` — Filter by file category (loads one file)
- `--keyword <word>` — Filter entries by keyword attribute in `<spec-entry>` tags. Searches across all files (or within category if combined)
- `--with-lessons` — Also search `.workflow/learning/lessons.jsonl`

**Examples:**
```
/spec-load --keyword auth
/spec-load --category coding --keyword naming
/spec-load --category arch
```
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
- [ ] Category and/or keyword parsed from arguments
- [ ] Spec files loaded per category mapping
- [ ] Keyword filtering applied at entry level (via `<spec-entry>` keywords attribute)
- [ ] Legacy entries filtered by text grep fallback
- [ ] Results displayed with file:category references
</success_criteria>
</output>
