export function speak(text: string, voiceURI?: string): void {
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)

  if (voiceURI) {
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find((v) => v.voiceURI === voiceURI)
    if (match) utterance.voice = match
  }

  utterance.rate = 1.0
  utterance.pitch = 1.0

  window.speechSynthesis.speak(utterance)
}

export function stop(): void {
  window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return window.speechSynthesis.speaking
}

export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices()
}
