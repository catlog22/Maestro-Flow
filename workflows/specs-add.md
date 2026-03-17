# Workflow: specs-add

Add a timestamped entry to the appropriate system specs file.

## Arguments

```
$ARGUMENTS: "<type> <content>"

type    -- one of: bug, pattern, decision, rule
content -- free-text description of the entry
```

## Type-to-File Mapping

All entries are first appended to `learnings.md` (primary). Types with secondary targets also update the relevant spec file:

| Type | Primary file | Secondary file |
|------|-------------|----------------|
| `bug` | `.workflow/specs/learnings.md` | -- |
| `pattern` | `.workflow/specs/learnings.md` | `.workflow/specs/coding-conventions.md` |
| `decision` | `.workflow/specs/learnings.md` | `.workflow/specs/architecture-constraints.md` |
| `rule` | `.workflow/specs/learnings.md` | `.workflow/specs/quality-rules.md` |
| `debug` | `.workflow/specs/learnings.md` | `.workflow/specs/debug-notes.md` |
| `test` | `.workflow/specs/learnings.md` | `.workflow/specs/test-conventions.md` |
| `review` | `.workflow/specs/learnings.md` | `.workflow/specs/review-standards.md` |
| `validation` | `.workflow/specs/learnings.md` | `.workflow/specs/validation-rules.md` |

## Prerequisites

- `.workflow/specs/` directory must exist (run `/workflow:specs-setup` first if missing)

## Execution Steps

### Step 1: Parse Arguments

```
Split $ARGUMENTS into:
  type    = first word
  content = remaining text

Validate:
  - type must be one of: bug, pattern, decision, rule, debug, test, review, validation
  - content must not be empty

On validation failure:
  - Display usage: `/workflow:specs-add <type> <content>`
  - List valid types with descriptions:
    bug        -- Bug or gotcha learned during development
    pattern    -- Coding pattern or convention to follow
    decision   -- Architecture decision or constraint
    rule       -- Quality rule or enforcement criterion
    debug      -- Debug tip, root cause record, or known issue workaround
    test       -- Test convention, pattern, or framework-specific note
    review     -- Review standard, checklist item, or quality gate
    validation -- Verification criterion or acceptance standard
  - Exit
```

### Step 2: Resolve Target Files

```
Map type to file paths using the Type-to-File Mapping table above.
Verify the primary file (learnings.md) exists.

If file does not exist:
  - Warn: "Specs not initialized. Run /workflow:specs-setup first."
  - Exit
```

Check for near-duplicate entries (same title in last 10 entries of learnings.md):
```bash
grep -i "<content_first_10_words>" .workflow/specs/learnings.md | tail -5
```

If near-duplicate found: warn user and ask to proceed or skip.

### Step 3: Format Entry

```
Generate timestamp: YYYY-MM-DD HH:mm (local time)
Generate title by extracting first meaningful phrase from content.
Auto-extract keywords from content for frontmatter update (see Step 5.5).

Entry format for learnings.md:
  ### [YYYY-MM-DD] <type>: <title>

  <full_content>
```

### Step 4: Append to Learnings (Primary)

```
Read .workflow/specs/learnings.md.
Find the "## Entries" section.
Append the formatted entry after the last existing entry (or after the section header if empty).
Write the file back.
```

### Step 5: Update Secondary Spec File

If the entry type has a secondary target file, update it:

| Type | Target file | Update action |
|------|------------|---------------|
| `pattern` | `coding-conventions.md` | Add or update convention section |
| `decision` | `architecture-constraints.md` | Add decision record |
| `rule` | `quality-rules.md` | Add rule under `## Manual` section |
| `debug` | `debug-notes.md` | Add entry under `## Entries` section |
| `test` | `test-conventions.md` | Add entry under `## Manual Additions` section |
| `review` | `review-standards.md` | Add entry under `## Manual Additions` section |
| `validation` | `validation-rules.md` | Add entry under `## Manual Additions` section |
| `bug` | -- | No secondary update (learnings only) |

For pattern/decision/rule: read the target file, find the appropriate section, append the new entry in the file's existing format.

**Frontmatter preservation**: When updating any spec file, preserve the existing YAML frontmatter block (`---` delimiters and all metadata fields). Only modify content below the frontmatter.

### Step 5.5: Auto-Extract Keywords

```
Extract keywords from the entry content and update the target file's frontmatter:

1. Tokenize content: split into words, filter stop words
2. Extract meaningful terms (>= 2 chars, not purely numeric)
3. For CJK text: extract character bigrams
4. Compare extracted keywords against existing frontmatter keywords[]
5. Append new unique keywords to the keywords[] array in frontmatter
6. Limit total keywords to 15 per spec file

If the target file has no frontmatter keywords field, skip this step.
```

### Step 6: Confirm

```
Display:
  == specs-add complete ==
  Type: <category>
  Added to: .workflow/specs/learnings.md
  Updated:  .workflow/specs/<secondary_file> (if applicable)

  Entry: ### [date] <type>: <title>
```

## Output

Entry appended to learnings.md, plus secondary spec file updated if applicable.
