---
name: maestro
description: Intelligent coordinator - analyze intent + read project state → select optimal skill chain → execute sequentially with artifact propagation.
argument-hint: "\"intent text\" [-y] [-c] [--dry-run] [--chain <name>]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# Maestro Coordinator

Orchestrate all maestro skills based on user intent and current project state.
Two routing modes:
1. **Intent-based**: User describes a goal → classify → select/compose chain → confirm → execute
2. **State-based**: Read `.workflow/state.json` → determine next logical step → execute (triggered by `continue`/`next`)

Produces session directory at `.workflow/.maestro/{session_id}/` with status.json tracking chain progress.

## Usage

```bash
$maestro "build authentication system"
$maestro -y "continue"
$maestro -c                              # resume last session
$maestro --chain full-lifecycle "e-commerce platform"
$maestro --dry-run "refactor auth module"
```

## Arguments & Flags

- `$ARGUMENTS` — user intent text, or special keywords
- **Special keywords**: `continue`/`next`/`go` (state-based), `status` (shortcut to `manage-status`)
- `-y` / `--yes` — Auto mode: skip clarification, skip confirmation, auto-skip on errors. Propagates to downstream skills.
- `-c` / `--continue` — Resume previous session from `.workflow/.maestro/*/status.json`
- `--dry-run` — Show planned chain without executing
- `--chain <name>` — Force a specific chain (bypass intent detection)

**State files read**: `.workflow/state.json`, `.workflow/roadmap.md`, `.workflow/phases/*/index.json`

---

## Step 1: Parse Arguments & Detect Mode

```javascript
const autoYes = /\b(-y|--yes)\b/.test($ARGUMENTS)
const resumeMode = /\b(-c|--continue)\b/.test($ARGUMENTS)
const dryRun = /\b--dry-run\b/.test($ARGUMENTS)
const forcedChain = $ARGUMENTS.match(/--chain\s+(\S+)/)?.[1] || null
const intent = $ARGUMENTS
  .replace(/\b(-y|--yes|-c|--continue|--dry-run)\b/g, '')
  .replace(/--chain\s+\S+/g, '')
  .trim()
```

**If resumeMode:**
1. Scan `.workflow/.maestro/` for latest session
2. Read `status.json` → find last completed step, remaining steps
3. If no session found: **Error E004**
4. Jump to **Step 6** at resume point

**Display banner:**
```
============================================================
  MAESTRO COORDINATOR
============================================================
  Mode:  {intent-based | state-based | resume}
  Auto:  {yes | no}
  Input: {intent or "continue"}
```

---

## Step 2: Read Project State

**If `.workflow/state.json` exists:**
1. Read → extract `current_milestone`, `current_phase`, `status`, `phases_summary`
2. Read `.workflow/roadmap.md` → extract phase list
3. Read `.workflow/phases/{NN}-{slug}/index.json` for current phase
4. Build `$PROJECT_STATE`:
   ```json
   {
     "initialized": true,
     "current_phase": 1, "phase_slug": "auth-system", "phase_title": "Authentication System",
     "phase_status": "pending|exploring|planning|executing|verifying|testing|completed|blocked",
     "phase_artifacts": { "brainstorm": false, "analysis": false, "context": false, "plan": false, "verification": false, "uat": false },
     "execution": { "tasks_completed": 0, "tasks_total": 0 },
     "verification_status": "pending", "uat_status": "pending",
     "phases_total": 3, "phases_completed": 0,
     "has_blockers": false, "review_verdict": null
   }
   ```

**If missing:** `$PROJECT_STATE = { initialized: false }`. If intent also empty: **Error E001**.

---

## Step 3: Analyze Intent

**If `$FORCED_CHAIN` set:** validate against known chains, jump to Step 5.

**Pattern matching (priority order, first match wins):**

