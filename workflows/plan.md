# Plan Workflow

5-phase pipeline: Context Collection -> Clarification -> Planning -> Plan Checking -> Confirmation.

Produces two-layer plan output: `plan.json` (overview with task_ids[] and waves[]) + `.task/TASK-{NNN}.json` (individual task definitions).

---

## Prerequisites

- `.workflow/` directory initialized (`/workflow:init` completed)
- Phase directory exists at `.workflow/phases/{NN}-{slug}/` — OR `--dir` specifies a scratch directory
- `index.json` present in target directory

---

## Phase Resolution

```
Input: <phase> argument (number or slug) OR --dir <path>

IF --dir <path> is provided:
  1. Set PHASE_DIR = <path> (absolute or relative to project root)
  2. Validate directory exists and contains index.json
  3. Set SCRATCH_MODE = true (skip roadmap validation, phase transition)
  4. Set PHASE_NUM = null, PHASE_SLUG = directory basename

ELSE (standard phase resolution):
  1. If number: find .workflow/phases/{NN}-*/index.json
  2. If slug: find .workflow/phases/*-{slug}/index.json
  3. Validate phase exists and status is not "completed"
  4. Set PHASE_DIR = resolved path
  5. Set PHASE_NUM and PHASE_SLUG from directory name
  6. Set SCRATCH_MODE = false
```

---

## Flag Processing

| Flag | Effect |
|------|--------|
| `--collab` | Use collaborative multi-planner mode in P3 |
| `--spec SPEC-xxx` | Load task-spec as requirements source |
| `--auto` | Skip P2 (clarification), proceed directly to P3 |
| `--gaps` | Load verification.json gaps, skip P1 exploration, plan only gap fixes |
| `--dir <path>` | Use arbitrary directory instead of phase resolution (skip roadmap validation) |

---

## P1: Context Collection

**Purpose:** Gather all available context before planning.

### Steps

1. **Load user decisions**
   ```
   Read ${PHASE_DIR}/context.md
   -> If missing: warn "No context.md found. Run /maestro-analyze -q first or proceed with defaults."
   ```

2. **Load spec reference** (if `--spec` flag or index.json has spec_ref)
   ```
   spec_ref = --spec argument || index.json.spec_ref
   If spec_ref:
     Read .workflow/task-specs/${spec_ref}/spec-summary.md
     Read .workflow/task-specs/${spec_ref}/requirements/_index.md
     Read .workflow/task-specs/${spec_ref}/epics/_index.md
   ```

3. **Load project specs**
   ```
   specs_content = maestro spec load --category planning
   ```
   Pass to planner agent as project constraints context.

4. **Load codebase context**
   ```
   If exists .workflow/codebase/doc-index.json:
     Read doc-index.json -> extract relevant features, components, requirements
   ```

4b. **Load design reference** (if available)
   ```
   IF file exists "${PHASE_DIR}/design-ref/MASTER.md":
     designRef = read("${PHASE_DIR}/design-ref/MASTER.md")
     designTokens = read_json("${PHASE_DIR}/design-ref/design-tokens.json")
     animationTokens = read_json("${PHASE_DIR}/design-ref/animation-tokens.json") // optional
     layoutTemplates = list("${PHASE_DIR}/design-ref/layout-templates/layout-*.json")
     display "Found design reference from maestro-ui-design. Including in plan context."
     // Pass to planner: MASTER.md, tokens, animation tokens, layout templates, prototype paths
     // Ensure every UI task includes in read_first[]:
     //   - design-ref/design-tokens.json (colors, typography, component_styles)
     //   - design-ref/animation-tokens.json (transitions, keyframes)
     //   - design-ref/layout-templates/layout-{target}-*.json (relevant target layout)
     //   - design-ref/MASTER.md (overall design system reference)
   ELSE IF phase goal matches UI keywords (landing|page|dashboard|frontend|UI|component|界面):
     display "This phase has UI work but no design reference."
     display "Consider: Skill({ skill: \"maestro-ui-design\", args: \"{phase}\" })"
     // Continue without design ref — non-blocking suggestion
   ```

