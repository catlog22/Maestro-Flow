# Dispatch Tasks

Create task chains from dependency graph, write to tasks.json with proper deps relationships.

## Workflow

1. Read task-analysis.json -> extract dependency_graph
2. Read specs/pipelines.md -> get task registry for selected pipeline
3. Topological sort tasks (respect deps)
4. Validate all owners exist in role registry (SKILL.md)
5. For each task (in order):
   - Add task entry to tasks.json `tasks` object (see template below)
   - Set deps array with upstream task IDs
   - Assign wave number based on dependency depth
6. Update tasks.json metadata: total count, wave assignments
7. Validate chain (no orphans, no cycles, all refs valid)

## Task Entry Template

Each task in tasks.json `tasks` object:
```json
{
  "<TASK-ID>": {
    "title": "<concise title>",
    "description": "PURPOSE: <goal> | Success: <criteria>\nTASK:\n  - <step 1>\n  - <step 2>\nCONTEXT:\n  - Session: <session-folder>\n  - Upstream artifacts: <list>\n  - Key files: <list>\nEXPECTED: <artifact path> + <quality criteria>\nCONSTRAINTS: <scope limits>\n---\nInnerLoop: <true|false>\nRoleSpec: <project>/.codex/skills/team-lifecycle-v4/roles/<role>/role.md",
    "role": "<role-name>",
    "pipeline_phase": "<phase>",
    "deps": ["<upstream-task-id>", "..."],
    "context_from": ["<upstream-task-id>", "..."],
    "wave": 1,
    "status": "pending",
    "findings": null,
    "quality_score": null,
    "supervision_verdict": null,
    "error": null
  }
}
```

## InnerLoop Flag Rules

- true: Role has 2+ serial same-prefix tasks (writer: DRAFT-001->004)
- false: Role has 1 task, or tasks are parallel

## CHECKPOINT Task Rules

CHECKPOINT tasks are dispatched like regular tasks but handled differently at spawn time:

- Added to tasks.json with proper deps (upstream tasks that must complete first)
- Owner: supervisor
- **NOT spawned as team_worker** — coordinator wakes the resident supervisor via followup_task
- If `supervision: false` in tasks.json, skip creating CHECKPOINT tasks entirely
- RoleSpec in description: `<project>/.codex/skills/team-lifecycle-v4/roles/supervisor/role.md`

## Dependency Validation

- No orphan tasks (all tasks have valid owner)
- No circular dependencies
- All deps references exist in tasks object
- Session reference in every task description
- RoleSpec reference in every task description