```javascript
const patterns = [
  // Special keywords
  ['state_continue',    /^(continue|next|go)$/i],
  ['status',            /^(status|dashboard)$/i],

  // Pre-execution pipeline
  ['spec_generate',     /spec.*(generat|creat|build|write|produce)|from.*idea.*to.*spec|PRD/i],
  ['brainstorm',        /brainstorm|ideate|explore.*idea/i],
  ['analyze',           /analy[sz]e|feasib|evaluat|assess|discuss|clarif|decid|gray.*area/i],
  ['ui_design',         /ui.*design|design.*ui|landing.*page|prototype.*style|design.*variant/i],
  ['init',              /init|setup.*project|start.*project|onboard/i],
  ['plan',              /plan(?!.*gap)|design.*plan|break.*down/i],
  ['roadmap',           /roadmap|create.*roadmap/i],

  // Execution pipeline
  ['execute',           /execute|implement|build|develop|code/i],
  ['verify',            /verif[iy]|check.*goal|validate.*result/i],

  // Quality pipeline
  ['review',            /\breview.*code|code.*review|review.*quality/i],
  ['test_gen',          /test.*gen|generat.*test|add.*test/i],
  ['test',              /\btest|uat|user.*accept/i],
  ['debug',             /debug|diagnos|troubleshoot|fix.*bug/i],
  ['integration_test',  /integrat.*test|e2e.*cycle/i],
  ['refactor',          /refactor|clean.*up|tech.*debt/i],
  ['sync',              /sync.*doc|refresh.*doc|update.*doc/i],

  // Phase/milestone lifecycle
  ['phase_transition',    /phase.*transit|next.*phase|advance.*phase/i],
  ['phase_add',           /phase.*add|insert.*phase|new.*phase|add.*phase/i],
  ['milestone_audit',     /milestone.*audit|cross.*phase.*check/i],
  ['milestone_complete',  /milestone.*compl|finish.*milestone/i],

  // Issue management (granular first, then generic)
  ['issue_analyze',     /analyze.*issue|issue.*analyze|issue.*root.*cause/i],
  ['issue_plan',        /plan.*issue|issue.*plan|issue.*solution/i],
  ['issue_execute',     /execute.*issue|issue.*execute|run.*issue/i],
  ['issue_discover',    /discover.*issue|scan.*issue/i],
  ['issue',             /issue|gap.*track|issue.*manage/i],

  // Maintenance operations
  ['codebase_rebuild',  /codebase.*rebuild|full.*rebuild/i],
  ['codebase_refresh',  /codebase.*refresh|incr.*refresh/i],
  ['spec_setup',        /spec.*setup|scan.*convention/i],
  ['spec_add',          /spec.*add|add.*(bug|pattern|decision|rule)/i],
  ['spec_load',         /spec.*load|load.*spec/i],
  ['spec_map',          /spec.*map|map.*codebase/i],
  ['memory_capture',    /memory.*captur|save.*memory|compact/i],
  ['memory',            /memory|manage.*mem/i],

  // Team skills
  ['team_lifecycle',    /team.*lifecycle|team.*session/i],
  ['team_coordinate',   /team.*coordinat|team.*dynamic.*role/i],
  ['team_design',       /team.*design(?!.*ui)|design.*team.*skill/i],
  ['team_execute',      /team.*exec(?!ute\b)|resume.*team.*session/i],
  ['team_qa',           /team.*(qa|quality.*assur)/i],
  ['team_test',         /team.*test/i],
  ['team_review',       /team.*review/i],
  ['team_tech_debt',    /team.*tech.*debt|team.*debt/i],

  // Quick task (lowest priority)
  ['quick',             /quick|small.*task|ad.?hoc|just.*do/i],
];
```

**Unmatched → `auto_detect`**: short intent (< 15 words) → `quick`; references lifecycle → `execute`; default → `quick`.

**Compute clarity_score**: 3 (verb+object+scope), 2 (verb+object), 1 (vague), 0 (empty).

```
  Intent Analysis:
    Type:       {task_type}
    Clarity:    {clarity_score}/3
    Complexity: {simple|moderate|complex}
    Phase ref:  {N or "none"}
```

---

