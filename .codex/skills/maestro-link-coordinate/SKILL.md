---
name: maestro-link-coordinate
description: Chain-graph walker with in-process flow control. Loads chain JSON, walks nodes in main process, dispatches command nodes via spawn_agents_on_csv. Decision nodes resolved in-process between waves.
argument-hint: "\"intent text\" [--list] [-c [sessionId]] [--chain <name>] [-y]"
allowed-tools: spawn_agents_on_csv, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
In-process chain-graph coordinator. Unlike the CLI-delegated version (maestro coordinate start/next),
this coordinator loads chain graph JSON directly and drives flow in the main process:

- Command nodes → spawn via `spawn_agents_on_csv` (one command = one wave, always solo)
- Decision nodes → resolve in-process using expression evaluation against accumulated context
- Gate/terminal nodes → handle in-process

Coordinator responsibilities: load graph → walk nodes → build skill_call → spawn → read result →
evaluate decision → advance → persist state → repeat until terminal.

```
+-------------------------------------------------------------------+
|  maestro-link-coordinate (in-process walker)                       |
+-------------------------------------------------------------------+
|                                                                   |
|  Phase 1: Load Chain Graph                                        |
|     +-- Parse flags (--chain, -y, -c, --list)                     |
|     +-- Load chain JSON from chains/ directory                    |
|     +-- Initialize session state                                  |
|                                                                   |
|  Phase 2: Walk Loop                                               |
|     +-- while (current_node != terminal):                         |
|     |   +-- command  → build skill_call → spawn_agents_on_csv     |
|     |   |              → read result → update context → follow next|
|     |   +-- decision → evaluate expr against ctx.result           |
|     |   |              → match edge → follow target               |
|     |   +-- gate     → evaluate condition → on_pass / on_fail     |
|     |   +-- terminal → exit loop                                  |
|     +-- Persist state after each node                             |
|                                                                   |
|  Phase 3: Completion Report                                       |
|     +-- Per-node results with outcomes                            |
|     +-- Final status and resume hint                              |
+-------------------------------------------------------------------+
```
</purpose>

<context>
$ARGUMENTS — user intent text, or flags.

**Flags**:
- `--list` — List all available chain graphs (scan chains/ directory)
- `-c / --continue [sessionId]` — Resume from last completed node
- `--chain <name>` — Force a specific chain graph
- `-y / --yes` — Auto mode: no confirmations between nodes

**Session state**: `.workflow/.maestro-coordinate/{session-id}/`
**Chain graphs**: `chains/` and `chains/singles/` directories (JSON files)
</context>

<invariants>
1. **ALL command-node execution via spawn_agents_on_csv**: Coordinator NEVER executes skills directly. Every command node dispatches through `spawn_agents_on_csv`.
2. **Coordinator = graph walker + prompt assembler**: Load graph → walk → build skill_call → spawn → read result → evaluate decisions → persist. Nothing else.
3. **One command per wave**: Each command node runs as a solo wave (result needed for subsequent decisions).
4. **Decision nodes are in-process**: Coordinator evaluates `node.eval` against `ctx.result` directly. No sub-agent or CLI delegation.
5. **Context flows forward**: Each command result is captured and available to subsequent decision expressions and command args.
6. **max_visits enforced**: Track visit count per node; bail with failure if exceeded.
7. **Resume from node**: `-c` loads saved state and continues from last incomplete node.
</invariants>

<execution>

### Phase 1: Load Chain Graph

```javascript
const args = $ARGUMENTS.trim();
const listMode = /\b--list\b/.test(args);
const autoYes = /\b(-y|--yes)\b/.test(args);
const resumeMode = /\b(-c|--continue)\b/.test(args);
const resumeId = args.match(/(?:-c|--continue)\s+(\S+)/)?.[1] || null;
const forcedChain = args.match(/--chain\s+(\S+)/)?.[1] || null;
const intent = args
  .replace(/\b(-y|--yes|--list|-c|--continue)\b/g, '')
  .replace(/(?:-c|--continue)\s+\S+/g, '')
  .replace(/--chain\s+\S+/g, '')
  .trim();
```

