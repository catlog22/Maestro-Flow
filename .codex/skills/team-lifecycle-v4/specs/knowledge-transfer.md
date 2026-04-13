# Knowledge Transfer Protocols

## 1. Transfer Channels

| Channel | Method | Producer | Consumer |
|---------|--------|----------|----------|
| Artifacts | Files in `<session>/artifacts/` | Task executor | Next task in pipeline |
| Discoveries | Files in `<session>/discoveries/{task_id}.json` | Task executor | Coordinator + downstream |
| Wisdom | Append to `<session>/wisdom/*.md` | Any role | All roles |
| Context Accumulator | In-memory aggregation | Inner loop only | Current task |
| Exploration Cache | `<session>/explorations/` | Analyst / researcher | All roles |
| **Progress Milestones** | `team_msg` type=progress/blocker/task_complete | Worker (all roles) | Coordinator + Human (CLI) |
| **Cross-Worker Handoff** | `send_message` from coordinator to running worker | Coordinator | Running worker |

## 2. Context Loading Protocol (Before Task Execution)

Every role MUST load context in this order before starting work.

| Step | Action | Required |
|------|--------|----------|
| 1 | Read `<session>/tasks.json` -- locate upstream task entries, check status and findings | Yes |
| 2 | Read `<session>/discoveries/{upstream_id}.json` for each upstream dependency -- get detailed findings and artifact paths | Yes |
| 3 | Read artifact files from upstream discovery's `artifacts_produced` paths | Yes |
| 4 | Read `<session>/wisdom/*.md` if exists | Yes |
| 5 | Check `<session>/explorations/cache-index.json` before new exploration | If exploring |

**Loading rules**:
- Never skip step 1 -- tasks.json contains task status, wave progression, and summary findings
- Never skip step 2 -- discoveries contain detailed key_findings, decisions, and artifact references
- If artifact path in discovery does not exist, log warning and continue
- Wisdom files are append-only -- read all entries, newest last

## 3. Context Publishing Protocol (After Task Completion)

| Step | Action | Required |
|------|--------|----------|
| 1 | Write deliverable to `<session>/artifacts/<task-id>-<name>.md` | Yes |
| 2 | Write `<session>/discoveries/{task_id}.json` with payload (see schema below) | Yes |
| 3 | Append wisdom entries for learnings, decisions, issues found | If applicable |

## 4. Discovery File Schema

Written to `<session>/discoveries/{task_id}.json` on task completion.

```json
{
  "task_id": "<TASK-NNN>",
  "worker": "<TASK-NNN>",
  "timestamp": "2026-03-24T10:15:00+08:00",
  "type": "<pipeline_phase>",
  "status": "completed | failed",
  "findings": "Summary string (max 500 chars)",
  "quality_score": null,
  "supervision_verdict": null,
  "error": null,
  "data": {
    "key_findings": [
      "Finding 1",
      "Finding 2"
    ],
    "decisions": [
      "Decision with rationale"
    ],
    "files_modified": [
      "path/to/file.ts"
    ],
    "verification": "self-validated | peer-reviewed | tested"
  },
  "artifacts_produced": [
    "<session>/artifacts/<task-id>-<name>.md"
  ]
}
```

**Field rules**:
- `artifacts_produced`: Always artifact paths, never inline content
- `data.key_findings`: Max 5 items, each under 100 chars
- `data.decisions`: Include rationale, not just the choice
- `data.files_modified`: Only for implementation tasks
- `data.verification`: One of `self-validated`, `peer-reviewed`, `tested`

**Supervisor-specific extensions** (CHECKPOINT tasks only):

```json
{
  "supervision_verdict": "pass | warn | block",
  "supervision_score": 0.85,
  "data": {
    "risks_logged": 0,
    "blocks_detected": 0
  }
}
```

- `supervision_verdict`: Required for CHECKPOINT tasks. Determines pipeline progression.
- `supervision_score`: Float 0.0-1.0. Aggregate of individual check scores.
- `data.risks_logged`: Count of risks written to wisdom/issues.md.
- `data.blocks_detected`: Count of blocking issues found. >0 implies verdict=block.

