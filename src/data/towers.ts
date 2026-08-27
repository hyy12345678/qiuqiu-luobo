export type TowerKind = 'bottle' | 'frost' | 'multishot' | 'sunflower' | 'fan' | 'rocket';

export interface TowerType {
  id: TowerKind;
  name: string;
  desc: string;
  cost: number;
  /** 射程（设计分辨率像素） */
  range: number;
  damage: number;
  /** 开火间隔（秒）；太阳花为灼烧 tick 间隔 */
  cooldown: number;
}

/** 六塔定案：速射 / 减速 / 多目标 / 近身灼烧 / 穿透 / 溅射 */
export const TOWER_TYPES: Record<TowerKind, TowerType> = {
  bottle: { id: 'bottle', name: '瓶子塔', desc: '快速单体攻击', cost: 100, range: 155, damage: 22, cooldown: 0.55 },
  frost: { id: 'frost', name: '冰冻星', desc: '命中减速敌人', cost: 140, range: 150, damage: 12, cooldown: 0.8 },
  multishot: { id: 'multishot', name: '多重箭', desc: '同时攻击 3 个目标', cost: 160, range: 165, damage: 16, cooldown: 0.7 },
  sunflower: { id: 'sunflower', name: '太阳花', desc: '持续灼烧周围一圈', cost: 180, range: 115, damage: 10, cooldown: 0.5 },
  fan: { id: 'fan', name: '风扇塔', desc: '直线穿透所有敌人', cost: 220, range: 190, damage: 26, cooldown: 0.9 },
  rocket: { id: 'rocket', name: '火箭塔', desc: '高伤范围爆炸', cost: 260, range: 185, damage: 55, cooldown: 1.6 },
};

/** 升级倍率表（Lv1~3）：伤害/射程/攻速 */
export const DMG_MUL = [1, 1.5, 2.25];
export const RANGE_MUL = [1, 1.12, 1.25];
export const CD_MUL = [1, 0.92, 0.85];

/** 从 level 升到 level+1 的费用（取整到 10） */
export function upgradeCost(base: TowerType, level: number): number {
  return Math.round((base.cost * [0.8, 1.2][level - 1]) / 10) * 10;
}
