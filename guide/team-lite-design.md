# Maestro Team Lite 协作方案

面向 2-8 人小团队的极简协作扩展。核心策略：**Git-native + 文件驱动 + advisory（建议性）协作**，零基础设施，向后兼容单机模式。

## 设计原则

1. **零新运行时依赖** — 只用 Git + 文件 + CLI，不引入数据库、relay、WebSocket
2. **单机零感知** — 未启用团队模式时，所有现有 `/maestro-*` 命令行为不变
3. **Advisory 而非 Authoritative** — 冲突靠心跳提示 + 人工协调，不做租约和仲裁
4. **操作即心跳** — 通过 PostToolUse hook 自动上报，无需用户主动广播
5. **Git 作慢通道** — 所有同步走 Git，离线自然降级
6. **人类协作与 agent 协作严格分层** — 磁盘命名空间隔离（见下）

## 命名空间边界（重要）

| 路径 | 含义 | 归属 | 不要混用 |
|---|---|---|---|
| `.workflow/.team/` | **agent 流水线** 内部角色间消息总线 | `src/tools/team-msg.ts` | 只由 agent team pipeline 写 |
| `.workflow/collab/` | **人类团队协作** 的成员 / 活动 / 同步记录 | 本方案 | 只由 `maestro collab *` 命令写 |

CLI 命令仍叫 `maestro collab *`（用户感知友好），但磁盘布局用 `collab` 明确与 agent 域分开。两个域共享底层 JSONL 工具，但数据严格不互通。

## 砍掉的复杂概念

相比 Claude 深度方案（13 周 / 6 阶段），以下概念全部搁置：

| 砍掉 | 理由 | 替代 |
|---|---|---|
| Relay/Broker 服务器 | 运维成本 + 单点故障 | Git 存储 |
| Actor 层级身份（`human:alice` / `ai:alice-commander`） | 概念抽象，理解成本高 | Git config（name + email） |
| Commander 仲裁（leader-elect / shadow / partitioned） | 自动化冲突极易出错 | 活动预警 + 人工协调 |
| WebSocket / P2P 直连 | VPN/防火墙不稳定 | Hook 心跳（Git tick） |
| K8s 风格 Phase 租约 | 小团队太重 | `activity.jsonl` 活跃度检测 |
| 跨机 Delegate Broker（三通路） | 技术复杂 | 不支持，各机独立运行 |
| 三层同步（realtime/on-demand/never） | 概念过载 | 单层 Git 同步 |

### v1 明确不做（与原方案不同）

| 不做 | 原因 |
|---|---|
| `locks.json` 建议锁 | 与 activity 预警重合；既然 `--force` 可覆盖，锁不多提供任何保证。等真有人投诉再加 |
| `pid` 字段 | 跨机无意义（两机 pid 空间互不相交） |
| `members.json`（单文件） | JSON 对象无法 `merge=union`，改用 per-member 文件彻底消除合并冲突 |

## 保留的 4 件事

1. **身份识别** — 映射本地 Git 身份到 `.workflow/collab/members/{uid}.json`
2. **共享活跃日志** — 全团队 append-only JSONL，记录谁在做什么
3. **冲突预警** — `/maestro-plan` / `/maestro-execute` 启动前扫日志，发现同 phase 活动即提示
4. **一键同步** — `maestro collab sync` 封装 `git stash + pull --rebase + pop + push`

## 前置依赖

这些是原方案未列出但必须先完成的小改动：

### P0.1：`state.json` 增加 `current_task_id`（0.5d）

- **现状**：`.workflow/state.json` 只有 `current_phase` / `current_step`，hook 无从得知当前 TASK
- **改动**：`maestro-execute` 进入 TASK 时写入 `current_task_id`，退出时清空
- **影响**：activity.jsonl 的 `task_id` 字段才有意义，否则只能靠人工 report 填

### P0.2：抽公共 `src/utils/jsonl-log.ts`（0.5d）

