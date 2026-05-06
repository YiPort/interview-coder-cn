import { ipcMain } from 'electron'
import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'

const WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/'

let ws: WebSocket | null = null
let taskId: string | null = null
let isSynthesizing = false
let taskStarted = false

function sendToRenderer(channel: string, ...args: unknown[]) {
  const mainWindow = global.mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

function cleanup() {
  if (ws) {
    ws.removeAllListeners()
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
    ws = null
  }
  taskId = null
  isSynthesizing = false
  taskStarted = false
}

function startTTS(apiKey: string) {
  if (isSynthesizing) return

  cleanup()
  isSynthesizing = true
  taskId = randomUUID()

  ws = new WebSocket(WS_URL, {
    headers: { Authorization: `bearer ${apiKey}` }
  })

  ws.on('open', () => {
    const runTask = {
      header: {
        action: 'run-task',
        task_id: taskId,
        streaming: 'duplex'
      },
      payload: {
        task_group: 'audio',
        task: 'tts',
        function: 'speech-synthesis',
        model: 'cosyvoice-v1',
        parameters: {
          format: 'pcm',
          sample_rate: 24000
        },
        input: {}
      }
    }
    ws!.send(JSON.stringify(runTask))
  })

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString())
      const event = msg.header?.event

      if (event === 'task-started') {
        taskStarted = true
        sendToRenderer('tts-started')
        return
      }

      if (event === 'result-generated') {
        const audio = msg.payload?.output?.audio
        if (audio) {
          sendToRenderer('tts-audio-chunk', Buffer.from(audio, 'base64').buffer)
        }
        return
      }

      if (event === 'task-failed') {
        const errorMsg = msg.header?.error_message || '语音合成失败'
        console.error('TTS task failed:', errorMsg)
        sendToRenderer('tts-error', errorMsg)
        cleanup()
        return
      }

      if (event === 'task-finished') {
        sendToRenderer('tts-complete')
        cleanup()
      }
    } catch (e) {
      console.error('Failed to parse TTS message:', e)
    }
  })

  ws.on('error', (err) => {
    console.error('TTS WebSocket error:', err)
    sendToRenderer('tts-error', err.message || 'WebSocket 连接失败')
    cleanup()
  })

  ws.on('close', () => {
    isSynthesizing = false
    taskStarted = false
    ws = null
  })
}

function speakText(text: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !taskStarted) return

  const continueTask = {
    header: {
      action: 'continue-task',
      task_id: taskId,
      streaming: 'duplex'
    },
    payload: {
      input: {
        text
      }
    }
  }
  ws.send(JSON.stringify(continueTask))
}

function stopTTS() {
  if (!isSynthesizing) return

  if (ws && ws.readyState === WebSocket.OPEN && taskId && taskStarted) {
    const finishTask = {
      header: {
        action: 'finish-task',
        task_id: taskId,
        streaming: 'duplex'
      },
      payload: {
        input: {}
      }
    }
    ws.send(JSON.stringify(finishTask))
  }

  cleanup()
}

ipcMain.handle('start-tts', (_event, apiKey: string) => {
  startTTS(apiKey)
})

ipcMain.handle('stop-tts', () => {
  stopTTS()
})

ipcMain.handle('tts-speak', (_event, text: string) => {
  speakText(text)
})
