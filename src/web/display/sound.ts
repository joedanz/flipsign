/** Generated "clack" (filtered noise burst); no audio assets needed. */
export class Clack {
  enabled = true;
  private ctx: AudioContext | undefined;
  private noise: AudioBuffer | undefined;
  private lastAt = 0;

  private init(): boolean {
    if (this.ctx) return true;
    try {
      this.ctx = new AudioContext();
    } catch {
      return false;
    }
    const len = Math.floor(this.ctx.sampleRate * 0.02);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    return true;
  }

  /** Call from a user gesture if the browser blocks autoplay. */
  unlock(): void {
    if (this.init()) void this.ctx!.resume();
  }

  play(): void {
    if (!this.enabled || !this.init()) return;
    const ctx = this.ctx!;
    if (ctx.state !== 'running') {
      void ctx.resume();
      return;
    }
    const t = ctx.currentTime;
    if (t - this.lastAt < 0.012) return; // cap the clack rate when many tiles flip at once
    this.lastAt = t;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0.15 + Math.random() * 0.15;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }
}
