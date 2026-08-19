/**
 * AudioWorklet source as a string. The worklet downsamples the mic stream
 * (whatever the hardware sample rate is) to 16 kHz mono Int16 PCM and posts
 * the raw ArrayBuffer back to the main thread for base64-encoding + send.
 *
 * Kept as a string literal so Vite can wrap it in a Blob URL at runtime,
 * avoiding a separate worklet file in the build pipeline.
 */
export const PCM_WORKLET_SOURCE = `
class PcmDownsamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = 16000;
    this.inputRate = sampleRate;
    this.ratio = this.inputRate / this.targetRate;
    this.buffer = [];
    this.outFrame = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    // Simple linear-interpolation downsample to 16kHz.
    const out = [];
    let rms = 0;
    for (let i = 0; this.outFrame + i * this.ratio < channel.length; i++) {
      const srcIdx = this.outFrame + i * this.ratio;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, channel.length - 1);
      const frac = srcIdx - lo;
      const sample = channel[lo] * (1 - frac) + channel[hi] * frac;
      rms += sample * sample;
      // Clamp + convert float [-1,1] → int16
      const clamped = Math.max(-1, Math.min(1, sample));
      out.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
    }
    // Advance by the number of input frames we consumed.
    const consumed = out.length * this.ratio;
    const leftover = channel.length - consumed;
    this.outFrame = leftover < 0 ? 0 : -leftover;

    if (out.length > 0) {
      const int16 = new Int16Array(out);
      const level = Math.sqrt(rms / out.length);
      this.port.postMessage({ pcm: int16.buffer, level }, [int16.buffer]);
    }
    return true;
  }
}

registerProcessor('pcm-downsampler', PcmDownsamplerProcessor);
`;
