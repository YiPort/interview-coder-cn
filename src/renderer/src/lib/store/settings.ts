import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  // theme: 'light' | 'dark'an
  apiBaseURL: string
  apiKey: string
  model: string
  customModels: string[]
  customPrompt: string

  opacity: number
  codeLanguage: string

  screenshotAutoSave: boolean
  screenshotDir: string

  dashscopeApiKey: string

  ttsProvider: 'web-speech' | 'dashscope'
  ttsEnabled: boolean
  audioSource: 'system' | 'microphone'
  ttsVoice: string
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
  codeLanguage: '',

  opacity: 0.8,

  screenshotAutoSave: false,
  screenshotDir: '',

  dashscopeApiKey: '',

  ttsProvider: 'web-speech' as const,
  ttsEnabled: true,
  audioSource: 'system' as const,
  ttsVoice: ''
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      updateSetting: (key, value) => {
        set({ [key]: value })
      },
      syncSettings: (settings) => {
        set(settings)
      }
    }),
    {
      name: 'interview-coder-settings',
      version: 5
    }
  )
)
