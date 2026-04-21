---
name: maestro-chain
description: Flat chain coordinator — resolve intent, build single CSV with all steps, execute via spawn_agents_on_csv (max_workers=1). Sub-agents self-discover context. No coordinator-side artifact analysis. Simpler than maestro.
argument-hint: "\"intent text\" [-y] [-c|--continue] [--dry-run] [--chain <name>]"
allowed-tools: spawn_agents_on_csv, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
Flat sequential chain coordinator. Resolves intent, builds a single CSV with all steps,
executes via one `spawn_agents_on_csv` call (max_workers=1). Sub-agents are self-discovering:
each skill reads `.workflow/state.json` and globs for latest artifacts on its own.
Coordinator only assembles initial args and launches — no mid-chain artifact analysis.

```
Intent → Resolve Chain → Build tasks.csv → spawn_agents_on_csv(max_workers=1) → Read results → Report
                           (all steps)       step 1 → step 2 → … → step N
                                             (each skill self-discovers context)
```

**When to use this vs `$maestro`**:
- `$maestro-chain` — all skills self-discover (read state.json, glob artifacts)
- `$maestro` — need coordinator-side artifact analysis between steps (dynamic arg resolution)
</purpose>

<required_reading>
@~/.maestro/workflows/maestro.codex.md — authoritative `detectTaskType`, `detectNextAction`, `chainMap` (35+ intent patterns, 40+ chain types). Read before executing any step.
</required_reading>

<context>
$ARGUMENTS — user intent text, or special flags.

**Flags:**
- `-y, --yes` — Auto mode: skip all prompts; propagate `-y` to each skill
- `--continue` — Resume latest paused session (re-run from first failed/pending step)
- `--dry-run` — Display planned chain without executing
- `--chain <name>` — Force specific chain (skips intent classification)

**Session state**: `.workflow/.maestro-chain/{session-id}/`
**Core output**: `tasks.csv` + `results.csv` + `state.json`
</context>

<invariants>
1. **ALL skills via spawn_agents_on_csv**: The entire chain is a single `spawn_agents_on_csv` invocation. Coordinator NEVER directly executes any skill. No exceptions.
2. **Coordinator = prompt assembler only**: Classify intent → build CSV → spawn → read results → report. It never runs skill logic itself.
3. **One CSV, one call**: All steps go into one `tasks.csv`, one `spawn_agents_on_csv` call.
4. **max_workers=1**: Strict sequential execution — step N finishes before step N+1 starts.
5. **Skills self-discover**: Each skill reads `.workflow/state.json` and globs for latest artifacts. No coordinator-side artifact analysis between steps.
6. **Args resolved once**: All `{phase}`, `{description}` placeholders resolved at CSV build time — no dynamic updates mid-chain.
7. **Abort tolerance**: A failed step doesn't auto-skip subsequent steps — each skill decides independently whether to proceed.
8. **Resume = rebuild CSV**: `--continue` rebuilds CSV from first pending/failed step.
</invariants>

<chain_map>
| Intent keywords | Chain | Steps (skills, in order) |
|----------------|-------|--------------------------|
| fix, bug, error, broken, crash | `quality-fix` | $maestro-analyze --gaps → $maestro-plan --gaps → $maestro-execute → $maestro-verify |
| test, spec, coverage | `quality-test` | $quality-test |
| refactor, cleanup, debt | `quality-refactor` | $quality-refactor |
| feature, implement, add, build | `feature` | $maestro-plan → $maestro-execute → $maestro-verify |
| review, check, audit | `quality-review` | $quality-review |
| deploy, release, ship | `deploy` | $maestro-verify → $maestro-execute |
</chain_map>

<execution>

### Phase 1: Resolve Intent and Chain

1. Parse arguments: extract `AUTO_YES`, `RESUME`, `DRY_RUN`, `forceChain`, `intent`
2. Read `.workflow/state.json` for project context
3. Classify intent → select chain (same logic as `$maestro`)
4. If unclear and not AUTO_YES: ask one clarifying question
5. Resolve phase from intent or state

**`--continue`**: Load latest `state.json` from `.workflow/.maestro-chain/`, rebuild CSV from first pending step.

**`--dry-run`**: Display chain and stop.

### Phase 2: Build CSV and Execute

#### Skill Call Assembly

