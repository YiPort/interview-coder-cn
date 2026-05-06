let systemStream: MediaStream | null = null
let micStream: MediaStream | null = null
let systemCtx: AudioContext | null = null
let micCtx: AudioContext | null = null
let systemProcessor: ScriptProcessorNode | null = null
let micProcessor: ScriptProcessorNode | null = null

function createProcessor(
  source: MediaStream,
  channel: 'system' | 'mic'
): { ctx: AudioContext; processor: ScriptProcessorNode } {
  const ctx = new AudioContext({ sampleRate: 16000 })
  const audioSource = ctx.createMediaStreamSource(source)
  const processor = ctx.createScriptProcessor(2048, 1, 1)
  processor.onaudioprocess = (e) => {
    const float32 = e.inputBuffer.getChannelData(0)
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    window.api.sendRecorderAudioChunk(int16.buffer, channel)
  }
  audioSource.connect(processor)
  processor.connect(ctx.destination)
  return { ctx, processor }
}

export async function startDualCapture(
  systemDeviceId?: string,
  micDeviceId?: string
): Promise<void> {
  if (systemDeviceId) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: systemDeviceId }, sampleRate: 16000, channelCount: 1 }
    })
    systemStream = stream
    const { ctx, processor } = createProcessor(stream, 'system')
    systemCtx = ctx
    systemProcessor = processor
  }
  if (micDeviceId) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: micDeviceId }, sampleRate: 16000, channelCount: 1 }
    })
    micStream = stream
    const { ctx, processor } = createProcessor(stream, 'mic')
    micCtx = ctx
    micProcessor = processor
  }
}

export function stopDualCapture(): void {
  ;[systemProcessor, micProcessor].forEach((p) => {
    if (p) p.disconnect()
  })
  ;[systemCtx, micCtx].forEach((c) => {
    if (c) c.close()
  })
  ;[systemStream, micStream].forEach((s) => {
    if (s) s.getTracks().forEach((t) => t.stop())
  })
  systemStream = micStream = null
  systemCtx = micCtx = null
  systemProcessor = micProcessor = null
}
