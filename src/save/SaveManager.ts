/** 进度存档：星级记录 + 静音偏好 + 语言，localStorage 持久化（无存储环境自动降级为内存） */
import type { Lang } from '../i18n';

const KEY = 'qqlb-save-v1';

export interface SaveData {
  /** levelId -> 星级(1~3) */
  stars: Record<number, number>;
  muted: boolean;
  /** 界面语言，缺省为英文 */
  lang: Lang;
}

function loadStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

class SaveManager {
  private data: SaveData;
  private store = loadStore();

  constructor() {
    let loaded: SaveData | undefined;
    try {
      loaded = this.store ? (JSON.parse(this.store.getItem(KEY) ?? '') as SaveData) : undefined;
    } catch {
      loaded = undefined;
    }
    this.data =
      loaded && loaded.stars && typeof loaded.stars === 'object'
        ? { stars: loaded.stars, muted: !!loaded.muted, lang: loaded.lang === 'zh' ? 'zh' : 'en' }
        : { stars: {}, muted: false, lang: 'en' };
  }

  private persist(): void {
    try {
      this.store?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* 存储满或被禁用时静默降级：游戏仍可玩，只是不记忆进度 */
    }
  }

  starOf(levelId: number): number {
    return this.data.stars[levelId] ?? 0;
  }

  recordStars(levelId: number, stars: number): void {
    if (stars > this.starOf(levelId)) {
      this.data.stars[levelId] = stars;
      this.persist();
    }
  }

  isUnlocked(levelId: number): boolean {
    return levelId <= 1 || this.starOf(levelId - 1) > 0;
  }

  get muted(): boolean {
    return this.data.muted;
  }

  setMuted(m: boolean): void {
    this.data.muted = m;
    this.persist();
  }

  get lang(): Lang {
    return this.data.lang;
  }

  setLang(lang: Lang): void {
    this.data.lang = lang;
    this.persist();
  }
}

export const save = new SaveManager();
