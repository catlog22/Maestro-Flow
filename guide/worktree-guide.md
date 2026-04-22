# Worktree 并行开发指南

Maestro-Flow 支持基于 git worktree 的**里程碑级并行开发**。当一个里程碑完成（即使有遗留 bug），可以 fork 出下一个里程碑的 worktree，在独立分支上推进开发，完成后 merge 回主分支。

## 核心概念

```
Main worktree (master)              Worktree (.worktrees/m2-production/)
├── .workflow/                      ├── .workflow/
│   ├── state.json                  │   ├── state.json (scoped)
│   ├── worktrees.json (registry)   │   ├── worktree-scope.json (marker)
│   ├── roadmap.md                  │   ├── roadmap.md (read-only copy)
│   └── scratch/                    │   └── scratch/
│       ├── analyze-auth-... ✅     │       ├── analyze-billing-...  (owned)
│       ├── plan-auth-... ✅        │       ├── plan-billing-...     (owned)
│       └── plan-billing-.. [forked]│       └── ...
│                                   │
│   main 上修 M1 bug                │   在这里正常执行:
│                                   │   /maestro-analyze
│                                   │   /maestro-plan
│                                   │   /maestro-execute
│                                   │   ...逐步推进
```

**关键约束：**
- 一个里程碑 = 一个 worktree（不支持里程碑内并行 worktree）
- worktree 内工作流正常运行（analyze → plan → execute → verify），产物写入 `scratch/`
- `.workflow/` 是 gitignored 的，fork 时会显式复制进 worktree
- Scope 保护基于 milestone 级别（不是 phase 级别）

## 命令速查

| 命令 | 用途 | 示例 |
|------|------|------|
| `maestro-fork -m <N>` | 为里程碑 N 创建 worktree | `/maestro-fork -m 2` |
| `maestro-fork -m <N> --sync` | 同步 main 最新代码到 worktree | `/maestro-fork -m 2 --sync` |
| `maestro-merge -m <N>` | 合并里程碑 N 的 worktree 回 main | `/maestro-merge -m 2` |
| `maestro-merge --continue` | 解决冲突后继续合并 | `/maestro-merge --continue` |

## 使用场景

### 场景 1：里程碑完成后有 bug，不等修完直接开始下一个

```bash
# M1 完成但有遗留 bug
/maestro-milestone-complete

# Fork M2 worktree（不用等 M1 bug 修完）
/maestro-fork -m 2
# → 创建 .worktrees/m2-production/
# → 复制 .workflow/ 上下文 + M2 已有 scratch artifacts
# → M2 在 main state.json 中标记为 "forked"

# 终端 A：main 上修 M1 bug
cd /project
# ... 修复、提交 ...

# 终端 B：worktree 中推进 M2
cd .worktrees/m2-production/
/maestro-analyze
/maestro-plan
/maestro-execute
/maestro-verify
# ... 重复直到 M2 工作完成 ...

# M2 完成，回 main 合并
cd /project
/maestro-merge -m 2
```

### 场景 2：长期 worktree 需要同步 main 修复

```bash
# main 上修完了影响 M2 的 bug
# 同步到 worktree
/maestro-fork -m 2 --sync
# → git merge main（源码同步）
# → 重新复制 project.md, roadmap.md, specs/（artifact 同步）
```

### 场景 3：使用 delegate 自动化 worktree 开发

```bash
/maestro-fork -m 2

# 委派一个 agent 在 worktree 中跑完整生命周期
maestro delegate "run full lifecycle for milestone" \
  --cd .worktrees/m2-production/ --mode write
```

## 详细流程

### Fork：创建 worktree

```bash
/maestro-fork -m 2
```

**执行步骤：**

