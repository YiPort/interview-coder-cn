let mediaStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let processor: ScriptProcessorNode | null = null

function createPCMProcessor(source: MediaStream): void {
  audioContext = new AudioContext({ sampleRate: 16000 })
  const audioSource = audioContext.createMediaStreamSource(source)

  processor = audioContext.createScriptProcessor(2048, 1, 1)
  processor.onaudioprocess = (e) => {
    const float32 = e.inputBuffer.getChannelData(0)
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    window.api.sendTranscriptionAudioChunk(int16.buffer)
  }
  audioSource.connect(processor)
  processor.connect(audioContext.destination)
}

export async function startAudioCapture(
  source: 'system' | 'microphone' = 'system'
): Promise<void> {
  if (source === 'system') {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true
    })
    stream.getVideoTracks().forEach((t) => t.stop())
    mediaStream = stream
    createPCMProcessor(new MediaStream(stream.getAudioTracks()))
  } else {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1 }
    })
    mediaStream = stream
    createPCMProcessor(stream)
  }
}

export function stopAudioCapture(): void {
  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
}
