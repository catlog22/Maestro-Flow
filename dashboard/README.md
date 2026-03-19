# Maestro Dashboard

Real-time project orchestration dashboard with Linear-style Kanban board, multi-agent execution control, and autonomous Commander supervision. Runs at `http://127.0.0.1:3001`.

## Views

The Kanban page (`/kanban`) provides four views:

| View | Shortcut | Description |
|------|----------|-------------|
| **Board** | `K` | Kanban columns (Backlog → In Progress → Review → Done) with Phase cards, Issue cards, and Linear integration |
| **Timeline** | `T` | Gantt-style phase timeline with progress indicators |
| **Center** | `C` | Command center — active executions, Issue queue, quality summary |
| **Table** | `L` | Sortable tabular view with all phase/issue metadata |

## Issue Lifecycle on Kanban

Issues have a **dual status system**:

- **IssueStatus** (`open` / `in_progress` / `resolved` / `closed`) — determines which **column** the card appears in
- **DisplayStatus** (`open` / `analyzing` / `planned` / `in_progress` / `resolved` / `closed`) — determines the **label color** on the card

An Issue with `status=open` always stays in the Backlog column, but its label changes from "open" → "analyzing" → "planned" as analysis and solution data are attached.

| Status | Kanban Column |
|--------|---------------|
| `open` | Backlog |
| `in_progress` | In Progress |
| `resolved` | Review |
| `closed` | Done |

### Issue Card Actions

- **Click** — Open detail modal (analysis, solution steps, execution results)
- **Executor dropdown** — Select agent: Claude Code / Codex / Gemini
- **Play button** — Dispatch execution via WebSocket
- **Multi-select** — Batch execution with floating toolbar
- **Create** — `C` shortcut or `+` button on column header

## Commander Agent

The autonomous supervisor runs a tick loop (`assess → decide → dispatch`) and automatically:

- Analyzes un-analyzed Issues (`open` + no `analysis`)
- Plans analyzed Issues (`analysis` exists, no `solution`)
- Executes planned Issues via ExecutionScheduler
- Profiles: `conservative` / `balanced` / `aggressive`

## Phase Pipeline Commands

| Status | Display Label | Recommended Command |
|--------|--------------|---------------------|
| `pending` | Pending | `/maestro-analyze {N}` |
| `exploring` | Explore | `/maestro-plan {N}` |
| `planning` | Plan | `/maestro-execute {N}` |
| `executing` | Execute | *(running)* |
| `verifying` | Verify | `/quality-review {N}` |
| `testing` | Test | `/quality-test {N}` |
| `completed` | Done | `/maestro-phase-transition` |
| `blocked` | Blocked | `/quality-debug` |

## Pre-Pipeline Setup

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `/maestro-init` | Initialize `.workflow/` directory |
| 2 | `/maestro-brainstorm` *(optional)* | Multi-role brainstorming |
| 3a | `/maestro-roadmap` | Lightweight interactive roadmap |
| 3b | `/maestro-spec-generate` | Full spec pipeline (PRD → architecture → roadmap) |
| 4 | `/maestro-plan 1` | Create Phase 1 execution plan |

## Development

```bash
cd dashboard
npm install
npm run dev        # Vite dev server + Hono API on port 3001
```

### Build

```bash
npm run build      # TypeScript + Vite build
npm start          # Production server
```

### Test

```bash
npm test           # Vitest
npm run test:watch # Watch mode
```

## Architecture

```
dashboard/src/
├── client/                  # React 19 + Zustand + Tailwind CSS 4
│   ├── components/
│   │   └── kanban/          # 19 components (Board, Column, PhaseCard, IssueCard, ...)
│   ├── pages/               # KanbanPage, WorkflowPage, SpecsPage, ArtifactsPage, McpPage
│   ├── store/               # 5 Zustand stores (board, issue, execution, linear, ui-prefs)
│   └── hooks/               # Custom React hooks
├── server/                  # Hono API + WebSocket + SSE
│   ├── agents/              # AgentManager + adapters (Claude SDK, Codex CLI, OpenCode)
│   ├── commander/           # CommanderAgent (tick loop, prompts, config, profiles)
│   ├── execution/           # ExecutionScheduler + WaveExecutor + WorkspaceManager
│   ├── routes/              # 14 route modules (issues, board, phases, agents, mcp, ...)
│   ├── state/               # StateManager, EventBus, FSWatcher
│   ├── ws/                  # WebSocket manager
│   └── sse/                 # Server-Sent Events hub
└── shared/                  # Types shared between client and server
    ├── types.ts             # PhaseCard, BoardState, PhaseStatus
    ├── issue-types.ts       # Issue, IssueAnalysis, IssueSolution
    ├── agent-types.ts       # AgentType, AgentProcess, AgentConfig
    ├── commander-types.ts   # CommanderConfig, PriorityAction, Assessment
    └── constants.ts         # Status colors, display status derivation, API endpoints
```

### Key Data Flow

```
.workflow/ files ──→ StateManager ──→ SSE ──→ Zustand stores ──→ React UI
                                                      ↑
WebSocket ←── IssueCard actions ←── User interaction ─┘
    │
    ↓
AgentManager.spawn() / ExecutionScheduler.dispatch()
    │
    ↓
Agent process (Claude SDK / Codex CLI / Gemini CLI)
    │
    ↓
PATCH /api/issues/:id ──→ JSONL file ──→ StateManager ──→ SSE ──→ UI update
```
