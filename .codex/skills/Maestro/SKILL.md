---
name: maestro
description: Intelligent coordinator — analyze intent, read project state, select chain, execute wave-by-wave via spawn_agents_on_csv. Barrier skills trigger coordinator-side artifact analysis between waves to dynamically assemble subsequent skill_call args. Each wave can be 1 or N parallel tasks.
argument-hint: "\"intent text\" [-y] [-c|--continue] [--dry-run] [--chain <name>]"
allowed-tools: spawn_agents_on_csv, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

## Auto Mode

When `-y` or `--yes`: Skip clarification and confirmation prompts. Pass `-y` through to each step's skill invocation.

# Maestro

## Usage

```bash
$maestro "implement user authentication with JWT"
$maestro -y "refactor the payment module"
$maestro --continue
$maestro --dry-run "add rate limiting to API endpoints"
$maestro --chain feature "add dark mode toggle"
```

**Flags**:
- `-y, --yes` — Auto mode: skip all prompts; propagate `-y` to each skill
- `--continue` — Resume latest paused session from last incomplete wave
- `--dry-run` — Display planned chain without executing
- `--chain <name>` — Force a specific chain (skips intent classification)

**Session state**: `.workflow/.maestro-coordinate/{session-id}/`
**Core Output**: `tasks.csv` (master) + `wave-{N}-results.csv` (per wave) + `context.md` (report)

---

## Overview

Wave-based pipeline coordinator. The coordinator loop builds one wave CSV at a time, calls `spawn_agents_on_csv`, then performs **coordinator-side artifact analysis** before assembling the next wave. Barrier skills produce artifacts (plan.json, analysis results, etc.) that the coordinator reads to dynamically resolve args for subsequent steps.

```
Intent → Resolve Chain → [Wave Loop]:
  ┌─────────────────────────────────────────────────┐
  │ 1. Identify next wave (1 or N parallel steps)   │
  │ 2. Build wave-{N}.csv with skill_call per row   │
  │ 3. spawn_agents_on_csv(wave-{N}.csv)            │
  │ 4. Read wave-{N}-results.csv                    │
  │ 5. If barrier skill: analyze artifacts,         │
  │    update context for subsequent steps           │
  │ 6. Merge into master tasks.csv                  │
  └─────────────────────────────────────────────────┘
  → Report
```

---

## Barrier Skills

Skills that produce artifacts requiring **coordinator-side analysis** before the next wave can be assembled. After a barrier skill completes, the coordinator reads its output and updates the execution context.

| Skill | Artifacts to Read | Context Updates |
|-------|------------------|-----------------|
| `maestro-analyze` | `.workflow/.csv-wave/*/context.md`, `state.json` | `gaps`, `phase`, `analysis_dir` |
| `maestro-plan` | `{phase_dir}/plan.json`, `{phase_dir}/.task/TASK-*.json` | `plan_dir`, `task_count`, `wave_count` |
| `maestro-brainstorm` | `.workflow/.csv-wave/*/.brainstorming/` | `brainstorm_dir`, `features` |
| `maestro-spec-generate` | `.workflow/.csv-wave/*/specs/` | `spec_session_id` |
| `maestro-execute` | `.workflow/.csv-wave/*/results.csv` | `exec_status`, `completed_tasks`, `failed_tasks` |

**Non-barrier skills** (can be grouped into multi-task waves): `maestro-verify`, `quality-review`, `quality-test`, `quality-debug`, `quality-refactor`, `quality-sync`, `manage-*`

---

## Chain Map

| Intent keywords | Chain | Steps (skills, in order) |
|----------------|-------|--------------------------|
| fix, bug, error, broken, crash | `quality-fix` | $maestro-analyze --gaps → $maestro-plan --gaps → $maestro-execute → $maestro-verify |
| test, spec, coverage | `quality-test` | $quality-test |
| refactor, cleanup, debt | `quality-refactor` | $quality-refactor |
| feature, implement, add, build | `feature` | $maestro-plan → $maestro-execute → $maestro-verify |
| review, check, audit | `quality-review` | $quality-review |
| deploy, release, ship | `deploy` | $maestro-verify → $maestro-execute |

---

## Implementation