- **目的**：避免复制 `team-msg.ts` 约 300 行的 JSONL I/O 逻辑
- **接口**：`appendLine(path, obj)` / `readAll(path)` / `tailLast(path, n)` / `rotateIfLarge(path, maxBytes)`
- **复用方**：`team-msg.ts`（agent 域）+ `team-activity.ts`（本方案）都调它

## 数据模型

全部落文件，保持零数据库。

### `.workflow/collab/members/{uid}.json`（per-file）

每个成员一个 JSON 文件，**彻底消除 Git 合并冲突**（两人同时 join 各自写各自的文件）。

```json
// .workflow/collab/members/alice.json
{
  "uid": "alice",
  "name": "Alice",
  "email": "alice@example.com",
  "host": "alice-laptop",
  "role": "admin",
  "joinedAt": "2026-04-11T10:00:00Z"
}
```

`uid` 从 git config `user.email` 的 local-part 派生（`alice@example.com` → `alice`），冲突时追加数字后缀（`alice-2`）。`host` 从 `os.hostname()` 取，用于跨机消歧义（代替原方案的 `pid`）。

### `.workflow/collab/activity.jsonl`

全团队共享的活动总线，append-only。每次工具调用或命令执行由 PostToolUse hook 自动追加一行。

```jsonl
{"ts":"2026-04-11T10:23:00Z","user":"alice","host":"alice-laptop","action":"maestro-plan","phase_id":3}
{"ts":"2026-04-11T10:24:15Z","user":"bob","host":"bob-desktop","action":"wiki-update","target":"spec-auth"}
{"ts":"2026-04-11T10:25:00Z","user":"alice","host":"alice-laptop","action":"maestro-execute","phase_id":3,"task_id":"TASK-001"}
```

**字段约定**：

| 字段 | 必填 | 说明 |
|---|---|---|
| `ts` | ✅ | ISO 8601 UTC 时间戳（`Date.now()`） |
| `user` | ✅ | members 目录中的 uid |
| `host` | ✅ | `os.hostname()`，用于跨机区分 |
| `action` | ✅ | 命令名或工具名 |
| `phase_id` | 否 | 关联的 phase（从 state.json 读） |
| `task_id` | 否 | 关联的 TASK（依赖 P0.1） |
| `target` | 否 | 操作目标（文件/spec/issue id） |

**合并策略**：`.gitattributes` 配置 `activity.jsonl merge=union`，Git 自动行级并集合并，冲突极少。注意：**只对 JSONL 有效**，不能用于 members/\*.json。

**日志轮转**：
- 触发条件：文件 > 10MB 或 每周一 00:00
- 轮转动作：重命名为 `activity-archives/activity-{YYYY}W{WW}.jsonl`
- statusline 和冲突检测只读当前 `activity.jsonl`，归档仅供审计
- 由 `maestro collab sync` 顺带检查一次

## CLI 命令清单

挂载在新建的 `maestro team` 子命令组下（`src/commands/team.ts`）。

| 子命令 | 说明 | 备注 |
|---|---|---|
| `maestro collab join` | 从 git config 读取 name/email，写入 `members/{uid}.json` | 幂等 |
| `maestro collab whoami` | 显示当前 uid / name / host / role | — |
| `maestro collab status` | ⭐ 展示谁在做什么（按时间倒序解析 `activity.jsonl`） | 核心命令 |
| `maestro collab report` | 手动上报一条 activity | 通常由 hook 自动调用 |
| `maestro collab sync` | ⭐ `git stash` → `pull --rebase` → `pop` → `push` + 日志轮转检查 | 核心命令 |
| `maestro collab preflight --phase N` | 冲突预扫描，供 `/maestro-plan` / `/maestro-execute` 显式调用 | 见"耦合点 3" |

### 使用示例

```bash
# 加入团队
maestro collab join
# > Joined as alice <alice@example.com> on alice-laptop (admin)

# 查看谁在活动
maestro collab status
# > Active in last 30 min:
# >   alice@alice-laptop  maestro-execute   phase 3 / TASK-001    2 min ago
# >   bob@bob-desktop     wiki-update       spec-auth             5 min ago

# 同步
maestro collab sync
# > Stashing local changes...
# > Pulling from origin/main (rebase)...
# > Pushing...
# > Rotating activity.jsonl (was 12.4 MB)...
# > Done.

# 手动预飞检（通常由 /maestro-execute 自动调用）
maestro collab preflight --phase 3
# > ⚠ Bob is active on phase 3 (maestro-plan, 3 min ago @ bob-desktop)
# > exit: 1
```

