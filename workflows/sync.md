# Workflow: sync

Change detection, impact chain traversal, and codebase documentation synchronization.

## Trigger

- Auto-triggered after `/workflow:execute` completes
- Manual via `/workflow:sync [--since <ref>] [--dry-run]`

## Arguments

| Arg | Description | Default |
|-----|-------------|---------|
| `--full` | Complete resync of all tracked files (ignores git diff, rebuilds all docs) | `false` |
| `--since <ref>` | Git ref for diff baseline (commit hash, `HEAD~N`, branch) | `HEAD~1` |
| `--dry-run` | Show impact analysis without writing changes | `false` |

## Prerequisites

- `.workflow/codebase/doc-index.json` must exist (run `/workflow:codebase rebuild` first if missing)
- Git repository initialized with at least one commit

---

## Workflow Steps

### Step 1: Parse Input and Validate

```
Parse $ARGUMENTS for flags:
  --full = complete resync mode (process all tracked files)
  --since <ref> = diff since specific commit or ref
  --dry-run = preview mode, no writes
  No flags = incremental sync since last tracked sync point

Verify .workflow/ directory exists.
  If not initialized: abort with E001.
```

### Step 2: Detect Changed Files

```
If --full flag:
  Collect all files tracked in doc-index.json code_locations as changed_files[]

Else:
  Run: git diff --name-only <since-ref>
    If --since not provided: git diff --name-only HEAD~1
    If no prior commit: git diff --name-only --cached

  Output: changed_files[] — list of file paths that changed

If no files changed: emit W001 ("No changes detected") and exit.
```

### Step 3: Load Doc Index

```
Read: .workflow/codebase/doc-index.json

Extract:
  - components[] (with code_locations, feature_ids, symbols)
  - features[] (with component_ids, requirement_ids)
  - requirements[]
  - architecture_decisions[]
```

### Step 4: Impact Chain Traversal

For each `changed_file` in `changed_files[]`:

```
a. Find matching components:
   Filter components where code_locations[] contains changed_file
   (use path matching — file may be relative or absolute)

b. From components -> find features:
   For each matched component:
     Collect feature_ids from the component entry
     OR: Find features where component_ids[] contains the component.id

c. From features -> find requirements:
   For each matched feature:
     Collect requirement_ids from the feature entry
     OR: Find requirements where feature_id matches

d. Aggregate all affected:
   affected = {
     files: [changed_file],
     components: [unique component entries],
     features: [unique feature entries],
     requirements: [unique requirement entries]
   }
```

Deduplicate across all changed files to build the total impact set.

### Step 5: Update Doc Index (skip if --dry-run)

```
For each affected component in doc-index.json:
  Update last_updated timestamp
  Re-scan code_locations to refresh symbols[] if the component's files changed
    - Read each code_location file
    - Extract exported symbols (classes, functions, interfaces, types, constants)
    - Update symbols[] array

For each affected feature in doc-index.json:
  Update last_updated timestamp
  Update status if needed (based on component changes)

Write updated doc-index.json
```

### Step 6: Regenerate Affected Docs (skip if --dry-run)

```
For each affected component:
  Regenerate .workflow/codebase/tech-registry/{component-slug}.md
  Content template:
    # {component.name}
    - **ID**: {component.id}
    - **Type**: {component.type}
    - **Code Locations**: {code_locations joined}
    - **Features**: {feature_ids joined}
    ## Symbols
    {symbols as bullet list}
    ## Last Updated
    {timestamp}

For each affected feature:
  Regenerate .workflow/codebase/feature-maps/{feature-slug}.md
  Content template:
    # {feature.name}
    - **ID**: {feature.id}
    - **Status**: {feature.status}
    - **Phase**: {feature.phase}
    - **Components**: {component_ids joined}
    - **Requirements**: {requirement_ids joined}
    ## Component Details
    {for each component: name, type, key symbols}
    ## Last Updated
    {timestamp}
```

### Step 7: Update State and Specs (skip if --dry-run)

```
Update state.json:
  - Set last_sync timestamp to current time
  - Record change summary (files changed, components/features affected)
  - Update last_updated timestamp

Update index.json:
  - For each affected phase (if phase-scoped files changed), update the phase index

Check if changes warrant spec updates:
  - If patterns or conventions changed: append learnings to relevant spec files
  - If new architectural patterns emerged: note in appropriate spec
  - Skip if no spec-relevant changes detected

Check if dependency manifests changed (project.md Tech Stack refresh):
  dependency_files = ["package.json", "go.mod", "pyproject.toml", "Cargo.toml",
                      "requirements.txt", "pom.xml", "build.gradle", "Gemfile"]
  changed_deps = changed_files.filter(f => dependency_files.includes(basename(f)))
  If changed_deps.length > 0 AND .workflow/project.md exists:
    Re-scan dependency manifests for current tech stack
    Update .workflow/project.md Tech Stack section with detected changes
    Display: "project.md: Tech Stack refreshed from {changed_deps.join(', ')}"
```

### Step 8: Create Action Log

```
Determine action hash:
  git rev-parse --short HEAD (or use the since-ref hash)

Write .workflow/codebase/action-logs/{hash}.md:

  # Changes in {hash}

  **Date**: {ISO timestamp}
  **Sync Baseline**: {since-ref}

  ## Files Changed
  {bullet list of changed_files}

  ## Components Affected
  {bullet list: component.id - component.name (component.type)}

  ## Features Affected
  {bullet list: feature.id - feature.name}

  ## Requirements Affected
  {bullet list: requirement.id - requirement.title}

  ## Impact Summary
  - Files changed: {count}
  - Components affected: {count}
  - Features affected: {count}
  - Requirements affected: {count}
```

### Step 9: Report

Display summary to user:

```
Sync complete:
  Changed files: N
  Components affected: N (list IDs)
  Features affected: N (list IDs)
  Requirements affected: N (list IDs)
  Specs updated: {list or "none"}
  Action log: .workflow/codebase/action-logs/{hash}.md
  If --dry-run: note that no changes were written
```

---

## Error Handling

| Code | Meaning |
|------|---------|
| E001 | .workflow/ not initialized — suggest running Skill({ skill: "maestro-init" }) first |
| W001 | No changes detected since last sync — report clean state, skip updates |

| Error | Action |
|-------|--------|
| .workflow/ missing | Fail with E001 |
| doc-index.json missing | Suggest `/workflow:codebase rebuild` |
| No git repo | Fail with message: "Git repository required for sync" |
| Changed file not in any component | Log as "untracked file" in action log (no impact chain) |
| doc-index.json parse error | Fail with error details |

## Output Files

| File | Action |
|------|--------|
| `.workflow/codebase/doc-index.json` | Updated (timestamps, symbols) |
| `.workflow/codebase/tech-registry/{slug}.md` | Regenerated for affected components |
| `.workflow/codebase/feature-maps/{slug}.md` | Regenerated for affected features |
| `.workflow/codebase/action-logs/{hash}.md` | Created |
| `.workflow/project.md` | Tech Stack section updated if dependency manifests changed |