5. **Load upstream analysis** (if available)
   ```
   IF file exists "${PHASE_DIR}/conclusions.json":
     conclusions = read_json("${PHASE_DIR}/conclusions.json")
     IF conclusions.status is not empty:
       display "Found existing analysis from maestro-analyze. Reusing exploration context."
       explorationContext = { conclusions: conclusions }
       IF file exists "${PHASE_DIR}/explorations.json":
         explorationContext.explorations = read_json("${PHASE_DIR}/explorations.json")
       IF file exists "${PHASE_DIR}/perspectives.json":
         explorationContext.perspectives = read_json("${PHASE_DIR}/perspectives.json")

       // Extract implementation scope (from analyze Step 9 scoping)
       IF conclusions.implementation_scope is not empty:
         explorationContext.implementationScope = conclusions.implementation_scope
         display "Found implementation scope: ${conclusions.implementation_scope.length} scoped items with acceptance criteria"
         // Planner MUST use these as primary input:
         //   scope.objective → task title/description
         //   scope.acceptance_criteria → convergence.criteria (make grep-verifiable)
         //   scope.target_files → files[] + read_first[]
         //   scope.priority → task/wave ordering

       Skip step 5 (parallel exploration).
   ```

5. **Parallel exploration** (skip if `--gaps` or upstream analysis loaded)
   ```
   Determine exploration angles based on phase goal + context complexity:
     - architecture: How does this fit into existing codebase?
     - implementation: What patterns/libraries to use?
     - integration: What existing code needs modification?
     - risk: What could go wrong?

   Spawn 1-4 cli-explore-agent in parallel (based on complexity):
     Each agent:
       Input: phase goal + success_criteria + one exploration angle
       Output: .process/exploration-{angle}.json

   Write .process/explorations-manifest.json:
     { "explorations": [{ "angle": "...", "file": "...", "status": "completed" }] }

   Write .process/context-package.json:
     Aggregated exploration results for downstream consumption
   ```

6. **Gap-mode context** (if `--gaps`)
   ```
   all_gaps = []

   // Primary source: issues registry
   IF file exists ".workflow/issues/issues.jsonl":
     issues = read_ndjson(".workflow/issues/issues.jsonl")
     phase_issues = issues.filter(i => i.phase_ref == PHASE_SLUG
                                    AND i.status in ["registered", "diagnosed"])
     FOR each issue in phase_issues:
       all_gaps.push({
         issue_id: issue.id,
         description: issue.description,
         fix_direction: issue.fix_direction,
         severity: issue.severity,
         source: "issue",
         context: issue.context
       })
       Update issue in issues.jsonl: status = "planning"

   // Fallback source: verification gaps (when no issues registry)
   IF all_gaps is empty AND file exists "${PHASE_DIR}/verification.json":
     verification = read_json("${PHASE_DIR}/verification.json")
     all_gaps.extend(verification.gaps)

   // Additional source: UAT human-found gaps
   IF file exists "${PHASE_DIR}/uat.md":
     Parse uat.md "Gaps" section into structured gap objects.
     FOR each uat_gap:
       IF not already covered in all_gaps (match by test/truth):
         all_gaps.push({ ...uat_gap, source: "uat" })

   // Enrichment source: debug diagnosis (enrich existing gaps)
   FOR each debug_dir IN "${PHASE_DIR}/.debug/*/":
     IF file exists "${debug_dir}/understanding.md":
       Parse root_cause and fix_direction from understanding.md.
       Match to existing gap by affected area/test_id.
       IF matched: enrich gap with root_cause, fix_direction, affected_files.

   IF all_gaps is empty:
     Error: "--gaps mode requires issues.jsonl, verification.json, or uat.md with identified gaps."

   Set explorationContext = all_gaps (skip exploration agents)
   ```

### Output
- `.process/exploration-{angle}.json` (1-4 files, skipped if upstream analysis loaded)
- `.process/explorations-manifest.json` (skipped if upstream analysis loaded)
- `.process/context-package.json` (skipped if upstream analysis loaded)
- In-memory: explorationContext (from upstream analysis or parallel exploration)

---

## P2: Clarification (Interactive)

**Purpose:** Resolve ambiguities before planning. Skipped with `--auto` flag.

### Steps

1. **Aggregate clarification needs**
   ```
   For each exploration-{angle}.json:
     Extract clarification_needs[] field
   Deduplicate similar questions
   Sort by priority (blocking > important > nice-to-have)
   ```

2. **Interactive clarification rounds**
   ```
   While unresolved_questions > 0 AND round <= 3:
     Present max 4 questions per round via AskUserQuestion
     Record answers
     Mark questions as resolved
     Check if answers trigger follow-up questions
   ```

