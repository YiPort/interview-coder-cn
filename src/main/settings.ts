import { dialog, ipcMain } from 'electron'

ipcMain.handle('getAppSettings', () => {
  return settings
})

ipcMain.handle('updateAppSettings', (_event, _settings) => {
  Object.assign(settings, _settings)
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
  apiBaseURL: process.env.API_BASE_URL || '',
  apiKey: process.env.API_KEY || '',
  model: process.env.MODEL || '',
  codeLanguage: process.env.CODE_LANGUAGE || 'typescript',
  customPrompt: '',
  codeIdeaPrompt: '',
  screenshotAutoSave: false,
  screenshotDir: '',
  dashscopeApiKey: '',
  ttsProvider: 'web-speech' as 'web-speech' | 'dashscope',
  ttsEnabled: true,
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
  voiceWordLimit: 500
}

export type AppSettings = typeof settings
