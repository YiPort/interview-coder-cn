import { create } from 'zustand'

interface RecorderState {
  isRecording: boolean
  systemSentenceCount: number
  micSentenceCount: number
}

interface RecorderStore extends RecorderState {
  setIsRecording: (value: boolean) => void
  incrementSystemCount: () => void
  incrementMicCount: () => void
  reset: () => void
}

export const useRecorderStore = create<RecorderStore>((set) => ({
  isRecording: false,
  systemSentenceCount: 0,
  micSentenceCount: 0,
  setIsRecording: (value) => set({ isRecording: value }),
  incrementSystemCount: () => set((s) => ({ systemSentenceCount: s.systemSentenceCount + 1 })),
  incrementMicCount: () => set((s) => ({ micSentenceCount: s.micSentenceCount + 1 })),
  reset: () => set({ isRecording: false, systemSentenceCount: 0, micSentenceCount: 0 })
}))
