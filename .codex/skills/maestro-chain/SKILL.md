---
name: maestro-chain
description: Flat chain coordinator — resolve intent, build single CSV with all steps, execute via spawn_agents_on_csv (max_workers=1). Sub-agents self-discover context from prior results. No coordinator-side artifact analysis. Simpler than maestro but requires skills to be self-discovering.
argument-hint: "\"intent text\" [-y] [-c|--continue] [--dry-run] [--chain <name>]"
allowed-tools: spawn_agents_on_csv, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

## Auto Mode

When `-y` or `--yes`: Skip clarification and confirmation prompts. Pass `-y` through to each step's skill invocation.

# Maestro Chain (Flat)

## Usage

```bash
$maestro-chain "implement user authentication with JWT"
$maestro-chain -y "refactor the payment module"
$maestro-chain --continue
$maestro-chain --dry-run "add rate limiting to API endpoints"
$maestro-chain --chain feature "add dark mode toggle"
```

**Flags**:
- `-y, --yes` — Auto mode: skip all prompts; propagate `-y` to each skill
- `--continue` — Resume latest paused session (re-run from first failed/pending step)
- `--dry-run` — Display planned chain without executing
- `--chain <name>` — Force a specific chain (skips intent classification)

**Session state**: `.workflow/.maestro-chain/{session-id}/`
**Core Output**: `tasks.csv` + `results.csv` + `state.json`

---

## Overview

Flat sequential chain execution — one CSV, one `spawn_agents_on_csv` call, done. Each skill is self-discovering: it reads `.workflow/state.json`, globs for latest artifacts, and resolves its own inputs. The coordinator only assembles initial args and launches.

```
Intent → Resolve Chain → Build tasks.csv → spawn_agents_on_csv(max_workers=1) → Read results → Report
                           (all steps)       step 1 → step 2 → … → step N
                                             (each skill self-discovers context)
```

**When to use this vs `$maestro`**:
- Use `$maestro-chain` when all skills in the chain are self-discovering (read state.json, glob artifacts)
- Use `$maestro` when you need coordinator-side artifact analysis between steps (dynamic arg resolution)

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

> **Full chain map reference**: `~/.maestro/workflows/maestro.codex.md` — read for 35+ intent patterns and 40+ chain definitions.

### Phase 1: Resolve Intent and Chain

1. Parse arguments: extract `AUTO_YES`, `RESUME`, `DRY_RUN`, `forceChain`, `intent`
2. Read `.workflow/state.json` for project context
3. Classify intent → select chain (same logic as `$maestro`)
4. If unclear and not AUTO_YES: ask one clarifying question
5. Resolve phase from intent or state

**`--continue` mode**: Load latest `state.json` from `.workflow/.maestro-chain/`, rebuild CSV from first pending step.

**`--dry-run`**: Display chain and stop.

---

### Phase 2: Build CSV and Execute

#### Assemble skill_call

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

#### Generate tasks.csv

```csv
id,skill_call,topic
"1","$maestro-analyze --gaps \"fix auth\" -y","Chain quality-fix step 1/4"
"2","$maestro-plan --gaps -y","Chain quality-fix step 2/4"
"3","$maestro-execute -y","Chain quality-fix step 3/4"
"4","$maestro-verify -y","Chain quality-fix step 4/4"
```

#### Write state.json

```javascript
const sessionId = `MC-${dateStr}-${timeStr}`;
const sessionDir = `.workflow/.maestro-chain/${sessionId}`;
Bash(`mkdir -p ${sessionDir}`);

Write(`${sessionDir}/state.json`, JSON.stringify({
  id: sessionId,
  intent,
  chain: chainName,
  auto_yes: AUTO_YES,
  status: "running",
  started_at: new Date().toISOString(),
  steps: chain.map((s, i) => ({
    step_n: i + 1,
    cmd: s.cmd,
    skill_call: buildSkillCall(s),
    status: "pending"
  }))
}, null, 2));
```

#### Execute

```javascript
spawn_agents_on_csv({
  csv_path: `${sessionDir}/tasks.csv`,
  id_column: "id",
  instruction: INSTRUCTION,
  max_workers: 1,
  max_runtime_seconds: 1800,
  output_csv_path: `${sessionDir}/results.csv`,
  output_schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["completed", "failed"] },
      skill_call: { type: "string" },
      summary: { type: "string" },
      artifacts: { type: "string" },
      error: { type: "string" }
    },
    required: ["status", "skill_call", "summary", "artifacts", "error"]
  }
})
```

---

### Instruction Template

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

---

### Phase 3: Report

Read `results.csv`, update `state.json`:

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

Display:

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

---

## Error Handling

| Code | Condition | Recovery |
|------|-----------|----------|
| E001 | Intent unclassifiable | Default to `feature` chain |
| E002 | `--chain` not in map | List valid chains, abort |
| E003 | Step timeout | Mark `failed` in results (subsequent steps still attempt) |
| E004 | `--continue`: no session | List sessions, prompt |

---

## Core Rules

1. **One CSV, one call**: Entire chain is a single `spawn_agents_on_csv` invocation
2. **max_workers=1**: Strict sequential — step N finishes before step N+1 starts
3. **Skills self-discover**: Each skill reads `.workflow/state.json` and globs for latest artifacts — no coordinator-side analysis needed
4. **Simple instruction**: Sub-agent just executes `{skill_call}` verbatim and reports
5. **Args resolved once**: All `{phase}`, `{description}` resolved at CSV build time — no dynamic updates mid-chain
6. **Abort tolerance**: A failed step doesn't auto-skip subsequent steps — each skill decides independently whether to proceed
7. **Resume = rebuild CSV**: `--continue` rebuilds CSV from first pending/failed step
