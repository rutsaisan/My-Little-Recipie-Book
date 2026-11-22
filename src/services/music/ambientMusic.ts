/**
 * Música ambiental generada en el navegador (Web Audio API).
 *
 * En lugar de una pista grabada (que exigiría comprobar su licencia), la
 * melodía se compone en directo y nunca se repite igual: acordes suaves de
 * fondo, un bajo tranquilo, una cajita de música en escala pentatónica y un
 * leve crepitar de disco antiguo. Al ser música original generada por la app,
 * no depende de licencias de terceros.
 *
 * Sigue las normas de los navegadores: solo suena después de que la persona
 * pulse algo (ver `components/music/useAmbientMusic.ts`).
 */

const BPM = 72;
const EIGHTH = 60 / BPM / 2; // duración de una corchea (s)
const STEPS_PER_CHORD = 16; // dos compases por acorde
const MAX_GAIN = 0.34;

interface Chord {
  pad: number[]; // notas MIDI del acorde de fondo
  bass: number;
}

// Fa mayor: I – vi – ii – V (sus)  y una variante  IV – iii – ii – I
const PROGRESSIONS: Chord[][] = [
  [
    { pad: [53, 57, 60, 64], bass: 41 }, // Fmaj7
    { pad: [50, 53, 57, 60], bass: 38 }, // Dm7
    { pad: [50, 53, 55, 58], bass: 43 }, // Gm7
    { pad: [48, 53, 55, 58], bass: 36 }, // C7sus4
  ],
  [
    { pad: [50, 53, 57, 58], bass: 46 }, // Bbmaj7
    { pad: [52, 55, 57, 60], bass: 45 }, // Am7
    { pad: [50, 53, 55, 58], bass: 43 }, // Gm7
    { pad: [53, 57, 60, 64], bass: 41 }, // Fmaj7
  ],
];

// Pentatónica de Fa (Fa Sol La Do Re), registro agudo de cajita de música.
const MELODY_SCALE = [72, 74, 77, 79, 81, 84, 86];

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

class AmbientMusic {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private padIn!: GainNode;
  private reverbSend!: GainNode;
  private delaySend!: GainNode;
  private noise: AudioBufferSourceNode | null = null;
  private timer: number | null = null;
  private stopTimer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private degree = 2;
  private volume = 0.6;
  private playing = false;
  private onVisibility = () => this.handleVisibility();

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Empieza (o retoma) con un fundido de entrada. Llamar desde un gesto. */
  async start(volume = this.volume): Promise<void> {
    this.volume = volume;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.stopTimer) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (ctx.state === 'suspended') await ctx.resume();
    this.playing = true;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(MAX_GAIN * this.volume, now + 2.5);
    if (this.timer === null) {
      this.nextTime = now + 0.12;
      this.timer = window.setInterval(() => this.schedule(), 40);
      this.startNoise();
    }
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Para con un fundido de salida. */
  stop(): void {
    this.playing = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.fadeOutAndSuspend();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (!this.ctx || !this.playing) return;
    this.master.gain.setTargetAtTime(MAX_GAIN * volume, this.ctx.currentTime, 0.25);
  }

  /** Tres notas de campanita para celebrar (solo si la música está sonando). */
  chime(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.05;
    [84, 89, 93, 96].forEach((note, i) => this.bell(note, t + i * 0.13, 0.09));
  }

  // ── Interno ───────────────────────────────────────────────────────────────

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.ratio.value = 3;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4200;
    this.bus = ctx.createGain();
    this.bus.connect(tone).connect(compressor).connect(this.master).connect(ctx.destination);

