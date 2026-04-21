---
name: spec-add
description: Add a spec entry to the appropriate specs file by category
argument-hint: "<category> <content>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---
<purpose>
Add a knowledge entry to the project specs system using `<spec-entry>` closed-tag format.
Each category maps 1:1 to a single target file — no dual-write.
</purpose>

<required_reading>
@~/.maestro/workflows/specs-add.md
</required_reading>

<context>
$ARGUMENTS -- expects `<category> <content>`

**Category-to-file mapping (1:1, same as spec-load):**
| Category | Target file |
|----------|------------|
| `coding` | `coding-conventions.md` |
| `arch` | `architecture-constraints.md` |
| `quality` | `quality-rules.md` |
| `debug` | `debug-notes.md` |
| `test` | `test-conventions.md` |
| `review` | `review-standards.md` |
| `learning` | `learnings.md` |

**Entry format (closed-tag):**
```markdown
<spec-entry category="{category}" keywords="{auto-extracted}" date="{YYYY-MM-DD}">

### {title}

{content}

</spec-entry>
```
</context>

<execution>
Follow '~/.maestro/workflows/specs-add.md' completely.
</execution>

<error_codes>
| Code | Severity | Description | Stage |
|------|----------|-------------|-------|
| E001 | fatal | Category and content are both required -- usage: `<category> <content>` | parse_input |
| E002 | fatal | `.workflow/specs/` not initialized -- run `/spec-setup` first | validate_entry |
| E003 | fatal | Invalid category -- must be one of: coding, arch, quality, debug, test, review, learning | parse_input |
</error_codes>

<success_criteria>
- [ ] Category parsed and validated
- [ ] Keywords auto-extracted from content (3-5 relevant terms)
- [ ] Entry written in `<spec-entry>` closed-tag format
- [ ] Entry appended to target file
- [ ] Confirmation report displayed
- [ ] Next step: `/spec-load --keyword {keyword}` to verify
</success_criteria>
</output>
