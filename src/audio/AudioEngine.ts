/**
 * Placeholder soundscape, generated with WebAudio (no audio files, nothing to license):
 * soft wind, the occasional bird, and a chime when a zone lights up.
 * Final recordings can replace it later (public/assets/audio/README.md).
 * Mute silences everything immediately. Nothing plays before a user gesture.
 */
export type SoundKind = 'pick' | 'drop' | 'tick' | 'note' | 'chirp' | 'rustle' | 'whoosh' | 'chime' | 'knock' | 'pluck' | 'basket' | 'creak' | 'bell' | 'hop' | 'hover';

interface Voice {
  base: number;
  type: OscillatorType;
  formant: [number, number];
  tempo: number;
  /** How much of the pentatonic-ish scale the voice uses (smaller = flatter, calmer). */
  range: number;
  gain: number;
}

/** Placeholder voices, one per character (and a soft one for the narrator). */
const VOICES: Record<string, Voice> = {
  skats: { base: 330, type: 'triangle', formant: [1000, 2100], tempo: 1, range: 1, gain: 0.07 },
  austina: { base: 440, type: 'sine', formant: [1200, 2600], tempo: 1.1, range: 0.8, gain: 0.08 },
  odzina: { base: 370, type: 'triangle', formant: [800, 1700], tempo: 0.95, range: 1, gain: 0.07 },
  deguntins: { base: 255, type: 'sawtooth', formant: [600, 1300], tempo: 1.05, range: 0.9, gain: 0.04 },
  plaukstina: { base: 300, type: 'triangle', formant: [700, 1500], tempo: 0.9, range: 0.7, gain: 0.07 },
  narrator: { base: 190, type: 'sine', formant: [500, 900], tempo: 1.15, range: 0.5, gain: 0.04 },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private birdTimer: ReturnType<typeof setTimeout> | null = null;
  private ambTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.scheduleAmbience();
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

  /** Sounds of the things you touch in a scene (all generated, nothing to license). */
  play(kind: SoundKind, index = 0): void {
    switch (kind) {
      case 'chime':
        this.chime(index);
        break;
      case 'chirp':
        this.chirp();
        break;
      case 'note': {
        // a wooden bar: a clear tone with a short, bright overtone
        const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
        const f = scale[((index % 8) + 8) % 8] ?? 523.25;
        this.blip('sine', f, f, 0.9, 0.2);
        this.blip('triangle', f * 4, f * 4, 0.12, 0.05);
        break;
      }
      case 'knock':
        this.blip('triangle', 340, 190, 0.1, 0.22);
        this.blip('square', 900, 500, 0.03, 0.04);
        break;
      case 'tick':
        this.blip('triangle', 1200, 900, 0.05, 0.08);
        break;
      case 'pick':
        this.blip('sine', 520, 720, 0.08, 0.1);
        break;
      case 'drop':
        this.blip('sine', 320, 190, 0.11, 0.14);
        break;
      case 'rustle':
        this.noise(0.7, 'highpass', 2200, 3600, 0.09);
        break;
      case 'pluck':
        this.noise(0.12, 'lowpass', 900, 500, 0.16);
        this.blip('sine', 240, 110, 0.14, 0.2);
        break;
      case 'basket':
        this.blip('sine', 150, 80, 0.16, 0.22);
        this.noise(0.18, 'bandpass', 1800, 1200, 0.07);
        break;
      case 'creak':
        this.blip('sawtooth', 150, 105, 0.38, 0.045);
        break;
      case 'bell':
        this.blip('sine', 988, 988, 1.3, 0.1);
        this.blip('sine', 1976, 1976, 0.7, 0.04);
        break;
      case 'hop':
        this.blip('sine', 280, 640, 0.13, 0.13);
        break;
      case 'hover':
        this.blip('sine', 1700, 1900, 0.03, 0.025);
        break;
      case 'whoosh':
        this.noise(1.1, 'bandpass', 300, 1400, 0.12);
        break;
    }
  }

  /**
   * A placeholder "voice" for a character: a babble of short pitched syllables shaped by the text (one to
   * three per word, longer pauses at punctuation, a lift at a question mark). Each character has its own
   * pitch and timbre; the same line always sounds the same. Real recordings replace this later.
   * Returns the approximate length in seconds.
   */
  speak(voice: string, text: string): number {
    const v = VOICES[voice] ?? VOICES.narrator!;
    const words = text.split(/\s+/).filter(Boolean);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    let t = 0;
    for (const word of words) {
      const syll = 1 + (word.length > 4 ? 1 : 0) + (word.length > 8 ? 1 : 0);
      for (let s = 0; s < syll && t < 8; s++) {
        h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
        const step = scale[h % scale.length]! * v.range;
        const last = s === syll - 1;
        const lift = last && word.endsWith('?') ? 1.28 : last && /[.!]$/.test(word) ? 0.92 : 1;
        this.syllable(v, v.base * 2 ** (step / 12) * lift, t, 0.07 + (h % 5) * 0.008, (h >>> 8) % 3);
        t += 0.1 * v.tempo;
      }
      t += 0.045 * v.tempo + (/[,;:]$/.test(word) ? 0.14 : /[.!?…]$/.test(word) ? 0.3 : 0);
    }
    return t;
  }

  private syllable(v: Voice, f: number, at: number, dur: number, vowel: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = v.type;
    osc.frequency.setValueAtTime(f * 0.96, t0);
    osc.frequency.linearRampToValueAtTime(f, t0 + dur * 0.4);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6 + vowel;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = f * 0.012;
    lfo.connect(lfoGain).connect(osc.frequency);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = v.formant[0] + (v.formant[1] - v.formant[0]) * (vowel / 2);
    formant.Q.value = 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v.gain, t0 + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(formant).connect(g).connect(master);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.02);
    lfo.stop(t0 + dur + 0.02);
  }

  private blip(type: OscillatorType, f0: number, f1: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, filter: BiquadFilterType, f0: number, f1: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    const t0 = ctx.currentTime;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.5);
    f.frequency.exponentialRampToValueAtTime(f0, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  dispose(): void {
    if (this.birdTimer) clearTimeout(this.birdTimer);
    this.birdTimer = null;
    if (this.ambTimer) clearTimeout(this.ambTimer);
    this.ambTimer = null;
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

  /** Now and then: a gust through the pines, or a woodpecker far away. */
  private scheduleAmbience(): void {
    this.ambTimer = setTimeout(
      () => {
        if (Math.random() < 0.28) this.woodpecker();
        else this.noise(1.8 + Math.random(), 'bandpass', 700, 1500, 0.045);
        this.scheduleAmbience();
      },
      7000 + Math.random() * 9000,
    );
  }

  private woodpecker(): void {
    const n = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) setTimeout(() => this.blip('square', 1600, 700, 0.025, 0.035), i * 78);
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
