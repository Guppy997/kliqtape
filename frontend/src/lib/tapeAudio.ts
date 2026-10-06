/**
 * Bandmaschine auf Basis der Web Audio API.
 *
 * Das Zurueckspulgeraeusch entsteht nicht aus einer Sounddatei, sondern aus dem
 * Material selbst: beim Ziehen am Regler werden laufend kurze Schnipsel des
 * Originals mit hoher Abspielrate angerissen ("granular scrubbing"). Weil
 * playbackRate Tempo UND Tonhoehe zugleich anhebt, klingt das wie ein Band,
 * das schnell am Tonkopf vorbeilaeuft. Ein Bandpassfilter nimmt Bass und
 * Hoehen weg — dadurch wird es blechern statt einfach nur schnell.
 */

const GRAIN_MS = 90; // Laenge eines Schnipsels
const GRAIN_GAP_MS = 55; // Mindestabstand zwischen zwei Schnipseln
const MIN_RATE = 1.6;
const MAX_RATE = 9;

export class TapeDeck {
  private ctx: AudioContext | null = null;
  private forward: AudioBuffer | null = null;
  private reverse: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private offset = 0;
  private lastGrain = 0;

  playing = false;

  get duration(): number {
    return this.forward?.duration ?? 0;
  }

  /** AudioContext erst bei der ersten Nutzergeste anlegen — sonst blockt der Browser. */
  private audio(): AudioContext {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  async load(url: string): Promise<void> {
    const ctx = this.audio();
    const bytes = await fetch(url).then((r) => r.arrayBuffer());
    this.forward = await ctx.decodeAudioData(bytes);

    // Rueckwaertspuffer einmal vorberechnen. Live umzudrehen waere pro
    // Schnipsel zu teuer und wuerde beim Ziehen ruckeln.
    const rev = ctx.createBuffer(this.forward.numberOfChannels, this.forward.length, this.forward.sampleRate);
    for (let c = 0; c < this.forward.numberOfChannels; c++) {
      const src = this.forward.getChannelData(c);
      const dst = rev.getChannelData(c);
      for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i]!;
    }
    this.reverse = rev;
  }

  /** Aktuelle Position in Sekunden. */
  position(): number {
    if (!this.forward) return 0;
    if (!this.playing) return this.offset;
    return Math.min(this.offset + (this.audio().currentTime - this.startedAt), this.duration);
  }

  play(onEnd?: () => void): void {
    if (!this.forward || this.playing) return;
    const ctx = this.audio();

    const src = ctx.createBufferSource();
    src.buffer = this.forward;

    // Leichte Hoehenabsenkung: eine Kassette klingt nie so offen wie die Quelle.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 11000;

    src.connect(tone).connect(ctx.destination);
    src.start(0, this.offset);

    src.onended = () => {
      if (this.source !== src) return; // durch stop() ersetzt
      this.playing = false;
      this.offset = 0;
      this.source = null;
      onEnd?.();
    };

    this.source = src;
    this.startedAt = ctx.currentTime;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.offset = this.position();
    this.stopSource();
    this.playing = false;
  }

  private stopSource(): void {
    if (!this.source) return;
    const s = this.source;
    this.source = null;
    s.onended = null;
    try {
      s.stop();
    } catch {
      /* war bereits beendet */
    }
  }

  /**
   * Position setzen und dabei das Bandgeraeusch erzeugen.
   * @param to      Zielposition in Sekunden
   * @param delta   Verschiebung seit dem letzten Aufruf (Vorzeichen = Richtung)
   */
  scrub(to: number, delta: number): void {
    if (!this.forward || !this.reverse) return;
    const ctx = this.audio();

    this.pause();
    this.offset = Math.max(0, Math.min(to, this.duration));

    if (Math.abs(delta) < 0.004) return;

    const now = performance.now();
    if (now - this.lastGrain < GRAIN_GAP_MS) return;
    this.lastGrain = now;

    const backwards = delta < 0;
    const buffer = backwards ? this.reverse : this.forward;
    // Im Rueckwaertspuffer liegt dieselbe Stelle gespiegelt.
    const start = backwards ? this.duration - this.offset : this.offset;
    const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, Math.abs(delta) * 55));

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2100;
    band.Q.value = 0.9;

    // Hart einsetzende Schnipsel knacken. Kurze Rampen an beiden Enden.
    const env = ctx.createGain();
    const t = ctx.currentTime;
    const len = GRAIN_MS / 1000;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.9, t + 0.006);
    env.gain.setValueAtTime(0.9, t + len - 0.02);
    env.gain.linearRampToValueAtTime(0, t + len);

    src.connect(band).connect(env).connect(ctx.destination);
    src.start(t, Math.max(0, Math.min(start, buffer.duration - 0.01)), len);
    src.stop(t + len);
  }

  dispose(): void {
    this.stopSource();
    void this.ctx?.close();
    this.ctx = null;
    this.forward = null;
    this.reverse = null;
  }
}

/** Welchen Aufnahme-Typ der Browser kann. Safari und Chrome sind sich hier uneinig. */
export function pickAudioMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export function pickVideoMime(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

/** 'audio/webm;codecs=opus' -> 'audio/webm', weil das Backend nur Basistypen kennt. */
export const baseMime = (mime: string) => mime.split(';')[0]!.trim();
