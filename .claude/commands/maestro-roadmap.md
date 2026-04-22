---
name: maestro-roadmap
description: Interactive roadmap creation with iterative refinement — lightweight alternative to spec-generate
argument-hint: "<requirement> [-y] [-c] [-m progressive|direct|auto] [--from-brainstorm SESSION-ID] [--revise [instructions]] [--review]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
<purpose>
Create or revise a project roadmap through interactive requirement decomposition and iterative refinement. This is the lightweight path for structured decomposition — directly from requirements to roadmap without full specification documents. For the heavy path with formal specs, use maestro-spec-generate instead.

Supports three modes:
- **Create** (default): Build roadmap from requirements
- **Revise** (`--revise`): Modify existing roadmap while preserving completed phase progress
- **Review** (`--review`): Health assessment of current roadmap — actual vs planned, drift detection, adjustment recommendations (read-only)

Produces `.workflow/roadmap.md` with milestone/phase structure ready for maestro-plan.
</purpose>

<required_reading>
@~/.maestro/workflows/roadmap.md
@~/.maestro/templates/roadmap.md
</required_reading>

<context>
$ARGUMENTS -- requirement text, @file reference, or brainstorm session reference.

**Flags:**
- `-y` / `--yes`: Auto mode — skip interactive questions, use recommended defaults
- `-c` / `--continue`: Resume from last checkpoint
- `-m progressive|direct|auto`: Decomposition strategy (default: auto)
- `--from-brainstorm SESSION-ID`: Import guidance-specification.md from a brainstorm session as seed
- `--revise [instructions]`: Revise existing roadmap. If instructions provided, apply directly (e.g. `--revise "add phase 4 for perf optimization"` or `--revise "split phase 2 into 2a and 2b"`). If omitted, ask user for revision instructions via AskUserQuestion. Preserves completed phase progress.
- `--review`: Roadmap health assessment — compare actual vs planned progress, detect drift, assess remaining phases (read-only, produces review report)

**Input types:**
- Direct text: `"Implement user authentication system with OAuth and 2FA"`
- File reference: `@requirements.md`
- Brainstorm import: `--from-brainstorm WFS-xxx`
- No args + `--revise` / `--review`: Operate on existing `.workflow/roadmap.md`

**Relationship to pipeline:**
```
maestro-brainstorm (optional upstream)
        ↓ guidance-specification.md
maestro-init (project setup — no roadmap)
        ↓ project.md, state.json, config.json
maestro-roadmap (this command — light path)
        ↓ roadmap.md → .workflow/roadmap.md
maestro-plan → maestro-execute → maestro-verify

Alternative heavy path (skip maestro-roadmap):
maestro-init → maestro-spec-generate → spec package + roadmap.md
```

**Dual modes:**
| Mode | Strategy | Best For |
|------|----------|----------|
| Progressive | MVP → Usable → Refined (as **Milestones**, each with 1-2 phases) | High uncertainty, need validation |
| Direct | Topological task sequence (1-2 phases, wave DAG handles ordering) | Clear requirements, confirmed tech |

Auto-selection: ≥3 high uncertainty factors → Progressive, ≥3 low → Direct, else → ask user.

**Minimum-phase principle:** Default 1 phase per milestone. Only split into 2 phases when hard dependency exists (runtime + not parallelizable + full barrier). Max 2 phases, exceptional 3 with justification.
</context>

<execution>

### Mode: Create (default)

Follow '~/.maestro/workflows/roadmap.md' completely.

**Next-step routing on completion:**
- Roadmap approved → /maestro-analyze 1
- Simple project, skip analysis → /maestro-plan 1
- Need UI design first → /maestro-ui-design 1
- View project dashboard → /manage-status

### Mode: Revise (`--revise [instructions]`)

Revise an existing roadmap while preserving completed phase progress.

**Pre-conditions:**
- `.workflow/roadmap.md` exists
- `.workflow/state.json` exists (for progress tracking)

**Execution flow:**

1. **Load current state**
   - Read `.workflow/roadmap.md` — parse milestones, phases, dependencies, progress markers
   - Read `.workflow/state.json` — get artifact registry, current milestone
   - Identify completed vs in-progress vs pending phases

