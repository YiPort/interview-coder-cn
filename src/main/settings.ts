import { dialog, ipcMain } from 'electron'

function normalizeApiBaseURL(url: string) {
  return url.trim()
}

ipcMain.handle('getAppSettings', () => {
  return settings
})

ipcMain.handle('updateAppSettings', (_event, _settings) => {
  const nextSettings = { ..._settings }
  if (typeof nextSettings.apiBaseURL === 'string') {
    nextSettings.apiBaseURL = normalizeApiBaseURL(nextSettings.apiBaseURL)
  }
  if (typeof nextSettings.visionApiBaseURL === 'string') {
    nextSettings.visionApiBaseURL = normalizeApiBaseURL(nextSettings.visionApiBaseURL)
  }
  Object.assign(settings, nextSettings)
})

ipcMain.handle('selectScreenshotDir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: '选择截图保存目录'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('selectRecordDir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: '选择录音保存目录'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

export const settings = {
  apiBaseURL: normalizeApiBaseURL(process.env.API_BASE_URL || ''),
  apiKey: process.env.API_KEY || '',
  model: process.env.MODEL || '',
  codeLanguage: process.env.CODE_LANGUAGE || 'typescript',
  customPrompt: '',
  codeIdeaPrompt: '',
  screenshotAutoSave: false,
  screenshotDir: '',
  dashscopeApiKey: '',
  ttsProvider: 'web-speech' as 'web-speech' | 'dashscope',
  ttsEnabled: false,
  audioSource: 'system' as 'system' | 'microphone',
  systemAudioDeviceId: '',
  micDeviceId: '',
  recordDir: '',
  recordEnabled: false,
  recordSaveScreenshots: true,
  useSeparateVisionModel: false,
  visionApiBaseURL: '',
  visionApiKey: '',
  visionModel: '',
  responseMode: 'core-code' as 'core-code' | 'acm' | 'custom',
  voiceWordLimit: 500,
  statusBarShortcutHints: [
    'appendScreenshot',
    'takeScreenshot',
    'toggleResponseMode',
    'codeIdea',
    'alternativeSolution',
    'voiceQuery',
    'toggleTTS'
  ] as Array<
    | 'hideOrShowMainWindow'
    | 'ignoreOrEnableMouse'
    | 'appendScreenshot'
    | 'takeScreenshot'
    | 'stopSolutionStream'
    | 'toggleResponseMode'
    | 'codeIdea'
    | 'alternativeSolution'
    | 'toggleTranscription'
    | 'clearTranscription'
    | 'pageUp'
    | 'pageDown'
    | 'contentScrollUp'
    | 'contentScrollDown'
    | 'moveMainWindowUp'
    | 'moveMainWindowDown'
    | 'moveMainWindowLeft'
    | 'moveMainWindowRight'
    | 'voiceQuery'
    | 'toggleTTS'
    | 'startRecording'
    | 'stopRecording'
  >
}

export type AppSettings = typeof settings