## 与现有工作流的耦合点

所有耦合通过"注入"方式实现，不修改现有命令代码。

### 耦合 1：PostToolUse Hook（零感知心跳）

- **实现**：**新建** `bin/maestro-team-monitor.js`（与现有 `maestro-context-monitor.js` / `maestro-delegate-monitor.js` 并列），在 `src/commands/hooks.ts` 的 `install` 逻辑里按相同模式注册第三个 PostToolUse 入口
- **不改动** `src/hooks/context-monitor.ts`，保持关注点分离
- **行为**：每次工具调用后异步 append 一行到 `activity.jsonl`
- **字段来源**：
  - `user` / `host`：启动时从 members 目录 + `os.hostname()` 取
  - `phase_id` / `task_id`：从 `.workflow/state.json` 读（依赖 P0.1）
  - `action`：从 hook stdin JSON 的 `tool_name` 取
- **Dedupe**：同 `user+action+phase_id` 60s 内只写一条（抵御 Wave 内子 Agent 放大）
- **失败策略**：写入失败静默忽略（不影响工具调用主流程），exit 0

### 耦合 2：Statusline（队友可见性）

- **入口**：`src/hooks/statusline.ts`
- **行为**：在 Claude Code 状态栏显示最近 30 分钟内的队友活动摘要
- **示例**：`👥 alice (P3/T1) | bob (spec-auth)`
- **性能**：只 `tailLast(activity.jsonl, 200)`，不全量 parse；缓存结果 10s 避免高频刷新

### 耦合 3：Execution Gate（冲突预警）

**不修改 .claude/commands/maestro-*.md**，而是提供 `maestro collab preflight` 子命令，由命令 markdown 在执行步骤开头显式调用：

- **算法**：
  1. `tailLast(activity.jsonl, 500)` 解析最近条目
  2. 过滤 `ts >= now - 30min - 5min`（±5 分钟时钟容忍带）
  3. 过滤 `phase_id == 目标 phase` 且 `user != self`
  4. 命中则 exit 1 + 打印警告；未命中 exit 0
- **调用方改动**：`.claude/commands/maestro-plan.md` / `maestro-execute.md` 在 `<execution>` 顶部加一行 `Bash("maestro collab preflight --phase $ARGUMENTS || confirm")`
- **`--force` 语义**：调用方用 `|| true` 或人工确认绕过

### 耦合 4：Commit Message 标签

- **入口**：**仅**作用于 `team sync` 自己生成的同步 commit，**不**触及用户手动 `git commit`
- **行为**：sync 如果 stash pop 后需要 merge commit，自动注入 `[P3][TASK-001] team sync <原 message>`
- **原方案要求"所有 commit 都 tag"被放弃** — 那需要 `prepare-commit-msg` git hook，涉及用户本地 `.git/hooks` 管理，成本远超收益。如需后续补，独立做一个 `maestro hooks install-git` 子命令

## 11 天实施清单（原 15d 优化）

### Week 1：前置 + 身份 + 可见性（5d）

| 任务 | 说明 | 工作量 |
|---|---|---|
| **P0.1** state.json 扩展 | `current_task_id` 字段 + maestro-execute 写入 | 0.5d |
| **P0.2** jsonl-log util | `src/utils/jsonl-log.ts`（append/readAll/tail/rotate） | 0.5d |
| **T1.1** 身份命令 | `team join` / `team whoami` + per-member 文件读写 | 1d |
| **T1.2** 活动模块 | `src/tools/team-activity.ts` + `team report` CLI | 1d |
| **T1.3** 状态展示 | `team status` CLI UI，按时间倒序 + 活跃判定 | 1d |
| **T1.4** team-monitor bin | `bin/maestro-team-monitor.js` + hooks.ts 注册 + dedupe | 1d |