3. **Build clarification context**
   ```
   clarificationContext = {
     questions_asked: [...],
     answers: [...],
     decisions_made: [...]
   }
   ```

### Output
- In-memory: clarificationContext

---

## P3: Planning

**Purpose:** Generate the execution plan.

### Standard Mode (default)

```
Spawn workflow-planner Agent:
  Input:
    - context.md (user decisions)
    - spec-ref (if available)
    - doc-index.json (if available)
    - explorationContext (from P1)
    - explorationContext.implementationScope (from P1, if present)
    - clarificationContext (from P2)
    - Phase goal + success_criteria from index.json
    - Templates: @templates/plan.json, @templates/task.json

  Agent responsibilities:
    1. Decompose goal into concrete tasks
       - **When implementationScope exists**: use each scope item as primary task seed
         (1 scope item → 1 task, group only if tightly coupled)
    2. Assign task IDs (TASK-001, TASK-002, ...)
    3. Determine dependencies between tasks
    4. Group tasks into execution waves
       - **When implementationScope exists**: order by scope.priority (high first)
    5. Estimate complexity and time
    6. Set convergence.criteria (grep-verifiable) for each task
       - **When implementationScope exists**: use scope.acceptance_criteria as seed,
         then refine into grep-verifiable form
    7. Identify files to create/modify per task
       - **When implementationScope exists**: use scope.target_files as starting point
    8. Populate read_first[] for each task

  Output:
    - plan.json (summary, approach, task_ids[], task_count, complexity, waves[])
    - .task/TASK-{NNN}.json per task (using task.json template)
```

### Deep Work Rules (MANDATORY for all modes)

Every TASK-*.json MUST include these fields — they are NOT optional:

1. **`read_first`** — Files the executor MUST read before touching anything. Always include:
   - The file being modified (so executor sees current state, not assumptions)
   - Any "source of truth" file referenced in context.md (reference implementations, existing patterns, config files, schemas)
   - Any file whose patterns, signatures, types, or conventions must be replicated or respected

2. **`convergence.criteria`** — Verifiable conditions that prove the task was done correctly. Rules:
   - Every criterion must be checkable with grep, file read, test command, or CLI output
   - NEVER use subjective language ("looks correct", "properly configured", "consistent with")
   - ALWAYS include exact strings, patterns, values, or command outputs that must be present
   - Examples:
     - Code: `auth.ts contains export function verifyToken(` / `test exits 0`
     - Config: `.env.example contains DATABASE_URL=` / `Dockerfile contains HEALTHCHECK`
     - Docs: `README.md contains '## Installation'` / `API.md lists all endpoints`

3. **`action`** — Must include CONCRETE values, not references. Rules:
   - NEVER say "align X with Y", "match X to Y", "update to be consistent" without specifying the exact target state
   - ALWAYS include the actual values: config keys, function signatures, class names, import paths, etc.
   - If context.md has a comparison table or expected values, copy them into the action verbatim
   - The executor should be able to complete the task from the action + implementation text alone

4. **`implementation`** steps — Each step must contain concrete values:
   - Bad: "Update the config to match production"
   - Good: "Add DATABASE_URL=postgresql://..., set POOL_SIZE=20, add REDIS_URL=redis://..."

**Why this matters:** Executor agents work from the task JSON. Vague instructions produce shallow one-line changes. Concrete instructions produce complete work.

### Collaborative Mode (`--collab`)

```
Determine planner count (2-5 based on task scope)

Pre-allocate TASK ID ranges:
  Planner 1: TASK-001..010
  Planner 2: TASK-011..020
  (etc.)

Create plan-note.md for coordination:
  - Shared context summary
  - ID range assignments
  - Coordination rules (no overlapping files)

Spawn N workflow-collab-planner agents in parallel:
  Each agent:
    - Assigned ID range
    - Read/append plan-note.md for coordination
    - Output: .task/TASK-{NNN}.json within assigned range

Merge results:
  - Collect all task files
  - Build unified plan.json with merged waves
  - Resolve cross-planner dependencies
```

### Gap Mode (`--gaps`)

```
Skip exploration, load gaps from explorationContext (populated in P1 Step 6):
  For each gap:
    Create TASK-{NNN}.json with:
      type: "fix"
      description: gap.description
      action: gap.fix_direction (with concrete values, not vague references)
      read_first: [affected files from gap context]
      convergence.criteria: [grep-verifiable conditions derived from gap description]
      issue_id: gap.issue_id (if source == "issue", else null)

  Link tasks to issues (bidirectional):
    For each created TASK-{NNN}.json that has issue_id:
      Update corresponding issue in .workflow/issues/issues.jsonl:
        status: "planned"
        updated_at: now()
      Display: "TASK-{NNN} <-> {issue_id}"

Build plan.json with gap-fix tasks
```

