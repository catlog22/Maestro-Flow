---
name: manage-memory-capture
description: Capture session memory (compact or tips) into .workflow/memory/ with JSON index
argument-hint: "[compact|tip] [description] [--tag tag1,tag2]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<purpose>
Capture session working memory into `.workflow/memory/` for cross-session recovery. Supports two modes: compact (full session compression for recovery) and tip (quick note-taking with tags). Maintains a `memory-index.json` for search and retrieval. Invoked when saving session state before context loss or recording insights during work.
</purpose>

<required_reading>
@~/.maestro/workflows/memory.md
</required_reading>

<context>
Arguments: $ARGUMENTS

**Modes:**
- `compact` — Full session memory compression (files, decisions, plan state, pending work)
- `tip` — Quick note with optional tags and context
- No arguments — Auto-detect or ask user

**Flags:**
- `--tag tag1,tag2` — Categorization tags (tip mode)

**Storage:**
- `.workflow/memory/` — Memory entries directory
- `.workflow/memory/memory-index.json` — Searchable index of all entries
</context>

<execution>
Follow '~/.maestro/workflows/memory.md' Part B (Memory Capture) completely.
</execution>

<error_codes>
| Code | Severity | Description | Stage |
|------|----------|-------------|-------|
| E001 | error | `.workflow/` not initialized — run Skill({ skill: "maestro-init" }) first | parse_input |
| E002 | error | Empty note content in tip mode — provide text to save | parse_input |
| W001 | warning | No active workflow session found — compact will capture conversation only | analyze_session |
| W002 | warning | Plan detection found no explicit plan — using inferred plan | analyze_session |
</error_codes>

<success_criteria>
- [ ] Mode correctly detected (compact or tip)
- [ ] Entry markdown file written to `.workflow/memory/`
- [ ] `memory-index.json` updated with new entry metadata
- [ ] Compact: all session fields populated (objective, files, decisions, plan)
- [ ] Compact: execution plan preserved VERBATIM (not summarized)
- [ ] Compact: all file paths are ABSOLUTE
- [ ] Tip: content, tags, and context captured
- [ ] Confirmation banner displayed with entry ID
</success_criteria>