    // Reverberación hecha con ruido que se apaga poco a poco (sala cálida).
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(ctx, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.32;
    this.reverbSend.connect(reverb).connect(compressor);

    // Eco suave (corchea con puntillo) solo para la cajita de música.
    const delay = ctx.createDelay(2);
    delay.delayTime.value = EIGHTH * 1.5;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 2200;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.28;
    this.delaySend.connect(delay);
    delay.connect(delayTone).connect(feedback).connect(delay);
    delayTone.connect(this.bus);
    delayTone.connect(this.reverbSend);

    // Acordes de fondo: filtro con un vaivén muy lento.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 950;
    padFilter.Q.value = 0.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth).connect(padFilter.frequency);
    lfo.start();
    this.padIn = ctx.createGain();
    this.padIn.connect(padFilter);
    padFilter.connect(this.bus);
    padFilter.connect(this.reverbSend);
    return ctx;
  }

  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return buffer;
  }

  /** Crepitar de disco y un soplo de ruido marrón, muy bajitos. */
  private startNoise(): void {
    const ctx = this.ctx!;
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      const crackle = Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.9 : 0;
      data[i] = brown * 2.2 + crackle;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.5;
    source.connect(filter).connect(gain).connect(this.bus);
    source.start();
    this.noise = source;
  }

  private handleVisibility(): void {
    if (!this.ctx) return;
    if (document.hidden) {
      this.fadeOutAndSuspend();
    } else if (this.playing) {
      void this.start();
    }
  }

  private fadeOutAndSuspend(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 1.2);
    if (this.stopTimer) window.clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => {
      this.stopTimer = null;
      if (this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
      this.noise?.stop();
      this.noise = null;
      void ctx.suspend();
    }, 1300);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const lookahead = document.hidden ? 1.5 : 0.25;
    while (this.nextTime < ctx.currentTime + lookahead) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += EIGHTH;
      this.step++;
    }
  }

  private chordAt(step: number): Chord {
    const chordIndex = Math.floor(step / STEPS_PER_CHORD);
    const cycle = Math.floor(chordIndex / 4);
    const progression = PROGRESSIONS[cycle % 3 === 2 ? 1 : 0];
    return progression[chordIndex % 4];
  }

  private playStep(step: number, time: number): void {
    const chord = this.chordAt(step);
    const inChord = step % STEPS_PER_CHORD;
    const inBar = step % 8;

    if (inChord === 0) {
      const duration = STEPS_PER_CHORD * EIGHTH;
      chord.pad.forEach((note) => this.pad(note, time, duration));
    }
    if (inBar === 0) this.bass(chord.bass, time, 0.11);
    if (inBar === 4) this.bass(chord.bass + 12, time, 0.05);

    const strong = inBar === 0 || inBar === 4;
    const chance = inBar === 0 ? 0.6 : strong ? 0.42 : inBar % 2 === 0 ? 0.3 : 0.18;
    if (Math.random() < chance) {
      this.degree = Math.max(0, Math.min(MELODY_SCALE.length - 1, this.degree + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      let note = MELODY_SCALE[this.degree];
      if (strong) {
        // En los tiempos fuertes, una nota del acorde suena más «en casa».
        const pcs = new Set(chord.pad.map((n) => n % 12));
        const candidates = MELODY_SCALE.filter((n) => pcs.has(n % 12));
        if (!pcs.has(note % 12) && candidates.length) {
          note = candidates.reduce((best, n) => (Math.abs(n - note) < Math.abs(best - note) ? n : best));
          this.degree = MELODY_SCALE.indexOf(note);
        }
      }
      const humanize = (Math.random() - 0.5) * 0.02;
      this.bell(note, time + humanize, strong ? 0.065 : 0.05);
    }
  }

  private pad(note: number, time: number, duration: number): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.038, time + 1.8);
    env.gain.setValueAtTime(0.038, time + duration);
    env.gain.linearRampToValueAtTime(0, time + duration + 2.4);
    env.connect(this.padIn);
    for (const detune of [-6, 5]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq(note);
      osc.detune.value = detune;
      osc.connect(env);
      osc.start(time);
      osc.stop(time + duration + 2.6);
    }
  }

  private bass(note: number, time: number, level: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq(note);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(level, time + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 1.9);
    osc.connect(env).connect(this.bus);
    osc.start(time);
    osc.stop(time + 2);
  }

  /** Nota de cajita de música: fundamental + armónico brillante que se apaga antes. */
  private bell(note: number, time: number, level: number): void {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.bus);
    out.connect(this.delaySend);
    out.connect(this.reverbSend);
    const partials: [number, number, number][] = [
      [1, level, 1.6],
      [4.01, level * 0.22, 0.35],
      [2.0, level * 0.12, 0.8],
    ];
    for (const [ratio, gain, decay] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq(note) * ratio;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, time);
      env.gain.exponentialRampToValueAtTime(gain, time + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      osc.connect(env).connect(out);
      osc.start(time);
      osc.stop(time + decay + 0.05);
    }
  }
}

/** Única instancia de la música (toda la app comparte el mismo altavoz). */
export const ambientMusic = new AmbientMusic();

export function playChime(): void {
  ambientMusic.chime();
}
