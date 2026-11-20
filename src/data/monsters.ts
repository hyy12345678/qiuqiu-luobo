import type { MonsterSkin } from '../render/sprites';

import type { TKey } from '../i18n';

export interface MonsterType {
  id: string;
  /** 字典键，显示时用 t() 翻译 */
  name: TKey;
  hp: number;
  /** 像素/秒 */
  speed: number;
  bounty: number;
  /** 碰撞与绘制半径 */
  radius: number;
  /** 到达终点啃南瓜扣的血 */
  damage: number;
  /** 减速抗性（0~1），Boss 用 */
  slowResist?: number;
  /** 死亡时爆炸：对半径内其他存活怪物造成伤害（可连锁） */
  deathBlast?: { radius: number; damage: number };
  /** 受击硬直：受击后 dur 秒内速度乘以 speedMul（不影响死亡判定） */
  hitStagger?: { dur: number; speedMul: number };
  skin: MonsterSkin;
}

/** 五怪 + Boss：标准 / 快速 / 肉盾 / 治疗 / 自爆冲刺 */
export const MONSTERS: Record<string, MonsterType> = {
  grunt: {
    id: 'grunt', name: 'monster.grunt',
    hp: 100, speed: 62, bounty: 10, radius: 23, damage: 1,
    skin: { body: '#d9d4f5', dark: '#8b84b8', kind: 'round' },
  },
  runner: {
    id: 'runner', name: 'monster.runner',
    hp: 60, speed: 112, bounty: 12, radius: 20, damage: 1,
    skin: { body: '#2d2433', dark: '#110b17', kind: 'tall' },
  },
  tank: {
    id: 'tank', name: 'monster.tank',
    hp: 420, speed: 44, bounty: 25, radius: 28, damage: 2,
    skin: { body: '#e9d9a6', dark: '#a88f4f', kind: 'tank' },
  },
  healer: {
    id: 'healer', name: 'monster.healer',
    hp: 160, speed: 58, bounty: 20, radius: 23, damage: 1,
    skin: { body: '#8e44ad', dark: '#4a1c63', kind: 'healer' },
  },
  bomber: {
    id: 'bomber', name: 'monster.bomber',
    hp: 85, speed: 92, bounty: 15, radius: 19, damage: 2,
    deathBlast: { radius: 85, damage: 50 },
    skin: { body: '#ff8c1a', dark: '#b34a00', kind: 'bomb' },
  },
  boss: {
    id: 'boss', name: 'monster.boss',
    hp: 3200, speed: 42, bounty: 200, radius: 40, damage: 3, slowResist: 0.5,
    hitStagger: { dur: 0.2, speedMul: 0.3 },
    skin: { body: '#4b1f5c', dark: '#1d0a26', kind: 'boss' },
  },
};

export function monsterById(id: string): MonsterType {
  const m = MONSTERS[id];
  if (!m) throw new Error(`未知怪物: ${id}`);
  return m;
}
