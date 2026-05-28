import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ipcMain, dialog } from 'electron'
import { streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { settings, AppSettings } from './settings'
import { resumeData } from './resume'

export const PROMPT_SYSTEM = readFileSync(join(import.meta.dirname, 'prompts.md'), 'utf-8').trim()

// Known providers that do NOT support vision (image_url) at all
const TEXT_ONLY_PROVIDERS = ['deepseek.com', 'api.deepseek.com']

// Known vision-capable models for fallback
const VISION_FALLBACKS: Record<string, string> = {
  siliconflow: 'Qwen/Qwen3-VL-32B-Instruct'
}

function getModel(_settings: AppSettings, needsVision = false) {
  const userModel = _settings.model?.trim()
  const apiUrl = settings.apiBaseURL || ''

  if (needsVision) {
    if (userModel) {
      if (TEXT_ONLY_PROVIDERS.some((p) => apiUrl.includes(p))) {
        const hostname = (() => { try { return new URL(apiUrl).hostname } catch { return apiUrl } })()
        throw new Error(
          `当前 API 服务商（${hostname}）不支持视觉模型，截图功能不可用。\n请切换至支持视觉模型的 API 服务商，如硅基流动 (https://api.siliconflow.cn/v1) 配合 Qwen/Qwen3-VL-32B-Instruct 模型。`
        )
      }
      return userModel
    }
    for (const [key, model] of Object.entries(VISION_FALLBACKS)) {
      if (apiUrl.includes(key)) return model
    }
    return 'gpt-5-mini'
  }

  const fallbackModel = apiUrl.includes('siliconflow')
    ? 'Qwen/Qwen3-VL-32B-Instruct'
    : 'gpt-5-mini'
  return userModel || fallbackModel
}

export function getVisionProvider() {
  if (settings.useSeparateVisionModel && settings.visionApiBaseURL && settings.visionApiKey) {
    return {
      baseURL: settings.visionApiBaseURL,
      apiKey: settings.visionApiKey,
      model: settings.visionModel || getModel(settings, true)
    }
  }
  return {
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey,
    model: getModel(settings, true)
  }
}

function getSolvingProvider() {
  return {
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey,
    model: settings.useSeparateVisionModel
      ? getModel(settings)  // Text model for solving
      : getModel(settings, true)  // Unified vision model
  }
}

/**
 * Extract problem text from a screenshot image using the vision model.
 * Returns only the text description of the problem, not a solution.
 */
async function extractTextFromImage(base64Image: string, abortSignal?: AbortSignal): Promise<string> {
  const { baseURL, apiKey, model } = getVisionProvider()
  const openai = createOpenAI({ baseURL, apiKey })

  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '请只提取图片中的题目内容，不要解答。直接返回题目文字即可。'
        },
        {
          type: 'image',
          image: base64Image
        }
      ]
    }
  ]

  const result = streamText({
    model: openai.chat(model),
    messages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })

  let text = ''
  for await (const chunk of result.textStream) {
    text += chunk
  }
  return text.trim()
}

/**
 * Build conversation messages for screenshot-based AI requests.
 * When dual-model mode is active, extracts text from image first,
 * then builds text-only messages for the solving model.
 */
export async function buildScreenshotMessages(
  base64Image: string,
  transcriptionText: string | null
): Promise<{
  messages: ModelMessage[]
  extractedText?: string
}> {
  if (settings.useSeparateVisionModel) {
    const extractedText = await extractTextFromImage(base64Image)
    const textContent = transcriptionText
      ? `这是语音转录内容：\n${transcriptionText}\n\n这是图片中提取的题目内容：\n${extractedText}`
      : `这是图片中提取的题目内容：\n${extractedText}`
    return {
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: textContent }]
      }],
      extractedText
    }
  }

  // Single-model mode: send image directly
  const textContent = transcriptionText
    ? `这是语音转录内容：\n${transcriptionText}\n\n同时附上屏幕截图：`
    : '这是屏幕截图'
  return {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: textContent },
        { type: 'image', image: base64Image }
      ]
    }]
  }
}

// ─── Mode-specific prompts ──────────────────────────────────────────

