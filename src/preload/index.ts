import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppSettings } from '../main/settings'
import type { AppState } from '../main/state'

// Custom APIs for renderer
const api = {
  // Get app settings
  getAppSettings: () => ipcRenderer.invoke('getAppSettings'),
  // Update app settings
  updateAppSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke('updateAppSettings', settings),

  // Update app state
  updateAppState: (state: Partial<AppState>) => ipcRenderer.invoke('updateAppState', state),
  // Listen for app state
  onSyncAppState: (callback: (state: AppState) => void) => {
    ipcRenderer.on('sync-app-state', (_event, state) => {
      callback(state)
    })
  },
  // Remove app state listener
  removeSyncAppStateListener: () => {
    ipcRenderer.removeAllListeners('sync-app-state')
  },

  // Init shortcuts
  initShortcuts: (shortcuts: Record<string, { action: string; key: string }>) =>
    ipcRenderer.invoke('initShortcuts', shortcuts),
  // Get shortcuts
  getShortcuts: () => ipcRenderer.invoke('getShortcuts'),
  // Update shortcuts
  updateShortcuts: (shortcuts: { action: string; key: string }[]) =>
    ipcRenderer.invoke('updateShortcuts', shortcuts),

  // Listen for screenshot events
  onScreenshotTaken: (callback: (screenshotData: string) => void) => {
    ipcRenderer.on('screenshot-taken', (_event, screenshotData) => {
      callback(screenshotData)
    })
  },
  // Remove screenshot listener
  removeScreenshotListener: () => {
    ipcRenderer.removeAllListeners('screenshot-taken')
  },

  // Listen for solution chunks
  onSolutionChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('solution-chunk', (_event, chunk) => {
      callback(chunk)
    })
  },
  // Remove solution chunk listener
  removeSolutionChunkListener: () => {
    ipcRenderer.removeAllListeners('solution-chunk')
  },

  // Stop solution stream
  stopSolutionStream: () => ipcRenderer.invoke('stopSolutionStream'),

  // Send follow-up question
  sendFollowUpQuestion: (question: string) => ipcRenderer.invoke('sendFollowUpQuestion', question),

  // Listen for solution completion
  onSolutionComplete: (callback: () => void) => {
    ipcRenderer.on('solution-complete', callback)
  },
  removeSolutionCompleteListener: () => {
    ipcRenderer.removeAllListeners('solution-complete')
  },

  onSolutionStopped: (callback: () => void) => {
    ipcRenderer.on('solution-stopped', callback)
  },
  removeSolutionStoppedListener: () => {
    ipcRenderer.removeAllListeners('solution-stopped')
  },

  onSolutionError: (callback: (message: string) => void) => {
    ipcRenderer.on('solution-error', (_event, message) => {
      callback(message)
    })
  },
  removeSolutionErrorListener: () => {
    ipcRenderer.removeAllListeners('solution-error')
  },

  // Listen for scroll page up
  onScrollPageUp: (callback: () => void) => {
    ipcRenderer.on('scroll-page-up', callback)
  },
  // Remove scroll page up listener
  removeScrollPageUpListener: () => {
    ipcRenderer.removeAllListeners('scroll-page-up')
  },

  // Listen for screenshots-updated (gallery)
  onScreenshotsUpdated: (callback: (screenshots: string[]) => void) => {
    ipcRenderer.on('screenshots-updated', (_event, screenshots) => {
      callback(screenshots)
    })
  },
  removeScreenshotsUpdatedListener: () => {
    ipcRenderer.removeAllListeners('screenshots-updated')
  },

  // Listen for scroll page down
  onScrollPageDown: (callback: () => void) => {
    ipcRenderer.on('scroll-page-down', callback)
  },
  // Remove scroll page down listener
  removeScrollPageDownListener: () => {
    ipcRenderer.removeAllListeners('scroll-page-down')
  },

  // AI loading events
  onAiLoadingStart: (callback: () => void) => {
    ipcRenderer.on('ai-loading-start', callback)
  },
  onAiLoadingEnd: (callback: () => void) => {
    ipcRenderer.on('ai-loading-end', callback)
  },
  removeAiLoadingStartListener: () => {
    ipcRenderer.removeAllListeners('ai-loading-start')
  },
  removeAiLoadingEndListener: () => {
    ipcRenderer.removeAllListeners('ai-loading-end')
  },

  // Solution clear event (new session)
  onSolutionClear: (callback: () => void) => {
    ipcRenderer.on('solution-clear', callback)
  },
  removeSolutionClearListener: () => {
    ipcRenderer.removeAllListeners('solution-clear')
  },

  // Select screenshot save directory
  selectScreenshotDir: () => ipcRenderer.invoke('selectScreenshotDir') as Promise<string | null>,

  // Transcription
  startTranscription: (apiKey: string) => ipcRenderer.invoke('start-transcription', apiKey),
  stopTranscription: () => ipcRenderer.invoke('stop-transcription'),
  sendTranscriptionAudioChunk: (chunk: ArrayBuffer) =>
    ipcRenderer.send('transcription-audio-chunk', chunk),
  getTranscriptionText: () => ipcRenderer.invoke('get-transcription-text') as Promise<string>,

  onToggleTranscription: (callback: () => void) => {
    ipcRenderer.on('toggle-transcription', callback)
  },
  removeToggleTranscriptionListener: () => {
    ipcRenderer.removeAllListeners('toggle-transcription')
  },
  onTranscriptionText: (callback: (data: { text: string; isPartial: boolean }) => void) => {
    ipcRenderer.on('transcription-text', (_event, data) => callback(data))
  },
  removeTranscriptionTextListener: () => {
    ipcRenderer.removeAllListeners('transcription-text')
  },
  onTranscriptionError: (callback: (message: string) => void) => {
    ipcRenderer.on('transcription-error', (_event, message) => callback(message))
  },
  removeTranscriptionErrorListener: () => {
    ipcRenderer.removeAllListeners('transcription-error')
  },
  onTranscriptionStopped: (callback: () => void) => {
    ipcRenderer.on('transcription-stopped', callback)
  },
  removeTranscriptionStoppedListener: () => {
    ipcRenderer.removeAllListeners('transcription-stopped')
  },
  onTranscriptionCleared: (callback: () => void) => {
    ipcRenderer.on('transcription-cleared', callback)
  },
  removeTranscriptionClearedListener: () => {
    ipcRenderer.removeAllListeners('transcription-cleared')
  },

  // TTS
  startTTS: (apiKey: string) => ipcRenderer.invoke('start-tts', apiKey),
  stopTTS: () => ipcRenderer.invoke('stop-tts'),
  ttsSpeak: (text: string) => ipcRenderer.invoke('tts-speak', text),

  onTTSAudioChunk: (callback: (chunk: ArrayBuffer) => void) => {
    ipcRenderer.on('tts-audio-chunk', (_event, chunk) => callback(chunk))
  },
  removeTTSAudioChunkListener: () => {
    ipcRenderer.removeAllListeners('tts-audio-chunk')
  },
  onTTSStarted: (callback: () => void) => {
    ipcRenderer.on('tts-started', callback)
  },
  removeTTSStartedListener: () => {
    ipcRenderer.removeAllListeners('tts-started')
  },
  onTTSComplete: (callback: () => void) => {
    ipcRenderer.on('tts-complete', callback)
  },
  removeTTSCompleteListener: () => {
    ipcRenderer.removeAllListeners('tts-complete')
  },
  onTTSError: (callback: (message: string) => void) => {
    ipcRenderer.on('tts-error', (_event, message) => callback(message))
  },
  removeTTSErrorListener: () => {
    ipcRenderer.removeAllListeners('tts-error')
  },

  // Voice conversation
  onToggleVoiceConversation: (callback: () => void) => {
    ipcRenderer.on('toggle-voice-conversation', callback)
  },
  removeToggleVoiceConversationListener: () => {
    ipcRenderer.removeAllListeners('toggle-voice-conversation')
  },
  sendVoiceQuery: (text: string) => ipcRenderer.invoke('send-voice-query', text),
  onToggleTTS: (callback: () => void) => {
    ipcRenderer.on('toggle-tts', callback)
  },
  removeToggleTTSListener: () => {
    ipcRenderer.removeAllListeners('toggle-tts')
  },

  // TTS speak text (clean AI response only, no user messages)
  onTtsSpeakText: (callback: (text: string) => void) => {
    ipcRenderer.on('tts-speak-text', (_event, text) => callback(text))
  },
  removeTtsSpeakTextListener: () => {
    ipcRenderer.removeAllListeners('tts-speak-text')
  },

  // Recording (interview review)
  startRecording: (apiKey: string, systemDeviceId: string, micDeviceId: string) =>
    ipcRenderer.invoke('start-recording', apiKey, systemDeviceId, micDeviceId),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  sendRecorderAudioChunk: (chunk: ArrayBuffer, channel: 'system' | 'mic') =>
    ipcRenderer.send(`recorder-${channel}-audio-chunk`, chunk),

  onStartRecordingCmd: (callback: () => void) => {
    ipcRenderer.on('start-recording-cmd', callback)
  },
  removeStartRecordingCmdListener: () => {
    ipcRenderer.removeAllListeners('start-recording-cmd')
  },
  onStopRecordingCmd: (callback: () => void) => {
    ipcRenderer.on('stop-recording-cmd', callback)
  },
  removeStopRecordingCmdListener: () => {
    ipcRenderer.removeAllListeners('stop-recording-cmd')
  },
  onRecordingStarted: (callback: () => void) => {
    ipcRenderer.on('recording-started', callback)
  },
  removeRecordingStartedListener: () => {
    ipcRenderer.removeAllListeners('recording-started')
  },
  onRecordingStopped: (callback: () => void) => {
    ipcRenderer.on('recording-stopped', callback)
  },
  removeRecordingStoppedListener: () => {
    ipcRenderer.removeAllListeners('recording-stopped')
  },
  onRecordingSentence: (callback: (channel: 'system' | 'mic') => void) => {
    ipcRenderer.on('recording-sentence', (_event, channel) => callback(channel))
  },
  removeRecordingSentenceListener: () => {
    ipcRenderer.removeAllListeners('recording-sentence')
  },
  onRecordingError: (callback: (message: string) => void) => {
    ipcRenderer.on('recording-error', (_event, message) => callback(message))
  },
  removeRecordingErrorListener: () => {
    ipcRenderer.removeAllListeners('recording-error')
  },

  selectRecordDir: () => ipcRenderer.invoke('selectRecordDir') as Promise<string | null>,

}

export type MainAPI = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