> **Full implementation reference**: The complete `detectTaskType`, `detectNextAction`, and `chainMap` definitions (35+ intent patterns, 40+ chain types) are in `~/.maestro/workflows/maestro.codex.md`. Read that file for authoritative logic before executing any step.

### Session Initialization

```javascript
const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '')
const timeStr = new Date().toISOString().substring(11, 19).replace(/:/g, '')
const sessionId = `MCC-${dateStr}-${timeStr}`
const sessionDir = `.workflow/.maestro-coordinate/${sessionId}`

Bash(`mkdir -p ${sessionDir}`)
```

### Phase 1: Resolve Intent and Chain

**`--continue` mode**: Glob `.workflow/.maestro-coordinate/MCC-*/state.json` sorted by name desc; load the most recent; resume from first pending wave.

**Fresh mode**:

1. Read `.workflow/state.json` for project context (`current_phase`, `workflow_name`)
2. If `--chain` is given, use it directly
3. Otherwise, classify intent with keyword heuristics (see Chain Map above)
4. If no keyword matches and not `AUTO_YES`: ask one clarifying question via `AskUserQuestion`
5. Resolve the chain's skill list from Chain Map
6. Write `state.json`:

```javascript
Write(`${sessionDir}/state.json`, JSON.stringify({
  id: sessionId,
  intent,
  chain: resolvedChain,
  auto_yes: AUTO_YES,
  status: "in_progress",
  started_at: new Date().toISOString(),
  context: {
    phase: resolvedPhase,
    plan_dir: null,
    analysis_dir: null,
    brainstorm_dir: null,
    spec_session_id: null,
    gaps: null
  },
  waves: [],   // populated as waves execute
  steps: chain.map((skill, i) => ({
    step_n: i + 1,
    skill: skill.cmd,
    args: skill.args ?? '',
    status: "pending",
    wave_n: null
  }))
}, null, 2))
```

**`--dry-run`**: Display the chain plan and stop.

```
Chain:  <resolvedChain>
Steps:
  1. $<cmd> <args>
  2. $<cmd> <args>  [BARRIER]
  3. $<cmd> <args>
```

**User confirmation** (skip if `AUTO_YES`): Display the plan above and prompt `Proceed? (yes/no)`.

---

### Phase 2: Wave Execution Loop

The coordinator iterates over pending steps, grouping them into waves and executing one wave at a time.

#### Wave Grouping Rules

1. A **barrier skill** is always alone in its wave (wave size = 1)
2. Consecutive **non-barrier skills** with no inter-dependencies are grouped into one wave (wave size = N)
3. After a barrier wave completes → coordinator analyzes artifacts → updates context → re-assembles subsequent step args

#### Per-Wave Execution

```javascript
let waveNum = 0;

while (state.steps.some(s => s.status === 'pending')) {
  waveNum++;

  // 1. Determine wave contents
  const waveSteps = buildNextWave(state.steps);

  // 2. Assemble skill_call for each step (with latest context)
  const waveCsv = waveSteps.map((step, i) => ({
    id: String(step.step_n),
    skill_call: buildSkillCall(step, state.context),
    topic: `Chain "${state.chain}" step ${step.step_n}/${state.steps.length}`
  }));

  // 3. Write wave CSV
  const csvContent = 'id,skill_call,topic\n' + waveCsv.map(r =>
    `"${r.id}","${r.skill_call.replace(/"/g, '""')}","${r.topic}"`
  ).join('\n');
  Write(`${sessionDir}/wave-${waveNum}.csv`, csvContent);

  // 4. Execute wave
  spawn_agents_on_csv({
    csv_path: `${sessionDir}/wave-${waveNum}.csv`,
    id_column: "id",
    instruction: WAVE_INSTRUCTION,
    max_workers: waveSteps.length > 1 ? waveSteps.length : 1,
    max_runtime_seconds: 1800,
    output_csv_path: `${sessionDir}/wave-${waveNum}-results.csv`,
    output_schema: RESULT_SCHEMA
  });

  // 5. Read results, update step status
  const results = readCSV(`${sessionDir}/wave-${waveNum}-results.csv`);
  for (const row of results) {
    const step = state.steps.find(s => s.step_n === parseInt(row.id));
    step.status = row.status;
    step.findings = row.findings;
    step.wave_n = waveNum;
  }

  // 6. Barrier analysis (if wave contained a barrier skill)
  if (isBarrier(waveSteps[0].skill)) {
    analyzeBarrierArtifacts(waveSteps[0], results[0], state.context);
  }

  // 7. Persist state
  state.waves.push({ wave_n: waveNum, steps: waveSteps.map(s => s.step_n), results });
  Write(`${sessionDir}/state.json`, JSON.stringify(state, null, 2));

  // 8. Abort on failure
  if (results.some(r => r.status === 'failed')) {
    state.status = 'aborted';
    state.steps.filter(s => s.status === 'pending').forEach(s => s.status = 'skipped');
    Write(`${sessionDir}/state.json`, JSON.stringify(state, null, 2));
    break;
  }
}
```

---

### Instruction Template (Simple)

```
你是 CSV job 子 agent。

