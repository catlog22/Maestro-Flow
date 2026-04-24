---
name: maestro-update
description: Interactive workflow migration — detect version, preview changes, apply upgrades
argument-hint: "[--dry-run] [--force]"
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
Detect the current `.workflow/` schema version, show available migrations, and interactively apply them. Uses a migration registry that supports incremental version upgrades (e.g., 1.0 → 2.0 → 3.0).

Each migration step is previewed before execution. The user confirms each step individually.
</purpose>

<context>
$ARGUMENTS — optional flags.

**Flags:**
- `--dry-run` -- Preview migration plan without executing
- `--force` -- Skip confirmation prompts (apply all pending migrations)

**Migration registry:** `src/utils/migration-registry.ts`
- Migrations are registered as `{ from, to, name, description, migrate }` objects
- Registry auto-chains: detects current version → walks chain → applies in order
- New migrations added by registering in the module or importing additional migration files

**State version source:** `.workflow/state.json` → `version` field
</context>

<execution>

### Step 1: Detect Current State

```
1. Read .workflow/state.json
2. Extract version field (default "1.0" if missing)
3. Display current state:

   === Maestro Workflow Update ===
   Project:  {project_name}
   Version:  {version}
   Location: {.workflow/ path}
```

### Step 2: Plan Migrations

```
1. Load migration registry (known migrations from state-schema)
2. Build migration chain from current version
3. If no pending migrations:
   Display: "✓ Already up to date (v{version})"
   → EXIT

4. Display migration plan:

   Pending Migrations:
   ┌─────┬────────┬────────────────────────────────────┐
   │ #   │ Target │ Name                               │
   ├─────┼────────┼────────────────────────────────────┤
   │ 1   │ v2.0   │ state-v2-artifact-registry          │
   └─────┴────────┴────────────────────────────────────┘

   For each step, display description (indented).
```

### Step 3: Interactive Confirmation Loop

For each migration step (unless `--force`):

```
1. Display step details:

   --- Migration 1: state-v2-artifact-registry ---
   From: v1.0 → v2.0

   Changes:
     - Add artifacts[] registry (harvest from phases/ if present)
     - Add milestones[].id and milestones[].status
     - Add current_task_id
     - Remove current_phase (derived from artifacts)
     - Remove phases_summary (derived from artifacts)
     - Normalize status enum

2. Ask user: "Apply this migration? (yes/skip/abort)"
   - yes   → execute migration, show result, continue to next
   - skip  → skip this step (WARNING: may break chain), continue
   - abort → stop all migrations, exit

3. If --dry-run: show what would change but don't execute
```

### Step 4: Execute Migration

```
1. Create backup: copy state.json → state.json.backup-{version}-{timestamp}
2. Execute migration function
3. Display result:

   ✓ Migration 1 completed: state-v2-artifact-registry
   Summary: Migrated to v2.0 (4 artifacts registered)
   Changes:
     - Remove current_phase: 2
     - Remove phases_summary
     - Normalize status: "phase_2_pending" → "active"
     - Harvested 4 artifacts from legacy phases/
     - milestones enriched: M1(MVP), M2(Production)
     - Version bumped: 1.0 → 2.0

4. Continue to next step
```

### Step 5: Summary

```
=== Migration Complete ===
Applied: {N} migration(s)
Version: {old} → {new}
Backup:  state.json.backup-{version}-{timestamp}

Next steps:
  /manage-status  -- Verify project state
  /maestro        -- Continue workflow
```

</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | .workflow/state.json not found | Run /maestro-init first |
| E002 | error | state.json parse error | Check file for corruption |
| E003 | error | Migration function failed | Restore from backup |
| W001 | warning | Skipped migration may break version chain | Consider running skipped migration later |
</error_codes>

<success_criteria>
- [ ] Current version detected from state.json
- [ ] Migration plan displayed with all pending steps
- [ ] Each step confirmed interactively (unless --force)
- [ ] Backup created before each migration
- [ ] Migration executed and result displayed
- [ ] Summary with version change and next steps
</success_criteria>
