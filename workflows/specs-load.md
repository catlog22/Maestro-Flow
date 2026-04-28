# Workflow: specs-load

Load spec files filtered by category. Supports project, global, team, and personal scopes.

## Arguments

```
$ARGUMENTS: "[--scope <scope>] [--uid <uid>] [--category <type>] [keyword]"

--scope     -- load scope: project (default) | global | team | personal
--uid       -- user id for personal scope (auto-detected from git if omitted)
--category  -- filter by category (1:1 mapping to file):
               coding | arch | quality | debug | test | review | learning | all
keyword     -- optional, grep within loaded specs for matching sections
```

## Category -> File Mapping (1:1)

Each category loads exactly one file per layer. Same mapping as spec-add.

| Category | File loaded |
|----------|------------|
| `coding` | `coding-conventions.md` |
| `arch` | `architecture-constraints.md` |
| `quality` | `quality-rules.md` |
| `debug` | `debug-notes.md` |
| `test` | `test-conventions.md` |
| `review` | `review-standards.md` |
| `learning` | `learnings.md` |
| `all` (default) | All `.md` files in specs/ |

## Layer Order by Scope

| Scope | Layers loaded (lowest -> highest priority) |
|-------|-------------------------------------------|
| `project` | baseline only |
| `global` | global + baseline |
| `team` | baseline + team shared |
| `personal` | baseline + team shared + personal (requires uid) |

Each layer is prefixed with a section header when multi-layer.

## Execution Steps

### Step 1: Parse Arguments

Extract `--scope`, `--uid`, `--category <type>` and remaining text (keyword for grep).

### Step 2: Load Specs via CLI

```bash
maestro spec load --scope <scope> [--uid <uid>] [--category <category>] [--keyword <word>]
```

If `maestro spec load` CLI is unavailable, read files directly from the resolved directory.

### Step 3: Keyword Filter (optional)

If keyword provided, grep within loaded content:
```bash
grep -n -i -C 3 "$KEYWORD" <loaded content>
```

### Step 4: Display Results

Output loaded specs content. If no specs found, show:
```
(No specs found. Run "maestro spec init --scope <scope>" to initialize.)
```
