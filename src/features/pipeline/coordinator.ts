/**
 * Pipeline coordinator — orchestrates the 14-step workflow.
 * Wired into the chat.message hook to intercept user messages
 * and drive the entire 国务院 → 发改委 → workgroup pipeline.
 */

import {
  PipelineState,
  createPipelineTask,
  getPipelineTask,
  transitionState,
  incrementQaRound,
  attachWorkgroup,
  type PipelineTask,
} from "./state"

/** Result of processing one step of the pipeline */
export interface StepResult {
  /** System message to inject into the chat context */
  systemMessage?: string
  /** User-facing message (国务院 speaks to user) */
  userMessage?: string
  /** Whether the pipeline is waiting for user input */
  awaitingUser: boolean
}

/**
 * Process a user message through the pipeline.
 * This is called from the chat.message hook.
 */
export function processUserMessage(
  userText: string,
  activeTaskId?: string,
): StepResult {
  // Step 0: No active task → start new pipeline (国务院 receives user message)
  if (!activeTaskId) {
    const task = createPipelineTask(userText)
    return {
      systemMessage: buildIntakePrompt(task, userText),
      userMessage: `收到。任务 ${task.taskId} 已登记，正在转发发改委评估需求。`,
      awaitingUser: false,
    }
  }

  // Find active task
  const task = getPipelineTask(activeTaskId)
  if (!task) {
    // Task not found, start fresh
    const newTask = createPipelineTask(userText)
    return {
      systemMessage: buildIntakePrompt(newTask, userText),
      userMessage: `收到。任务 ${newTask.taskId} 已登记。`,
      awaitingUser: false,
    }
  }

  // Route based on current state
  switch (task.state) {
    case PipelineState.INTAKE:
      return handleIntake(task, userText)

    case PipelineState.QA:
      return handleQa(task, userText)

    case PipelineState.PLANNING:
      return handlePlanning(task, userText)

    case PipelineState.APPROVAL:
      return handleApproval(task, userText)

    case PipelineState.EXECUTING:
      // Workgroup is running independently. If user sends a new task request,
      // start a fresh pipeline rather than blocking.
      if (_isNewTask(userText)) {
        const newTask = createPipelineTask(userText)
        return {
          systemMessage: buildIntakePrompt(newTask, userText),
          userMessage: `新任务 ${newTask.taskId} 已登记。`,
          awaitingUser: false,
        }
      }
      // Message is about existing workgroup — let 国务院 handle directly
      return { awaitingUser: false }

    default:
      return { awaitingUser: true }
  }
}

/** 国务院 → 转发到发改委 (Step 1→2) */
function handleIntake(task: PipelineTask, _userText: string): StepResult {
  transitionState(task.taskId, PipelineState.QA)

  return {
    systemMessage: buildFagaiweiQaPrompt(task),
    userMessage: "已转发改委评估需求。",
    awaitingUser: false,
  }
}

/** 发改委 Q&A → 国务院 formatting → user */
function handleQa(task: PipelineTask, userText: string): StepResult {
  const round = incrementQaRound(task.taskId)

  if (round >= 5) {
    // Q&A exhausted → 发改委 proceeds with assumptions
    transitionState(task.taskId, PipelineState.PLANNING)
    return {
      systemMessage: buildFagaiweiPlanPrompt(task),
      userMessage: "发改委 Q&A 完成，正在制定执行方案。",
      awaitingUser: false,
    }
  }

  // Q&A in progress — 国务院 must relay
  if (_isFagaiweiQuestion(userText)) {
    // 发改委 asked a question → 国务院 translates for user
    return {
      userMessage: formatForUser(userText),
      awaitingUser: true,
    }
  }

  // User answered → forward to 发改委
  return {
    systemMessage: buildFagaiweiQaContinuePrompt(task, userText),
    userMessage: `已转达（第 ${round}/5 轮）。`,
    awaitingUser: false,
  }
}

/** 发改委 creates plan → user approval */
function handlePlanning(task: PipelineTask, _userText: string): StepResult {
  transitionState(task.taskId, PipelineState.APPROVAL)

  return {
    systemMessage: buildPlanReviewPrompt(task),
    userMessage: "发改委方案已出，请审阅：\n\n" +
      "（系统正在整理方案，请稍候...）",
    awaitingUser: true,
  }
}

