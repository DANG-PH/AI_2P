const DEFAULT_SAMPLE_RATE = 16_000
const AUDIO_WORKLET_NAME = 'vienmeet-pcm-processor'

interface AudioStreamerOptions {
  sampleRate?: number
  mediaStream?: MediaStream
  onAudioChunk: (chunk: ArrayBuffer) => void
  onVolume?: (volume: number) => void
}

/**
 * Reads a mono browser audio track, emits fixed 200 ms PCM16 chunks at 16 kHz,
 * and can either own a temporary microphone stream or reuse a LiveKit stream.
 */
export class AudioStreamer {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private ownsMediaStream = false
  private readonly options: AudioStreamerOptions

  constructor(options: AudioStreamerOptions) {
    this.options = options
  }

  async start(): Promise<void> {
    if (this.audioContext) {
      return
    }

    try {
      if (this.options.mediaStream) {
        this.mediaStream = this.options.mediaStream
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
        this.ownsMediaStream = true
      }

      const AudioContextClass =
        window.AudioContext ||
        (window as Window & {
          webkitAudioContext?: typeof AudioContext
        }).webkitAudioContext

      if (!AudioContextClass) {
        throw new Error('WEB_AUDIO_UNAVAILABLE')
      }

      this.audioContext = new AudioContextClass()
      await this.audioContext.audioWorklet.addModule(
        `${import.meta.env.BASE_URL}pcm-audio-processor.js`,
      )

      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream,
      )
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        AUDIO_WORKLET_NAME,
        {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
        },
      )

      const targetSampleRate =
        this.options.sampleRate ?? DEFAULT_SAMPLE_RATE
      const sourceSampleRate = this.audioContext.sampleRate

      this.workletNode.port.onmessage = (
        event: MessageEvent<{ samples: Float32Array; rms: number }>,
      ) => {
        const { samples, rms } = event.data
        const downsampled = this.downsample(
          samples,
          sourceSampleRate,
          targetSampleRate,
        )
        const pcm = this.toPcm16(downsampled)

        this.options.onAudioChunk(pcm.buffer as ArrayBuffer)
        this.options.onVolume?.(
          Math.min(Math.round(rms * 350), 100),
        )
      }

      this.sourceNode.connect(this.workletNode)

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
    } catch (error) {
      this.stop()
      throw error
    }
  }

  stop(): void {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null
      this.workletNode.disconnect()
      this.workletNode = null
    }

    this.sourceNode?.disconnect()
    this.sourceNode = null

    if (this.ownsMediaStream) {
      this.mediaStream?.getTracks().forEach((track) => track.stop())
    }
    this.mediaStream = null
    this.ownsMediaStream = false

    if (this.audioContext?.state !== 'closed') {
      void this.audioContext?.close()
    }
    this.audioContext = null
  }

  private downsample(
    input: Float32Array,
    sourceRate: number,
    targetRate: number,
  ): Float32Array {
    if (sourceRate === targetRate) {
      return input
    }

    const targetLength = Math.round(
      (input.length * targetRate) / sourceRate,
    )
    const output = new Float32Array(targetLength)
    const ratio = sourceRate / targetRate

    for (let targetIndex = 0; targetIndex < targetLength; targetIndex += 1) {
      const sourceStart = Math.floor(targetIndex * ratio)
      const sourceEnd = Math.min(
        input.length,
        Math.max(sourceStart + 1, Math.floor((targetIndex + 1) * ratio)),
      )
      let sum = 0

      for (
        let sourceIndex = sourceStart;
        sourceIndex < sourceEnd;
        sourceIndex += 1
      ) {
        sum += input[sourceIndex]
      }

      output[targetIndex] = sum / (sourceEnd - sourceStart)
    }

    return output
  }

  private toPcm16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length)

    for (let index = 0; index < input.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, input[index]))
      output[index] =
        sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }

    return output
  }
}
