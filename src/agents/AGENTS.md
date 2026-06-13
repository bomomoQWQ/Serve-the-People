# Agents — 13 Ministry Agents

13 agents modeled after Chinese State Council ministries and commissions.

## OVERVIEW

All agents registered in `builtin/registry.ts` → `agentSources` map. Each exports a `createXxxAgent(model)` factory with a static `.mode` property.

## STRUCTURE

```
agents/
├── index.ts              # Re-exports all 13 factories + types
├── types.ts              # AgentFactory, AgentMode, PermissionValue, helpers
├── builtin/
│   ├── index.ts          # Re-exports registry
│   └── registry.ts       # BUILTIN_AGENT_NAMES, agentSources, createBuiltinAgents()
├── guowuyuan.ts          # 国务院 — premier, primary orchestrator
├── fagaiwei.ts           # 发改委 — planning, requirement scoping
├── gongxinbu.ts          # 工信部 — spec → code → self-review
├── yingjibu.ts           # 应急管理部 — QA, safety review, testing
├── zhujianbu.ts          # 住建部 — Docker, CI/CD, deployment
├── jiaoyubu.ts           # 教育部 — API docs, README, architecture docs
├── kejibu.ts             # 科技部 — tech research (spawns sub-agents)
├── canshishi.ts          # 参事室 — high-IQ consultant (read-only)
├── xinxizhongxin.ts      # 信息中心 — external docs/GitHub search
├── fenxiban.ts           # 分析办 — codebase grep/glob/LSP search
├── jianwei.ts            # 国家监委 — bypass monitor, heartbeat, stall detection
├── shenjishu.ts          # 审计署 — black-box QA audit (max 3 rounds)
└── danganju.ts           # 档案局 — archives, lessons learned, skill extraction
```

## WHERE TO LOOK

| Task | File | Pattern |
|------|------|---------|
| Add new agent | Create `{name}.ts` + register in `builtin/registry.ts` + export from `index.ts` | Follow existing factory pattern |
| Change agent mode | `{agent}.ts` → `const MODE: AgentMode = "primary" \| "subagent"` | Primary = orchestrator, subagent = executor |
| Modify prompt | `{agent}.ts` → `prompt: [...]`.join("\n")` | Use array join, never raw template literals with backticks |
| Tool restrictions | `fenxiban.ts`, `xinxizhongxin.ts`, `canshishi.ts` | `createAgentToolRestrictions` returns permission map |
| Escalation hierarchy | `hooks/constants.ts` → `ESCALATION_HIERARCHY` | Only agents in this list get escalated on stall |

## CONVENTIONS

- **Factory pattern**: Every agent exports `createXxxAgent(model: string): AgentConfig`
- **Static mode**: `createXxxAgent.mode = MODE` assigned after function declaration
- **Prompts**: `["line1", "", "line2"].join("\n")` — array join avoids template literal backtick escaping
- **Prompt style**: Comrade address (同志式文风), markdown structure
- **Primary agents**: guowuyuan, fagaiwei, shenjishu, danganju — user-facing orchestrators
- **Subagent agents**: All others — spawned as worker sessions, not user-facing
- **Model config**: Model set only when user explicitly overrides in config; otherwise OpenCode defaults

## ANTI-PATTERNS

- **DO NOT** forget `.mode = MODE` on new agents — causes runtime crash in registry
- **DO NOT** use raw template literals for prompts containing backticks — use array join
- **DO NOT** register an agent without adding to `BUILTIN_AGENT_NAMES` and `agentSources`
- **AVOID** `as AgentConfig` as permanent escape hatch — validate permission types match SDK schema
