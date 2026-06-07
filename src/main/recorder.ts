import { ipcMain, app } from 'electron'
import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'
import { writeFile, appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { settings, getTranscriptionModel } from './settings'

const WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/'

interface ChannelSession {
  ws: WebSocket | null
  taskId: string | null
  taskStarted: boolean
  isActive: boolean
}

let systemSession: ChannelSession = {
  ws: null,
  taskId: null,
  taskStarted: false,
  isActive: false
}
let micSession: ChannelSession = {
  ws: null,
  taskId: null,
  taskStarted: false,
  isActive: false
}
let isRecording = false
let recordFilePath: string | null = null
let imagesDir: string | null = null
let sessionStartTime = 0

function getRecordDir(): string {
  return settings.recordDir || join(app.getPath('documents'), 'InterviewCoder', 'Records')
}

function formatTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}`
}

function sendToRenderer(channel: string, ...args: unknown[]) {
  const mainWindow = global.mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

function createRecordingWebSocket(apiKey: string, channel: 'system' | 'mic'): WebSocket {
  const session = channel === 'system' ? systemSession : micSession
  const speaker = channel === 'system' ? '面试官' : '我'

  session.taskId = randomUUID()

  const ws = new WebSocket(WS_URL, {
    headers: { Authorization: `bearer ${apiKey}` }
  })

  ws.on('open', () => {
    const runTask = {
      header: {
        action: 'run-task',
        task_id: session.taskId,
        streaming: 'duplex'
      },
      payload: {
        task_group: 'audio',
        task: 'asr',
        function: 'recognition',
        model: getTranscriptionModel(),
        parameters: {
          format: 'pcm',
          sample_rate: 16000
        },
        input: {}
      }
    }
    ws.send(JSON.stringify(runTask))
  })

  ws.on('message', async (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString())
      const event = msg.header?.event

      if (event === 'task-started') {
        session.taskStarted = true
        return
      }

      if (event === 'result-generated') {
        const sentence = msg.payload?.output?.sentence
        if (!sentence || !sentence.sentence_end || !sentence.text) return

        const text: string = sentence.text.trim()
        if (!text) return

        const beginTimeMs: number = sentence.begin_time || 0
        const absoluteTime = new Date(sessionStartTime + beginTimeMs)
        const timeStr = formatTime(absoluteTime)

        const line = `[${timeStr}] **${speaker}**：${text}\n\n`

        if (recordFilePath) {
          await appendFile(recordFilePath, line, 'utf-8')
        }

        sendToRenderer('recording-sentence', channel)
        return
      }

      if (event === 'task-failed') {
        const errorMsg = msg.header?.error_message || '语音识别失败'
        console.error(`Recorder ${channel} task failed:`, errorMsg)
        sendToRenderer('recording-error', `${speaker}通道识别失败: ${errorMsg}`)
      }
    } catch (e) {
      console.error(`Failed to parse recorder ${channel} message:`, e)
    }
  })

  ws.on('error', (err) => {
    console.error(`Recorder ${channel} WebSocket error:`, err)
    sendToRenderer('recording-error', `${speaker}通道连接失败: ${err.message}`)
  })

  ws.on('close', () => {
    session.taskStarted = false
    session.ws = null
  })

  return ws
}

async function startRecording(
  apiKey: string,
  systemDeviceId: string,
  micDeviceId: string
): Promise<void> {
  if (isRecording) return

  const dir = getRecordDir()
  await mkdir(dir, { recursive: true })

  sessionStartTime = Date.now()
  const now = new Date()
  const ts = formatTimestamp(now)
  const shortId = randomUUID().slice(0, 6)

  recordFilePath = join(dir, `interview-${ts}-${shortId}.md`)
  imagesDir = join(dir, `interview-${ts}-${shortId}_images`)
  await mkdir(imagesDir, { recursive: true })

  const header = [
    '# 面试录音记录\n',
    `**开始时间**：${now.toLocaleString('zh-CN')}\n`,
    `**音频来源**：系统音频（面试官）+ 麦克风（我）\n`,
    '\n---\n\n'
  ].join('\n')
  await writeFile(recordFilePath, header, 'utf-8')

  isRecording = true

  if (systemDeviceId) {
    systemSession.isActive = true
    systemSession.ws = createRecordingWebSocket(apiKey, 'system')
  }
  if (micDeviceId) {
    micSession.isActive = true
    micSession.ws = createRecordingWebSocket(apiKey, 'mic')
  }

  sendToRenderer('recording-started')
}

function stopRecording(): void {
  if (!isRecording) return

  ;[systemSession, micSession].forEach((session) => {
    if (
      session.ws &&
      session.ws.readyState === WebSocket.OPEN &&
      session.taskId &&
      session.taskStarted
    ) {
      const finishTask = {
        header: {
          action: 'finish-task',
          task_id: session.taskId,
          streaming: 'duplex'
        },
        payload: { input: {} }
      }
      session.ws.send(JSON.stringify(finishTask))
    }
    if (session.ws) {
      session.ws.removeAllListeners()
      if (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING) {
        try {
          session.ws.close()
        } catch {
          // WebSocket may throw if closed before handshake completes (e.g. React strict mode remount)
        }
      }
      session.ws = null
    }
    session.taskId = null
    session.taskStarted = false
    session.isActive = false
  })

  isRecording = false
  recordFilePath = null
  imagesDir = null

  sendToRenderer('recording-stopped')
}

function handleAudioChunk(chunk: ArrayBuffer, channel: 'system' | 'mic'): void {
  const session = channel === 'system' ? systemSession : micSession
  if (!session.ws || session.ws.readyState !== WebSocket.OPEN || !session.taskStarted) return
  session.ws.send(Buffer.from(chunk))
}

export async function addRecordingScreenshot(base64Data: string): Promise<void> {
  if (!isRecording || !recordFilePath || !imagesDir || !settings.recordSaveScreenshots) return

  const now = new Date()
  const ts = formatTimestamp(now)
  const imageFilename = `${ts}.png`
  const imagePath = join(imagesDir, imageFilename)
  const buffer = Buffer.from(base64Data, 'base64')
  await writeFile(imagePath, buffer)

  const dirName = imagesDir.split(/[\\/]/).pop() || 'images'
  const line = `\n![截图 - ${formatTime(now)}](${dirName}/${imageFilename})\n\n`
  await appendFile(recordFilePath, line, 'utf-8')
}

export function isRecorderActive(): boolean {
  return isRecording
}

// IPC handlers
ipcMain.handle(
  'start-recording',
  async (_event, apiKey: string, systemDeviceId: string, micDeviceId: string) => {
    await startRecording(apiKey, systemDeviceId, micDeviceId)
  }
)

ipcMain.handle('stop-recording', () => {
  stopRecording()
})

ipcMain.on('recorder-system-audio-chunk', (_event, chunk: ArrayBuffer) => {
  handleAudioChunk(chunk, 'system')
})

ipcMain.on('recorder-mic-audio-chunk', (_event, chunk: ArrayBuffer) => {
  handleAudioChunk(chunk, 'mic')
})
