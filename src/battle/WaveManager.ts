export interface WaveEntry {
  monster: string;
  count: number;
  /** 出怪间隔（秒） */
  interval: number;
  /** 本条目延迟开怪（秒），多条目并行时错开出怪 */
  delay?: number;
  hpScale?: number;
  /** 从哪条路径进场（多路径关卡用，默认 0） */
  path?: number;
}

export interface WaveDef {
  entries: WaveEntry[];
}

interface SpawnItem {
  at: number;
  typeId: string;
  hpScale: number;
  pathIdx: number;
}

type State = 'prelude' | 'countdown' | 'spawning' | 'done';

/** 波次推进：按配置表定时出怪，管理波间倒计时 */
export class WaveManager {
  private idx = -1;
  private state: State = 'prelude';
  private queue: SpawnItem[] = [];
  private waveClock = 0;
  countdown = 3.5;

  constructor(
    private waves: WaveDef[],
    private onSpawn: (typeId: string, hpScale: number, pathIdx: number) => void,
  ) {}

  get total(): number {
    return this.waves.length;
  }

  /** 当前已开始的波（1 基） */
  get currentWave(): number {
    return this.idx + 1;
  }

  get finished(): boolean {
    return this.state === 'done';
  }

  get spawning(): boolean {
    return this.state === 'spawning';
  }

  update(dt: number): void {
    switch (this.state) {
      case 'prelude':
      case 'countdown': {
        this.countdown -= dt;
        if (this.countdown <= 0) this.startWave(this.idx + 1);
        break;
      }
      case 'spawning': {
        this.waveClock += dt;
        while (this.queue.length > 0 && this.queue[0].at <= this.waveClock) {
          const item = this.queue.shift()!;
          this.onSpawn(item.typeId, item.hpScale, item.pathIdx);
        }
        if (this.queue.length === 0) {
          if (this.idx + 1 < this.total) {
            this.state = 'countdown';
            this.countdown = 6;
          } else {
            this.state = 'done';
          }
        }
        break;
      }
      case 'done':
        break;
    }
  }

  /** 提前开下一波：返回放弃的倒计时秒数；当前不可召唤时返回 null */
  tryCallNext(): number | null {
    if (this.state !== 'prelude' && this.state !== 'countdown') return null;
    const remaining = this.countdown;
    this.startWave(this.idx + 1);
    return remaining;
  }

  private startWave(i: number): void {
    this.idx = i;
    this.waveClock = 0;
    this.queue = [];
    for (const entry of this.waves[i].entries) {
      for (let n = 0; n < entry.count; n++) {
        this.queue.push({
          at: (entry.delay ?? 0) + n * entry.interval,
          typeId: entry.monster,
          hpScale: entry.hpScale ?? 1,
          pathIdx: entry.path ?? 0,
        });
      }
    }
    this.queue.sort((a, b) => a.at - b.at);
    this.state = 'spawning';
  }
}
