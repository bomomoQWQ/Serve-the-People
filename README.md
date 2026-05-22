# 为人民服务 · Serve the People

> 多 Agent 编码协作系统，参考中国现代政治结构的分权制衡替代 Agent 自由对话。
> 
> 发改委把关需求、国家监委旁路监控、审计署逐项验收、档案局积累经验——13 个 Agent 走完 14 步流水线，质量可追溯、经验可积累。

---

市面上多数 Multi-Agent 框架是自由对话模式：Agent 自己聊，聊完直接给结果。没有需求澄清、没有方案审核、没有独立验收、没有经验积累——**上次翻的错，下次继续翻**。

为人民服务用 agent 参考了一套运行了 70+ 年的分权制衡架构来解决这个问题：

- **发改委**在动手前做结构化 Q&A，最多 5 轮问到透彻：先搞清楚用户真正要什么，不猜。出方案、拆 phase、建议哪些部委加入工作组。超 5 轮还不清的，标注"以下 N 项基于假设"，不卡住。
- **国家监委**旁路监控执行过程，不阻塞但每步留痕：监听每个 task 的状态变更频率，连续不动的标记停滞；工信部和应急部来回扯皮超 3 次的记录争议；红头文件要求的步骤被跳过的标记违规。发现问题只写报告给国务院，不叫停执行。
- **审计署**按清单逐项验收——代码存在、测试覆盖率达标、配置非硬编码、JWT 含过期+刷新、Dockerfile 端口合规、文档与代码一致。不合格退回附清单，最多退 3 轮。第 3 轮还不过，标记已知缺陷放行，记到《若干问题》里公示。
- **档案局**归档每次教训，九维索引建好——任务类型、分类、严重程度、部委、红头、工作组、时间、phase 阶段、全文搜索。同一类教训踩了 3 次以上的建议国务院发红头文件，critical 级别的立刻写进《若干问题》。下次任务时这些教训预载为 Skill，**上次犯的错不再犯**。

