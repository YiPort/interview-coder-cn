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

/**
 * Capture audio from a specific input device via getUserMedia.
 * For system audio, select "Stereo Mix" (立体声混音) or similar loopback device.
 * For your own voice, select your physical microphone.
 */
export async function startAudioCapture(deviceId?: string): Promise<void> {
  const audioConstraints: MediaTrackConstraints = {
    sampleRate: 16000,
    channelCount: 1
  }
  if (deviceId) {
    audioConstraints.deviceId = { exact: deviceId }
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints
  })
  mediaStream = stream
  createPCMProcessor(stream)
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