## Step 4: Clarify (if clarity_score < 2)

**Skip if auto mode (`-y`).**

**clarity_score == 0:**
- AskUserQuestion: "I couldn't understand your request. What would you like to do?"
- Options: "Start a new project" → init, "Continue working" → state_continue, "Run a quick task" → quick, "Check status" → status, "Let me rephrase" → re-run Step 3

**clarity_score == 1:**
- AskUserQuestion: "I think you want to {inferred_action}. Is that right?"
- Options: "Yes, proceed", "{alternative_1}", "{alternative_2}", "Let me rephrase"

Max 2 rounds. Still unclear: **Error E002**.

---

## Step 5: Select Chain & Confirm

### 5a: State-Based Routing (task_type == `state_continue`)

```javascript
function detectNextAction(state) {
  if (!state.initialized) return { chain: 'init', steps: ['maestro-init'] };
  if (state.phases_total === 0) return { chain: 'brainstorm-driven', steps: ['maestro-brainstorm', 'maestro-plan', 'maestro-execute', 'maestro-verify'] };

  const ps = state.phase_status;
  const art = state.phase_artifacts;

  if (ps === 'pending') {
    if (art.context) return { steps: ['maestro-plan'] };
    if (art.analysis) return { steps: ['maestro-analyze -q'] };
    return { steps: ['maestro-analyze'] };
  }
  if (ps === 'exploring' || ps === 'planning') {
    if (art.plan) return { steps: ['maestro-execute', 'maestro-verify'] };
    return { steps: ['maestro-plan'] };
  }
  if (ps === 'executing') {
    if (state.execution.tasks_completed >= state.execution.tasks_total && state.execution.tasks_total > 0)
      return { steps: ['maestro-verify'] };
    if (state.has_blockers) return { steps: ['quality-debug'] };
    return { steps: ['maestro-execute'] };
  }
  if (ps === 'verifying') {
    if (state.verification_status === 'passed') {
      if (!state.review_verdict) return { steps: ['quality-review'] };
      if (state.review_verdict === 'BLOCK') return { steps: ['maestro-plan --gaps', 'maestro-execute', 'quality-review'] };
      if (state.uat_status === 'pending') return { steps: ['quality-test'] };
      if (state.uat_status === 'passed') return { steps: ['maestro-phase-transition'] };
      if (state.uat_status === 'failed') return { steps: ['quality-debug --from-uat {phase}'] };
      return { steps: ['quality-test'] };
    }
    return { steps: ['maestro-plan --gaps', 'maestro-execute', 'maestro-verify'] };
  }
  if (ps === 'testing') {
    if (state.uat_status === 'passed') return { steps: ['maestro-phase-transition'] };
    return { steps: ['quality-debug --from-uat {phase}'] };
  }
  if (ps === 'completed') {
    if (state.phases_completed >= state.phases_total) return { steps: ['maestro-milestone-audit', 'maestro-milestone-complete'] };
    return { steps: ['maestro-phase-transition'] };
  }
  if (ps === 'blocked') return { steps: ['quality-debug'] };
  return { steps: ['manage-status'] };
}
```

### 5a (cont): Intent-Based Routing

