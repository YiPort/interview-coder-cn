import { create } from 'zustand'

interface VoiceState {
  isVoiceMode: boolean
  isTTSEnabled: boolean
  isSpeaking: boolean
}

interface VoiceStore extends VoiceState {
  setVoiceMode: (v: boolean) => void
  setTTSEnabled: (v: boolean) => void
  setIsSpeaking: (v: boolean) => void
  resetState: () => void
}

const defaultState: VoiceState = {
  isVoiceMode: false,
  isTTSEnabled: true,
  isSpeaking: false
}

export const useVoiceStore = create<VoiceStore>()((set) => ({
  ...defaultState,
  setVoiceMode: (v) => set({ isVoiceMode: v }),
  setTTSEnabled: (v) => set({ isTTSEnabled: v }),
  setIsSpeaking: (v) => set({ isSpeaking: v }),
  resetState: () => set(defaultState)
}))
