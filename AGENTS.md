# 为人民服务 — PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-11
**Commit:** b24ed7b
**Branch:** main

## OVERVIEW

OpenCode plugin implementing a multi-agent coding collaboration system modeled after China's State Council structure. 13 agents coordinate via workgroup sessions with mailbox messaging, audit loops, and archive learning. TypeScript strict mode, Bun runtime, GPL-3.0.

## STRUCTURE

```
src/
├── index.ts                    # Plugin entry (6 lines, delegates to factory)
├── plugin-interface.ts         # 11 OpenCode hooks wiring
├── plugin-config.ts            # JSONC config loader (user ← project merge)
├── create-tools.ts             # 17+ tool definitions, all stp_ prefix
├── create-hooks.ts             # Hook composer (wraps event with 监委)
├── create-managers.ts          # Empty (no-op)
├── agents/                     # 13 agent factories + registry
│   └── builtin/                # BUILTIN_AGENT_NAMES, createBuiltinAgents()
├── config/                     # Zod schema (debug/agents/mcp/skills)
│   └── schema/                 # ServeThePeopleConfigSchema + DEFAULT_CONFIG
├── features/
│   ├── workgroup/              # State, mailbox, tasklist, spawn, session registry
│   ├── archives/               # Storage, indices, analysis, digestion, templates
│   ├── shenjishu/              # Audit triggers, checklist definitions
│   └── pipeline/               # 14-step linear pipeline coordinator
├── hooks/                      # Idle-wake, mailbox injector, background notify, 监委 monitor
├── mcp/                        # 5 MCP servers (websearch, context7, grep_app, lsp, ast_grep)
├── shared/                     # Paths, ripgrep CLI, skill loader
├── tools/                      # 16 tool subdirectories (grep, glob, lsp, workgroup, etc.)
└── testing/                    # create-plugin-module.ts (main plugin factory)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a new agent | `src/agents/{name}.ts` + register in `builtin/registry.ts` | Must export `createXxxAgent`, assign `.mode` |
| Change agent prompts | `src/agents/{name}.ts` | Array join for safe template literals |
| Add a tool | `src/tools/{name}/tools.ts` + register in `create-tools.ts` | Use `stp_` prefix |
| Modify workgroup flow | `src/features/workgroup/` | File-based state, mailbox, tasklist |
| Change config schema | `src/config/schema/index.ts` | Zod v4, validate with `safeParse` |
| Plugin init chain | `src/testing/create-plugin-module.ts` | 7-step pipeline |
| Workgroup idle wake | `src/hooks/workgroup-idle-wake.ts` | 60s 监委 heartbeat |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `createPluginModule` | function | `testing/create-plugin-module.ts` | 7-step init factory |
| `loadPluginConfig` | function | `plugin-config.ts` | 3-tier JSONC merge |
| `createBuiltinAgents` | function | `agents/builtin/registry.ts` | Spawns 13 agents |
| `agentSources` | record | `agents/builtin/registry.ts` | Agent name → factory map |
| `BUILTIN_AGENT_NAMES` | const | `agents/builtin/registry.ts` | 13 names (canshishi..danganju) |
| `createTools` | function | `create-tools.ts` | Tool registry factory |
| `createPluginInterface` | function | `plugin-interface.ts` | Hooks wiring |
| `JianweiMonitor` | class | `hooks/jianwei-monitor.ts` | Heartbeat, stall detection, retry, escalation |
| `TaskManager` | class | `tools/delegate-task/task-manager.ts` | Session spawn + poll |
| `WorkgroupState` | interface | `features/workgroup/state.ts` | File-based team state |
| `PipelineState` | enum | `features/pipeline/state.ts` | 14-step state machine |

## CONVENTIONS

- **Tools**: All `stp_` prefixed (e.g. `stp_grep`, `stp_workgroup_create`)
- **Agents**: Pinyin naming (guowuyuan, fagaiwei, gongxinbu...)
- **Config**: JSONC with `//` comments, `.opencode/serve-the-people.jsonc`
- **State**: File-based (`.servethepeople/teams/{teamId}/state.json`)
- **Mailbox**: File-based (`.servethepeople/teams/{teamId}/mailbox/{agent}/`)
- **Tasklist**: File-based (`.servethepeople/teams/{teamId}/tasks/{id}.json`)
- **Prompts**: Agent prompts use `["...", "..."].join("\n")` (safer than template literals)
- **Imports**: No circular deps — type-only imports break potential cycles
- **Errors**: Best-effort catch blocks acceptable for cleanup; critical paths must log

## ANTI-PATTERNS

- **NEVER** `as any` or `@ts-ignore` — strict mode enforced
- **NEVER** delete failing tests to pass
- **NEVER** empty catch on critical paths
- **NEVER** hardcode paths — use `shared/paths.ts` `projectRoot()`
- **NEVER** sync write without atomic temp+rename for shared state files
- **DO NOT** auto-inject mailbox for 国务院 — it polls manually

## UNIQUE STYLES

- **同志文风**: All agent prompts use comrade-style address ("工信部的同志，辛苦了。")
- **Government theme**: Ministries (部委), workgroups (工作组), red-head documents (红头文件), archives (档案局), audit (审计署)
- **Learning loop**: Agents self-criticize → archive lessons → digest red-head documents → extract skills
- **Pipeline phases**: INTAKE → QA → PLANNING → APPROVAL → SPAWNING → EXECUTING → MONITORING → AUDITING → COMPLETE

## COMMANDS

```bash
bun run typecheck    # tsc --noEmit
bun run build        # bun build + tsc declaration emit
bun test             # (no tests yet)
```

## NOTES

- Plugin factory lives in `src/testing/create-plugin-module.ts` (non-standard location — moved future to `src/plugin-module.ts`)
- No `opencode.jsonc` — plugin registers via npm dependency in `.opencode/package.json`
- `create-managers.ts` returns empty `{}` — placeholder for future manager system
- config uses manual regex JSONC stripping instead of the `jsonc-parser` dependency
- 3 critical bugs fixed 2026-06-11: 监委 escalation hierarchy, TOCTOU race in tasklist, double `stp_` prefix on workgroup tools
- `stp_workgroup_task` and `stp_workgroup_message` are the correct tool names (NOT `stp_stp_workgroup_task`)