```javascript
const chainMap = {
  // Single-step
  'status':             [{ cmd: 'manage-status' }],
  'init':               [{ cmd: 'maestro-init' }],
  'analyze':            [{ cmd: 'maestro-analyze', args: '{phase}' }],
  'plan':               [{ cmd: 'maestro-plan', args: '{phase}' }],
  'execute':            [{ cmd: 'maestro-execute', args: '{phase}' }],
  'verify':             [{ cmd: 'maestro-verify', args: '{phase}' }],
  'review':             [{ cmd: 'quality-review', args: '{phase}' }],
  'test':               [{ cmd: 'quality-test', args: '{phase}' }],
  'test_gen':           [{ cmd: 'quality-test-gen', args: '{phase}' }],
  'debug':              [{ cmd: 'quality-debug', args: '"{description}"' }],
  'integration_test':   [{ cmd: 'quality-integration-test', args: '{phase}' }],
  'refactor':           [{ cmd: 'quality-refactor', args: '"{description}"' }],
  'sync':               [{ cmd: 'quality-sync', args: '{phase}' }],
  'ui_design':          [{ cmd: 'maestro-ui-design', args: '{phase}' }],
  'roadmap':            [{ cmd: 'maestro-roadmap', args: '"{description}"' }],
  'quick':              [{ cmd: 'maestro-quick', args: '"{description}"' }],
  'phase_transition':   [{ cmd: 'maestro-phase-transition' }],
  'phase_add':          [{ cmd: 'maestro-phase-add', args: '"{description}"' }],
  'milestone_audit':    [{ cmd: 'maestro-milestone-audit' }],
  'milestone_complete': [{ cmd: 'maestro-milestone-complete' }],
  'codebase_rebuild':   [{ cmd: 'manage-codebase-rebuild' }],
  'codebase_refresh':   [{ cmd: 'manage-codebase-refresh' }],
  'spec_setup':         [{ cmd: 'spec-setup' }],
  'spec_add':           [{ cmd: 'spec-add', args: '"{description}"' }],
  'spec_load':          [{ cmd: 'spec-load', args: '"{description}"' }],
  'spec_map':           [{ cmd: 'spec-map' }],
  'memory':             [{ cmd: 'manage-memory', args: '"{description}"' }],
  'memory_capture':     [{ cmd: 'manage-memory-capture', args: '"{description}"' }],
  'issue':              [{ cmd: 'manage-issue', args: '"{description}"' }],
  'issue_discover':     [{ cmd: 'manage-issue-discover', args: '"{description}"' }],
  'issue_analyze':      [{ cmd: 'manage-issue-analyze', args: '"{description}"' }],
  'issue_plan':         [{ cmd: 'manage-issue-plan', args: '"{description}"' }],
  'issue_execute':      [{ cmd: 'manage-issue-execute', args: '"{description}"' }],
  // Team skills
  'team_lifecycle':     [{ cmd: 'team-lifecycle-v4', args: '"{description}"' }],
  'team_coordinate':    [{ cmd: 'team-coordinate', args: '"{description}"' }],
  'team_design':        [{ cmd: 'team-designer', args: '"{description}"' }],
  'team_execute':       [{ cmd: 'team-executor', args: '"{description}"' }],
  'team_qa':            [{ cmd: 'team-quality-assurance', args: '"{description}"' }],
  'team_test':          [{ cmd: 'team-testing', args: '"{description}"' }],
  'team_review':        [{ cmd: 'team-review', args: '"{description}"' }],
  'team_tech_debt':     [{ cmd: 'team-tech-debt', args: '"{description}"' }],

  // Multi-step chains
  'full-lifecycle': [
    { cmd: 'maestro-plan', args: '{phase}' },
    { cmd: 'maestro-execute', args: '{phase}' },
    { cmd: 'maestro-verify', args: '{phase}' },
    { cmd: 'quality-review', args: '{phase}' },
    { cmd: 'quality-test', args: '{phase}' },
    { cmd: 'maestro-phase-transition' }
  ],
  'spec-driven': [
    { cmd: 'maestro-init' },
    { cmd: 'maestro-spec-generate', args: '"{description}"' },
    { cmd: 'maestro-plan', args: '{phase}' },
    { cmd: 'maestro-execute', args: '{phase}' },
    { cmd: 'maestro-verify', args: '{phase}' }
  ],
  'roadmap-driven': [
    { cmd: 'maestro-init' },
    { cmd: 'maestro-roadmap', args: '"{description}"' },
    { cmd: 'maestro-plan', args: '{phase}' },
    { cmd: 'maestro-execute', args: '{phase}' },
    { cmd: 'maestro-verify', args: '{phase}' }
  ],
  'brainstorm-driven': [
    { cmd: 'maestro-brainstorm', args: '"{description}"' },
    { cmd: 'maestro-plan', args: '{phase}' },
    { cmd: 'maestro-execute', args: '{phase}' },
    { cmd: 'maestro-verify', args: '{phase}' }
  ],
  'ui-design-driven': [
    { cmd: 'maestro-ui-design', args: '{phase}' },
    { cmd: 'maestro-plan', args: '{phase}' },
    { cmd: 'maestro-execute', args: '{phase}' },
    { cmd: 'maestro-verify', args: '{phase}' }
  ],
  'analyze-plan-execute': [
    { cmd: 'maestro-analyze', args: '"{description}" -q' },
    { cmd: 'maestro-plan', args: '--dir {scratch_dir}' },
    { cmd: 'maestro-execute', args: '--dir {scratch_dir}' }
  ],
  'execute-verify': [
    { cmd: 'maestro-execute', args: '{phase}' },
    { cmd: 'maestro-verify', args: '{phase}' }
  ],
  'quality-loop': [
    { cmd: 'maestro-verify', args: '{phase}' },
    { cmd: 'quality-review', args: '{phase}' },
    { cmd: 'quality-test-gen', args: '{phase}' },
    { cmd: 'quality-test', args: '{phase}' },
    { cmd: 'quality-debug', args: '--from-uat {phase}' },
    { cmd: 'maestro-plan', args: '{phase} --gaps' },
    { cmd: 'maestro-execute', args: '{phase}' }
  ],
  'milestone-close': [
    { cmd: 'maestro-milestone-audit' },
    { cmd: 'maestro-milestone-complete' }
  ]
};

// Special mappings: task_type → chain name (when different from task_type key)
const taskToChain = {
  'spec_generate': 'spec-driven',
  'brainstorm': 'brainstorm-driven',
};
```

