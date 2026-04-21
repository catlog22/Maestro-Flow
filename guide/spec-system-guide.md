# Spec 系统指南

Maestro 的 Spec 系统管理项目级知识（编码规范、架构约束、调试记录、测试惯例等），供 agent 和 hook 在执行前自动加载。所有 spec 存储在 `.workflow/specs/` 中。

## 目录

- [概览](#概览)
  - [Category 体系](#category-体系)
  - [Entry 格式](#entry-格式)
- [命令](#命令)
  - [spec-setup — 初始化](#spec-setup--初始化)
  - [spec-add — 添加条目](#spec-add--添加条目)
  - [spec-load — 加载条目](#spec-load--加载条目)
- [Keyword 系统](#keyword-系统)
  - [关键词提取](#关键词提取)
  - [按 keyword 加载](#按-keyword-加载)
  - [自动注入机制](#自动注入机制)
- [验证 Hook](#验证-hook)
- [Session Dedup](#session-dedup)
- [文件结构](#文件结构)
- [向后兼容](#向后兼容)
- [CLI 参考](#cli-参考)

---

## 概览

### Category 体系

Spec 系统使用统一的 **category** 体系。`spec-add` 和 `spec-load` 使用同一套 category 名，1:1 对应文件：

| Category | 文件 | 用途 |
|----------|------|------|
| `coding` | `coding-conventions.md` | 命名、导入、格式化、编码模式 |
| `arch` | `architecture-constraints.md` | 模块结构、层级边界、架构决策 |
| `quality` | `quality-rules.md` | 质量规则、lint 配置、强制标准 |
| `debug` | `debug-notes.md` | 调试技巧、根因记录、已知问题 |
| `test` | `test-conventions.md` | 测试框架、模式、覆盖率要求 |
| `review` | `review-standards.md` | 审查清单、质量门槛 |
| `learning` | `learnings.md` | Bug、陷阱、经验教训 |

**没有 `type` 概念** — 所有操作只用 `category`。

### Entry 格式

每个条目使用 `<spec-entry>` 闭合标签格式：

```markdown
<spec-entry category="coding" keywords="auth,token,rotation" date="2026-04-21">

### Token rotation needs email carried through refresh flow

Revoked column must be set rather than deleting tokens.
Refresh token generation must carry email from stored user data.

</spec-entry>
```

**属性：**

| 属性 | 必填 | 格式 | 说明 |
|------|------|------|------|
| `category` | 是 | 7 个有效值之一 | 必须匹配所在文件的 category |
| `keywords` | 是 | 逗号分隔，小写 | 可搜索关键词，≥1 个 |
| `date` | 是 | `YYYY-MM-DD` | 创建日期 |
| `source` | 否 | 字符串 | 来源（manual / agent / dashboard） |

标签内部是普通 Markdown — `### 标题` + 正文。Markdown 渲染器会忽略 `<spec-entry>` 标签，文件保持可读。

---

## 命令

### spec-setup — 初始化

```bash
/spec-setup
```

扫描项目代码库，检测技术栈和编码模式，生成 spec 文件：

- **核心文件**（始终创建）：`coding-conventions.md`、`architecture-constraints.md`、`learnings.md`
- **可选文件**（检测到时创建）：`quality-rules.md`（有 linter 配置时）、`test-conventions.md`（有测试框架时）
- **按需文件**（首次 `spec-add` 时创建）：`debug-notes.md`、`review-standards.md`

同时生成 `.workflow/project-tech.json`（技术栈概要）。

### spec-add — 添加条目

```bash
/spec-add coding "Always use named exports for utility functions"
/spec-add learning "Off-by-one in pagination when page=0 passed"
/spec-add arch "Use event-driven architecture for notification module"
```

执行流程：

1. 解析 `<category> <content>`
2. 从内容中自动提取 3-5 个关键词
3. 以 `<spec-entry>` 闭合标签格式写入目标文件
4. 输出确认信息和验证命令

**示例输出：**

```
== spec-add complete ==
Category: coding
Added to: .workflow/specs/coding-conventions.md
Keywords: named-exports, utility, module
Verify: /spec-load --keyword named-exports
```

### spec-load — 加载条目

```bash
# 按 category 加载（整个文件）
/spec-load --category coding

# 按 keyword 加载（entry 级别精确匹配）
/spec-load --keyword auth

# 组合使用
/spec-load --category coding --keyword naming

# 加载全部
/spec-load
```

`--keyword` 按 `<spec-entry>` 标签的 `keywords` 属性精确匹配。对于旧格式（heading 格式）条目，fallback 到文本搜索。

---

## Keyword 系统

### 关键词提取

`spec-add` 时 agent 自动从内容中提取关键词：

- 领域特定术语（非通用词如 code、file、function）
- 小写，无空格（多词用连字符）
- 3-5 个关键词

**好的关键词：** `auth`, `token-rotation`, `tenant-isolation`, `pagination`, `zod-validation`

**差的关键词：** `code`, `function`, `file`, `bug`, `fix`

### 按 keyword 加载

CLI 支持按关键词查询：

```bash
# CLI 直接使用
maestro spec load --keyword auth

# 组合 category + keyword
maestro spec load --category coding --keyword naming

# JSON 输出
maestro spec load --keyword auth --json
```

`--keyword` 跨所有 spec 文件搜索（或在指定 category 内搜索），返回匹配条目的内容（标签已去除）。

### 自动注入机制

Keyword 注入在三个点触发：

| 触发点 | Hook 事件 | 行为 |
|--------|-----------|------|
| **用户输入** | `UserPromptSubmit` | 扫描 prompt 中的关键词，匹配 spec entries，注入为 context |
| **Agent 启动** | `PreToolUse:Agent` | 从 agent prompt 提取关键词，匹配并注入 |
| **Coordinator** | `transformPrompt` | coordinator 级别的 keyword 匹配注入 |

三个触发点共享同一个 session dedup bridge，防止重复注入。

---

## 验证 Hook

`spec-validator` hook 在写入 `.workflow/specs/` 文件时自动验证格式：

**验证规则：**

1. 每个 `<spec-entry>` 必须有 `</spec-entry>` 闭合
2. `category` 属性存在且为 7 个有效值之一
3. `keywords` 属性存在且 ≥1 个关键词
4. `date` 匹配 `YYYY-MM-DD` 格式
5. `category` 值必须匹配所在文件的 category
6. 无嵌套 `<spec-entry>`

**默认 warn 模式** — 不阻断写入，只输出警告。可在 config 中切换为 `block` 模式。

```
[SpecValidator] Format warnings:
L5: Missing required attribute: keywords (need at least 1)
L5: Invalid date format "04-21-2026". Expected YYYY-MM-DD
```

---

## Session Dedup

防止同一个 session 中重复注入相同的 spec entries：

- **Bridge 文件：** `{tmpdir}/maestro-spec-kw-{sessionId}.json`
- **记录内容：** 已注入的 keywords 列表 + 已注入的 entry IDs
- **判定规则：** entry 的 ID 已在 bridge 中 → 跳过该 entry
- **生命周期：** session 结束后 bridge 文件自然过期

```json
{
  "session_id": "abc123",
  "injected_keywords": ["auth", "token", "tenant"],
  "injected_entries": ["learnings.md:15", "coding-conventions.md:42"],
  "updated_at": 1745193600
}
```

---

## 文件结构

```
.workflow/
├── specs/
│   ├── coding-conventions.md      # category: coding
│   ├── architecture-constraints.md # category: arch
│   ├── quality-rules.md           # category: quality
│   ├── debug-notes.md             # category: debug
│   ├── test-conventions.md        # category: test
│   ├── review-standards.md        # category: review
│   └── learnings.md               # category: learning
└── project-tech.json              # 技术栈概要
```

每个文件有 YAML frontmatter：

```yaml
---
title: "Coding Conventions"
category: coding
---
```

文件正文包含 `<spec-entry>` 闭合标签条目和/或旧格式 heading 条目。

---

## 向后兼容

系统采用**双格式解析**，同时支持新旧两种条目格式：

**新格式（`<spec-entry>` 闭合标签）：**
```markdown
<spec-entry category="learning" keywords="slug,regex,validation" date="2026-04-08">

### Slug 验证正则分散在 3 个文件且不一致

middleware/tenant.ts、db/connection-pool.ts、validation.ts 各有不同的 slug 正则。
需提取共享 SLUG_REGEX 到独立模块。

</spec-entry>
```

**旧格式（heading-based）：**
```markdown
### [2026-04-08 20:00] pitfall: Slug 验证正则分散在 3 个文件且不一致

middleware/tenant.ts、db/connection-pool.ts、validation.ts 各有不同的 slug 正则。
```

解析器先提取所有 `<spec-entry>` 块，再对剩余文本用 heading parser 处理。两种格式在同一文件中共存。

**keyword 过滤行为：**
- 新格式：精确匹配 `keywords` 属性
- 旧格式：文本搜索 fallback

---

## CLI 参考

```bash
# 初始化
maestro spec init                           # 创建种子文档

# 加载
maestro spec load                           # 加载全部
maestro spec load --category coding         # 按 category 加载
maestro spec load --keyword auth            # 按 keyword 加载
maestro spec load --category arch --keyword module  # 组合
maestro spec load --json                    # JSON 输出
maestro spec load --stdin                   # Hook 模式（读 stdin）

# 查看
maestro spec list                           # 列出 spec 文件
maestro spec status                         # 显示状态（文件数、大小）

# Hook 管理
maestro hooks install --level standard      # 安装包含 spec-validator + keyword-spec-injector
maestro hooks status                        # 查看 hook 状态
```