/** User approves plan → spawn workgroup */
function handleApproval(task: PipelineTask, userText: string): StepResult {
  if (_isApproval(userText)) {
    const workgroupId = `GW-${new Date().toISOString().slice(0, 7).replace(/-/g, "-")}-${String(Date.now() % 1000).padStart(3, "0")}`
    attachWorkgroup(task.taskId, workgroupId)
    transitionState(task.taskId, PipelineState.EXECUTING)

    return {
      systemMessage: buildWorkgroupSpawnPrompt(task, workgroupId),
      userMessage: `批准。工作组 ${workgroupId} 已组建，各部委正在并行执行。`,
      awaitingUser: false,
    }
  }

  // Not approved → ask again
  return {
    userMessage: "请确认方案是否可行。输入 '可以' 或 '搞' 继续。",
    awaitingUser: true,
  }
}

// ── Prompt builders ──

function buildIntakePrompt(task: PipelineTask, userText: string): string {
  return `\n<!-- SERVE-THE-PEOPLE PIPELINE: INTAKE -->\n` +
    `[系统指令] 你是国务院。用户发来需求："${userText}"。任务ID: ${task.taskId}。\n` +
    `你的职责：不做技术分析。将此需求转发给发改委 (fagaiwei) 评估。\n` +
    `使用 task(subagent_type="fagaiwei", prompt="请评估以下需求并制定方案：${userText}")`
}

function buildFagaiweiQaPrompt(task: PipelineTask): string {
  return `\n<!-- SERVE-THE-PEOPLE PIPELINE: QA STARTED -->\n` +
    `[系统指令] 你是发改委。任务ID: ${task.taskId}。\n` +
    `原始需求: "${task.originalMessage}"\n` +
    `请分析需求，如不明确请提出具体问题。5轮后按假设继续。`
}

function buildFagaiweiQaContinuePrompt(task: PipelineTask, answer: string): string {
  return `\n<!-- SERVE-THE-PEOPLE PIPELINE: QA ROUND ${task.qaRounds} -->\n` +
    `[系统指令] 用户回答: "${answer}"\n` +
    `是否还需要追问？不需要则说 "需求已澄清，进入规划。"`
}

function buildFagaiweiPlanPrompt(task: PipelineTask): string {
  return `\n<!-- SERVE-THE-PEOPLE PIPELINE: PLANNING -->\n` +
    `[系统指令] 需求已澄清（或Q&A用尽）。任务ID: ${task.taskId}。\n` +
    `请制定执行方案：拆解phase、建议编制。`
}

function buildPlanReviewPrompt(task: PipelineTask): string {
  return `\n<!-- SERVE-THE-PEOPLE PIPELINE: USER APPROVAL -->\n` +
    `[系统指令] 方案已输出。请向用户展示方案摘要并请求批准。`
}

function buildWorkgroupSpawnPrompt(task: PipelineTask, workgroupId: string): string {
  return `\n<!-- SERVE-THE-PEOPLE PIPELINE: WORKGROUP SPAWN -->\n` +
    `[系统指令] 用户已批准方案。工作组ID: ${workgroupId}。任务ID: ${task.taskId}。\n` +
    `请立即组建工作组——spawn 所需的部委 agent session。\n` +
    `使用 workgroup state/mailbox/tasklist 工具管理协作。`
}

// ── Helpers ──

function formatForUser(text: string): string {
  // 发改委可能输出技术问题，国务院应格式化
  return `发改委有以下问题需要确认：\n\n${text.replace(/[\[\(]系统指令[\]\)]/g, "").replace(/<!--.*?-->/gs, "").trim()}`
}

function _isFagaiweiQuestion(text: string): boolean {
  return text.includes("?") || text.includes("？") || text.includes("请确认") || text.includes("请选择")
}

function _isApproval(text: string): boolean {
  const t = text.toLowerCase().trim()
  return t === "可以" || t === "搞" || t === "yes" || t === "ok" || t === "批准" || t === "行" || t === "好" || t === "开始"
}

function _isNewTask(text: string): boolean {
  // Heuristic: message contains task-like opening keywords → treat as new task request
  return text.length > 10 && (
    text.startsWith("搞") || text.startsWith("做") || text.startsWith("写") || text.startsWith("建") ||
    text.startsWith("开始") || text.startsWith("帮我") || text.startsWith("请") ||
    text.startsWith("测试") || text.startsWith("实现") || text.startsWith("创建")
  )
}