### 5b: State Validation (W003)

Cross-validate intent against project state:
- Intent `execute` but no plan → warn, prepend `maestro-plan`
- Intent `verify` but not executed → warn, prepend `maestro-execute`
- Intent `test` but not verified → warn, prepend `maestro-verify`
- Intent `phase_transition` but not verified → warn, prepend `maestro-verify`

Display warning but let user override.

### 5c: Resolve Phase Number

```javascript
function resolvePhase(intent, state) {
  // 1. Explicit in intent: "plan phase 3"
  const m = intent.match(/phase\s*(\d+)|^(\d+)$/);
  if (m) return m[1] || m[2];
  // 2. From project state
  if (state.initialized) return state.current_phase;
  // 3. Scratch mode → null (uses {scratch_dir})
  if (chainName === 'analyze-plan-execute') return null;
  // 4. Commands that don't need phase
  const noPhase = ['manage-status', 'manage-issue', 'manage-issue-analyze', 'manage-issue-plan',
    'manage-issue-execute', 'maestro-init', 'maestro-spec-generate', 'maestro-roadmap',
    'spec-setup', 'spec-map', 'manage-memory', 'manage-memory-capture',
    'manage-codebase-rebuild', 'manage-codebase-refresh', 'maestro-milestone-audit',
    'maestro-milestone-complete', 'maestro-phase-transition', 'maestro-phase-add'];
  if (chain.every(s => noPhase.includes(s.cmd))) return null;
  // 5. Ask user
  return askUserForPhase();
}
```

### 5d: Confirm

**If `--dry-run`:** display chain visualization and exit.

**If not auto mode:** AskUserQuestion to confirm chain execution. Options: "Execute", "Execute from step N", "Cancel".

---

## Step 6: Setup Tracking

```bash
SESSION_ID="maestro-$(date +%Y%m%d-%H%M%S)"
SESSION_DIR=".workflow/.maestro/${SESSION_ID}"
mkdir -p "${SESSION_DIR}"
```

Write `status.json`:
```json
{
  "session_id": "{SESSION_ID}",
  "created_at": "{ISO timestamp}",
  "intent": "{original_intent}",
  "task_type": "{task_type}",
  "chain_name": "{chain_name}",
  "phase": "{resolved_phase}",
  "auto_mode": false,
  "steps": [
    { "index": 0, "skill": "{cmd}", "args": "{args}", "status": "pending", "started_at": null, "completed_at": null }
  ],
  "current_step": 0,
  "status": "running"
}
```