### Output
- `plan.json` in PHASE_DIR
- `.task/TASK-{NNN}.json` files in PHASE_DIR/.task/
- `plan-note.md` (collab mode only)

---

## P4: Plan Checking

**Purpose:** Verify plan quality before execution.

### Steps

1. **Spawn workflow-plan-checker agent**
   ```
   Input: plan.json + all .task/TASK-*.json + index.json (success_criteria)

   Check dimensions:
     - Requirements coverage: Every success_criterion maps to at least one task
     - Feasibility: Files referenced exist or can be created
     - Dependency correctness: No circular deps, deps exist, wave ordering valid
     - Convergence criteria quality: Each task has grep-verifiable convergence.criteria (no subjective language)
     - read_first completeness: Every task has read_first[] with at least the file being modified
     - Action concreteness: No vague "align X with Y" — every action has exact values
     - Wave structure: Parallel tasks have no conflicting file modifications
     - Completeness: No orphan tasks (not in any wave)
   ```

2. **Revision loop** (max 3 rounds)
   ```
   While issues_found AND round <= 3:
     checker returns issues[] with severity + fix_suggestion
     If critical issues:
       Re-spawn workflow-planner with issues as additional input
       Planner revises plan.json + affected .task/ files
       Re-check
     If only warnings:
       Log warnings, proceed
   ```

3. **Update index.json**
   ```
   index.json.plan = {
     task_ids: [extracted from plan.json],
     task_count: plan.json.task_count,
     complexity: plan.json.complexity,
     waves: plan.json.waves,
     executor_assignments: {}  # populated by user override or auto-assignment in P5
   }
   index.json.status = "planning"
   index.json.updated_at = now()
   ```

### Output
- Updated plan.json (if revised)
- Updated .task/ files (if revised)
- Updated index.json with plan fields

---

## P5: Confirmation

**Purpose:** Present plan to user and determine next action.

### Steps

1. **Display plan summary**
   ```
   Show:
     - Plan summary and approach
     - Task count and wave structure
     - Complexity estimate
     - Key dependencies
   ```

2. **Present options via AskUserQuestion** (skip if `config.gates.confirm_plan == false`, auto-proceed to Execute)
   ```
   "Plan ready ({task_count} tasks in {wave_count} waves). What next?"

   Options:
     1. Execute now       -> Build executionContext, hand off to /workflow:execute
     2. Verify plan quality -> Re-run P4 with stricter checks
     3. Just view          -> Display full plan details, exit
     4. Modify             -> Open specific task for editing, return to P4
   ```

3. **executionContext handoff** (if "Execute now")
   ```
   executionMethod = config.json.execution.method || "agent"
   defaultExecutor = config.json.execution.default_executor || "gemini"
   executorAssignments = index.json.plan.executor_assignments || {}

   executionContext = {
     planObject: {
       plan: plan.json contents,
       tasks: { "TASK-001": task-001.json, ... }
     },
     explorations: [ exploration-*.json contents ],
     clarifications: clarificationContext,
     executionMethod: executionMethod,
     defaultExecutor: defaultExecutor,
     executorAssignments: executorAssignments,
     phaseIndex: index.json contents,
     specRef: spec-ref contents (if loaded)
   }

   Hand off to /workflow:execute with executionContext in memory
   ```

---

## Error Handling

| Error | Action |
|-------|--------|
| Phase directory not found | Abort with message: "Phase {phase} not found. Run /workflow:init first." |
| No context.md | Warn, proceed with exploration only |
| Exploration agent fails | Log error, continue with available explorations |
| Planner produces invalid JSON | Retry once, then abort with error details |
| Plan-checker exceeds 3 rounds | Accept plan with warnings, note in index.json |
| User cancels clarification | Proceed with available context |

---

## State Updates

| When | Field | Value |
|------|-------|-------|
| P1 start | index.json.status | "planning" |
| P3 complete | index.json.plan.* | Plan metadata |
| P4 pass | index.json.updated_at | Current timestamp |
| P5 "Execute now" | (handoff, no write) | executionContext in memory |
