import type { Monster } from './entities/Monster';

export interface Blast {
  radius: number;
  damage: number;
}

/**
 * 以 (x, y) 为中心，对半径内的存活怪物造成伤害，返回受影响的数量。
 * 被炸死的怪物若自带爆炸（deathBlast），会通过 monster:killed 事件再次触发，形成连锁。
 * 只处理怪物，不波及障碍物与萝卜。
 */
export function applyBlast(x: number, y: number, blast: Blast, monsters: readonly Monster[]): number {
  let hits = 0;
  for (const m of monsters) {
    if (m.dead) continue;
    if (Math.hypot(m.pos.x - x, m.pos.y - y) <= blast.radius) {
      m.takeDamage(blast.damage);
      hits++;
    }
  }
  return hits;
}