**里程碑**：Week 1 结束时，团队成员可以在 Git 仓库内看见彼此的活动。

### Week 2：同步 + 预飞检 + Statusline（5d）

| 任务 | 说明 | 工作量 |
|---|---|---|
| **T2.1** 同步命令 | `team sync` — git stash/pull/pop/push + 轮转触发 | 2d |
| **T2.2** 预飞检命令 | `team preflight --phase` + 时钟容忍带 + `|| confirm` 语义 | 1d |
| **T2.3** 命令注入 | 改 `maestro-plan.md` / `maestro-execute.md` 调用 preflight | 0.5d |
| **T2.4** Statusline 集成 | 队友活跃摘要 + tail 缓存 | 1.5d |

**里程碑**：Week 2 结束时，团队可一键同步，核心命令会在冲突场景提示。

### Week 3：润色（1d）

| 任务 | 说明 | 工作量 |
|---|---|---|
| **T3.1** Sync commit tag | `team sync` 生成的 commit 自动加 `[Pn][TASK-m]` 前缀 | 0.5d |
| **T3.2** 文档 + 验证 | 《团队协作指南》+ 单机/多机兼容性测试 | 0.5d |

**总工作量**：11 天（原 15 天），每项 ≤ 2d 粒度。

## 未来升级触发点

当团队规模/需求变化满足以下任一条件，再考虑升级到 Claude 深度方案（13 周 / 6 阶段）：

| 触发条件 | 现象 | 升级动作 |
|---|---|---|
| **团队规模 > 10 人** | `activity.jsonl` Git 冲突频率明显上升 | 引入结构化 Actor 模型 + Phase 租约 |
| **实时性要求 < 1s** | 需要多人同时编辑同一文件（协同看板） | 引入 WebSocket Relay（Claude 方案通路 A） |
| **强 RBAC 需求** | advisory 不够，需要基于角色严格隔离 | 引入中间件权限模型（Claude 方案 P1） |
| **需要真正的建议锁** | advisory 预警被忽视导致事故 | 引入 `locks.json` + 过期清理 + preflight 集成 |
| **双 Commander 问题** | 自动化 Issue 闭环在多机上重复 dispatch | 引入 Leased + Shadow Commander |
| **跨机 AI 协作** | Alice 想遥控 Bob 机器上的 AI agent | 引入跨机 Delegate Broker |
| **任意 commit tag 需求** | 审计需要所有人工 commit 也带 phase 标签 | 加 `maestro hooks install-git` 装 `prepare-commit-msg` |

## 与现有单机模式的兼容性

- **未执行 `team join`**：
  - `maestro collab *` 命令（除 join/whoami）返回 "team mode not enabled"
  - `team-monitor` hook 检测到 `.workflow/collab/members/` 为空时静默 exit 0
  - 现有 `/maestro-*` 命令行为 100% 不变
- **已执行 `team join` 但独自工作**：心跳只写本地文件，`team status` 只显示自己，无任何副作用
- **多人但不跑 `team sync`**：各人有独立的 `activity.jsonl`，本地一致但不同步

## 参考

- **前序方案**：
  - Gemini 初版（P0/P1/P2 / 8.5d）— 仅存储和权限
  - Claude 深度版（13w / 6 阶段）— 完整工作流感知
- **已有代码参考**：
  - `src/tools/team-msg.ts` — agent 域 JSONL 总线（不要混用）
  - `src/hooks/context-monitor.ts` + `bin/maestro-context-monitor.js` — PostToolUse hook 样板
  - `src/hooks/delegate-monitor.ts` + `bin/maestro-delegate-monitor.js` — 同上，第二个独立 hook 样板
  - `src/commands/hooks.ts` — hook 安装逻辑（`install` 里加第三个 entry）
  - `src/hooks/statusline.ts` — Claude Code 状态栏
  - `src/commands/wiki.ts` — CLI 子命令样板
- **数据存储参考**：`docs/wiki-endpoint-design.md` — Wiki 端点的文件级节点设计（per-member 文件策略借鉴于此）
