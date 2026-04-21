# MCP 工具参考

Maestro MCP 服务器暴露 9 个工具，供 Claude Code、Codex 等 AI 智能体在会话中直接调用。所有工具通过 stdio 传输协议注册，无需额外配置即可使用。

> **启用/过滤**: 通过 `MAESTRO_ENABLED_TOOLS` 环境变量或 `config.mcp.enabledTools` 控制可见工具列表。默认 `['all']` 全部启用。

---

## 目录

- [工具总览](#工具总览)
- [文件操作](#文件操作)
  - [edit_file](#edit_file)
  - [write_file](#write_file)
  - [read_file](#read_file)
  - [read_many_files](#read_many_files)
- [团队协作](#团队协作)
  - [team_msg](#team_msg)
  - [team_mailbox](#team_mailbox)
  - [team_task](#team_task)
  - [team_agent](#team_agent)
- [持久记忆](#持久记忆)
  - [core_memory](#core_memory)
- [CLI 终端命令](#cli-终端命令)

---

## 工具总览

| 工具 | 类别 | 用途 |
|------|------|------|
| `edit_file` | 文件操作 | 文本替换或行级编辑，支持 dryRun 预览 |
| `write_file` | 文件操作 | 创建/覆盖文件，自动创建目录 |
| `read_file` | 文件操作 | 单文件读取，支持行级分页 |
| `read_many_files` | 文件操作 | 批量读取/目录遍历/内容搜索 |
| `team_msg` | 团队协作 | 持久化 JSONL 消息总线 |
| `team_mailbox` | 团队协作 | 邮箱式消息投递与签收 |
| `team_task` | 团队协作 | 任务 CRUD 与状态机管理 |
| `team_agent` | 团队协作 | 智能体生命周期管理 (spawn/shutdown) |
| `core_memory` | 持久记忆 | 跨会话 JSON 记忆存储 |

---

## 文件操作

### edit_file

两种编辑模式：**update**（文本替换）和 **line**（行级操作）。支持 dryRun 预览、多编辑批量替换、模糊匹配和自动换行符适配（CRLF/LF）。

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `path` | string | 是 | — | 目标文件路径 |
| `mode` | `"update"` \| `"line"` | 否 | `"update"` | 编辑模式 |
| `dryRun` | boolean | 否 | `false` | 仅预览 diff，不修改文件 |

**update 模式参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `oldText` | string | 是* | 要查找的文本 |
| `newText` | string | 是* | 替换文本 |
| `edits` | `{oldText, newText}[]` | 是* | 批量替换（与 oldText/newText 二选一） |
| `replaceAll` | boolean | 否 | 替换所有匹配（默认仅首个） |

**line 模式参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `operation` | `"insert_before"` \| `"insert_after"` \| `"replace"` \| `"delete"` | 是 | 行操作类型 |
| `line` | number | 是 | 行号（1-based） |
| `end_line` | number | 否 | 结束行号（范围操作时使用） |
| `text` | string | 否 | 插入/替换的内容 |

#### 示例

```jsonc
// 文本替换
{ "path": "src/app.ts", "oldText": "hello", "newText": "world" }

// 批量替换
{ "path": "src/app.ts", "edits": [{"oldText": "foo", "newText": "bar"}, {"oldText": "baz", "newText": "qux"}] }

// 行级插入
{ "path": "src/app.ts", "mode": "line", "operation": "insert_after", "line": 10, "text": "// added" }

// 预览变更
{ "path": "src/app.ts", "oldText": "old", "newText": "new", "dryRun": true }
```

---

### write_file

创建或覆盖文件，自动创建父目录。支持可选备份和多编码格式。

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `path` | string | 是 | — | 文件路径 |
| `content` | string | 是 | — | 写入内容 |
| `createDirectories` | boolean | 否 | `true` | 自动创建父目录 |
| `backup` | boolean | 否 | `false` | 覆盖前创建时间戳备份 |
| `encoding` | `"utf8"` \| `"utf-8"` \| `"ascii"` \| `"latin1"` \| `"binary"` \| `"hex"` \| `"base64"` | 否 | `"utf8"` | 文件编码 |

#### 示例

```jsonc
// 创建文件
{ "path": "src/new-module.ts", "content": "export const hello = 'world';" }

// 覆盖并备份
{ "path": "config.json", "content": "{\"key\": \"value\"}", "backup": true }
```

---

### read_file

读取单个文件，支持行级分页。适用于大文件按需读取。

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `path` | string | 是 | — | 文件路径 |
| `offset` | number | 否 | — | 起始行偏移（0-based） |
| `limit` | number | 否 | — | 读取行数 |

#### 示例

```jsonc
// 读取整个文件
{ "path": "README.md" }

// 分页读取（第 100-149 行）
{ "path": "src/large-file.ts", "offset": 99, "limit": 50 }
```

---

### read_many_files

批量文件读取、目录遍历和内容正则搜索。支持 glob 模式过滤和深度控制。

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `paths` | string \| string[] | 是 | — | 文件路径或目录 |
| `pattern` | string | 否 | — | Glob 过滤模式（如 `"*.ts"`） |
| `contentPattern` | string | 否 | — | 正则内容搜索 |
| `maxDepth` | number | 否 | `3` | 目录遍历最大深度 |
| `includeContent` | boolean | 否 | `true` | 返回结果是否包含文件内容 |
| `maxFiles` | number | 否 | `50` | 最大返回文件数 |

#### 示例

```jsonc
// 读取多个文件
{ "paths": ["src/a.ts", "src/b.ts"] }

// 遍历目录（仅 .ts 文件）
{ "paths": "src/", "pattern": "*.ts" }

// 内容搜索
{ "paths": "src/", "contentPattern": "TODO|FIXME" }

// 仅列出不读内容
{ "paths": "src/", "includeContent": false }
```

---

## 团队协作

### team_msg

持久化 JSONL 消息总线，用于智能体团队间通信。提供 10 种操作，支持消息投递状态跟踪。

**存储位置**: `.workflow/.team/{session-id}/.msg/messages.jsonl`

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `operation` | enum (见下) | 是 | — | 操作类型 |
| `session_id` | string | 是* | — | 会话 ID（如 `TLS-my-project-2026-02-27`） |
| `from` | string | 否* | — | 发送者角色名 |
| `to` | string | 否 | `"coordinator"` | 接收者角色 |
| `type` | string | 否 | `"message"` | 消息类型 |
| `summary` | string | 否 | 自动生成 | 一行摘要 |
| `data` | object | 否 | — | 结构化数据载荷 |
| `id` | string | 否* | — | 消息 ID（read/delete 时使用） |
| `last` | number | 否 | `20` | 列出最近 N 条消息（上限 100） |
| `role` | string | 否* | — | 角色名（get_state/read_mailbox 时使用） |
| `delivery_method` | string | 否 | — | 投递方式跟踪 |

**操作类型:**

| 操作 | 说明 |
|------|------|
| `log` | 追加消息到日志 |
| `broadcast` | 广播给所有团队成员 |
| `read` | 按 ID 读取单条消息 |
| `list` | 列出最近消息，支持 from/to/type 过滤 |
| `status` | 汇总各角色活跃状态 |
| `get_state` | 读取角色状态（`meta.json`） |
| `read_mailbox` | 读取角色未读消息并标记已投递 |
| `mailbox_status` | 各角色投递状态计数 |
| `delete` | 删除指定消息 |
| `clear` | 清空会话所有消息 |

#### 示例

```jsonc
// 发送消息
{ "operation": "log", "session_id": "TLS-proj-2026-04-21", "from": "planner", "to": "implementer", "summary": "plan ready", "data": {"phase": 1} }

// 读取收件箱
{ "operation": "read_mailbox", "session_id": "TLS-proj-2026-04-21", "role": "implementer" }

// 查看团队状态
{ "operation": "status", "session_id": "TLS-proj-2026-04-21" }
```

---

### team_mailbox

邮箱式智能体消息投递，支持 broker 注入和投递状态跟踪。相比 `team_msg` 更侧重点对点投递确认。

**存储位置**: `.workflow/.team/{session-id}/.msg/mailbox.jsonl`

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `operation` | `"send"` \| `"read"` \| `"status"` | 是 | — | 操作类型 |
| `session_id` | string | 是 | — | 会话 ID |
| `from` | string | send | — | 发送者角色 |
| `to` | string | send | — | 接收者角色 |
| `message` | string | send | — | 消息内容 |
| `type` | string | 否 | `"message"` | 消息类型 |
| `delivery_method` | `"inject"` \| `"poll"` \| `"broadcast"` | 否 | `"inject"` | 投递方式 |
| `data` | object | 否 | — | 结构化数据 |
| `role` | string | read | — | 读取邮箱的角色 |
| `limit` | number | 否 | `50` | 最大返回数（1-100） |
| `mark_delivered` | boolean | 否 | `true` | 读取后标记为已投递 |

#### 示例

```jsonc
// 发送消息（自动注入到运行中的 agent）
{ "operation": "send", "session_id": "TLS-proj-2026-04-21", "from": "coordinator", "to": "worker-1", "message": "start task A" }

// 读取邮箱
{ "operation": "read", "session_id": "TLS-proj-2026-04-21", "role": "worker-1" }

// 查看投递状态
{ "operation": "status", "session_id": "TLS-proj-2026-04-21" }
```

---

### team_task

团队任务 CRUD 管理，基于 CollabTask 系统，带会话级命名空间隔离和状态机校验。

**存储位置**: `.workflow/.team/{session_id}/tasks/{id}.json`

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `operation` | `"create"` \| `"update"` \| `"list"` \| `"get"` | 是 | — | 操作类型 |
| `session_id` | string | 是 | — | 会话 ID |
| `title` | string | create | — | 任务标题 |
| `description` | string | 否 | — | 任务描述 |
| `owner` | string | 否 | `"agent"` | 责任人 |
| `priority` | `"low"` \| `"medium"` \| `"high"` \| `"critical"` | 否 | `"medium"` | 优先级 |
| `task_id` | string | update/get | — | 任务 ID（如 `ATASK-001`） |
| `status` | `"open"` \| `"assigned"` \| `"in_progress"` \| `"pending_review"` \| `"done"` \| `"closed"` | 否 | — | 任务状态 |

**状态流转:**

```
open → assigned → in_progress → pending_review → done → closed
                                                        ↘ open (reopen)
```

#### 示例

```jsonc
// 创建任务
{ "operation": "create", "session_id": "TLS-proj-2026-04-21", "title": "Implement auth", "priority": "high" }

// 更新状态
{ "operation": "update", "session_id": "TLS-proj-2026-04-21", "task_id": "ATASK-001", "status": "in_progress" }

// 列出任务
{ "operation": "list", "session_id": "TLS-proj-2026-04-21" }
```

---

### team_agent

智能体生命周期管理 —— 通过 Delegate Broker 进行 spawn、shutdown、remove 操作。

**存储位置**: `.workflow/.team/{session_id}/members.json`

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `operation` | `"spawn_agent"` \| `"shutdown_agent"` \| `"remove_agent"` \| `"members"` | 是 | — | 操作类型 |
| `session_id` | string | 是 | — | 会话 ID |
| `role` | string | spawn/shutdown/remove | — | 角色名 |
| `prompt` | string | spawn | — | 智能体指令 |
| `tool` | string | 否 | `"gemini"` | CLI 工具 |

#### 示例

```jsonc
// 启动智能体
{ "operation": "spawn_agent", "session_id": "TLS-proj-2026-04-21", "role": "researcher", "prompt": "Analyze auth patterns", "tool": "gemini" }

// 关闭智能体
{ "operation": "shutdown_agent", "session_id": "TLS-proj-2026-04-21", "role": "researcher" }

// 查看成员列表
{ "operation": "members", "session_id": "TLS-proj-2026-04-21" }
```

---

## 持久记忆

### core_memory

跨会话 JSON 记忆管理，存储于 `~/.maestro/data/core-memory/`。提供 4 种操作：列出、导入、导出、搜索。

**存储位置**: `~/.maestro/data/core-memory/{project-path-md5-hash}.json`

**ID 格式**: `CMEM-YYYYMMDD-HHMMSS`

#### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `operation` | `"list"` \| `"import"` \| `"export"` \| `"search"` | 是 | — | 操作类型 |
| `path` | string | 否 | 自动检测 | 项目路径覆盖 |
| `text` | string | import | — | 导入内容 |
| `id` | string | export | — | 记忆 ID |
| `query` | string | search | — | 搜索关键词 |
| `limit` | number | 否 | `100` | 最大结果数 |
| `tags` | string[] | 否 | — | 标签过滤（AND 逻辑） |

#### 示例

```jsonc
// 导入记忆
{ "operation": "import", "text": "Auth module uses bcrypt + JWT", "tags": ["auth", "security"] }

// 搜索
{ "operation": "search", "query": "auth token" }

// 导出
{ "operation": "export", "id": "CMEM-20260421-143000" }

// 列出（按标签过滤）
{ "operation": "list", "tags": ["auth"], "limit": 10 }
```

---

## CLI 终端命令

除了 MCP 工具外，Maestro 还提供 21 个终端命令，可通过 `maestro <command>` 直接调用。

### 命令总览

| 命令 | 别名 | 用途 |
|------|------|------|
| `maestro install` | — | 安装 Maestro 资源（交互式） |
| `maestro uninstall` | — | 卸载已安装资源 |
| `maestro view` | — | 启动 Dashboard 看板 |
| `maestro stop` | — | 停止 Dashboard 服务 |
| `maestro update` | — | 检查/安装最新版本 |
| `maestro serve` | — | 启动工作流服务器 |
| `maestro run` | — | 执行指定工作流 |
| `maestro delegate` | — | 委派任务给 AI 智能体 |
| `maestro coordinate` | `coord` | 图工作流协调器 |
| `maestro cli` | — | 运行 CLI 智能体工具 |
| `maestro launcher` | — | Claude Code 启动器（workflow/settings 切换） |
| `maestro spec` | — | 项目 Spec 管理 |
| `maestro wiki` | — | Wiki 知识图谱查询 |
| `maestro hooks` | — | Hook 管理与运行 |
| `maestro overlay` | — | 命令 Overlay 管理 |
| `maestro collab` | `team` | 人类团队协作 |
| `maestro agent-msg` | `msg` | 智能体团队消息总线 |
| `maestro core-memory` | `cm` | 持久记忆管理 |
| `maestro brainstorm-visualize` | `bv` | 头脑风暴可视化服务器 |
| `maestro ext` | — | 扩展管理 |
| `maestro tool` | — | 工具交互（list/exec） |

---

### maestro install

安装 Maestro 资源到项目或全局目录。交互式步骤选择。

```bash
maestro install                           # 交互式安装
maestro install --force                   # 非交互批量安装
maestro install components                # 安装文件组件
maestro install hooks                     # 安装 Hook
maestro install mcp                       # 注册 MCP 服务器
```

| 选项 | 说明 |
|------|------|
| `--force` | 非交互批量安装所有组件 |
| `--global` | 仅安装全局资源 |
| `--path <dir>` | 安装到指定项目目录 |
| `--hooks <level>` | Hook 级别：none / minimal / standard / full |

---

### maestro uninstall

移除已安装的 Maestro 资源。

```bash
maestro uninstall              # 交互式卸载
maestro uninstall --all        # 卸载所有已记录安装
maestro uninstall --all -y     # 跳过确认
```

---

### maestro view

启动 Dashboard 看板（浏览器或 TUI）。

```bash
maestro view                   # 启动看板（自动打开浏览器）
maestro view --tui             # 终端 UI 模式
maestro view --dev             # Vite 开发模式（HMR）
maestro view --port 8080       # 指定端口
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--port`, `-p` | `3001` | 服务端口 |
| `--host` | `127.0.0.1` | 绑定主机 |
| `--path <dir>` | CWD | 工作区根目录（含 `.workflow/`） |
| `--no-browser` | — | 不自动打开浏览器 |
| `--tui` | — | 终端 UI 模式 |
| `--dev` | — | Vite 开发服务器模式 |

---

### maestro stop

停止 Dashboard 服务器。三阶段策略：graceful shutdown → 端口查找 kill → force kill。

```bash
maestro stop                   # 优雅停止
maestro stop --force           # 强制终止
maestro stop --port 8080       # 指定端口
```

---

### maestro update

检查并安装最新版本。

```bash
maestro update                 # 检查并提示安装
maestro update --check         # 仅检查，不安装
```

---

### maestro delegate

委派任务给 AI 智能体工具（gemini/qwen/codex/claude/opencode）。支持同步、异步、会话恢复。

```bash
# 同步执行
maestro delegate "analyze auth module" --to gemini

# 异步后台执行
maestro delegate "fix bug in auth" --to gemini --async

# 查看执行状态
maestro delegate show
maestro delegate status gem-143022-a7f2
maestro delegate output gem-143022-a7f2

# 消息注入
maestro delegate message gem-143022-a7f2 "also check utils"

# 恢复会话
maestro delegate "continue" --to gemini --resume gem-143022-a7f2
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--to <tool>` | 首个启用工具 | 目标工具（gemini/qwen/codex/claude/opencode） |
| `--mode <mode>` | `analysis` | 执行模式：analysis（只读）/ write（可写） |
| `--model <model>` | 工具默认 | 模型覆盖 |
| `--cd <dir>` | CWD | 工作目录 |
| `--rule <template>` | — | 协议+模板加载 |
| `--id <id>` | 自动生成 | 执行 ID |
| `--resume [id]` | — | 恢复上次/指定会话 |
| `--async` | — | 后台异步执行 |
| `--backend <type>` | `direct` | 适配后端：direct / terminal |

**子命令:**

| 子命令 | 说明 |
|--------|------|
| `show [--all]` | 列出执行历史 |
| `output <id> [--verbose]` | 获取输出 |
| `status <id> [--events N]` | 查看状态 |
| `tail <id>` | 最近事件+历史 |
| `cancel <id>` | 请求取消 |
| `message <id> <text> [--delivery inject\|after_complete]` | 注入消息 |
| `messages <id>` | 查看消息队列 |

---

### maestro coordinate

图工作流协调器，支持 step 模式（逐步执行）和 auto 模式（全图遍历）。

```bash
# 列出可用链图
maestro coordinate list

# 自动运行（全图遍历）
maestro coordinate run "implement auth" --chain default -y

# 步进模式
maestro coordinate start "implement auth" --chain default
maestro coordinate next <sessionId>
maestro coordinate status <sessionId>

# 报告节点结果
maestro coordinate report --session <id> --node <id> --status SUCCESS
```

| 选项 | 说明 |
|------|------|
| `--chain <name>` | 指定链图 |
| `--tool <tool>` | 智能体工具（默认 `claude`） |
| `-y`, `--yes` | 自动确认模式 |
| `--parallel` | 启用 fork/join 并行 |
| `--dry-run` | 预览执行计划 |
| `--continue`, `-c` | 恢复会话 |

---

### maestro cli

统一 CLI 智能体工具接口（gemini/qwen/codex/claude/opencode）。

```bash
maestro cli -p "analyze code" --tool gemini --mode analysis
maestro cli -p "fix bug" --tool gemini --mode write
maestro cli show                    # 查看执行历史
maestro cli output <id>             # 获取输出
maestro cli watch <id>              # 实时流输出
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `-p`, `--prompt` | **必填** | 提示文本 |
| `--tool <name>` | 首个启用工具 | CLI 工具 |
| `--mode <mode>` | `analysis` | 执行模式 |
| `--model <model>` | 工具默认 | 模型覆盖 |
| `--cd <dir>` | CWD | 工作目录 |
| `--rule <template>` | — | 模板加载 |
| `--id <id>` | 自动生成 | 执行 ID |
| `--resume [id]` | — | 恢复会话 |

---

### maestro launcher

Claude Code 统一启动器，管理 workflow profile 和 settings 切换。

```bash
maestro launcher -w my-project -s dev    # 指定 profile 启动
maestro launcher list                    # 列出所有 profile
maestro launcher status                  # 查看当前活跃 profile
maestro launcher add-workflow my-proj --claude-md ./CLAUDE.md
```

---

### maestro spec

项目 Spec 管理（初始化、加载、列表、状态）。

```bash
maestro spec init                 # 初始化 spec 系统
maestro spec load --category coding --keyword auth
maestro spec list                 # 列出 spec 文件
maestro spec status               # 查看 spec 状态
```

---

### maestro wiki

Wiki 知识图谱查询和变更。默认离线模式，`--live` 使用 Dashboard HTTP API。

```bash
maestro wiki list --type spec     # 按类型列出
maestro wiki search "auth"        # BM25 全文搜索
maestro wiki get <id>             # 获取单条
maestro wiki health               # 图谱健康评分
maestro wiki orphans              # 孤立条目
maestro wiki hubs --limit 5       # Top-N 枢纽节点
maestro wiki create --type note --slug my-note --title "My Note"
```

---

### maestro hooks

Hook 管理与评估器运行。

```bash
maestro hooks install --level full     # 安装 Hook
maestro hooks status                   # 查看安装状态
maestro hooks list                     # 列出所有 Hook
maestro hooks toggle spec-injector on  # 开关 Hook
maestro hooks run spec-injector        # 运行评估器
```

可用 Hook: `context-monitor`, `spec-injector`, `delegate-monitor`, `team-monitor`, `telemetry`, `session-context`, `skill-context`, `coordinator-tracker`, `preflight-guard`, `spec-validator`, `keyword-spec-injector`, `workflow-guard`

---

### maestro overlay

命令 Overlay 管理 —— 非侵入式 `.claude/commands` 补丁。

```bash
maestro overlay list                    # 查看并管理 overlay
maestro overlay apply                   # 重新应用所有 overlay（幂等）
maestro overlay add my-overlay.json     # 安装 overlay
maestro overlay remove my-overlay       # 移除 overlay
maestro overlay bundle -o bundle.json   # 打包为可移植文件
maestro overlay import-bundle bundle.json  # 导入打包
```

---

### maestro collab (别名: team)

人类团队协作 —— 加入、汇报、查看活动。

```bash
maestro collab join                    # 注册为团队成员
maestro collab whoami                  # 查看当前身份
maestro collab status                  # 查看团队活动
maestro collab sync                    # 同步远程仓库
maestro collab preflight --phase 1     # 冲突预检
maestro collab guard                   # 查看命名空间边界
maestro collab task create --title "task"
maestro collab task list --status open
```

---

### maestro agent-msg (别名: msg)

智能体团队消息总线。

```bash
maestro msg send "task done" -s <session> --from worker --to coordinator
maestro msg list -s <session> --last 10
maestro msg status -s <session>
maestro msg broadcast "meeting" -s <session> --from coordinator
```

---

### maestro core-memory (别名: cm)

持久记忆管理。

```bash
maestro cm list --tags auth             # 按标签列出
maestro cm import "auth uses JWT" --tags auth,security
maestro cm export CMEM-20260421-143000  # 导出
maestro cm search "auth token"          # 搜索
```

---

### maestro brainstorm-visualize (别名: bv)

头脑风暴 HTML 原型可视化服务器。

```bash
maestro bv start --dir ./prototypes     # 启动可视化服务
maestro bv status <execId>              # 查看状态
maestro bv stop <execId>                # 停止服务
```

---

### maestro ext / maestro tool

扩展与工具管理。

```bash
maestro ext list                        # 列出已安装扩展
maestro tool list                       # 列出可用工具
maestro tool exec read_file '{"path":"README.md"}'  # 执行工具
```

---

## 架构概览

```
MCP Server (stdio)
  └─ ToolRegistry
       ├─ edit_file       ─ 文件编辑 (update/line)
       ├─ write_file      ─ 文件写入
       ├─ read_file       ─ 单文件读取
       ├─ read_many_files ─ 批量文件读取/搜索
       ├─ team_msg        ─ 消息总线 (JSONL)
       ├─ team_mailbox    ─ 邮箱投递
       ├─ team_task       ─ 任务管理
       ├─ team_agent      ─ 智能体生命周期
       └─ core_memory     ─ 持久记忆
```

**适配机制**: 工具内部使用 Zod schema 校验，返回 `{success, result, error}` 格式，由 `ccwResultToMcp()` 适配为 MCP 标准格式 `{content, isError}`。
