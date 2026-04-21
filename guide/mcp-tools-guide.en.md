# MCP Tools Reference

The Maestro MCP server exposes 9 tools for AI agents (Claude Code, Codex, etc.) to call directly within a session. All tools are registered via the stdio transport protocol and require no additional configuration.

> **Filtering**: Control which tools are visible via the `MAESTRO_ENABLED_TOOLS` environment variable or `config.mcp.enabledTools`. Default: `['all']`.

---

## Table of Contents

- [Overview](#overview)
- [File Operations](#file-operations)
  - [edit_file](#edit_file)
  - [write_file](#write_file)
  - [read_file](#read_file)
  - [read_many_files](#read_many_files)
- [Team Collaboration](#team-collaboration)
  - [team_msg](#team_msg)
  - [team_mailbox](#team_mailbox)
  - [team_task](#team_task)
  - [team_agent](#team_agent)
- [Persistent Memory](#persistent-memory)
  - [core_memory](#core_memory)
- [CLI Terminal Commands](#cli-terminal-commands)

---

## Overview

| Tool | Category | Purpose |
|------|----------|---------|
| `edit_file` | File Ops | Text replacement or line-level editing with dryRun preview |
| `write_file` | File Ops | Create/overwrite files with auto-mkdir |
| `read_file` | File Ops | Single file reading with line-based pagination |
| `read_many_files` | File Ops | Batch read / directory traversal / content search |
| `team_msg` | Team | Persistent JSONL message bus |
| `team_mailbox` | Team | Mailbox-style message delivery with tracking |
| `team_task` | Team | Task CRUD with state machine management |
| `team_agent` | Team | Agent lifecycle management (spawn/shutdown) |
| `core_memory` | Memory | Cross-session JSON memory storage |

---

## File Operations

### edit_file

Two edit modes: **update** (text replacement) and **line** (position-driven operations). Supports dryRun preview, multi-edit batches, fuzzy matching, and auto line-ending adaptation (CRLF/LF).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | Yes | — | Target file path |
| `mode` | `"update"` \| `"line"` | No | `"update"` | Edit mode |
| `dryRun` | boolean | No | `false` | Preview diff without modifying file |

**Update mode parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `oldText` | string | Yes* | Text to find |
| `newText` | string | Yes* | Replacement text |
| `edits` | `{oldText, newText}[]` | Yes* | Batch replacements (use instead of oldText/newText) |
| `replaceAll` | boolean | No | Replace all occurrences (default: first only) |

**Line mode parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `operation` | `"insert_before"` \| `"insert_after"` \| `"replace"` \| `"delete"` | Yes | Line operation type |
| `line` | number | Yes | Line number (1-based) |
| `end_line` | number | No | End line for range operations |
| `text` | string | No | Content for insert/replace |

#### Examples

```jsonc
// Text replacement
{ "path": "src/app.ts", "oldText": "hello", "newText": "world" }

// Batch replacement
{ "path": "src/app.ts", "edits": [{"oldText": "foo", "newText": "bar"}, {"oldText": "baz", "newText": "qux"}] }

// Line insertion
{ "path": "src/app.ts", "mode": "line", "operation": "insert_after", "line": 10, "text": "// added" }

// Preview changes
{ "path": "src/app.ts", "oldText": "old", "newText": "new", "dryRun": true }
```

---

### write_file

Create or overwrite files with auto-created parent directories. Supports optional backup and multiple encodings.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | Yes | — | File path |
| `content` | string | Yes | — | Content to write |
| `createDirectories` | boolean | No | `true` | Auto-create parent directories |
| `backup` | boolean | No | `false` | Create timestamped backup before overwrite |
| `encoding` | `"utf8"` \| `"utf-8"` \| `"ascii"` \| `"latin1"` \| `"binary"` \| `"hex"` \| `"base64"` | No | `"utf8"` | File encoding |

#### Examples

```jsonc
// Create file
{ "path": "src/new-module.ts", "content": "export const hello = 'world';" }

// Overwrite with backup
{ "path": "config.json", "content": "{\"key\": \"value\"}", "backup": true }
```

---

### read_file

Read a single file with optional line-based pagination. Useful for large files.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | Yes | — | File path |
| `offset` | number | No | — | Line offset (0-based) |
| `limit` | number | No | — | Number of lines to read |

#### Examples

```jsonc
// Read entire file
{ "path": "README.md" }

// Paginated read (lines 100-149)
{ "path": "src/large-file.ts", "offset": 99, "limit": 50 }
```

---

### read_many_files

Batch file reading, directory traversal, and content regex search. Supports glob pattern filtering and depth control.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `paths` | string \| string[] | Yes | — | File path(s) or directory |
| `pattern` | string | No | — | Glob filter (e.g., `"*.ts"`) |
| `contentPattern` | string | No | — | Regex content search |
| `maxDepth` | number | No | `3` | Max directory traversal depth |
| `includeContent` | boolean | No | `true` | Include file content in results |
| `maxFiles` | number | No | `50` | Max files to return |

#### Examples

```jsonc
// Read multiple files
{ "paths": ["src/a.ts", "src/b.ts"] }

// Traverse directory (TypeScript only)
{ "paths": "src/", "pattern": "*.ts" }

// Content search
{ "paths": "src/", "contentPattern": "TODO|FIXME" }

// List files only (no content)
{ "paths": "src/", "includeContent": false }
```

---

## Team Collaboration

### team_msg

Persistent JSONL message bus for agent team communication. Provides 10 operations with delivery status tracking.

**Storage**: `.workflow/.team/{session-id}/.msg/messages.jsonl`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `operation` | enum (see below) | Yes | — | Operation type |
| `session_id` | string | Yes* | — | Session ID (e.g., `TLS-my-project-2026-02-27`) |
| `from` | string | No* | — | Sender role name |
| `to` | string | No | `"coordinator"` | Recipient role |
| `type` | string | No | `"message"` | Message type |
| `summary` | string | No | auto-generated | One-line summary |
| `data` | object | No | — | Structured data payload |
| `id` | string | No* | — | Message ID (for read/delete) |
| `last` | number | No | `20` | Last N messages (max 100) |
| `role` | string | No* | — | Role name (for get_state/read_mailbox) |
| `delivery_method` | string | No | — | Delivery method tracking |

**Operations:**

| Operation | Description |
|-----------|-------------|
| `log` | Append message to log |
| `broadcast` | Send to all team members |
| `read` | Read a specific message by ID |
| `list` | List recent messages with from/to/type filters |
| `status` | Summarize per-role activity |
| `get_state` | Read role state from `meta.json` |
| `read_mailbox` | Read unread messages for a role, mark delivered |
| `mailbox_status` | Per-role delivery status counts |
| `delete` | Delete a message by ID |
| `clear` | Delete all messages for a session |

#### Examples

```jsonc
// Send message
{ "operation": "log", "session_id": "TLS-proj-2026-04-21", "from": "planner", "to": "implementer", "summary": "plan ready", "data": {"phase": 1} }

// Read mailbox
{ "operation": "read_mailbox", "session_id": "TLS-proj-2026-04-21", "role": "implementer" }

// View team status
{ "operation": "status", "session_id": "TLS-proj-2026-04-21" }
```

---

### team_mailbox

Mailbox-style agent messaging with delivery tracking and broker injection. Compared to `team_msg`, this tool focuses on point-to-point delivery confirmation.

**Storage**: `.workflow/.team/{session-id}/.msg/mailbox.jsonl`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `operation` | `"send"` \| `"read"` \| `"status"` | Yes | — | Operation type |
| `session_id` | string | Yes | — | Session ID |
| `from` | string | send | — | Sender role |
| `to` | string | send | — | Recipient role |
| `message` | string | send | — | Message content |
| `type` | string | No | `"message"` | Message type |
| `delivery_method` | `"inject"` \| `"poll"` \| `"broadcast"` | No | `"inject"` | Delivery method |
| `data` | object | No | — | Structured data |
| `role` | string | read | — | Role to read mailbox for |
| `limit` | number | No | `50` | Max messages (1-100) |
| `mark_delivered` | boolean | No | `true` | Mark returned messages as delivered |

#### Examples

```jsonc
// Send message (auto-inject into running agent)
{ "operation": "send", "session_id": "TLS-proj-2026-04-21", "from": "coordinator", "to": "worker-1", "message": "start task A" }

// Read mailbox
{ "operation": "read", "session_id": "TLS-proj-2026-04-21", "role": "worker-1" }

// Check delivery status
{ "operation": "status", "session_id": "TLS-proj-2026-04-21" }
```

---

### team_task

Team task CRUD with session-scoped namespaces and state machine validation. Built on the CollabTask system.

**Storage**: `.workflow/.team/{session_id}/tasks/{id}.json`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `operation` | `"create"` \| `"update"` \| `"list"` \| `"get"` | Yes | — | Operation type |
| `session_id` | string | Yes | — | Session ID |
| `title` | string | create | — | Task title |
| `description` | string | No | — | Task description |
| `owner` | string | No | `"agent"` | Owner (assignee) |
| `priority` | `"low"` \| `"medium"` \| `"high"` \| `"critical"` | No | `"medium"` | Priority |
| `task_id` | string | update/get | — | Task ID (e.g., `ATASK-001`) |
| `status` | `"open"` \| `"assigned"` \| `"in_progress"` \| `"pending_review"` \| `"done"` \| `"closed"` | No | — | Task status |

**State transitions:**

```
open → assigned → in_progress → pending_review → done → closed
                                                        ↘ open (reopen)
```

#### Examples

```jsonc
// Create task
{ "operation": "create", "session_id": "TLS-proj-2026-04-21", "title": "Implement auth", "priority": "high" }

// Update status
{ "operation": "update", "session_id": "TLS-proj-2026-04-21", "task_id": "ATASK-001", "status": "in_progress" }

// List tasks
{ "operation": "list", "session_id": "TLS-proj-2026-04-21" }
```

---

### team_agent

Agent lifecycle management — spawn, shutdown, and remove agents via the Delegate Broker.

**Storage**: `.workflow/.team/{session_id}/members.json`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `operation` | `"spawn_agent"` \| `"shutdown_agent"` \| `"remove_agent"` \| `"members"` | Yes | — | Operation type |
| `session_id` | string | Yes | — | Session ID |
| `role` | string | spawn/shutdown/remove | — | Agent role name |
| `prompt` | string | spawn | — | Agent instructions |
| `tool` | string | No | `"gemini"` | CLI tool to use |

#### Examples

```jsonc
// Spawn agent
{ "operation": "spawn_agent", "session_id": "TLS-proj-2026-04-21", "role": "researcher", "prompt": "Analyze auth patterns", "tool": "gemini" }

// Shutdown agent
{ "operation": "shutdown_agent", "session_id": "TLS-proj-2026-04-21", "role": "researcher" }

// List members
{ "operation": "members", "session_id": "TLS-proj-2026-04-21" }
```

---

## Persistent Memory

### core_memory

Cross-session JSON memory storage at `~/.maestro/data/core-memory/`. Provides 4 operations: list, import, export, search.

**Storage**: `~/.maestro/data/core-memory/{md5-hash-of-project-path}.json`

**ID format**: `CMEM-YYYYMMDD-HHMMSS`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `operation` | `"list"` \| `"import"` \| `"export"` \| `"search"` | Yes | — | Operation type |
| `path` | string | No | auto-detected | Project path override |
| `text` | string | import | — | Content to import |
| `id` | string | export | — | Memory ID |
| `query` | string | search | — | Search keywords |
| `limit` | number | No | `100` | Max results |
| `tags` | string[] | No | — | Tag filter (AND logic) |

#### Examples

```jsonc
// Import memory
{ "operation": "import", "text": "Auth module uses bcrypt + JWT", "tags": ["auth", "security"] }

// Search
{ "operation": "search", "query": "auth token" }

// Export
{ "operation": "export", "id": "CMEM-20260421-143000" }

// List with tag filter
{ "operation": "list", "tags": ["auth"], "limit": 10 }
```

---

## CLI Terminal Commands

In addition to MCP tools, Maestro provides 21 terminal commands invoked via `maestro <command>`.

### Command Overview

| Command | Alias | Purpose |
|---------|-------|---------|
| `maestro install` | — | Install Maestro assets (interactive) |
| `maestro uninstall` | — | Remove installed assets |
| `maestro view` | — | Launch Dashboard kanban board |
| `maestro stop` | — | Stop Dashboard server |
| `maestro update` | — | Check/install latest version |
| `maestro serve` | — | Start workflow server |
| `maestro run` | — | Execute a named workflow |
| `maestro delegate` | — | Delegate task to AI agent |
| `maestro coordinate` | `coord` | Graph workflow coordinator |
| `maestro cli` | — | Run CLI agent tools |
| `maestro launcher` | — | Claude Code launcher (workflow/settings switching) |
| `maestro spec` | — | Project spec management |
| `maestro wiki` | — | Wiki knowledge graph queries |
| `maestro hooks` | — | Hook management and evaluation |
| `maestro overlay` | — | Command overlay management |
| `maestro collab` | `team` | Human team collaboration |
| `maestro agent-msg` | `msg` | Agent team message bus |
| `maestro core-memory` | `cm` | Persistent memory management |
| `maestro brainstorm-visualize` | `bv` | Brainstorm visualization server |
| `maestro ext` | — | Extension management |
| `maestro tool` | — | Tool interaction (list/exec) |

---

### maestro install

Install Maestro assets to project or global directory with interactive step selection.

```bash
maestro install                           # Interactive install
maestro install --force                   # Non-interactive batch install
maestro install components                # Install file components
maestro install hooks                     # Install hooks
maestro install mcp                       # Register MCP server
```

| Option | Description |
|--------|-------------|
| `--force` | Non-interactive batch install of all components |
| `--global` | Install global assets only |
| `--path <dir>` | Install to specified project directory |
| `--hooks <level>` | Hook level: none / minimal / standard / full |

---

### maestro uninstall

Remove installed Maestro assets.

```bash
maestro uninstall              # Interactive uninstall
maestro uninstall --all        # Uninstall all recorded installations
maestro uninstall --all -y     # Skip confirmation
```

---

### maestro view

Launch the Dashboard kanban board (browser or TUI).

```bash
maestro view                   # Launch board (auto-open browser)
maestro view --tui             # Terminal UI mode
maestro view --dev             # Vite dev mode (HMR)
maestro view --port 8080       # Custom port
```

| Option | Default | Description |
|--------|---------|-------------|
| `--port`, `-p` | `3001` | Server port |
| `--host` | `127.0.0.1` | Bind host |
| `--path <dir>` | CWD | Workspace root (containing `.workflow/`) |
| `--no-browser` | — | Don't auto-open browser |
| `--tui` | — | Terminal UI mode |
| `--dev` | — | Vite dev server mode |

---

### maestro stop

Stop the Dashboard server. 3-stage strategy: graceful shutdown → port lookup kill → force kill.

```bash
maestro stop                   # Graceful stop
maestro stop --force           # Force kill
maestro stop --port 8080       # Custom port
```

---

### maestro update

Check for and install the latest version.

```bash
maestro update                 # Check and prompt to install
maestro update --check         # Check only, don't install
```

---

### maestro delegate

Delegate tasks to AI agent tools (gemini/qwen/codex/claude/opencode). Supports sync, async, and session resume.

```bash
# Synchronous execution
maestro delegate "analyze auth module" --to gemini

# Async background execution
maestro delegate "fix bug in auth" --to gemini --async

# Inspect execution
maestro delegate show
maestro delegate status gem-143022-a7f2
maestro delegate output gem-143022-a7f2

# Message injection
maestro delegate message gem-143022-a7f2 "also check utils"

# Resume session
maestro delegate "continue" --to gemini --resume gem-143022-a7f2
```

| Option | Default | Description |
|--------|---------|-------------|
| `--to <tool>` | First enabled tool | Target tool (gemini/qwen/codex/claude/opencode) |
| `--mode <mode>` | `analysis` | Execution mode: analysis (read-only) / write |
| `--model <model>` | Tool default | Model override |
| `--cd <dir>` | CWD | Working directory |
| `--rule <template>` | — | Protocol + template loading |
| `--id <id>` | Auto-generated | Execution ID |
| `--resume [id]` | — | Resume last/specific session |
| `--async` | — | Run detached in background |
| `--backend <type>` | `direct` | Adapter backend: direct / terminal |

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `show [--all]` | List execution history |
| `output <id> [--verbose]` | Get output |
| `status <id> [--events N]` | View status |
| `tail <id>` | Recent events + history |
| `cancel <id>` | Request cancellation |
| `message <id> <text> [--delivery inject\|after_complete]` | Inject message |
| `messages <id>` | View message queue |

---

### maestro coordinate

Graph workflow coordinator with step mode (execute one node at a time) and auto mode (full graph traversal).

```bash
# List available chain graphs
maestro coordinate list

# Auto run (full graph traversal)
maestro coordinate run "implement auth" --chain default -y

# Step mode
maestro coordinate start "implement auth" --chain default
maestro coordinate next <sessionId>
maestro coordinate status <sessionId>

# Report node result
maestro coordinate report --session <id> --node <id> --status SUCCESS
```

| Option | Description |
|--------|-------------|
| `--chain <name>` | Specify chain graph |
| `--tool <tool>` | Agent tool (default: `claude`) |
| `-y`, `--yes` | Auto-confirm mode |
| `--parallel` | Enable fork/join parallel execution |
| `--dry-run` | Preview execution plan |
| `--continue`, `-c` | Resume session |

---

### maestro cli

Unified CLI agent tool interface (gemini/qwen/codex/claude/opencode).

```bash
maestro cli -p "analyze code" --tool gemini --mode analysis
maestro cli -p "fix bug" --tool gemini --mode write
maestro cli show                    # View execution history
maestro cli output <id>             # Get output
maestro cli watch <id>              # Stream output in real-time
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p`, `--prompt` | **required** | Prompt text |
| `--tool <name>` | First enabled tool | CLI tool |
| `--mode <mode>` | `analysis` | Execution mode |
| `--model <model>` | Tool default | Model override |
| `--cd <dir>` | CWD | Working directory |
| `--rule <template>` | — | Template loading |
| `--id <id>` | Auto-generated | Execution ID |
| `--resume [id]` | — | Resume session |

---

### maestro launcher

Unified Claude Code launcher with workflow profile and settings switching.

```bash
maestro launcher -w my-project -s dev    # Launch with profile
maestro launcher list                    # List all profiles
maestro launcher status                  # Show active profile
maestro launcher add-workflow my-proj --claude-md ./CLAUDE.md
```

---

### maestro spec

Project spec management (init, load, list, status).

```bash
maestro spec init                 # Initialize spec system
maestro spec load --category coding --keyword auth
maestro spec list                 # List spec files
maestro spec status               # Show spec status
```

---

### maestro wiki

Wiki knowledge graph queries and mutations. Offline by default, `--live` for HTTP API.

```bash
maestro wiki list --type spec     # List by type
maestro wiki search "auth"        # BM25 full-text search
maestro wiki get <id>             # Get single entry
maestro wiki health               # Graph health score
maestro wiki orphans              # Orphan entries
maestro wiki hubs --limit 5       # Top-N hub nodes
maestro wiki create --type note --slug my-note --title "My Note"
```

---

### maestro hooks

Hook management and evaluator execution.

```bash
maestro hooks install --level full     # Install hooks
maestro hooks status                   # View installation status
maestro hooks list                     # List all hooks
maestro hooks toggle spec-injector on  # Toggle hook
maestro hooks run spec-injector        # Run evaluator
```

Available hooks: `context-monitor`, `spec-injector`, `delegate-monitor`, `team-monitor`, `telemetry`, `session-context`, `skill-context`, `coordinator-tracker`, `preflight-guard`, `spec-validator`, `keyword-spec-injector`, `workflow-guard`

---

### maestro overlay

Command overlay management — non-invasive patches for `.claude/commands`.

```bash
maestro overlay list                    # View and manage overlays
maestro overlay apply                   # Reapply all overlays (idempotent)
maestro overlay add my-overlay.json     # Install overlay
maestro overlay remove my-overlay       # Remove overlay
maestro overlay bundle -o bundle.json   # Pack into portable file
maestro overlay import-bundle bundle.json  # Import bundle
```

---

### maestro collab (alias: team)

Human team collaboration — join, report, and view activity.

```bash
maestro collab join                    # Register as team member
maestro collab whoami                  # Show current identity
maestro collab status                  # View team activity
maestro collab sync                    # Sync with remote
maestro collab preflight --phase 1     # Conflict preflight check
maestro collab guard                   # Show namespace boundaries
maestro collab task create --title "task"
maestro collab task list --status open
```

---

### maestro agent-msg (alias: msg)

Agent team message bus.

```bash
maestro msg send "task done" -s <session> --from worker --to coordinator
maestro msg list -s <session> --last 10
maestro msg status -s <session>
maestro msg broadcast "meeting" -s <session> --from coordinator
```

---

### maestro core-memory (alias: cm)

Persistent memory management.

```bash
maestro cm list --tags auth             # List by tag
maestro cm import "auth uses JWT" --tags auth,security
maestro cm export CMEM-20260421-143000  # Export
maestro cm search "auth token"          # Search
```

---

### maestro brainstorm-visualize (alias: bv)

Brainstorm HTML prototype visualization server.

```bash
maestro bv start --dir ./prototypes     # Start visualizer
maestro bv status <execId>              # View status
maestro bv stop <execId>                # Stop server
```

---

### maestro ext / maestro tool

Extension and tool management.

```bash
maestro ext list                        # List installed extensions
maestro tool list                       # List available tools
maestro tool exec read_file '{"path":"README.md"}'  # Execute tool
```

---

## Architecture

```
MCP Server (stdio)
  └─ ToolRegistry
       ├─ edit_file       ─ File editing (update/line)
       ├─ write_file      ─ File writing
       ├─ read_file       ─ Single file read
       ├─ read_many_files ─ Batch read / search
       ├─ team_msg        ─ Message bus (JSONL)
       ├─ team_mailbox    ─ Mailbox delivery
       ├─ team_task       ─ Task management
       ├─ team_agent      ─ Agent lifecycle
       └─ core_memory     ─ Persistent memory
```

**Adapter**: Tools use Zod schemas internally and return `{success, result, error}` format. The `ccwResultToMcp()` adapter converts this to the MCP standard `{content, isError}` format.