const MODE_PROMPTS: Record<string, string> = {
  'core-code':
    '你是一个编程面试辅助工具。只输出题目的核心解题代码，遵循以下规则：\n' +
    '- 不要输出任何思考过程、推理步骤、分析说明。直接输出最终代码\n' +
    '- 代码使用 Markdown 代码块包裹，在开头三反引号后必须标注语言（如 ```python、```java、```cpp）\n' +
    '- 代码格式整洁，正确缩进，每行只写一条语句，不要多条语句挤在一行\n' +
    '- 使用题目对应的函数签名，不要额外添加 main 函数或测试用例\n' +
    '- 使用有意义的变量名；输出格式保持干净：不保留多余空行，所有代码行末尾不要有空格或 Tab',
  'acm':
    '你是一个编程竞赛辅助工具。以 ACM 模式输出完整代码，遵循以下规则：\n' +
    '- 不要输出任何思考过程、推理步骤、分析说明。直接输出最终代码\n' +
    '- 代码使用 Markdown 代码块包裹，在开头三反引号后必须标注语言（如 ```python、```java、```cpp）\n' +
    '- 包含所有必要的 import/头文件\n' +
    '- 包含完整的输入读取和输出打印逻辑\n' +
    '- 代码可以直接复制到在线评测系统运行\n' +
    '- 目标是“一页内清晰可读”，不是压成一行：保留必要换行、正确缩进、结构一眼能看清\n' +
    '- 每行只写一个关键语句或一个清晰的变量声明，不要为了变短把多个赋值、循环、条件判断挤在同一行\n' +
    '- if/for/while、函数、类、输入处理、核心逻辑、输出逻辑都要有清晰层次；复杂语句必须拆行\n' +
    '- 可以省略注释和测试用例，可以合并连续 import 或简单同类变量声明，但不要牺牲可读性\n' +
    '- 输出格式保持干净：不要保留多余空行，所有代码行末尾不要有空格或 Tab，代码块末尾不要有多余换行\n' +
    '- 上一条是对输出格式的要求，不要在业务代码里额外编写清理空格/删除换行的逻辑'
}

function buildResumeContextSection(): string {
  if (!resumeData.enabled || !resumeData.structured) return ''

  const p = resumeData.priority
  const s = resumeData.structured

  let section = '\n\n## 候选人背景信息\n\n'
  section += '以下为候选人的背景资料，请根据题目实际需要选择性引用。\n'
  section += '优先级排序：题目本身 > 候选人自身情况 >= 岗位JD > 公司业务。\n\n'

  if (p.selfInfo > 0 && (s.techStack.length > 0 || s.workExperience || s.internshipExperience || s.projectExperience || s.education)) {
    section += `### 候选人简历（重要程度：${p.selfInfo}/100）\n\n`
    if (s.techStack.length > 0) {
      section += `**技术栈**：${s.techStack.join('、')}\n\n`
    }
    if (s.workExperience) {
      section += `**工作经历**：\n${s.workExperience}\n\n`
    }
    if (s.internshipExperience) {
      section += `**实习经历**：\n${s.internshipExperience}\n\n`
    }
    if (s.projectExperience) {
      section += `**项目经验**：\n${s.projectExperience}\n\n`
    }
    if (s.education) {
      section += `**教育背景**：\n${s.education}\n\n`
    }
  }

  if (p.jd > 0 && resumeData.jd) {
    section += `### 目标岗位 JD（重要程度：${p.jd}/100）\n\n${resumeData.jd}\n\n`
  }

  if (p.companyBusiness > 0 && resumeData.companyInfo) {
    section += `### 目标公司调研（重要程度：${p.companyBusiness}/100）\n\n${resumeData.companyInfo}\n\n`
  }

  return section
}

function getSystemPrompt(): string {
  const customPrompt = settings.customPrompt?.trim()

  if (settings.responseMode === 'custom') {
    return customPrompt || PROMPT_SYSTEM + `\n使用编程语言：${settings.codeLanguage} 解答。`
  }

  // Mode-specific prompt replaces the default PROMPT_SYSTEM for code modes
  if (settings.responseMode === 'core-code' || settings.responseMode === 'acm') {
    return (
      MODE_PROMPTS[settings.responseMode] +
      `\n使用编程语言：${settings.codeLanguage} 解答。`
    )
  }
  return PROMPT_SYSTEM + `\n使用编程语言：${settings.codeLanguage} 解答。`
}

// ─── Streaming functions ───────────────────────────────────────────

