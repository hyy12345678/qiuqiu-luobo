import type { MonsterSkin } from '../render/sprites';

export interface MonsterType {
  id: string;
  name: string;
  hp: number;
  /** 像素/秒 */
  speed: number;
  bounty: number;
  /** 碰撞与绘制半径 */
  radius: number;
  /** 到达终点啃萝卜扣的血 */
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
    id: 'grunt', name: '果冻小兵',
    hp: 100, speed: 62, bounty: 10, radius: 23, damage: 1,
    skin: { body: '#6cc24a', dark: '#3f8f2a', kind: 'round' },
  },
  runner: {
    id: 'runner', name: '飞毛腿',
    hp: 60, speed: 112, bounty: 12, radius: 20, damage: 1,
    skin: { body: '#a97ae8', dark: '#6f47b1', kind: 'tall' },
  },
  tank: {
    id: 'tank', name: '铁壳',
    hp: 420, speed: 44, bounty: 25, radius: 28, damage: 2,
    skin: { body: '#93a8bc', dark: '#54697d', kind: 'tank' },
  },
  healer: {
    id: 'healer', name: '医生怪',
    hp: 160, speed: 58, bounty: 20, radius: 23, damage: 1,
    skin: { body: '#f2f6f4', dark: '#8fa89e', kind: 'healer' },
  },
  bomber: {
    id: 'bomber', name: '爆爆虫',
    hp: 85, speed: 92, bounty: 15, radius: 19, damage: 2,
    deathBlast: { radius: 85, damage: 50 },
    skin: { body: '#ff6b4a', dark: '#c23a22', kind: 'round' },
  },
  boss: {
    id: 'boss', name: '萝卜巨兽',
    hp: 3200, speed: 42, bounty: 200, radius: 40, damage: 3, slowResist: 0.5,
    hitStagger: { dur: 0.2, speedMul: 0.3 },
    skin: { body: '#8e5bd6', dark: '#4d2b96', kind: 'boss' },
  },
};

export function monsterById(id: string): MonsterType {
  const m = MONSTERS[id];
  if (!m) throw new Error(`未知怪物: ${id}`);
  return m;
}