**`--list`**: Scan `chains/*.json` and `chains/singles/*.json`, display names + descriptions, stop.

**`-c` (resume)**:
1. Glob `.workflow/.maestro-coordinate/MLC-*/state.json`, pick most recent (or by `resumeId`)
2. Load state → find first node with `status !== "completed"` → set as `current_node`
3. Jump to **Phase 2**

**Fresh session**:
1. Resolve chain: `--chain` direct or classify from intent using `chains/_intent-map.json`
2. Load chain JSON: try `chains/{name}.json` then `chains/singles/{name}.json`
3. Read `.workflow/state.json` for project context (phase, milestone)
4. Initialize session:

```javascript
const sessionId = `MLC-${dateStr}-${timeStr}`;
const sessionDir = `.workflow/.maestro-coordinate/${sessionId}`;

const state = {
  id: sessionId, intent, chain: graph.id, auto_mode: autoYes,
  status: "in_progress", started_at: new Date().toISOString(),
  current_node: graph.entry,
  context: {
    phase: resolvedPhase ?? null, description: intent,
    result: null   // last command result, used by decision eval
  },
  visit_counts: {},   // nodeId → number
  history: [],        // { node_id, type, outcome, summary, timestamp }
};
Write(`${sessionDir}/state.json`, JSON.stringify(state, null, 2));
```

**`--dry-run`**: Display node walk order with types, stop.

**Confirm** (skip if `autoYes`): Display chain summary, prompt `Proceed?`.

### Phase 2: Walk Loop

```javascript
while (state.status === 'in_progress') {
  const nodeId = state.current_node;
  const node = graph.nodes[nodeId];

  if (!node) {
    state.status = 'failed';
    state.history.push({ node_id: nodeId, type: 'error', outcome: 'failed',
      summary: `Node "${nodeId}" not found in graph`, timestamp: now() });
    break;
  }

  // max_visits guard
  state.visit_counts[nodeId] = (state.visit_counts[nodeId] ?? 0) + 1;
  if (node.max_visits && state.visit_counts[nodeId] > node.max_visits) {
    state.status = 'failed';
    state.history.push({ node_id: nodeId, type: node.type, outcome: 'max_visits_exceeded',
      summary: `Exceeded max_visits (${node.max_visits})`, timestamp: now() });
    break;
  }

  switch (node.type) {
    case 'command':  handleCommand(state, graph, nodeId, node); break;
    case 'decision': handleDecision(state, nodeId, node);       break;
    case 'gate':     handleGate(state, nodeId, node);            break;
    case 'terminal': handleTerminal(state, nodeId, node);        break;
  }

  // Persist after every node
  Write(`${sessionDir}/state.json`, JSON.stringify(state, null, 2));
}
```

#### handleCommand — spawn via CSV