---

## Step 7: Execute Chain

### Auto-Mode Propagation

Only skills that explicitly support auto flags receive them:

| Skill | Auto Flag | Effect |
|-------|-----------|--------|
| maestro-analyze | `-y` | Skip interactive scoping |
| maestro-brainstorm | `-y` | Skip interactive questions |
| maestro-ui-design | `-y` | Skip interactive selection |
| maestro-plan | `--auto` | Skip interactive clarification |
| maestro-spec-generate | `-y` | Skip interactive questions |
| quality-test | `--auto-fix` | Auto-trigger gap-fix loop |

All other skills execute as-is (no auto flag injected).

### Argument Assembly

```javascript
const AUTO_FLAG_MAP = {
  'maestro-analyze': '-y', 'maestro-brainstorm': '-y', 'maestro-ui-design': '-y',
  'maestro-plan': '--auto', 'maestro-spec-generate': '-y', 'quality-test': '--auto-fix',
};

function assembleArgs(step, context) {
  let args = (step.args || '')
    .replace(/\{phase\}/g, context.current_phase || '')
    .replace(/\{description\}/g, context.user_intent || '')
    .replace(/\{scratch_dir\}/g, context.scratch_dir || '');
  if (context.auto_mode) {
    const flag = AUTO_FLAG_MAP[step.cmd];
    if (flag && !args.includes(flag)) args = args ? `${args} ${flag}` : flag;
  }
  return args.trim();
}
```

### Per-Step Execution

For each step starting at `$STEP_INDEX` (default 0):

1. **Banner**: `STEP {i+1}/{total}: {skill_name} — Args: {args}`
2. **Update status.json**: step status = `"running"`, started_at = now
3. **Execute**: `$maestro-execute "{args}"` (invoke the target skill)
4. **Parse output**: scan for phase references, spec session IDs → update context
5. **On success**: step status = `"completed"`, continue
6. **On failure**:
   - Auto mode: log warning, mark `"skipped"`, continue
   - Interactive: AskUserQuestion — "Retry" (max 2), "Skip", "Abort"
   - On Abort: **Error E003** — display resume instructions

### Completion Report

```
============================================================
  MAESTRO SESSION COMPLETE
============================================================
  Session:  {session_id}
  Chain:    {chain_name} ({completed}/{total} steps)
  Phase:    {current_phase}
  Mode:     {auto | interactive}

  Steps:
    [{status_icon}] {N}. {skill_name} -- {duration}

  Next: {suggested_next_action}
============================================================
```

---

## Error Codes

| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and project not initialized | Prompt for intent or suggest maestro-init |
| E002 | error | Clarity too low after 2 clarification rounds | Show parsed intent, ask user to rephrase |
| E003 | error | Chain step failed + user chose abort | Record partial progress, suggest resume with -c |
| E004 | error | Resume session not found | Show available sessions |
| E005 | error | Invalid chain name with --chain | Show valid chain names and exit |
| W001 | warning | Intent ambiguous, multiple chains possible | Present options, let user choose |
| W002 | warning | Chain step completed with warnings | Log and continue |
| W003 | warning | State suggests different chain than intent | Show discrepancy, let user decide |

---

## Success Criteria

- [ ] Intent classified with task_type, complexity, clarity_score
- [ ] Project state read and incorporated into routing
- [ ] Command chain selected and confirmed (or auto-confirmed with -y)
- [ ] Auto flags correctly propagated to supporting skills only
- [ ] Session directory created at `.workflow/.maestro/{session_id}/`
- [ ] status.json tracks per-step progress
- [ ] All chain steps executed with proper argument propagation
- [ ] Phase numbers auto-detected and passed to downstream skills
- [ ] Error handling: retry/skip/abort per step (auto-skip in -y mode)
- [ ] Session summary displayed on completion
