let audioContext: AudioContext | null = null
let nextPlayTime = 0
const SAMPLE_RATE = 24000

export function ensurePlayer(): void {
  if (audioContext) return
  audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
  nextPlayTime = audioContext.currentTime
}

export function enqueueChunk(chunk: ArrayBuffer): void {
  if (!audioContext) return

  const int16 = new Int16Array(chunk)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768
  }

  const buffer = audioContext.createBuffer(1, float32.length, SAMPLE_RATE)
  buffer.getChannelData(0).set(float32)

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.connect(audioContext.destination)

  const now = audioContext.currentTime
  const startTime = Math.max(now, nextPlayTime)
  source.start(startTime)
  nextPlayTime = startTime + buffer.duration
}

export function stopPlayer(): void {
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  nextPlayTime = 0
}