```javascript
function handleCommand(state, graph, nodeId, node) {
  // 1. Build skill_call
  const skillCall = buildSkillCall(node, state.context, state.auto_mode);

  // 2. Write single-row CSV
  const csvPath = `${sessionDir}/wave-${nodeId}.csv`;
  const csv = `id,skill_call,topic\n"${nodeId}","${skillCall.replace(/"/g, '""')}","Chain \\"${state.chain}\\" node ${nodeId}"`;
  Write(csvPath, csv);

  // 3. Spawn
  spawn_agents_on_csv({
    csv_path: csvPath,
    id_column: "id",
    instruction: AGENT_INSTRUCTION,
    max_workers: 1,
    max_runtime_seconds: 1800,
    output_csv_path: `${sessionDir}/wave-${nodeId}-results.csv`,
    output_schema: RESULT_SCHEMA
  });

  // 4. Read result
  const results = readCSV(`${sessionDir}/wave-${nodeId}-results.csv`);
  const result = results[0];
  const outcome = result?.status === 'completed' ? 'success' : 'failed';

  // 5. Update context with result (for downstream decision eval)
  state.context.result = parseResultContext(result);

  // 6. Record history
  state.history.push({
    node_id: nodeId, type: 'command', outcome,
    summary: result?.summary ?? '', timestamp: now()
  });

  // 7. Advance or fail
  if (outcome === 'failed') {
    if (node.on_failure) {
      state.current_node = node.on_failure;
    } else {
      state.status = 'failed';
    }
  } else {
    state.current_node = node.next;
  }
}
```

#### handleDecision — in-process expr evaluation

```javascript
function handleDecision(state, nodeId, node) {
  // Resolve eval expression from context
  const evalKey = node.eval;   // e.g. "ctx.result.verification_status"
  const value = resolveExpr(evalKey, state.context);

  // Match edge
  let target = null;
  let matchedLabel = null;
  for (const edge of node.edges) {
    if (edge.value !== undefined && String(edge.value) === String(value)) {
      target = edge.target;
      matchedLabel = edge.label ?? edge.description ?? String(edge.value);
      break;
    }
    if (edge.match && new RegExp(edge.match).test(String(value))) {
      target = edge.target;
      matchedLabel = edge.label ?? edge.description ?? edge.match;
      break;
    }
  }
  // Default fallback
  if (!target) {
    const defaultEdge = node.edges.find(e => e.default);
    if (defaultEdge) {
      target = defaultEdge.target;
      matchedLabel = defaultEdge.label ?? defaultEdge.description ?? 'default';
    }
  }

  state.history.push({
    node_id: nodeId, type: 'decision',
    outcome: target ? 'resolved' : 'no_match',
    summary: `${evalKey} = "${value}" → ${matchedLabel ?? 'none'}`,
    timestamp: now()
  });

  if (target) {
    state.current_node = target;
  } else {
    state.status = 'failed';
  }
}
```

#### handleGate — condition check

```javascript
function handleGate(state, nodeId, node) {
  const passed = resolveExpr(node.condition, state.context);
  state.history.push({
    node_id: nodeId, type: 'gate',
    outcome: passed ? 'passed' : 'blocked',
    summary: `${node.condition} → ${passed}`,
    timestamp: now()
  });
  state.current_node = passed ? node.on_pass : node.on_fail;
}
```

#### handleTerminal

```javascript
function handleTerminal(state, nodeId, node) {
  state.status = node.status === 'success' ? 'completed' : 'failed';
  state.history.push({
    node_id: nodeId, type: 'terminal',
    outcome: node.status ?? 'completed',
    summary: node.summary ?? 'Chain walk complete',
    timestamp: now()
  });
}
```

### Shared Utilities

```javascript
const AUTO_FLAG_MAP = {
  'maestro-analyze': '-y', 'maestro-brainstorm': '-y',
  'maestro-ui-design': '-y', 'maestro-plan': '--auto',
  'maestro-spec-generate': '-y', 'quality-test': '--auto-fix',
  'quality-retrospective': '--auto-yes', 'maestro-roadmap': '-y',
};

function buildSkillCall(node, ctx, autoMode) {
  let args = (node.args ?? '')
    .replace(/{phase}/g, ctx.phase ?? '')
    .replace(/{description}/g, ctx.description ?? '')
    .replace(/{issue_id}/g, ctx.issue_id ?? '')
    .replace(/{milestone_num}/g, ctx.milestone_num ?? '');
  if (autoMode) {
    const flag = node.auto_flag ?? AUTO_FLAG_MAP[node.cmd];
    if (flag && !args.includes(flag)) args = args ? `${args} ${flag}` : flag;
  }
  return `$${node.cmd} ${args}`.trim();
}

function resolveExpr(expr, ctx) {
  // expr is "ctx.result.verification_status" or "all_phases_completed"
  // Navigate dot-path from context root
  if (!expr) return undefined;
  const path = expr.replace(/^ctx\./, '').split('.');
  let val = ctx;
  for (const key of path) {
    if (val == null) return undefined;
    val = val[key];
  }
  return val;
}

