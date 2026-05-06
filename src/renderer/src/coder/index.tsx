import { useEffect } from 'react'
import { useSettingsStore } from '@/lib/store/settings'
import { useAppStore } from '@/lib/store/app'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useSolutionStore } from '@/lib/store/solution'
import { useVoiceStore } from '@/lib/store/voice'
import { startAudioCapture, stopAudioCapture } from '@/lib/audio-capture'
import { speak as ttsSpeak, stop as ttsStop } from '@/lib/tts'

import { AppHeader } from './AppHeader'
import { AppContent } from './AppContent'
import { AppStatusBar } from './AppStatusBar'
import { PrerequisitesChecker } from './PrerequisitesChecker'
import { TranscriptionBar } from './TranscriptionBar'

/** Pick the right device ID based on current audio source. */
function getDeviceId(): string | undefined {
  const { audioSource, systemAudioDeviceId, micDeviceId } = useSettingsStore.getState()
  const id = audioSource === 'system' ? systemAudioDeviceId : micDeviceId
  return id || undefined
}

export default function CoderPage() {
  const { opacity, dashscopeApiKey, audioSource, systemAudioDeviceId, micDeviceId } =
    useSettingsStore()
  const { syncAppState } = useAppStore()
  const { isTranscribing, setIsTranscribing, setTranscriptionText, clearText } =
    useTranscriptionStore()
  const { setErrorMessage } = useSolutionStore()
  const { setVoiceMode } = useVoiceStore()

  useEffect(() => {
    document.body.style.opacity = opacity.toString()
    return () => {
      document.body.style.opacity = ''
    }
  }, [opacity])

  useEffect(() => {
    window.api.updateAppState({ inCoderPage: true })
    return () => {
      window.api.updateAppState({ inCoderPage: false })
    }
  }, [])

  useEffect(() => {
    window.api.onSyncAppState((state) => {
      syncAppState(state)
    })
    return () => {
      window.api.removeSyncAppStateListener()
    }
  }, [syncAppState])

  useEffect(() => {
    const handleToggle = async () => {
      if (isTranscribing) {
        stopAudioCapture()
        await window.api.stopTranscription()
        setIsTranscribing(false)
      } else {
        if (!dashscopeApiKey) {
          setErrorMessage('请先在设置中配置百炼平台 API Key')
          return
        }
        try {
          await startAudioCapture(
            audioSource === 'system'
              ? (systemAudioDeviceId || undefined)
              : (micDeviceId || undefined)
          )
          await window.api.startTranscription(dashscopeApiKey)
          setIsTranscribing(true)
          setErrorMessage(null)
        } catch (err) {
          console.error('Failed to start transcription:', err)
          stopAudioCapture()
          setErrorMessage('启动语音转录失败，请检查音频设备权限。如果使用系统音频，请确认已启用"立体声混音"设备（详见 README）。')
        }
      }
    }

    window.api.onToggleTranscription(handleToggle)
    return () => {
      window.api.removeToggleTranscriptionListener()
    }
  }, [isTranscribing, dashscopeApiKey, audioSource, systemAudioDeviceId, micDeviceId, setIsTranscribing, setErrorMessage])

  useEffect(() => {
    window.api.onTranscriptionText((data) => {
      setTranscriptionText(data.text)
    })
    window.api.onTranscriptionError((message) => {
      setErrorMessage(message)
      setIsTranscribing(false)
      stopAudioCapture()
    })
    window.api.onTranscriptionStopped(() => {
      setIsTranscribing(false)
    })
    window.api.onTranscriptionCleared(() => {
      clearText()
    })

    return () => {
      window.api.removeTranscriptionTextListener()
      window.api.removeTranscriptionErrorListener()
      window.api.removeTranscriptionStoppedListener()
      window.api.removeTranscriptionClearedListener()
    }
  }, [setTranscriptionText, setErrorMessage, setIsTranscribing, clearText])

  // Trigger TTS on solution completion — only speak the latest AI response
  useEffect(() => {
    const handleTtsSpeak = (text: string) => {
      const { ttsEnabled: enabled } = useSettingsStore.getState()
      const { isVoiceMode: voiceMode } = useVoiceStore.getState()
      if ((enabled || voiceMode) && text.trim()) {
        ttsSpeak(text.trim())
      }
    }

    window.api.onTtsSpeakText(handleTtsSpeak)
    return () => {
      window.api.removeTtsSpeakTextListener()
    }
  }, [])

  // Voice conversation mode toggle
  useEffect(() => {
    const handleToggleVoice = async () => {
      const { isVoiceMode: voiceMode } = useVoiceStore.getState()
      if (voiceMode) {
        // Stop voice mode: stop audio, stop transcription, send text to AI
        stopAudioCapture()
        await window.api.stopTranscription()
        setVoiceMode(false)
        useTranscriptionStore.getState().setIsTranscribing(false)
        const text = await window.api.getTranscriptionText()
        if (text.trim()) {
          useTranscriptionStore.getState().clearText()
          await window.api.sendVoiceQuery(text.trim())
        }
      } else {
        // Start voice mode: start audio capture, start transcription
        const { dashscopeApiKey: apiKey } = useSettingsStore.getState()
        if (!apiKey) {
          setErrorMessage('请先在设置中配置百炼平台 API Key')
          return
        }
        try {
          await startAudioCapture(getDeviceId())
          await window.api.startTranscription(apiKey)
          setVoiceMode(true)
          useTranscriptionStore.getState().setIsTranscribing(true)
          setErrorMessage(null)
        } catch (err) {
          console.error('Failed to start voice conversation:', err)
          stopAudioCapture()
          setErrorMessage('启动语音对话失败，请检查音频设备权限。如果使用系统音频，请确认已启用"立体声混音"设备（详见 README）。')
        }
      }
    }

    window.api.onToggleVoiceConversation(handleToggleVoice)
    return () => {
      window.api.removeToggleVoiceConversationListener()
    }
  }, [setErrorMessage, setVoiceMode])

  // Toggle TTS on/off from shortcut
  useEffect(() => {
    const handleToggleTTS = () => {
      const { ttsEnabled: enabled } = useSettingsStore.getState()
      useSettingsStore.getState().updateSetting('ttsEnabled', !enabled)
      if (enabled) {
        ttsStop()
      }
    }

    window.api.onToggleTTS(handleToggleTTS)
    return () => {
      window.api.removeToggleTTSListener()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (useTranscriptionStore.getState().isTranscribing) {
        stopAudioCapture()
        window.api.stopTranscription()
      }
      if (useVoiceStore.getState().isVoiceMode) {
        stopAudioCapture()
        window.api.stopTranscription()
      }
      ttsStop()
    }
  }, [])

  return (
    <div className="relative h-screen">
      <AppHeader />
      <AppContent />
      <TranscriptionBar />
      <AppStatusBar />
      <PrerequisitesChecker />
    </div>
  )
}
