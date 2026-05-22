# 为人民服务 · Serve the People

> 多 Agent 编码协作系统。13 Agent × 14 步流水线：需求澄清 → 方案会签 → 并行执行 → 独立验收 → 经验归档。

市面上多数 Multi-Agent 框架是自由对话模式——Agent 聊完给结果，没需求澄清、没方案审核、没独立验收、没经验积累。为人民服务用分权制衡解决这个问题：

- **发改委** 需求澄清（≤5 轮 Q&A）→ 拆 phase → 出方案 → 建议编制
- **国务院** 组建工作组，旁路 spawn 国家监委监控执行
- **工信部 spec → 应急部会签 → 编码 → 测试 → 住建部部署 → 教育部文档**
- **审计署** cos 普通用户黑盒验收，不合格退回（≤3 轮）
- **档案局** 九维索引归档教训 → 交叉分析 → 生成《若干问题》→ 追踪消化
- **闭环** 红头文件签发生效，部委学习提炼为 skill，下次任务自动加载

---

## 安装

```
git clone https://github.com/bomomoQWQ/Serve-the-People.git
cd Serve-the-People && bash install.sh    # Unix
# 或 powershell install.ps1               # Windows
```

或手动：`bun install && bun run build`，然后在 OpenCode 配置添加：

```jsonc
{ "plugin": ["/path/to/Serve-the-People"] }
```

重启 OpenCode 即可。配置文件 `.opencode/serve-the-people.jsonc` 自动生成。

> 不要与 oh-my-openagent 共存（同名 agent/工具冲突）。

---

## 架构

```
用户
 └─ 国务院        — 收文 / Q&A 中转 / 建组 / 呈报 / 签发红头
     ├─ 发改委      — 需求澄清 → 拆 phase → 出方案（≤5 轮 Q&A）
     ├─ 国家监委    — 旁路监控（心跳 / 停滞 / 合规 / 返工）
     ├─ 审计署      — 黑盒用户验收（按 README 走流程，≤3 轮退回）
     ├─ 档案局      — 归档索引 → 交叉分析 → 《若干问题》→ 追踪消化
     └─ 工作组（按需 spawn）
         ├─ 科技部      — 并行调研（explore/N + librarian + oracle）
         ├─ 工信部      — spec → coding → self-review
         ├─ 应急管理部   — 会签 / 测试 / CVE 扫描
         ├─ 住建部      — Dockerfile / CI/CD / 部署
         └─ 教育部      — API 文档 / README / 架构说明
```

### 完整流程

| 步 | 动作 |
|----|------|
| 1 | 国务院收文，登记 TASK-ID，转发发改委 |
| 2 | 发改委 Q&A → 国务院去术语 → 用户回答（≤5 轮）|
| 3 | 发改委拆 phase → 出方案 + 编制建议 |
| 4 | 国务院完整性检查 → 用户拍板 |
| 5 | 组建工作组 spawn 部委 + 监委旁路 |
| 6 | 工信部 spec → 应急部会签 → 编码 → 住建部/教育部 |
| 7 | 国家监委心跳/停滞监控 → 报告国务院 |
| 8 | 审计署黑盒验收（cos 普通用户按 README 走）|
| 9 | 部委写工作报告 + 自我批评 → 国务院中转 |
| 10 | 档案局归档 → 九维索引 → 交叉分析 → 《若干问题》草案 |
| 11 | 国务院签发红头文件 → 归档 + 群发部委 |
| 12 | 部委学习红头 → 提炼 skill（skill_write）|
| 13 | 档案局标记消化（danganju_digestion）|
| 14 | 闭环：解散工作组，下次任务自动加载 skill |

---

## Agent

### 常设机构（primary mode）

| Agent | 职责 | 红线 |
|-------|------|------|
| **guowuyuan** | 用户界面 / 收文中转 / 建组 / 呈报 | 不做技术分析 |
| **fagaiwei** | 需求澄清 / 拆 phase / 出方案 / 建议编制 | 不执行 |
| **jianwei** | 心跳监控 / 停滞检测 / 合规 / 返工追踪 | 不阻塞不叫停 |
| **shenjishu** | cos 普通用户黑盒验收（≤3 轮退回） | 不读代码 |
| **danganju** | 归档 / 9 维索引 / 交叉分析 / 消化追踪 | 不做决定 |

