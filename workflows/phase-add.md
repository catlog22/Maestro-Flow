# Workflow: phase-add

Add or insert a new phase into the project roadmap with automatic renumbering of subsequent phases.

## Trigger

- Manual via `/workflow:phase-add <after-phase> <slug> <title>`

## Arguments

| Arg | Description | Required |
|-----|-------------|----------|
| `<after-phase>` | Phase number after which to insert (0 = insert at beginning) | Yes |
| `<slug>` | URL-safe identifier for the phase (kebab-case) | Yes |
| `<title>` | Human-readable phase title | Yes |

## Prerequisites

- `.workflow/state.json` must exist
- `.workflow/roadmap.md` must exist
- `.workflow/phases/` directory must exist

---

## Workflow Steps

### Step 1: Parse Arguments

```
Parse $ARGUMENTS to extract:
  after_phase: integer (0 = before all, N = after phase N)
  slug: string (validate kebab-case: /^[a-z0-9]+(-[a-z0-9]+)*$/)
  title: string (remaining text after slug)

Validate:
  - after_phase is a non-negative integer
  - slug is valid kebab-case
  - title is non-empty
  If invalid: fail with usage message:
    "Usage: /workflow:phase-add <after-phase> <slug> <title>"
    "Example: /workflow:phase-add 2 caching Add caching layer"
```

### Step 2: Calculate New Phase Number

```
new_phase_number = after_phase + 1

Scan existing phases:
  Glob: .workflow/phases/*/
  Parse directory names: {NN}-{slug}
  Build list: existing_phases = [{ number, slug, dir_name, path }]
  Sort by number ascending

Check for conflicts:
  conflicting_phases = existing_phases.filter(p => p.number >= new_phase_number)
  needs_renumber = conflicting_phases.length > 0

Also validate:
  - No existing phase has the same slug
  If duplicate slug found: fail "Phase with slug '{slug}' already exists"
```

### Step 3: Renumber Existing Phases (if needed)

```
If needs_renumber:
  Process conflicting phases from HIGHEST number to LOWEST (to avoid conflicts):

  For each phase in reverse(conflicting_phases):
    old_number = phase.number
    new_number = phase.number + 1
    old_dir = .workflow/phases/{old_number padded to 2 digits}-{phase.slug}
    new_dir = .workflow/phases/{new_number padded to 2 digits}-{phase.slug}

    a. Rename directory:
       mv {old_dir} {new_dir}

    b. Update index.json inside the renamed directory:
       Read {new_dir}/index.json
       Update: phase = new_number
       Write {new_dir}/index.json

    c. Log: "Renumbered: {old_number}-{phase.slug} -> {new_number}-{phase.slug}"

  Update state.json if current_phase was renumbered:
    Read .workflow/state.json
    If current_phase >= new_phase_number:
      current_phase = current_phase + 1
    Write .workflow/state.json
```

### Step 4: Create New Phase Directory

```
phase_dir = .workflow/phases/{new_phase_number padded to 2 digits}-{slug}

Create directory: {phase_dir}/

Create {phase_dir}/index.json:
{
  "phase": {new_phase_number},
  "slug": "{slug}",
  "title": "{title}",
  "status": "pending",
  "created_at": "{ISO timestamp}",
  "updated_at": "{ISO timestamp}",
  "goal": "",
  "success_criteria": [],
  "requirements": [],
  "spec_ref": null,
  "plan": {
    "task_ids": [],
    "task_count": 0,
    "complexity": null,
    "waves": []
  },
  "execution": {
    "method": "agent",
    "started_at": null,
    "completed_at": null,
    "tasks_completed": 0,
    "tasks_total": 0,
    "current_wave": 0,
    "commits": []
  },
  "verification": {
    "status": "pending",
    "verified_at": null,
    "must_haves": {},
    "gaps": []
  },
  "validation": {
    "status": "pending",
    "test_coverage": null,
    "gaps": []
  },
  "uat": {
    "status": "pending",
    "test_count": 0,
    "passed": 0,
    "gaps": []
  },
  "reflection": {
    "rounds": 0,
    "strategy_adjustments": []
  }
}

Create subdirectories:
  {phase_dir}/.task/
  {phase_dir}/.summaries/
  {phase_dir}/.process/
```

### Step 5: Update Roadmap

```
Read .workflow/roadmap.md

Find the phase list section (look for numbered phase entries or table rows).

Insert new phase entry at the correct position:

  Format (match existing roadmap format):
    ## Phase {new_phase_number}: {title}
    - **Slug**: {slug}
    - **Status**: pending
    - **Goal**: (to be defined)

  If roadmap uses table format:
    | {new_phase_number} | {title} | {slug} | pending | - |

  Update subsequent phase numbers in the document:
    For each line referencing a phase number >= new_phase_number (excluding the new one):
      Increment the phase number by 1

Write updated roadmap.md
```

### Step 6: Update State Summary

```
Read .workflow/state.json

Update phases_summary:
  total: increment by 1
  pending: increment by 1

Write .workflow/state.json
```

### Step 7: Report

```
Display:
  Phase added successfully:
    Number: {new_phase_number}
    Slug: {slug}
    Title: {title}
    Directory: .workflow/phases/{NN}-{slug}/

  If renumbering occurred:
    Phases renumbered:
    {list of old -> new mappings}

  Next steps:
    - Define goals: Edit .workflow/phases/{NN}-{slug}/index.json
    - Update roadmap details: Edit .workflow/roadmap.md
    - Suggest: Skill({ skill: "maestro-analyze", args: "{new_phase_number} -q" }) or Skill({ skill: "maestro-plan", args: "{new_phase_number}" }) to start working on it
```

---

## Error Handling

| Error | Action |
|-------|--------|
| state.json missing | Fail: "Run /workflow:init first" |
| roadmap.md missing | Fail: "No roadmap.md found" |
| Duplicate slug | Fail: "Phase with slug '{slug}' already exists at phase {N}" |
| Invalid slug format | Fail with slug format requirements |
| after_phase > max existing | Insert at end (no renumbering needed) |
| Rename conflict | Process highest-first to avoid; fail if OS rename fails |

## Output Files

| File | Action |
|------|--------|
| `.workflow/phases/{NN}-{slug}/index.json` | Created (new phase) |
| `.workflow/phases/{NN}-{slug}/.task/` | Created (empty) |
| `.workflow/phases/{NN}-{slug}/.summaries/` | Created (empty) |
| `.workflow/phases/{NN}-{slug}/.process/` | Created (empty) |
| `.workflow/phases/{MM}-{slug}/index.json` | Updated phase number (renumbered phases) |
| `.workflow/roadmap.md` | Updated with new phase entry |
| `.workflow/state.json` | Updated phases_summary totals |

## Renumbering Example

```
Before: phases/01-setup, phases/02-auth, phases/03-api

Command: /workflow:phase-add 1 caching "Add caching layer"

Renumbering (highest first):
  03-api -> 04-api
  02-auth -> 03-auth

Create: phases/02-caching

After: phases/01-setup, phases/02-caching, phases/03-auth, phases/04-api
```
