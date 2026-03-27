# Workflow: maestro-link-coordinate

Chain-graph coordinator via `maestro coordinate` CLI endpoint. Loads a chain graph, walks node by node via step-mode subcommands. Each command node executed through `maestro cli` internally.

---

### Step 1: Parse Arguments

```javascript
const args = $ARGUMENTS.trim();
const listMode = /\b--list\b/.test(args);
const autoYes = /\b(-y|--yes)\b/.test(args);
const resumeMode = /\b(-c|--continue)\b/.test(args);
const resumeId = args.match(/(?:-c|--continue)\s+(\S+)/)?.[1] || null;
const forcedChain = args.match(/--chain\s+(\S+)/)?.[1] || null;
const cliTool = args.match(/--tool\s+(\S+)/)?.[1] || 'claude';
const intent = args
  .replace(/\b(-y|--yes|--list|-c|--continue)\b/g, '')
  .replace(/(?:-c|--continue)\s+\S+/g, '')
  .replace(/--(chain|tool)\s+\S+/g, '')
  .trim();
```

---

### Step 2: Handle --list

```bash
maestro coordinate list
```

Exit after display.

---

### Step 3: Start or Resume Session

#### 3a: New session (step mode)

```bash
maestro coordinate start "{intent}" --chain {forcedChain} --tool {cliTool} {autoYes ? '-y' : ''}
```

Outputs JSON to stdout:

```json
{
  "session_id": "coord-1711612800-a1b2",
  "status": "step_paused",
  "graph_id": "full-lifecycle",
  "current_node": "plan",
  "steps_completed": 1,
  "last_step": { "node_id": "plan", "outcome": "success", "summary": "..." },
  "history": [...]
}
```

Capture `session_id` from output.

#### 3b: Resume existing session

```bash
maestro coordinate next {resumeId}
```

Same JSON output format.

---

### Step 4: Step Loop

Parse JSON output from start/next. While `status === "step_paused"`:

```bash
maestro coordinate next {session_id}
```

After each call:
- Parse JSON output
- Log step result: `[Step N] /{cmd} — {outcome} — {summary}`
- If `status === "step_paused"` → continue loop
- If `status === "completed"` → **Step 5**
- If `status === "failed"` → **Step 5**

The walker handles internally:
- Prompt assembly from `coordinate-step` template
- CLI execution via `maestro cli --tool {tool} --mode write`
- Decision/gate/eval node auto-resolution
- max_visits loop prevention
- State persistence to `.workflow/.maestro-coordinate/{session_id}/`

---

### Step 5: Completion

```bash
maestro coordinate status {session_id}
```

Display final summary:

```
============================================================
  COORDINATE COMPLETE
============================================================
  Session: {session_id}
  Graph:   {graph_id}
  Status:  {completed|failed}

  Steps:
    [✓] plan — success — Plan generated
    [✓] execute — success — Implementation done
    [✗] verify — failure — 2 issues found
    [→] check_result → retry_plan (decision)
    [✓] retry_plan — success — Gaps fixed
    [✓] retry_execute — success — All passing

  Completed: {N} | Failed: {N}
============================================================
```

---

## CLI Endpoint Reference

| Command | Description | Output |
|---------|-------------|--------|
| `maestro coordinate list` | List all chain graphs | Table to stdout |
| `maestro coordinate start "intent" --chain X --tool Y` | Start step-mode session | JSON (session_id, status, last_step) |
| `maestro coordinate next [sessionId]` | Execute next step | JSON (updated state) |
| `maestro coordinate status [sessionId]` | Query session state | JSON (full state) |
| `maestro coordinate run "intent" --chain X --tool Y` | Autonomous full run | JSON (final state) |

---

## Core Rules

1. **All execution via CLI endpoint** — `maestro coordinate start/next/run`, never direct walker calls
2. **Step mode by default** — `start` pauses after each command node, `next` advances one step
3. **JSON protocol** — all subcommands output structured JSON to stdout, logs to stderr
4. **Session persistence** — state at `.workflow/.maestro-coordinate/{session_id}/walker-state.json`
5. **Decision auto-resolve** — walker evaluates `ctx.result.status` internally between steps
6. **Resume** — `next {sessionId}` continues any step_paused session
7. **Autonomous fallback** — `run` walks entire graph without pausing (backward compat)
