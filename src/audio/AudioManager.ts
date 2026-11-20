import { save } from '../save/SaveManager';

export type SfxName =
  | 'click' | 'build' | 'upgrade' | 'sell'
  | 'coin' | 'die' | 'bite' | 'explode' | 'heal'
  | 'shoot_drop' | 'shoot_arrow' | 'shoot_ice' | 'shoot_rocket' | 'shoot_fan'
  | 'wave' | 'win' | 'lose';

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  /** 延迟秒 */
  at?: number;
  /** 滑向的目标频率 */
  slideTo?: number;
}

/**
 * Web Audio 程序合成音效 + 轻量 BGM（零素材方案）。
 * 浏览器要求首次用户手势后才能出声：main.ts 在首个 pointerdown 调 unlock()。
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private lastPlay = new Map<string, number>();
  private bgmTimer: ReturnType<typeof setTimeout> | null = null;
  private step = 0;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      this.startBgm();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.startBgm();
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  play(name: SfxName): void {
    if (!this.ctx || save.muted) return;
    // 同名音效节流，防止高射速时爆音
    const now = performance.now();
    if (now - (this.lastPlay.get(name) ?? 0) < 50) return;
    this.lastPlay.set(name, now);

    switch (name) {
      case 'click':
        this.tone(650, 0.05, { type: 'square', vol: 0.05 });
        break;
      case 'build':
        this.tone(220, 0.12, { type: 'triangle', vol: 0.15 });
        this.tone(440, 0.1, { type: 'triangle', vol: 0.1, at: 0.07 });
        break;
      case 'upgrade':
        [520, 660, 880].forEach((f, i) => this.tone(f, 0.09, { type: 'triangle', vol: 0.1, at: i * 0.06 }));
        break;
      case 'sell':
        this.tone(500, 0.09);
        this.tone(340, 0.12, { at: 0.08 });
        break;
      case 'coin':
        this.tone(988, 0.06, { type: 'square', vol: 0.055 });
        this.tone(1319, 0.12, { type: 'square', vol: 0.055, at: 0.05 });
        break;
      case 'die':
        this.tone(380, 0.16, { type: 'sawtooth', vol: 0.07, slideTo: 90 });
        break;
      case 'bite':
        this.noise(0.14, 0.2, 900);
        this.tone(140, 0.12, { type: 'square', vol: 0.1, slideTo: 70 });
        break;
      case 'explode':
        this.noise(0.3, 0.28, 600);
        this.tone(90, 0.25, { vol: 0.16, slideTo: 40 });
        break;
      case 'heal':
        this.tone(760, 0.12, { vol: 0.05 });
        this.tone(1014, 0.14, { vol: 0.05, at: 0.08 });
        break;
      case 'shoot_drop':
        this.tone(720, 0.07, { vol: 0.045, slideTo: 320 });
        break;
      case 'shoot_arrow':
        this.tone(1100, 0.045, { type: 'square', vol: 0.03 });
        break;
      case 'shoot_ice':
        this.tone(1250, 0.09, { type: 'triangle', vol: 0.05, slideTo: 1900 });
        break;
      case 'shoot_fan':
        this.noise(0.12, 0.05, 2500);
        break;
      case 'shoot_rocket':
        this.noise(0.18, 0.11, 800);
        this.tone(160, 0.18, { type: 'sawtooth', vol: 0.07, slideTo: 60 });
        break;
      case 'wave':
        [330, 392, 494].forEach((f, i) => this.tone(f, 0.28, { type: 'sawtooth', vol: 0.055, at: i * 0.05 }));
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.24, { type: 'triangle', vol: 0.11, at: i * 0.13 }));
        break;
      case 'lose':
        [392, 330, 262].forEach((f, i) => this.tone(f, 0.32, { type: 'triangle', vol: 0.1, at: i * 0.2 }));
        break;
    }
  }

  // ---------------- BGM：五声音阶轻快小循环 ----------------

  startBgm(): void {
    if (!this.ctx || this.bgmTimer) return;
    this.step = 0;
    this.tickBgm();
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private tickBgm(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // Am-F-G-Em 进行，88bpm 八分音符，A 小调五声音阶（夜晚氛围）
    const eighth = 60 / 88 / 2;
    const barSteps = 8;
    const roots = [110, 87.3, 98, 82.4]; // A2 F2 G2 E2
    const penta = [440, 523.3, 587.3, 659.3, 784]; // A C D E G
    const bar = Math.floor(this.step / barSteps) % 4;

    if (!save.muted) {
      // 低音铺底
      this.tone(roots[bar], eighth * 7.5, { type: 'sine', vol: 0.05 });
      // 五声音阶旋律（确定性伪随机，带休止）
      for (let i = 0; i < barSteps; i++) {
        const g = (this.step * 7 + i * 3 + bar * 5) % 11;
        if (g < 3) continue; // 休止
        this.tone(penta[g % 5], 0.22, { type: 'triangle', vol: 0.038, at: i * eighth });
      }
    }

    this.step += barSteps;
    this.bgmTimer = setTimeout(() => this.tickBgm(), eighth * barSteps * 1000 - 60);
  }

  // ---------------- 合成原语 ----------------

  private tone(freq: number, dur: number, opts: ToneOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx || save.muted) return;
    const t0 = ctx.currentTime + (opts.at ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slideTo), t0 + dur);
    gain.gain.setValueAtTime(opts.vol ?? 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(dur: number, vol: number, lowpassHz: number): void {
    const ctx = this.ctx;
    if (!ctx || save.muted) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassHz;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }
}

export const audio = new AudioManager();