export function getSolutionStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const { baseURL, apiKey, model } = getSolvingProvider()
  const openai = createOpenAI({ baseURL, apiKey })

  const { textStream } = streamText({
    model: openai.chat(model),
    system: getSystemPrompt(),
    messages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

export function getFollowUpStream(
  messages: ModelMessage[],
  userQuestion: string,
  abortSignal?: AbortSignal
) {
  const { baseURL, apiKey, model } = getSolvingProvider()
  const openai = createOpenAI({ baseURL, apiKey })

  const updatedMessages: ModelMessage[] = [
    ...messages,
    {
      role: 'user',
      content: [{ type: 'text', text: userQuestion }]
    }
  ]

  const { textStream } = streamText({
    model: openai.chat(model),
    system: getSystemPrompt(),
    messages: updatedMessages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

/**
 * Get system prompt for alternative solution requests.
 * Appends a strong nudge to provide a different approach.
 */
function getAlternativeSystemPrompt(): string {
  const base = getSystemPrompt()
  return (
    base +
    '\n\n⚠️ 重要：用户对之前的解法不满意。请给出一种与之前完全不同的解法（不同的算法、数据结构或思路），不要重复之前的方案。' +
    '\n输出代码时保持格式干净：删除多余空行和行尾空格/Tab，但不要把这个要求写成业务代码逻辑。'
  )
}

export function getAlternativeSolutionStream(
  messages: ModelMessage[],
  abortSignal?: AbortSignal
) {
  const { baseURL, apiKey, model } = getSolvingProvider()
  const openai = createOpenAI({ baseURL, apiKey })

  const updatedMessages: ModelMessage[] = [
    ...messages,
    {
      role: 'user',
      content: [{ type: 'text', text: '请给出另一种不同的解法。' }]
    }
  ]

  const { textStream } = streamText({
    model: openai.chat(model),
    system: getAlternativeSystemPrompt(),
    messages: updatedMessages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

const DEFAULT_CODE_IDEA_PROMPT = `你是一个编程面试辅助工具。你的任务是基于已有题目上下文，输出候选人可以直接讲给面试官听的“解题思路”，不是完整代码。

## 输出要求

- 使用中文，表达清楚自然，不要堆关键词，也不要写成长篇文章；
- 总长度控制在 5～7 行、400 字以内，尽量一屏读完；
- 不要输出完整代码、代码块、内部推理链、隐藏思考过程；
- 必须讲清楚三件事：为什么用这个方法、代码按什么步骤实现、有哪些边界和复杂度；
- 推荐输出顺序：
  1. 先用 1 句话概括核心方法，并说明为什么这样能解决问题；
  2. 再用 2～4 句话按代码执行顺序描述实现步骤，说明关键变量/数据结构的作用；
  3. 最后补充容易漏的边界情况和时间/空间复杂度；
- 如果之前已经给过代码，请基于已有代码提炼可复述的思路，不要重新生成代码。`

function getCodeIdeaSystemPrompt(): string {
  const prompt = settings.codeIdeaPrompt?.trim() || DEFAULT_CODE_IDEA_PROMPT
  return prompt + `\n使用编程语言：${settings.codeLanguage} 说明。`
}

export function getCodeIdeaStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const { baseURL, apiKey, model } = getSolvingProvider()
  const openai = createOpenAI({ baseURL, apiKey })

  const updatedMessages: ModelMessage[] = [
    ...messages,
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text:
            '请输出这道题的面试讲述版解题思路：讲清楚为什么用这个方法、代码实现步骤、关键变量、边界情况和复杂度。不要输出完整代码。'
        }
      ]
    }
  ]

  const { textStream } = streamText({
    model: openai.chat(model),
    system: getCodeIdeaSystemPrompt(),
    messages: updatedMessages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

const VOICE_SYSTEM_PROMPT = `你是一个专业的面试助手，正在帮助候选人进行面试。你的任务是根据候选人的背景信息，辅助回答面试官的问题。

## 回答要求

- 使用中文，口语化表达，便于语音朗读；
- 根据问题复杂度动态调整回答长度：简单问题简明扼要，复杂问题详细展开；
- 根据候选人的简历背景，给出针对性的回答建议；
- 如果问题涉及候选人经历，优先引用其简历中的真实经历；
- 如果问题涉及技术，结合候选人的技术栈给出回答思路；
- 如果候选人的背景不足以回答某个问题，诚实指出并给出通用的回答框架；
- 不要输出代码块，不要长篇大论；
- 像真正的面试伙伴一样，给出可以直接说出口的回答。`

export function getVoiceStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  const resumeContext = buildResumeContextSection()
  const wordLimit = settings.voiceWordLimit || 500
  const systemPrompt =
    settings.customPrompt ||
    VOICE_SYSTEM_PROMPT +
      `\n- 回答不超过 ${wordLimit} 字；` +
      resumeContext

  const { textStream } = streamText({
    model: openai.chat(getModel(settings)),
    system: systemPrompt,
    messages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

export function getGeneralStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const { baseURL, apiKey, model } = getSolvingProvider()
  const openai = createOpenAI({ baseURL, apiKey })

  const { textStream } = streamText({
    model: openai.chat(model),
    system: getSystemPrompt(),
    messages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

// ─── API Test (IPC) ─────────────────────────────────────────────────

async function testConnection(
  baseURL: string,
  apiKey: string,
  model: string
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  if (!baseURL || !apiKey) {
    return { success: false, latencyMs: 0, error: 'API Base URL 或 API Key 未配置' }
  }
  const start = Date.now()
  try {
    const openai = createOpenAI({ baseURL, apiKey })
    const result = streamText({
      model: openai.chat(model),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]
    })
    let text = ''
    for await (const chunk of result.textStream) {
      text += chunk
      if (text.trim()) break
    }
    const latencyMs = Date.now() - start
    if (!text.trim()) {
      return { success: false, latencyMs, error: 'API 返回空内容，请检查 API Base URL 是否包含 /v1，以及模型是否可用' }
    }
    return { success: true, latencyMs }
  } catch (err) {
    const latencyMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, latencyMs, error: msg }
  }
}

// Expected problem text for the test image (add-two-numbers.png)
const EXPECTED_TEST_TEXT =
  '给你两个 非空 的链表，表示两个非负的整数。它们每位数字都是按照 逆序 的方式存储的，并且每个节点只能存储 一位 数字。请你将两个数相加，并以相同形式返回一个表示和的链表。你可以假设除了数字 0 之外，这两个数都不会以 0 开头。'

/** Calculate character-level bigram similarity (0–100), works well for Chinese. */
function calcSimilarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const g: string[] = []
    for (let i = 0; i < s.length - 1; i++) g.push(s[i] + s[i + 1])
    return new Set(g)
  }
  const sa = bigrams(a)
  const sb = bigrams(b)
  if (sa.size === 0 && sb.size === 0) return 100
  let intersect = 0
  for (const g of sa) { if (sb.has(g)) intersect++ }
  return Math.round((2 * intersect / (sa.size + sb.size)) * 100)
}

async function testVisionCapability(
  baseURL: string,
  apiKey: string,
  model: string,
  opts?: { imagePath?: string; expectedText?: string }
): Promise<{
  success: boolean
  latencyMs: number
  similarity?: number
  extractedText?: string
  error?: string
}> {
  if (!baseURL || !apiKey) {
    return { success: false, latencyMs: 0, error: '视觉模型 API Base URL 或 API Key 未配置' }
  }
  const start = Date.now()
  try {
    // Use custom image or fall back to default test image
    const imagePath = opts?.imagePath || join(import.meta.dirname, '..', '..', 'assets', 'add-two-numbers.png')
    const testImage = readFileSync(imagePath, 'base64')
    const mime = imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg') ? 'jpeg' : 'png'
    const dataUrl = `data:image/${mime};base64,${testImage}`

    const openai = createOpenAI({ baseURL, apiKey })
    const result = streamText({
      model: openai.chat(model),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '请只提取图片中的题目内容，不要解答。直接返回题目文字即可。' },
            { type: 'image', image: dataUrl }
          ]
        }
      ]
    })

    let text = ''
    for await (const chunk of result.textStream) {
      text += chunk
    }
    const latencyMs = Date.now() - start
    const trimmed = text.trim()
    const expected = opts?.expectedText?.trim() || EXPECTED_TEST_TEXT
    const similarity = expected ? calcSimilarity(trimmed, expected) : undefined
    if (!trimmed) {
      return { success: false, latencyMs, similarity, extractedText: trimmed, error: '图片解析返回空内容，请检查 API Base URL 是否包含 /v1，并确认模型支持图片输入' }
    }
    return { success: true, latencyMs, similarity, extractedText: trimmed }
  } catch (err) {
    const latencyMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, latencyMs, error: msg }
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────

function registerIpcHandler(channel: string, handler: Parameters<typeof ipcMain.handle>[1]) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

registerIpcHandler('test-api-connection', async () => {
  const model = getModel(settings)
  return testConnection(settings.apiBaseURL, settings.apiKey, model)
})

registerIpcHandler(
  'test-vision-capability',
  async (_event, opts?: { imagePath?: string; expectedText?: string }) => {
    // If the main API doesn't support vision and no separate vision model is configured,
    // return a clear message instead of throwing
    if (!settings.useSeparateVisionModel) {
      const apiUrl = settings.apiBaseURL || ''
      if (TEXT_ONLY_PROVIDERS.some((p) => apiUrl.includes(p))) {
        return {
          success: false,
          latencyMs: 0,
          error:
            '当前主 API 服务商不支持图片解析。请开启上方"使用独立视觉模型"开关，并配置支持视觉的 API（如硅基流动），然后重新检测。'
        }
      }
    }
    try {
      const { baseURL, apiKey, model } = getVisionProvider()
      return await testVisionCapability(baseURL, apiKey, model, opts)
    } catch (err) {
      return {
        success: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }
)

// Image file picker for custom vision test
registerIpcHandler('select-image-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: '选择测试图片',
    filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})
