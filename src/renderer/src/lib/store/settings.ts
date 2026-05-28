import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  // theme: 'light' | 'dark'an
  apiBaseURL: string
  apiKey: string
  model: string
  customModels: string[]
  customPrompt: string
  codeIdeaPrompt: string

  opacity: number
  codeLanguage: string

  screenshotAutoSave: boolean
  screenshotDir: string

  dashscopeApiKey: string

  ttsProvider: 'web-speech' | 'dashscope'
  ttsEnabled: boolean
  audioSource: 'system' | 'microphone'
  systemAudioDeviceId: string
  micDeviceId: string
  ttsVoice: string
  recordDir: string
  recordEnabled: boolean
  recordSaveScreenshots: boolean
  useSeparateVisionModel: boolean
  visionApiBaseURL: string
  visionApiKey: string
  visionModel: string
  responseMode: 'core-code' | 'acm' | 'custom'
  voiceWordLimit: number
  statusBarShortcutHints: StatusBarShortcutHintAction[]
}

export type StatusBarShortcutHintAction =
  | 'appendScreenshot'
  | 'takeScreenshot'
  | 'toggleResponseMode'
  | 'codeIdea'
  | 'alternativeSolution'
  | 'voiceQuery'
  | 'toggleTTS'
  | 'startRecording'
  | 'stopRecording'

export const defaultStatusBarShortcutHints: StatusBarShortcutHintAction[] = [
  'appendScreenshot',
  'takeScreenshot',
  'toggleResponseMode',
  'codeIdea',
  'alternativeSolution',
  'voiceQuery',
  'toggleTTS'
]

function normalizeApiBaseURL(url: string) {
  return url.trim()
}

function normalizeSettings(settings: Partial<Settings>) {
  const next = { ...settings }
  if (typeof next.apiBaseURL === 'string') {
    next.apiBaseURL = normalizeApiBaseURL(next.apiBaseURL)
  }
  if (typeof next.visionApiBaseURL === 'string') {
    next.visionApiBaseURL = normalizeApiBaseURL(next.visionApiBaseURL)
  }
  return next
}

interface SettingsStore extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  syncSettings: (settings: Partial<Settings>) => void
}

const defaultSettings: Settings = {
  apiBaseURL: '',
  apiKey: '',
  model: '',
  customModels: [],
  customPrompt: '',
  codeIdeaPrompt: '',
  codeLanguage: '',

  opacity: 0.8,

  screenshotAutoSave: false,
  screenshotDir: '',

  dashscopeApiKey: '',

  ttsProvider: 'web-speech' as const,
  ttsEnabled: false,
  audioSource: 'system' as const,
  systemAudioDeviceId: '',
  micDeviceId: '',
  ttsVoice: '',
  recordDir: '',
  recordEnabled: false,
  recordSaveScreenshots: true,
  useSeparateVisionModel: false,
  visionApiBaseURL: '',
  visionApiKey: '',
  visionModel: '',
  responseMode: 'core-code' as const,
  voiceWordLimit: 500,
  statusBarShortcutHints: defaultStatusBarShortcutHints
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      updateSetting: (key, value) => {
        set(normalizeSettings({ [key]: value } as Partial<Settings>))
      },
      syncSettings: (settings) => {
        set(normalizeSettings(settings))
      }
    }),
    {
      name: 'interview-coder-settings',
      version: 5
    }
  )
)