1. **校验**：项目已初始化、roadmap 存在、不在 worktree 内、M2 未被 fork
2. **解析里程碑**：`state.json.milestones[1]` → `{id: "M2", name: "Production", status: "active"}`
3. **创建 worktree**：`git worktree add -b milestone/production .worktrees/m2-production HEAD`
4. **复制 .workflow/**：
   - 共享文件（只读）：`project.md`, `roadmap.md`, `config.json`, `specs/`
   - Milestone scratch artifacts：从 `state.json.artifacts[]` 筛选 `milestone == "M2"`，复制对应 `scratch/` 目录
5. **写入标记**：
   - `worktree-scope.json`：`{ milestone_num: 2, milestone: "M2", ... }`
   - scoped `state.json`：仅包含 M2 的 artifacts，`current_milestone` 设为 "M2"
6. **更新 main**：
   - `worktrees.json` 注册表添加条目
   - `state.json.milestones[]` 中 M2 标记为 `"forked"`

**输出示例：**

```
=== FORK COMPLETE ===
Session:    fork-20260418T143022
Base:       HEAD (abc1234)
Milestone:  M2 — Production (生产就绪)
Branch:     milestone/production
Path:       .worktrees/m2-production
Artifacts:  3 scratch dirs copied
```

### Sync：同步 worktree

```bash
/maestro-fork -m 2 --sync
```

**执行步骤：**

1. 从 `worktrees.json` 找到 M2 的 worktree
2. `cd .worktrees/m2-production && git merge main`（源码同步）
3. 重新复制 `project.md`, `roadmap.md`, `config.json`, `specs/`（artifact 同步）
4. 报告冲突（如果有）

**建议时机：**
- main 有 bug fix 影响 worktree 代码
- 共享文件（project.md, specs/）更新后
- 长期 worktree 定期同步，减少最终 merge 冲突

### Merge：合并 worktree

```bash
/maestro-merge -m 2
```

**执行步骤（两阶段）：**

**Phase 1 — Git Merge（源码）：**
1. 注册表健康检查（清理失效条目）
2. 校验 worktree 中 milestone artifact 完成状态
3. Pre-merge：`cd worktree && git merge main`（减少冲突）
4. `git merge milestone/production --no-ff`

**Phase 2 — Artifact Sync（仅 Phase 1 成功后）：**
5. 复制 worktree 的 `scratch/*` 目录回 main `.workflow/scratch/`
6. 合并 artifact registry：
   - worktree `state.json.artifacts[]` → main `state.json.artifacts[]`
   - 同 id 条目 worktree 版本优先
   - 移除 milestone 的 `"forked"` 标记
7. 更新 `roadmap.md`（completed phases 标记 ✅）
8. 清理：`git worktree remove` + `git branch -D`

**冲突处理：**

```bash
# Phase 1 git merge 冲突时，merge 暂停
# 解决冲突：
git add <resolved-files>
git merge --continue

# 继续 Phase 2（artifact sync）：
/maestro-merge --continue
```

**Flags：**

| Flag | 作用 |
|------|------|
| `--force` | 即使 milestone 有未完成 artifact 也合并 |
| `--dry-run` | 只显示会做什么，不执行 |
| `--no-cleanup` | 合并后保留 worktree（用于检查） |
| `--continue` | 解决 git 冲突后继续 artifact sync |

## Scope 保护机制

worktree 内基于 milestone 级别的保护：

### Milestone scope 检查

在 worktree 内执行 `analyze`, `plan`, `execute`, `verify` 时，新创建的 artifact 自动归属 `worktree-scope.json` 中的 milestone。如果操作试图修改其他 milestone 的 artifact，会被拒绝：

```
# worktree scope: M2
/maestro-analyze            # → OK, artifact 归属 M2
/maestro-plan               # → OK
/maestro-execute             # → OK
```

### 全局命令阻止

以下命令在 worktree 内无法执行：

| 命令 | 原因 |
|------|------|
| `maestro-init` | 会重置项目状态 |
| `maestro-roadmap` | 会重新分解 milestones |
| `maestro-spec-generate` | 会修改全局 specs |
| `maestro-fork` | 不能在 worktree 内再 fork |
| `maestro-merge` | 必须在 main 中执行 |

## Dashboard 集成

`/manage-status` 会显示 worktree 状态：

**在 main 中：**

```
┌─────────────────────────────────────────┐
│ ACTIVE WORKTREES                        │
├─────────────────────────────────────────┤
│ M2 (Production) | milestone/production  │
│   Path: .worktrees/m2-production        │
│   Artifacts: 5 (3 completed, 2 pending) │
│                                         │
│ Sync:  /maestro-fork -m 2 --sync        │
│ Merge: /maestro-merge -m 2              │
└─────────────────────────────────────────┘
```

**在 worktree 中：**

```
┌─────────────────────────────────────────┐
│ WORKTREE MODE                           │
├─────────────────────────────────────────┤
│ Milestone: M2 (Production)             │
│ Branch:    milestone/production          │
│ Artifacts: 5 scratch dirs               │
│ Main:      /path/to/project              │
└─────────────────────────────────────────┘
```

## 文件结构

| 文件 | 位置 | 说明 |
|------|------|------|
| `worktrees.json` | main `.workflow/` | 注册表：所有活跃 worktree |
| `worktree-scope.json` | worktree `.workflow/` | 标记文件：milestone scope、main 路径 |
| `state.json` | worktree `.workflow/` | scoped 副本，仅包含此 milestone 的 artifacts |
| `project.md` | worktree `.workflow/` | 只读副本 |
| `roadmap.md` | worktree `.workflow/` | 只读副本 |

## 注意事项

1. **不要手动修改 worktree 中的 `worktree-scope.json`** — 它是 fork 时自动生成的
2. **不要在 worktree 中直接修改 main 的 `.workflow/`** — 会导致状态不一致
3. **定期 sync** — 特别是 main 有 bug fix 时，尽早同步减少冲突
4. **merge 前确保 worktree 干净** — 所有改动都已 commit
5. **一个里程碑只能有一个 worktree** — 不支持同一里程碑的多个 worktree
