---
name: spec-add
description: Add a spec entry (bug, pattern, decision, or rule) to the appropriate specs file
argument-hint: "<type> <content>"
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Spec Add

## Usage

```bash
$spec-add "pattern Always use named exports for utility functions"
$spec-add "bug Off-by-one in pagination when page=0"
$spec-add "decision Use Zod for runtime validation over io-ts"
$spec-add "rule All API endpoints must return structured error objects"
```

**Arguments**: `<type> <content>` where type is one of: bug, pattern, decision, rule, debug, test, review, validation.

---

## Implementation

### Step 1: Parse Input

Extract type (first token) and content (remainder) from arguments.
- Validate type is one of: bug, pattern, decision, rule, debug, test, review, validation (E003 if invalid)
- Validate content is non-empty (E001 if missing)

### Step 2: Validate Specs Directory

```bash
test -d .workflow/specs || exit 1  # E002: not initialized
```

### Step 3: Route to File

| Type | Primary File | Secondary Update |
|------|-------------|-----------------|
| `bug` | `learnings.md` | -- |
| `pattern` | `learnings.md` | `coding-conventions.md` |
| `decision` | `learnings.md` | `architecture-constraints.md` |
| `rule` | `learnings.md` | `quality-rules.md` |
| `debug` | `learnings.md` | `debug-notes.md` |
| `test` | `learnings.md` | `test-conventions.md` |
| `review` | `learnings.md` | `review-standards.md` |
| `validation` | `learnings.md` | `validation-rules.md` |

### Step 4: Append Entry

Append timestamped entry to `.workflow/specs/learnings.md` using the unified `[type] [date]` format:

```markdown
### [{type}] [{YYYY-MM-DD}] {first line of content}

{content}
```

Example: `### [bug] [2026-03-21] Off-by-one in pagination when page=0`

If type has a secondary file, also update that file with the new convention/rule/decision.

### Step 5: Confirm

```
Added [{type}] to learnings.md
{Secondary file updated if applicable}
```

---

## Error Handling

| Code | Severity | Description |
|------|----------|-------------|
| E001 | fatal | Category and content are both required |
| E002 | fatal | `.workflow/specs/` not initialized -- run `Skill({ skill: "spec-setup" })` first |
| E003 | fatal | Invalid category -- must be one of: bug, pattern, decision, rule, debug, test, review, validation |