```javascript
const AUTO_FLAG_MAP = {
  'maestro-analyze': '-y', 'maestro-brainstorm': '-y',
  'maestro-ui-design': '-y', 'maestro-plan': '--auto',
  'maestro-spec-generate': '-y', 'quality-test': '--auto-fix',
  'quality-retrospective': '--auto-yes',
};

function buildSkillCall(step) {
  let args = (step.args ?? '')
    .replace(/{phase}/g, resolvedPhase ?? '')
    .replace(/{description}/g, intent ?? '')
    .replace(/{issue_id}/g, resolvedIssueId ?? '');
  if (AUTO_YES) {
    const flag = AUTO_FLAG_MAP[step.cmd];
    if (flag && !args.includes(flag)) args = args ? `${args} ${flag}` : flag;
  }
  return `$${step.cmd} ${args}`.trim();
}
```

#### Session Init + CSV Generation

```javascript
const sessionId = `MC-${dateStr}-${timeStr}`;
const sessionDir = `.workflow/.maestro-chain/${sessionId}`;
Bash(`mkdir -p ${sessionDir}`);

Write(`${sessionDir}/state.json`, JSON.stringify({
  id: sessionId, intent, chain: chainName, auto_yes: AUTO_YES,
  status: "running", started_at: new Date().toISOString(),
  steps: chain.map((s, i) => ({
    step_n: i + 1, cmd: s.cmd,
    skill_call: buildSkillCall(s), status: "pending"
  }))
}, null, 2));
```

```csv
id,skill_call,topic
"1","$maestro-analyze --gaps \"fix auth\" -y","Chain quality-fix step 1/4"
"2","$maestro-plan --gaps -y","Chain quality-fix step 2/4"
"3","$maestro-execute -y","Chain quality-fix step 3/4"
"4","$maestro-verify -y","Chain quality-fix step 4/4"
```

#### Spawn — ALL execution via spawn_agents_on_csv, never direct

```javascript
spawn_agents_on_csv({
  csv_path: `${sessionDir}/tasks.csv`,
  id_column: "id",
  instruction: INSTRUCTION,
  max_workers: 1,
  max_runtime_seconds: 1800,
  output_csv_path: `${sessionDir}/results.csv`,
  output_schema: RESULT_SCHEMA
});
```

### Sub-Agent Instruction Template

```
你是 CSV job 子 agent。

先原样执行这一段技能调用：
{skill_call}

然后基于结果完成这一行任务说明：
{topic}

限制：
- skill 内部自己管理 session 和产物发现
- 不要修改 .workflow/.maestro-chain/ 下的 state 文件

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

### Phase 3: Report

```javascript
const results = parseCSV(Read(`${sessionDir}/results.csv`));
const done = results.filter(r => r.status === 'completed').length;
const failed = results.filter(r => r.status === 'failed').length;

state.status = failed > 0 ? 'completed_with_errors' : 'completed';
state.completed_at = new Date().toISOString();
for (const row of results) {
  const step = state.steps[parseInt(row.id) - 1];
  step.status = row.status;
  step.summary = row.summary;
  step.artifacts = row.artifacts;
  step.error = row.error;
}
Write(`${sessionDir}/state.json`, JSON.stringify(state, null, 2));
```

```
=== CHAIN COMPLETE ===
Session:  <sessionId>
Chain:    <chain>
Steps:    <done>/<total>

RESULTS:
  [1] $maestro-analyze --gaps  →  ✓  <summary>
  [2] $maestro-plan --gaps     →  ✓  <summary>
  [3] $maestro-execute         →  ✓  <summary>
  [4] $maestro-verify          →  ✓  <summary>

State:  .workflow/.maestro-chain/<sessionId>/state.json
Resume: $maestro-chain --continue
```
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Intent unclassifiable | Default to `feature` chain |
| E002 | error | `--chain` not in map | List valid chains, abort |
| E003 | error | Step timeout | Mark `failed` in results (subsequent steps still attempt) |
| E004 | error | `--continue`: no session | List sessions, prompt |
</error_codes>

<success_criteria>
- [ ] Intent classified and chain resolved
- [ ] Session dir initialized with `state.json` before spawn
- [ ] All steps in one `tasks.csv`, one `spawn_agents_on_csv` call — no direct skill execution
- [ ] max_workers=1 enforced (strict sequential)
- [ ] Each skill self-discovers context (no coordinator-side artifact analysis)
- [ ] Args resolved at CSV build time, no mid-chain updates
- [ ] Results read, state.json updated with per-step status
- [ ] Completion report displayed
- [ ] `--dry-run` shows chain, no execution
- [ ] `--continue` rebuilds CSV from first pending/failed step
</success_criteria>