这个项目的起点很简单：看到 [edict/三省六部](https://github.com/cft0808/edict) 的古制架构，觉得「古的都能那么强，现代的分权制衡岂不是更强」；又觉得 [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) 好用。结合一下。

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

重启 OpenCode 即可。插件首次加载时自动创建 `.opencode/serve-the-people.jsonc`。也可直接编辑项目根目录下的 `.opencode/serve-the-people.jsonc` 调整 MCP、Skill、Agent 模型等配置。

> 不要与 oh-my-openagent 共存（同名 agent/工具冲突）。

---

## 架构

```
用户
 +-- 国务院     — 收发 / Q&A 中转 / 查档 / 建组 / 呈报 / 签发红头
 +-- 发改委     — Q&A（最多 5 轮）-> 拆 phase -> 出方案 + 建议编制
 +-- 国家监委   — 旁路监控（心跳 / 停滞 / 合规 / 返工追踪 / 报告）
 +-- 审计署     — 按清单逐项验收，最多退 3 轮
 +-- 档案局     — 九维索引归档 -> 提炼《若干问题》-> 追踪 skill 消化
 +-- 工作组（按需 spawn）
      +-- 科技部     — 调研（explore×N + librarian×3 + oracle）
      +-- 工信部     — spec -> 会签 -> 编码 -> 自审
      +-- 应急管理部 — 会签 / 测试 / 安全扫描
      +-- 住建部     — Dockerfile / CI/CD / 部署
      +-- 教育部     — API 文档 / README
```

---

## Agent

### 常设机构（primary）

#### guowuyuan — 国务院

**收文转发。** 登记 TASK-ID、原始文本、时间戳，不做分析直接转发发改委。

**Q&A 中转。** 发改委的技术问题去掉术语后问用户，用户回答转回发改委。

**建组呈报。** 用户拍板后查档建组，收到监委报告后格式化呈报用户。

**签发红头。** 收到档案局《若干问题》草稿后决定是否发红头文件，签发后抄送各部委归档。

> 红线：只转述不分析，不绕过发改委决策。

#### fagaiwei — 发改委

**需求澄清。** 结构化面试，最多 5 轮 Q&A。超 5 轮标注"以下 N 项基于假设"继续。

**查档。** 查询档案局搜历史相关红头文件和教训。

**出方案。** 拆解 phase -> 出执行方案 -> 建议编制（抽调哪些部委）。

> 红线：不直接对话用户，不写码不测试不部署。

#### jianwei — 国家监委

**心跳监控。** 监听每个 task 的状态变更频率。连续 3 轮无变更标记停滞。

**合规检查。** 红头要求的关键步骤是否被执行（如 spec 未会签就编码 -> 标记违规）。

**返工追踪。** 记录工信部/应急部间退回次数。超 3 轮 -> 第 4 轮强制通过，记录争议。

**报告。** 定期或异常时写报告给国务院呈报用户。

> 红线：不介入执行，不叫停。发现异常只记录报告。

#### shenjishu — 审计署

**验收时机。** 全部 task 标记 completed 后触发。

**验收清单。** 代码存在 / 测试覆盖率 >= 阈值 / 配置非硬编码 / JWT 含过期+刷新 / Dockerfile 端口合规 / 文档与代码一致（doc-code-sync）。

**退回。** 不合格附清单 -> 相关部委整改 -> 重新验收。最多 3 轮，第 3 轮仍不合格 -> 标记已知缺陷放行，记录到《若干问题》。

> 红线：不盯进度、不中途介入、不修改代码。

#### danganju — 档案局

**归档。** 各部委的工作报告和自我批评入库。

**九维索引。** 任务类型 / 教训分类 / 严重程度 / 涉及部委 / 关联红头 / 工作组 ID / 时间范围 / phase 阶段 / 全文搜索。

**提炼。** 交叉分析教训。同一分类 >= 3 次 -> 草拟《若干问题》建议国务院发红头。同一 phase 高频卡顿 -> 建议调整编制。critical 级别教训 -> 立即写进《若干问题》。

**消化追踪。** 各部委学习红头文件后生成 skill -> 标记已消化 -> 下次任务自动加载。

> 红线：不做决定，不删教训。

---

### 按需部委（subagent mode）

#### kejibu — 科技部

**技术调研。** 收到调研请求 -> 并行 spawn explore×N + librarian×3 + oracle -> 综合结果 -> 输出推荐方案。

**自审。** 方案对比 >= 2 候选 / 推荐理由有数据支撑 / 标注信息来源和不确定性。

**输出给。** 工信部（搜索结果/方案推荐/根因分析）。

> 红线：不写代码，不测试。

#### gongxinbu — 工信部

**流程。** 出 spec -> 应急部会签通过 -> 开始编码 -> 自审通过 -> 提交应急部测试。

**自审。** 配置外抽非硬编码（国发6号）/ OpenAPI spec 含错误码（国发5号）/ JWT 含过期+刷新（国发3号）/ happy path 自测通过。

**可 spawn。** librarian（查 API 文档）/ explore（搜现有代码模式）。

> 红线：spec 未经会签禁止编码。配置硬编码审计不通过。接口变更未通知教育部审计不通过。

#### yingjibu — 应急管理部

**会签。** 工信部 spec 提交后审核、通过/退回。退回必须附文件:行号 + 原因 + 建议。

**测试。** 单元/集成/回归测试。边界条件覆盖率达标。

**安全扫描。** CVE 扫描、漏洞检测、合规审计。

**通知。** 测试通过后通知住建部（可部署）和教育部（可定稿）。

> 红线：不写代码。会签漏项审计追溯不合格。高危漏洞未报告验收不通过。退回理由模糊自审不通过。

#### zhujianbu — 住建部

**部署。** Dockerfile -> CI/CD -> 部署执行。

**自审。** 端口与工信部确认一致 / 无非必要端口暴露 / Dockerfile 语法通过 / 环境变量完整。

> 红线：端口不一致或暴露非必要端口 -> 应急部退回。不写业务代码。

#### jiaoyubu — 教育部

**文档。** API 文档 / README / 架构说明 / 变更日志。

**自审。** 文档与工信部最新代码一致 / 错误码说明完整（国发5号）/ 示例代码可运行。

> 红线：文档与代码不一致或错误码章节缺失 -> 应急部退回。不写代码。

---

### 基础 sub-agent

#### oracle — 只读顾问

架构设计 / 硬调试 / 方案对比。被发改委、科技部调用。

#### librarian — 外部搜索

Context7 + GitHub 代码搜索 + 网页抓取。被科技部、工信部、应急部等调用。

#### explore — 代码搜索

grep + glob + AST-grep + LSP 符号查找。被科技部并行 spawn 多个。

---

## 工作流

**核心系统（8 步）：** 收文 -> Q&A -> 方案 -> 拍板 -> 建组 -> 执行 -> 监督 -> 验收

| 步 | 动作 |
|----|------|
| 1 | 国务院收文，登记 TASK-YYYYMMDD-NNN，转发发改委 |
| 2 | 发改委整理问题 -> 国务院去技术术语 -> 用户回答（最多循环 5 轮）|
| 3 | 发改委查档案 -> 拆 phase -> 出方案 + 编制建议 |
| 4 | 国务院完整性检查（不分析技术）-> 用户拍板 |
| 5 | 国务院查档案局拿红头 -> spawn 工作组（含 skill 预加载）|
| 6 | 工信部 spec -> 应急部会签 -> 编码 -> 测试 -> 部署/文档。最多 3 轮退回 |
| 7 | 国家监委心跳/停滞监控 -> 报告国务院 -> 呈报用户 |
| 8 | 审计署验收 -> done / 退回（最多 3 轮）|

**学习系统（6 步）：** 批评 -> 归档 -> 提炼 -> 发红头 -> 学 -> 闭环

| 步 | 动作 |
|----|------|
| 9 | 各部委写工作报告 + 自我批评（根因分类 / 严重程度 / 改进建议）|
| 10 | 档案局归档 -> 九维索引 -> 交叉分析 -> 提炼《若干问题》|
| 11 | 国务院签发红头文件（国发〔YYYY〕N 号）|
| 12 | 部委学习 -> 提炼 skill -> 写入 profile（<=50 个/部委，单 skill <= 2000 tokens）|
| 13 | 档案局标记消化 |
| 14 | 闭环：下次任务自动加载 skill |

---

## 红线

- 工信部 spec 未经应急部会签 -> **禁止编码**
- Q&A 最多 5 轮，超限标注"以下 N 项基于假设"
- 退回最多 3 轮，第 4 轮强制通过（附带保留意见）
- 审计最多 3 轮，第 3 轮已知缺陷放行 -> 写入《若干问题》
- **国务院不做技术分析**，不绕过发改委决策
- 监委不阻塞、审计不盯进度
- Sub-agent 只读不写、用完即毁、不得递归 spawn
- Skill 每部委 <= 50 个，单 skill <= 2000 tokens

---

## 模型配置

默认不设模型，由 OpenCode 自动选择。推荐配置：

| Agent | 推荐模型 |
|-------|---------|
| `oracle` | `anthropic/claude-sonnet-4-6` |
| `librarian` `explore` | `openai/gpt-5.4-mini-fast` |
| `gongxinbu` | `openai/gpt-5.5` |
| 其余 9 个 | `anthropic/claude-sonnet-4-6` |

如需指定，编辑 `serve-the-people.jsonc`（用户级 `~/.config/opencode/`，项目级 `.opencode/`）：

```jsonc
{ "agents": { "guowuyuan": { "model": "anthropic/claude-sonnet-4-6" } } }
```

---

## 项目结构

```
serve-the-people/
├── src/
│   ├── agents/              13 个 Agent + registry
│   ├── tools/                grep / glob / session-manager / task / workgroup / background-task / skill / skill-mcp
│   ├── hooks/                jianwei-monitor + constants
│   ├── features/
│   │   ├── workgroup/        mailbox + tasklist + state + spawn
│   │   ├── pipeline/         coordinator + state machine
│   │   ├── shenjishu/        checklist + auto-trigger
│   │   └── archives/         storage + indices + analysis + digestion + templates
│   ├── mcp/                  websearch / context7 / grep_app / lsp / ast_grep
│   ├── config/               schema + types
│   ├── shared/               ripgrep-cli + skill-loader
│   ├── testing/              create-plugin-module
│   └── plugin-interface.ts / plugin-config.ts / create-tools.ts / create-hooks.ts
├── install.sh / install.ps1  安装脚本
└── package.json
```

---

## For LLM Agents

前置：`bun --version >= 1.3`，`opencode --version >= 1.0.150`

**安装：**

```
git clone https://github.com/bomomoQWQ/Serve-the-People.git
cd Serve-the-People && bun install && bun run build
```

**注册：** 在 OpenCode 配置中添加 `{ "plugin": ["$PWD"] }`，重启。验证 agent 列表出现以下 13 个 agent：`guowuyuan fagaiwei jianwei shenjishu danganju kejibu gongxinbu yingjibu zhujianbu jiaoyubu oracle librarian explore`。

**模型：** 如果用户没有默认模型，编辑项目根目录 `.opencode/serve-the-people.jsonc` 中的 `agents` 字段覆盖（参考上方模型配置表）。此文件已预置在仓库中。

**警告：** 不和 oh-my-openagent 共存。无 claude 时 Oracle 等 agent 可能不可用，推荐 kimi-k2.6 或 glm-5 替代。

---

## 路线图

- [x] Phase 1-3: 13 Agent + 17 工具 + 工作组 + 5 MCP + 监督/验收/学习系统
- [x] Phase 4: 监委 Hook + 审计署验收 + 档案局存储 + 学习系统第9-14步集成

---

## 致谢

- [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) — 插件框架参考。Agent 工厂模式、工具系统、Team Mode mailbox/tasklist、MCP 注册机制。
- [edict (三省六部)](https://github.com/cft0808/edict) — 架构设计灵感。11 态状态机、停滞检测、升级路径。
- [OpenCode](https://opencode.ai) — 插件平台。

---

## 许可证

双许可证：[LICENSE.md](LICENSE.md)

- 来源于 oh-my-openagent 的代码（MCP 配置、grep/glob/session-manager、部分 Agent prompt）：**SUL-1.0**
- 原创代码（角色 Agent、工作组、delegate-task 等）：**MIT**
