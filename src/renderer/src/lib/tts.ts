import { useSettingsStore } from '@/lib/store/settings'
import { useVoiceStore } from '@/lib/store/voice'
import * as webSpeech from './speech-synthesis'
import * as pcmPlayer from './tts-player'

let cleanupTTSListeners: (() => void) | null = null

function clearTTSListeners() {
  if (cleanupTTSListeners) {
    cleanupTTSListeners()
    cleanupTTSListeners = null
  }
}

export async function speak(text: string): Promise<void> {
  const { ttsProvider, ttsVoice, dashscopeApiKey } = useSettingsStore.getState()
  useVoiceStore.getState().setIsSpeaking(true)

  if (ttsProvider === 'web-speech') {
    webSpeech.speak(text, ttsVoice)
    waitForWebSpeechEnd().then(() => {
      useVoiceStore.getState().setIsSpeaking(false)
    })
  } else {
    clearTTSListeners()

    await window.api.startTTS(dashscopeApiKey)

    pcmPlayer.ensurePlayer()

    window.api.onTTSAudioChunk((chunk: ArrayBuffer) => {
      pcmPlayer.enqueueChunk(chunk)
    })

    let completed = false
    const onComplete = () => {
      if (completed) return
      completed = true
      useVoiceStore.getState().setIsSpeaking(false)
      clearTTSListeners()
    }

    window.api.onTTSComplete(onComplete)
    window.api.onTTSError(() => {
      pcmPlayer.stopPlayer()
      onComplete()
    })

    cleanupTTSListeners = () => {
      window.api.removeTTSAudioChunkListener()
      window.api.removeTTSCompleteListener()
      window.api.removeTTSErrorListener()
    }

    await window.api.ttsSpeak(text)
  }
}

export function stop(): void {
  const { ttsProvider } = useSettingsStore.getState()

  if (ttsProvider === 'web-speech') {
    webSpeech.stop()
  } else {
    pcmPlayer.stopPlayer()
    window.api.stopTTS()
    clearTTSListeners()
  }

  useVoiceStore.getState().setIsSpeaking(false)
}

function waitForWebSpeechEnd(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (!webSpeech.isSpeaking()) {
        resolve()
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}