先原样执行这一段技能调用：
{skill_call}

然后基于结果完成这一行任务说明：
{topic}

限制：
- 不要修改 .workflow/.maestro-coordinate/ 下的 state 文件
- skill 内部有自己的 session 管理，按 skill SKILL.md 执行即可

最后必须调用 `report_agent_job_result`，返回 JSON：
{"status":"completed|failed","skill_call":"{skill_call}","summary":"一句话结果","artifacts":"产物路径或空字符串","error":"失败原因或空字符串"}
```

### Result Schema

```javascript
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["completed", "failed"] },
    skill_call: { type: "string" },
    summary: { type: "string" },
    artifacts: { type: "string" },
    error: { type: "string" }
  },
  required: ["status", "skill_call", "summary", "artifacts", "error"]
};
```

---

### Barrier Analysis Logic

After a barrier skill completes, the coordinator reads its artifacts and updates `state.context`:

```javascript
function analyzeBarrierArtifacts(step, result, ctx) {
  const artifactPath = result.artifacts;

  switch (step.skill) {
    case 'maestro-analyze':
      // Read analysis conclusions → extract gaps, phase info
      const contextMd = Read(`${artifactPath}/context.md`);
      ctx.analysis_dir = artifactPath;
      ctx.gaps = extractGaps(contextMd);  // grep for gap/issue markers
      if (!ctx.phase) ctx.phase = extractPhase(contextMd);
      break;

    case 'maestro-plan':
      // Read plan.json → know task structure for execute
      const planJson = JSON.parse(Read(`${artifactPath}/plan.json`));
      ctx.plan_dir = artifactPath;
      ctx.task_count = planJson.tasks?.length ?? 0;
      ctx.wave_count = planJson.waves?.length ?? 0;
      break;

    case 'maestro-brainstorm':
      // Read brainstorm output → features for plan
      ctx.brainstorm_dir = artifactPath;
      break;

    case 'maestro-spec-generate':
      ctx.spec_session_id = extractSpecId(artifactPath);
      break;

    case 'maestro-execute':
      // Read execution results → completed/failed counts
      const execResults = Read(`${artifactPath}/results.csv`);
      ctx.exec_completed = countStatus(execResults, 'completed');
      ctx.exec_failed = countStatus(execResults, 'failed');
      break;
  }
}
```

### Skill Call Assembly

The coordinator builds each `skill_call` with resolved context — sub-agents just execute verbatim:

```javascript
const BARRIER_SKILLS = new Set([
  'maestro-analyze', 'maestro-plan', 'maestro-brainstorm',
  'maestro-spec-generate', 'maestro-execute'
]);

const AUTO_FLAG_MAP = {
  'maestro-analyze': '-y', 'maestro-brainstorm': '-y',
  'maestro-ui-design': '-y', 'maestro-plan': '--auto',
  'maestro-spec-generate': '-y', 'quality-test': '--auto-fix',
  'quality-retrospective': '--auto-yes',
};

function buildSkillCall(step, ctx) {
  let args = (step.args ?? '')
    .replace(/{phase}/g, ctx.phase ?? '')
    .replace(/{description}/g, state.intent ?? '')
    .replace(/{issue_id}/g, ctx.issue_id ?? '')
    .replace(/{plan_dir}/g, ctx.plan_dir ?? '')
    .replace(/{analysis_dir}/g, ctx.analysis_dir ?? '')
    .replace(/{brainstorm_dir}/g, ctx.brainstorm_dir ?? '')
    .replace(/{spec_session_id}/g, ctx.spec_session_id ?? '');

  if (state.auto_yes) {
    const flag = AUTO_FLAG_MAP[step.skill];
    if (flag && !args.includes(flag)) args = args ? `${args} ${flag}` : flag;
  }

  return `$${step.skill} ${args}`.trim();
}

