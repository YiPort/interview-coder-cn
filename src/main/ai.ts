import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ipcMain, dialog } from 'electron'
import { streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { settings, AppSettings } from './settings'

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

function getVisionProvider() {
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

// ─── Streaming functions ───────────────────────────────────────────

export function getSolutionStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const { baseURL, apiKey, model } = getSolvingProvider()
  const openai = createOpenAI({ baseURL, apiKey })

  const { textStream } = streamText({
    model: openai.chat(model),
    system:
      settings.customPrompt || PROMPT_SYSTEM + `\n使用编程语言：${settings.codeLanguage} 解答。`,
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
    system:
      settings.customPrompt || PROMPT_SYSTEM + `\n使用编程语言：${settings.codeLanguage} 解答。`,
    messages: updatedMessages,
    abortSignal,
    onError: (err) => {
      throw err.error ?? err
    }
  })
  return textStream
}

export function getVoiceStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  const { textStream } = streamText({
    model: openai.chat(getModel(settings)),
    system:
      settings.customPrompt ||
      PROMPT_SYSTEM +
        `\n使用编程语言：${settings.codeLanguage} 解答。\n\n你是一个语音面试助手。请用口语化、简洁的方式回答问题，便于语音朗读。`,
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
    system:
      settings.customPrompt ||
      PROMPT_SYSTEM +
        `\n使用编程语言：${settings.codeLanguage} 解答。\n\n注意：如果有多张截图，请结合所有截图内容进行完整分析，不要遗漏任何部分。`,
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
    // Consume the stream to ensure connection succeeded
    for await (const _ of result.textStream) {
      break
    }
    const latencyMs = Date.now() - start
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
    return { success: true, latencyMs, similarity, extractedText: trimmed }
  } catch (err) {
    const latencyMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, latencyMs, error: msg }
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────

ipcMain.handle('test-api-connection', async () => {
  const model = getModel(settings)
  return testConnection(settings.apiBaseURL, settings.apiKey, model)
})

ipcMain.handle(
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
ipcMain.handle('select-image-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: '选择测试图片',
    filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})
