import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const AI_ANSWER_FONT_SIZE_DEFAULT = 12
export const AI_ANSWER_FONT_SIZE_MIN = 10
export const AI_ANSWER_FONT_SIZE_MAX = 20

export function clampAiAnswerFontSize(value: number) {
  if (!Number.isFinite(value)) return AI_ANSWER_FONT_SIZE_DEFAULT
  return Math.min(AI_ANSWER_FONT_SIZE_MAX, Math.max(AI_ANSWER_FONT_SIZE_MIN, Math.round(value)))
}

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
  aiAnswerFontSize: number
  statusBarShortcutHints: StatusBarShortcutHintAction[]
}

export type StatusBarShortcutHintAction =
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
  | 'resetAnswerFontSize'
  | 'decreaseAnswerFontSize'
  | 'increaseAnswerFontSize'
  | 'moveMainWindowUp'
  | 'moveMainWindowDown'
  | 'moveMainWindowLeft'
  | 'moveMainWindowRight'
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
  if (typeof next.aiAnswerFontSize === 'number') {
    next.aiAnswerFontSize = clampAiAnswerFontSize(next.aiAnswerFontSize)
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
  aiAnswerFontSize: AI_ANSWER_FONT_SIZE_DEFAULT,
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