function buildNextWave(steps) {
  const pending = steps.filter(s => s.status === 'pending');
  if (!pending.length) return [];

  const first = pending[0];
  // Barrier skill → solo wave
  if (BARRIER_SKILLS.has(first.skill)) return [first];

  // Group consecutive non-barriers
  const wave = [first];
  for (let i = 1; i < pending.length; i++) {
    if (BARRIER_SKILLS.has(pending[i].skill)) break;
    wave.push(pending[i]);
  }
  return wave;
}
```

---

### Phase 3: Completion Report

```javascript
state.status = state.steps.every(s => s.status === 'completed') ? 'completed' : state.status;
state.completed_at = new Date().toISOString();
Write(`${sessionDir}/state.json`, JSON.stringify(state, null, 2));
```

Generate `context.md`:

```markdown
# Coordinate Report — {chain}

## Summary
- Session: {sessionId}
- Chain: {chain}
- Waves: {waveNum} executed
- Steps: {completed}/{total} completed

## Wave Results
### Wave {N} (barrier: {skill})
| Step | Skill Call | Status | Summary |
|------|-----------|--------|---------|
| {step_n} | {skill_call} | {status} | {summary} |

Artifacts: {artifacts}
Context update: {what changed}
```

Display:

```
=== COORDINATE COMPLETE ===
Session:  <sessionId>
Chain:    <chain>
Waves:    <N> executed
Steps:    <completed>/<total>

WAVE RESULTS:
  [W1] $maestro-analyze --gaps  →  ✓  found 3 gaps
  [W2] $maestro-plan --gaps     →  ✓  12 tasks in 3 waves
  [W3] $maestro-execute         →  ✓  12/12 tasks done
  [W4] $maestro-verify          →  ✓  all criteria met

State:    .workflow/.maestro-coordinate/<sessionId>/state.json
Resume:   $maestro --continue
```

---

## CSV Schema

### wave-{N}.csv (Per-Wave Input)

```csv
id,skill_call,topic
"1","$maestro-analyze --gaps \"fix auth\" -y","Chain \"quality-fix\" step 1/4"
```

| Column | Description |
|--------|-------------|
| `id` | Step number from chain (string) |
| `skill_call` | Full skill invocation assembled by coordinator with resolved context |
| `topic` | Brief description for the agent |

### tasks.csv (Master State)

```csv
id,skill,args,wave_n,status,findings,artifacts,error
```

Accumulated across all waves. Updated after each wave completes.

---

## Error Handling

| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Intent unclassifiable after clarification | Default to `feature` chain |
| E002 | error | `--chain` value not in chain map | List valid chains, abort |
| E003 | error | Wave timeout (max_runtime_seconds) | Mark step `failed`, abort chain |
| E004 | error | Barrier artifact not found | Retry wave once, then abort |
| E005 | error | `--continue`: no session found | List sessions, prompt |
| W001 | warning | Barrier artifact partial | Continue with available context |

---

## Core Rules

1. **Start Immediately**: Init session dir and write `state.json` before any wave
2. **Wave-by-wave**: Never start wave N+1 before wave N results are read and analyzed
3. **Barrier = solo wave**: A barrier skill always executes alone; coordinator analyzes its artifacts before proceeding
4. **Non-barriers can parallel**: Consecutive non-barrier skills in the same wave execute with `max_workers = N`
5. **Coordinator owns context**: Sub-agents never read prior results — coordinator assembles the full `skill_call` with resolved args
6. **Simple instruction**: Sub-agent instruction is minimal — just "execute {skill_call}, report result"
7. **Abort on failure**: Failed step → mark remaining as skipped → report
8. **State.json tracks waves**: Each wave is recorded with step IDs and results for resume
9. **Dry-run is read-only**: Display chain with [BARRIER] markers, no execution
10. **Resume from wave**: `--continue` finds last completed wave and resumes from next pending step