2. **Obtain revision instructions**
   - If `--revise "instructions text"` provided → use directly as change directive
   - If `--revise` without instructions → use AskUserQuestion to ask user what to change
     - Show current roadmap summary with phase statuses
     - Present options: add/remove/reorder phases, modify scope/criteria/deps, move between milestones
     - Capture change instructions from response

3. **Impact analysis**
   - For each proposed change, assess impact on:
     - Phase dependency chain (re-validate no circular deps)
     - Requirement coverage (every Active requirement still mapped)
     - Completed phases (warn if change invalidates completed work)
     - Existing plan artifacts (warn if plan exists for affected phase)
   - Present impact summary for confirmation

4. **Apply revisions**
   - Update `.workflow/roadmap.md` preserving:
     - Completed phase progress markers (✓, completion dates)
     - Phase numbering for completed phases (renumber only pending phases)
     - Cross-references from state.json artifacts
   - Update `state.json` if milestone structure changed
   - Add revision log entry to roadmap.md metadata section

5. **Post-revision validation**
   - Re-check dependency integrity (no circular deps)
   - Re-check requirement coverage (every Active req mapped)
   - Verify completed phases unaffected

**Next-step routing on completion:**
- Phases changed, need re-analysis → `/maestro-analyze {phase}`
- Phases changed, ready to plan → `/maestro-plan {phase}`
- Only pending phases adjusted → `/maestro-plan` (continue from where left off)

### Mode: Review (`--review`)

Read-only health assessment of the current roadmap.

**Pre-conditions:**
- `.workflow/roadmap.md` exists

**Execution flow:**

1. **Load roadmap + execution history**
   - Read `.workflow/roadmap.md` — full structure
   - Read `.workflow/state.json` — artifact registry, milestone progress
   - Cross-reference: for each phase, check ANL/PLN/EXC/VRF artifact status

2. **Assessment dimensions**
   - **Progress tracking**: Actual vs planned per phase, milestone velocity
   - **Drift detection**: Completed phases deviating from original scope (via verify/audit findings)
   - **Relevance check**: Pending phases still aligned with current project goals (from project.md)
   - **Dependency health**: Pending phase dependencies still valid given completed work
   - **Risk assessment**: Identify phases at risk (blocked, scope creep, dependency failures)

3. **Produce review report**
   - Write to `.workflow/scratch/roadmap-review-{date}.md`
   - Format:
     ```
     === ROADMAP REVIEW ===
     Date: {date}
     Milestone: {current}

     Progress: {completed}/{total} phases ({percentage}%)
     Drift: {none|minor|significant}
     Risk: {low|medium|high}

     Phase Assessment:
       [✓] Phase 1: {name} — completed, on-scope
       [~] Phase 2: {name} — in-progress, {status notes}
       [ ] Phase 3: {name} — pending, {risk/notes}

     Recommendations:
       1. {actionable recommendation}
       2. ...

     Suggested actions:
       /maestro-roadmap --revise   — Apply recommended changes
       /maestro-plan {phase}       — Plan next phase
       /manage-status              — View full dashboard
     ```

**No state modifications.** Pure assessment + recommendations.
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Requirement text or @file required | Prompt user for input |
| E002 | error | Brainstorm session not found (--from-brainstorm) | Show available sessions |
| E003 | error | Circular dependency detected in phases | Prompt user to re-decompose |
| E004 | error | roadmap.md not found (--revise/--review) | Run maestro-roadmap first |
| E005 | error | Revision invalidates completed phase work | Warn user, ask to confirm or adjust |
| W001 | warning | CLI analysis failed, using fallback | Continue with available data |
| W002 | warning | Max refinement rounds (5) reached | Force proceed with current roadmap |
| W005 | warning | External research agent failed | Continue without apiResearchContext |
</error_codes>

<success_criteria>
- [ ] Requirement parsed with goal, constraints, stakeholders
- [ ] Decomposition strategy selected (progressive or direct)
- [ ] Phases defined with success criteria, dependencies, and requirement mappings
- [ ] Every Active requirement from project.md mapped to exactly one phase
- [ ] No circular dependencies in phase ordering
- [ ] User approved roadmap (or auto-approved with -y)
- [ ] `.workflow/roadmap.md` written with phase details, scope decisions, and progress table
- [ ] No phase directories created (phases are labels in roadmap, not directories)
</success_criteria>
