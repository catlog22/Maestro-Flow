# Workflow: specs-load

Load and display relevant spec files, optionally filtered by category and/or keyword.

## Arguments

```
$ARGUMENTS: "[--category <type>] [--required-only] [keyword]"

--category       -- optional filter by frontmatter category:
                    general | exploration | planning | execution | debug | test | review | validation | all
--required-only  -- only load specs with readMode: required in frontmatter
keyword          -- optional search term (matched against frontmatter keywords[] and content)
```

## Category-to-File Mapping

Categories map to spec files via frontmatter `category` field:

| Category | Files loaded | Typical consumers |
|----------|-------------|-------------------|
| `general` | `learnings.md` | All workflows (always included as fallback) |
| `exploration` | _(reserved for future use)_ | brainstorm, analyze |
| `planning` | `architecture-constraints.md` | plan, analyze |
| `execution` | `coding-conventions.md`, `quality-rules.md` | execute, plan, quick, refactor |
| `debug` | `debug-notes.md` | debug |
| `test` | `test-conventions.md` | test-gen, integration-test |
| `review` | `review-standards.md` | review |
| `validation` | `validation-rules.md` | verify |
| `all` (default) | All spec files | spec-load with no filter |

**Note:** `general` category specs are always included regardless of filter (see `spec-loader.ts` filter logic).

## Prerequisites

- `.workflow/specs/` directory must exist with spec files

## Search Targets

```
.workflow/specs/coding-conventions.md      (category: execution)
.workflow/specs/architecture-constraints.md (category: planning)
.workflow/specs/learnings.md               (category: general)
.workflow/specs/quality-rules.md           (category: execution)
.workflow/specs/debug-notes.md             (category: debug)
.workflow/specs/test-conventions.md        (category: test)
.workflow/specs/review-standards.md        (category: review)
.workflow/specs/validation-rules.md        (category: validation)
```

## Execution Steps

### Step 1: Parse Arguments

```
Parse $ARGUMENTS:
  --category <type>  -> category filter (general|exploration|planning|execution|debug|test|review|validation|all)
  remaining text     -> keyword for search filtering

Examples:
  ""                          -> category=all, keyword=none
  "--category execution"      -> category=execution, keyword=none
  "error handling"            -> category=all, keyword="error handling"
  "--category test mock"      -> category=test, keyword="mock"
  "--category debug"          -> category=debug, keyword=none
```

### Step 2: Detect Context and Verify Specs

Determine what phase/task is currently active to provide context-aware loading.

```bash
# Check for active phase
cat .workflow/state.json 2>/dev/null | grep -o '"current_phase":[^,}]*'

# Check specs directory exists
ls .workflow/specs/ 2>/dev/null || echo "E001"
```

If `.workflow/specs/` not initialized -> abort with E001.

### Step 3: Load and Filter Specs

**Frontmatter-based filtering (preferred):**

Use `maestro spec load` CLI for programmatic access:
```bash
# By category (uses frontmatter category field)
maestro spec load --category planning
maestro spec load --category execution

# By keywords (matched against frontmatter keywords[])
maestro spec load --keywords "style,naming"

# Required specs only
maestro spec load --category planning   # readMode: required specs loaded by default
```

**Fallback file resolution** (when `maestro spec load` CLI is unavailable):
```bash
# Scan all .md files in specs/, filter by frontmatter category field
FILES=""
for f in .workflow/specs/*.md; do
  file_category=$(head -10 "$f" | grep "^category:" | awk '{print $2}')
  if [ "$CATEGORY" = "all" ] || [ "$file_category" = "$CATEGORY" ] || [ "$file_category" = "general" ]; then
    FILES="$FILES $f"
  fi
done
```

**If keyword provided:** Match against frontmatter `keywords[]` first, then fall back to content search.
```bash
# Programmatic: maestro spec load --keywords "$KEYWORD"
# Fallback: grep -n -i -C 3 "$KEYWORD" $FILES
```

**If --required-only:** Filter to specs with `readMode: required` in frontmatter.

**If no keyword:** Read and display full contents of resolved files.

If keyword provided but no matches found -> warn W001.

### Step 4: Rank Results

```
Ranking criteria (highest to lowest):
  1. Exact match   -- keyword appears as a standalone word
  2. Partial match  -- keyword appears as substring of a word
  3. Related match  -- keyword appears in the section heading only

Sort results by rank, then by priority (frontmatter):
  critical > high > medium > low
```

### Step 5: Display Results

**Output format (no keyword):**
```
== specs-load: [category] ==
--- .workflow/specs/coding-conventions.md ---
[full content]

--- .workflow/specs/architecture-constraints.md ---
[full content]
...
```

**Output format (with keyword):**
```
== specs-load: "[keyword]" in [category] ==
Results (ranked by relevance):

1. .workflow/specs/coding-conventions.md:42
   [matched section with context]

2. .workflow/specs/learnings.md:15
   [matched section with context]

Total: N matches across M files
```

If no matches found:
```
No matches found for "{keyword}".

Related headings in spec files:
- {heading_1} (coding-conventions.md)
- {heading_2} (architecture-constraints.md)
- ...
```

## Output

Formatted search results with file:line references and context.
