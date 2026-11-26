/**
 * Placeholder soundscape, generated with WebAudio (no audio files, nothing to license):
 * soft wind, the occasional bird, and a chime when a zone lights up.
 * Final recordings can replace it later (public/assets/audio/README.md).
 * Mute silences everything immediately. Nothing plays before a user gesture.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private birdTimer: ReturnType<typeof setTimeout> | null = null;
  private muted = false;

  get supported(): boolean {
    return typeof window !== 'undefined' && typeof window.AudioContext === 'function';
  }

  /** Call from a user gesture (a click or key press). Safe to call repeatedly. */
  start(): void {
    if (!this.supported) return;
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.7;
    master.connect(ctx.destination);
    this.master = master;
    this.startWind(ctx, master);
    this.scheduleBird();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  /** Short pentatonic chime. `index` picks the note so each zone sounds different. */
  chime(index = 0): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const scale = [392, 440, 523.25, 587.33, 659.25, 783.99];
    const base = scale[index % scale.length] ?? 440;
    [0, 2, 4].forEach((step, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = scale[(index + step) % scale.length] ?? base;
      const t0 = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      osc.connect(gain).connect(master);
      osc.start(t0);
      osc.stop(t0 + 1.2);
    });
  }

  dispose(): void {
    if (this.birdTimer) clearTimeout(this.birdTimer);
    this.birdTimer = null;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private startWind(ctx: AudioContext, out: AudioNode): void {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      // Brown-ish noise: soft and low
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.07;
    lfo.connect(lfoDepth).connect(gain.gain);
    src.connect(filter).connect(gain).connect(out);
    src.start();
    lfo.start();
  }

  private scheduleBird(): void {
    this.birdTimer = setTimeout(
      () => {
        this.chirp();
        this.scheduleBird();
      },
      3500 + Math.random() * 5000,
    );
  }

  private chirp(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const f = 2400 + Math.random() * 900;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.14;
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.09);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.035, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      osc.connect(gain).connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.14);
    }
  }
}
