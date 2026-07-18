class ViEnMeetPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.chunkLength = Math.round(sampleRate * 0.2)
    this.chunk = new Float32Array(this.chunkLength)
    this.offset = 0
    this.squareSum = 0
  }

  process(inputs) {
    const input = inputs[0]?.[0]
    if (!input) {
      return true
    }

    let inputOffset = 0
    while (inputOffset < input.length) {
      const writable = Math.min(
        input.length - inputOffset,
        this.chunkLength - this.offset,
      )

      for (let index = 0; index < writable; index += 1) {
        const sample = input[inputOffset + index]
        this.chunk[this.offset + index] = sample
        this.squareSum += sample * sample
      }

      inputOffset += writable
      this.offset += writable

      if (this.offset === this.chunkLength) {
        const completedChunk = this.chunk
        const rms = Math.sqrt(this.squareSum / this.chunkLength)
        this.port.postMessage(
          { samples: completedChunk, rms },
          [completedChunk.buffer],
        )
        this.chunk = new Float32Array(this.chunkLength)
        this.offset = 0
        this.squareSum = 0
      }
    }

    return true
  }
}

registerProcessor('vienmeet-pcm-processor', ViEnMeetPcmProcessor)