function parseResultContext(result) {
  // Extract structured fields from agent result for decision eval
  if (!result) return {};
  try {
    const parsed = typeof result.findings === 'string'
      ? JSON.parse(result.findings) : result.findings;
    return { ...parsed, _raw_summary: result.summary, _status: result.status };
  } catch {
    return { _raw_summary: result.summary ?? '', _status: result.status ?? 'unknown' };
  }
}
```

### Sub-Agent Instruction Template

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
{"status":"completed|failed","skill_call":"{skill_call}","summary":"一句话结果","findings":"JSON 结构化结果（含 decision 所需字段）","artifacts":"产物路径或空字符串","error":"失败原因或空字符串"}
```

**findings 字段规约**：sub-agent 必须在 findings 中返回 decision node 需要的字段。例如：
- `maestro-verify` → `{"verification_status": "passed|failed", ...}`
- `quality-review` → `{"review_verdict": "PASS|BLOCK", ...}`
- `quality-test` → `{"uat_status": "passed|failed", ...}`
- `maestro-milestone-audit` → `{"audit_verdict": "PASS|BLOCK", ...}`

Coordinator 将 `findings` 解析后写入 `ctx.result`，供后续 decision node 的 `eval` 表达式读取。

### Result Schema

```javascript
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["completed", "failed"] },
    skill_call: { type: "string" },
    summary: { type: "string" },
    findings: { type: "string" },
    artifacts: { type: "string" },
    error: { type: "string" }
  },
  required: ["status", "skill_call", "summary", "findings", "artifacts", "error"]
};
```

### Phase 3: Completion Report

```javascript
state.completed_at = new Date().toISOString();
Write(`${sessionDir}/state.json`, JSON.stringify(state, null, 2));
```

Display:
```
=== LINK-COORDINATE COMPLETE ===
Session:  {sessionId}
Chain:    {chain.name} ({chain.id})
Status:   {completed|failed}

NODE WALK:
  [✓] plan (command) — success — Plan generated
  [→] check_verify (decision) — ctx.result.verification_status = "passed" → review
  [✓] review (command) — success — No blockers
  [→] check_review (decision) — ctx.result.review_verdict = "PASS" → test
  [✓] test (command) — success — All tests passing

Nodes: {completed}/{total} | Visits: {total_visits}
State: .workflow/.maestro-coordinate/{sessionId}/state.json
Resume: $maestro-link-coordinate -c {sessionId}
```

</execution>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no --list/--chain | Suggest --list |
| E002 | error | Chain graph JSON not found | List available chains |
| E003 | error | Command node spawn failed | Check wave result CSV, resume with -c |
| E004 | error | Decision node: no matching edge | Show eval value and available edges |
| E005 | error | max_visits exceeded on node | Show loop path, suggest --chain with simpler graph |
| E006 | error | Resume session not found | List available sessions |
| W001 | warning | Decision eval returned undefined | Fall through to default edge |
</error_codes>

<success_criteria>
- [ ] Chain graph loaded from chains/ directory (multi-path resolution)
- [ ] Session state initialized with graph entry node
- [ ] Every command node dispatched via spawn_agents_on_csv — coordinator never executes skills
- [ ] Decision nodes resolved in-process via expr evaluation against ctx.result
- [ ] Gate nodes evaluated in-process with pass/fail routing
- [ ] max_visits tracked per node, exceeded → failure
- [ ] Context flows forward: command result → ctx.result → decision eval → next command args
- [ ] State persisted after every node for resumability
- [ ] -c resumes from last incomplete node
- [ ] --list displays available chains without starting a session
- [ ] -y propagates auto_flag to command skill_calls
- [ ] Completion report shows per-node walk with outcomes
- [ ] findings from sub-agent parsed into ctx.result for decision routing
</success_criteria>