## 5. Exploration Cache Protocol

Prevents redundant research across tasks.

| Step | Action |
|------|--------|
| 1 | Read `<session>/explorations/cache-index.json` |
| 2 | If angle already explored, read cached result from `explore-<angle>.json` |
| 3 | If not cached, perform exploration |
| 4 | Write result to `<session>/explorations/explore-<angle>.json` |
| 5 | Update `cache-index.json` with new entry |

**cache-index.json format**:
```json
{
  "entries": [
    {
      "angle": "competitor-analysis",
      "file": "explore-competitor-analysis.json",
      "created_by": "RESEARCH-001",
      "timestamp": "2026-01-15T10:30:00Z"
    }
  ]
}
```

**Rules**:
- Cache key is the exploration `angle` (normalized to kebab-case)
- Cache entries never expire within a session
- Any role can read cached explorations; only the creator updates them

## 6. Progress Milestone Protocol

Workers report progress during execution via `team_msg`. This provides:
- **Human CLI monitoring**: `maestro msg list -s <session-id> --type progress` works while coordinator is blocked in `wait_agent`
- **Coordinator post-wait trace**: Full execution history for forensics and status display
- **Blocker awareness**: Coordinator knows where worker got stuck on timeout

### Message Types

| Type | When | Purpose |
|------|------|---------|
| `progress` | At natural phase boundaries | Report milestone reached + progress % |
| `blocker` | Immediately on error | Report blocking issue without waiting |
| `task_complete` | After `report_agent_job_result` | Final status for coordinator trace |

### Progress Message Schema

```javascript
mcp__maestro-tools__team_msg({
  operation: "log",
  session_id: "<session_id>",
  from: "<task_id>",           // e.g., "IMPL-001"
  to: "coordinator",
  type: "progress",            // or "blocker" or "task_complete"
  summary: "[<task_id>] <phase description> (<pct>%)",
  data: {
    task_id: "<task_id>",
    role: "<role>",
    status: "in_progress",     // in_progress | blocked | completed
    progress_pct: 0-100,
    phase: "<what just completed>",
    key_info: "<most important finding>"
  }
})
```

### Timing Constraint

`wait_agent` is **blocking** — coordinator cannot read team_msg during wait. Progress is only consumed:
1. On `handleCheck` (user types "check" while coordinator is idle)
2. On `handleResume` after `wait_agent` returns (drain bus before collecting discoveries)
3. By human via `maestro msg list` CLI (works anytime, independent of coordinator)

### Relationship to Discoveries

- **Progress milestones** = lightweight trace during execution (via team_msg)
- **Discovery files** = authoritative final output (via `discoveries/{task_id}.json`)
- If team_msg fails, worker continues — discovery file is ground truth
- Coordinator always reads both: team_msg for trace, discoveries for results

## 7. Cross-Worker Handoff Protocol

When worker A completes and worker B is still running, coordinator pushes A's findings to B via `send_message`:

```javascript
// In handleSpawnNext, after collecting A's discovery:
send_message({
  target: "IMPL-002",        // B's task_name
  message: `## Supplementary Context from IMPL-001\n${findingsFromA}`
})
// Note: send_message queues info without interrupting B's current work
```

**When to send**: After each wave of discoveries is collected, if any running worker could benefit from the new findings.
**What to send**: Key findings and decisions from completed tasks, especially those listed in `context_from` deps.

## 8. Platform Mapping Reference

| Claude Code Operation | Codex Equivalent |
|----------------------|------------------|
| `team_msg(operation="get_state", role=<upstream>)` | Read `tasks.json` + Read `discoveries/{upstream_id}.json` |
| `team_msg(type="state_update", payload={...})` | Write `discoveries/{task_id}.json` |
| `TaskCreate` / `TaskUpdate` status fields | Read/Write `tasks.json` task entries |
| In-memory state aggregation | Parse `tasks.json` + glob `discoveries/*.json` |
