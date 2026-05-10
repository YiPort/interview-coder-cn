import { readFileSync } from 'node:fs'
import { ipcMain, dialog } from 'electron'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import mammoth from 'mammoth'
import { getDocument } from 'pdfjs-dist'
import { settings } from './settings'
import { getVisionProvider } from './ai'

// ─── Types ────────────────────────────────────────────────────────────

export interface ResumeStructured {
  techStack: string[]
  projectExperience: string
  internshipExperience: string
  workExperience: string
  education: string
}

export interface ResumePriority {
  selfInfo: number
  jd: number
  companyBusiness: number
}

export interface ResumeData {
  rawText: string
  structured: ResumeStructured | null
  jd: string
  companyName: string
  companyInfo: string
  priority: ResumePriority
  enabled: boolean
}

const DEFAULT_PRIORITY: ResumePriority = {
  selfInfo: 80,
  jd: 70,
  companyBusiness: 50
}

export const resumeData: ResumeData = {
  rawText: '',
  structured: null,
  jd: '',
  companyName: '',
  companyInfo: '',
  priority: { ...DEFAULT_PRIORITY },
  enabled: false
}

// ─── File Parsing ─────────────────────────────────────────────────────

function getExtension(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (ext === 'pdf' || ext === 'docx' || ext === 'md' || ext === 'txt') return ext
  return null
}

async function parsePDF(filePath: string): Promise<string> {
  const data = new Uint8Array(readFileSync(filePath))
  const doc = await getDocument({ data }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .filter((item) => 'str' in item)
      .map((item) => (item as { str: string }).str)
      .join(' ')
    pages.push(pageText)
  }
  return pages.join('\n').trim()
}

async function parseDOCX(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath)
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim()
}

function parseMarkdown(filePath: string): string {
  return readFileSync(filePath, 'utf-8').trim()
}

async function parseFile(filePath: string): Promise<string> {
  const ext = getExtension(filePath)
  switch (ext) {
    case 'pdf':
      return parsePDF(filePath)
    case 'docx':
      return parseDOCX(filePath)
    case 'md':
    case 'txt':
      return parseMarkdown(filePath)
    default:
      throw new Error(`不支持的文件类型: ${ext || '未知'}`)
  }
}

// ─── AI Extraction ────────────────────────────────────────────────────

async function extractResumeWithAI(rawText: string): Promise<ResumeStructured> {
  if (!settings.apiKey) throw new Error('请先在 AI 设置中配置 API Key')

  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  const prompt = `请从以下简历文本中提取结构化信息。返回一个严格的JSON对象（不要包含其他内容），格式如下：
{
  "techStack": ["技术1", "技术2", ...],
  "projectExperience": "项目经历的Markdown总结（包含项目名称、技术栈、职责和成果）",
  "internshipExperience": "实习经历的Markdown总结（如无则填'无'）",
  "workExperience": "工作经历的Markdown总结（包含公司、职位、时间和职责, 如无则填'无'）",
  "education": "教育背景的Markdown总结（学校、专业、学位、时间）"
}

简历文本：
${rawText}`

  const result = streamText({
    model: openai.chat(settings.model || 'gpt-5-mini'),
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
  })

  let text = ''
  for await (const chunk of result.textStream) {
    text += chunk
  }

  // Strip thinking tags, then extract JSON
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const jsonMatch =
    clean.match(/```(?:json)?\s*([\s\S]*?)```/) || clean.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : clean
  const parsed = JSON.parse(jsonStr.trim())

  return {
    techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
    projectExperience: parsed.projectExperience || '',
    internshipExperience: parsed.internshipExperience || '',
    workExperience: parsed.workExperience || '',
    education: parsed.education || ''
  }
}

// ─── Company Search ───────────────────────────────────────────────────

async function searchCompany(companyName: string): Promise<string> {
  if (!settings.apiKey) throw new Error('请先在 AI 设置中配置 API Key')

  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  const prompt = `请对"${companyName}"公司进行调研，用中文回答，包含以下方面：

## 公司文化与价值观
公司使命、愿景、核心价值观、工作文化特点

## 主营业务与产品
主要产品线、业务方向、行业地位

## 技术栈（如为互联网/科技公司）
核心技术栈、技术架构特点

## 面试风格与流程
技术面试常见流程、考察重点、面试风格（如已知）

## 面试准备建议
针对该公司面试的具体准备建议

请确保信息准确，如不确定请注明。`

  const result = streamText({
    model: openai.chat(settings.model || 'gpt-5-mini'),
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
  })

  let text = ''
  for await (const chunk of result.textStream) {
    text += chunk
  }
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

// ─── IPC Handlers ─────────────────────────────────────────────────────

ipcMain.handle('select-resume-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: '选择简历文件',
    filters: [{ name: '简历文件', extensions: ['pdf', 'docx', 'md', 'txt'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('select-resume-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: '选择简历截图',
    filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('parse-resume-file', async (_event, filePath: string) => {
  const sizeLimit = 10 * 1024 * 1024 // 10MB
  const { size } = await import('node:fs/promises').then((fs) => fs.stat(filePath))
  if (size > sizeLimit) throw new Error('文件超过 10MB 限制，请压缩后重试')

  const text = await parseFile(filePath)
  if (!text.trim()) throw new Error('未能从文件中提取到文字内容。如果是扫描版/图片版 PDF，请使用"截图"方式上传')

  resumeData.rawText = text
  return text
})

ipcMain.handle('parse-resume-image', async (_event, imagePath: string) => {
  if (!settings.apiKey) throw new Error('请先在 AI 设置中配置 API Key')

  const base64 = readFileSync(imagePath, 'base64')
  const ext = imagePath.split('.').pop()?.toLowerCase()
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : 'png'
  const dataUrl = `data:image/${mimeType};base64,${base64}`

  let baseURL: string, apiKey: string, model: string
  try {
    const provider = getVisionProvider()
    baseURL = provider.baseURL
    apiKey = provider.apiKey
    model = provider.model
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('不支持视觉模型') || msg.includes('不支持图片')) {
      throw new Error(
        '当前主 API 不支持图片解析。请在 AI 设置中开启"使用独立视觉模型"开关，配置支持视觉的 API（如硅基流动 https://api.siliconflow.cn/v1，模型选 Qwen/Qwen3-VL-32B-Instruct），或使用文件版简历（PDF/Word/Markdown）。'
      )
    }
    throw err
  }

  const openai = createOpenAI({ baseURL, apiKey })

  const result = streamText({
    model: openai.chat(model),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请从这张简历图片中提取所有文本内容，包括个人信息、技能、工作经历、教育背景等。直接返回提取的文字内容。'
          },
          { type: 'image', image: dataUrl }
        ]
      }
    ]
  })

  let text = ''
  for await (const chunk of result.textStream) {
    text += chunk
  }
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  resumeData.rawText = clean
  return clean
})

ipcMain.handle('extract-resume-structured', async () => {
  if (!resumeData.rawText.trim()) throw new Error('请先上传并解析简历文件')
  const structured = await extractResumeWithAI(resumeData.rawText)
  resumeData.structured = structured
  return structured
})

ipcMain.handle('search-company-info', async (_event, companyName: string) => {
  if (!companyName.trim()) throw new Error('请输入公司名称')
  const info = await searchCompany(companyName.trim())
  resumeData.companyName = companyName.trim()
  resumeData.companyInfo = info
  return info
})

ipcMain.handle('get-resume-data', () => {
  return resumeData
})

ipcMain.handle('update-resume-data', (_event, data: Partial<ResumeData>) => {
  Object.assign(resumeData, data)
})