### 按需部委（subagent mode，由国务院 spawn）

| Agent | 职责 | 工具限制 |
|-------|------|----------|
| **kejibu** | 并行技术调研 | explore/librarian/oracle only |
| **gongxinbu** | spec → 编码 → 自审 | 同上 |
| **yingjibu** | 会签 / 测试 / CVE 扫描 | 同上 |
| **zhujianbu** | Dockerfile / CI/CD / 部署 | 同上 |
| **jiaoyubu** | API 文档 / README / 架构说明 | 同上 |

### 基础 sub-agent

| Agent | 用途 |
|-------|------|
| **oracle** | 只读高 IQ 技术顾问 |
| **librarian** | 外部文档 / GitHub 搜索 |
| **explore** | 代码库搜索（grep/glob/lsp/ast-grep）|

---

## 工具

### 工作组协作
`workgroup_create` · `workgroup_status` · `workgroup_list` · `workgroup_task` · `workgroup_message` · `workgroup_disband`

### 档案局
`danganju_archive` · `danganju_query` · `danganju_analyze` · `danganju_draft` · `danganju_digestion`

### 审计署
`shenjishu_audit` — 自助读取/更新审计轮次和历史失败项

### 代码分析
`lsp_diagnostics` · `lsp_symbols` · `ast_grep_search` · `ast_grep_replace` · `edit` (hashline) · `grep` · `glob`

### Skill
`skill_write` · `skill_list` · `skill` · `skill_mcp`

### 会话
`task` (delegate) · `background_output` · `background_cancel` · `session_list` · `session_read` · `session_search` · `session_info`

---

## 存储布局

```
~/.servethepeople/          ← 全局持久（跨项目）
├── skills/                 ← SKILL.md
└── archives/
    ├── works/              ← 工作报告 + 自我批评
    ├── indices/index.json  ← 9 维索引
    ├── drafts/             ← 《若干问题》草稿
    └── digestion.json      ← 消化记录

{project}/.servethepeople/  ← 项目级（临时）
└── teams/                  ← 工作组 → 解散即删
```

---

## 红线

- 工信部 spec 未经应急部会签 → 禁止编码
- Q&A ≤ 5 轮，超限标注"基于假设"
- 退回 ≤ 3 轮，第 4 轮强制通过
- 审计 ≤ 3 轮，第 3 轮已知缺陷放行
- 国务院不做技术分析
- 监委不阻塞、审计不盯进度
- 按需部委只能 spawn explore/librarian/oracle，禁止委托其他部委

---

## 模型配置

默认不设模型，由 OpenCode 自动选择。推荐：

| Agent | 推荐模型 |
|-------|---------|
| `oracle` `librarian` `explore` | `anthropic/claude-sonnet-4-6` |
| `gongxinbu` | `openai/gpt-5.5` |
| 其余 | `anthropic/claude-sonnet-4-6` |

配置覆盖：`.opencode/serve-the-people.jsonc`

```jsonc
{ "agents": { "guowuyuan": { "model": "your-provider/model" } } }
```

---

## 项目结构

```
src/
├── agents/              13 agent factories + registry
├── tools/               grep / glob / session-manager / delegate-task /
│                        workgroup / danganju / shenjishu /
│                        lsp-diagnostics / lsp-symbols /
│                        ast-grep-search / ast-grep-replace /
│                        hashline-edit / skill-write / skill / skill-mcp /
│                        background-task
├── hooks/               jianwei-monitor / workgroup-mailbox-injector / workgroup-idle-wake
├── features/
│   ├── workgroup/       mailbox / tasklist / state / spawn / session-registry
│   ├── pipeline/        coordinator / state
│   ├── shenjishu/       checklist + auto-trigger
│   └── archives/        storage / indices / analysis / digestion / templates
├── mcp/                 websearch / context7 / grep_app
├── shared/              paths / skill-loader / ripgrep-cli
└── create-*.ts          plugin wiring
```

---

## 致谢

- [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) — 插件框架参考
- [edict (三省六部)](https://github.com/cft0808/edict) — 架构设计灵感
- [OpenCode](https://opencode.ai) — 插件平台

---

## 许可证

GPL-3.0
