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

/** Lv3 分支：升到 Lv3 时二选一。数值以乘数形式叠加在 Lv3 的基础属性上 */
export interface BranchDef {
  key: 'A' | 'B';
  name: string;
  desc: string;
  dmgMul: number;
  rangeMul: number;
  cdMul: number;
  /** 多重箭的目标数（默认 3） */
  extraTargets?: number;
  /** 命中后附带的小范围溅射：半径（像素）与伤害比例 */
  splash?: { radius: number; ratio: number };
  /** 冰冻减速覆盖：速度比例与持续秒数 */
  slow?: { ratio: number; dur: number };
  /** 火箭爆炸半径乘数 */
  splashRadiusMul?: number;
}

/** 每座塔的两条分支（A 与 B）。 */
export const BRANCHES: Record<TowerKind, [BranchDef, BranchDef]> = {
  bottle: [
    { key: 'A', name: '连发', desc: '射得更快，单发稍弱', dmgMul: 0.85, rangeMul: 1, cdMul: 0.6 },
    { key: 'B', name: '大水球', desc: '砸出小水花，溅到旁边', dmgMul: 1.5, rangeMul: 1, cdMul: 1.25, splash: { radius: 46, ratio: 0.45 } },
  ],
  frost: [
    { key: 'A', name: '深冰', desc: '减速更狠，持续更久', dmgMul: 1, rangeMul: 1, cdMul: 1, slow: { ratio: 0.25, dur: 3.5 } },
    { key: 'B', name: '冰爆', desc: '命中炸开一圈冰晶', dmgMul: 1.1, rangeMul: 1, cdMul: 1.1, splash: { radius: 60, ratio: 0.5 } },
  ],
  multishot: [
    { key: 'A', name: '五连箭', desc: '一次射 5 个目标', dmgMul: 0.8, rangeMul: 1, cdMul: 1, extraTargets: 5 },
    { key: 'B', name: '重箭', desc: '每箭更痛，射得稍慢', dmgMul: 1.9, rangeMul: 1, cdMul: 1.25 },
  ],
  sunflower: [
    { key: 'A', name: '烈焰', desc: '灼烧范围更大', dmgMul: 1, rangeMul: 1.3, cdMul: 1 },
    { key: 'B', name: '强灼', desc: '伤害翻倍，节奏稍慢', dmgMul: 1.9, rangeMul: 1, cdMul: 1.2 },
  ],
  fan: [
    { key: 'A', name: '长风', desc: '风刃飞得更远', dmgMul: 1, rangeMul: 1.3, cdMul: 1 },
    { key: 'B', name: '重刃', desc: '刃更重，出手稍慢', dmgMul: 1.7, rangeMul: 1, cdMul: 1.3 },
  ],
  rocket: [
    { key: 'A', name: '连环爆', desc: '爆炸范围扩大一半', dmgMul: 1, rangeMul: 1, cdMul: 1, splashRadiusMul: 1.5 },
    { key: 'B', name: '大爆', desc: '伤害加半，装填稍慢', dmgMul: 1.5, rangeMul: 1, cdMul: 1.2 },
  ],
};

/** 从 level 升到 level+1 的费用（取整到 10） */
export function upgradeCost(base: TowerType, level: number): number {
  return Math.round((base.cost * [0.8, 1.2][level - 1]) / 10) * 10;
}
