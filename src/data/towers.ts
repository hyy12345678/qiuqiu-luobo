import type { TKey } from '../i18n';

export type TowerKind = 'bottle' | 'frost' | 'multishot' | 'sunflower' | 'fan' | 'rocket';

export interface TowerType {
  id: TowerKind;
  /** 字典键，显示时用 t() 翻译 */
  name: TKey;
  desc: TKey;
  cost: number;
  /** 射程（设计分辨率像素） */
  range: number;
  damage: number;
  /** 开火间隔（秒）；太阳花为灼烧 tick 间隔 */
  cooldown: number;
}

/** 六塔定案：速射 / 减速 / 多目标 / 近身灼烧 / 穿透 / 溅射 */
export const TOWER_TYPES: Record<TowerKind, TowerType> = {
  bottle: { id: 'bottle', name: 'tower.bottle.name', desc: 'tower.bottle.desc', cost: 100, range: 155, damage: 22, cooldown: 0.55 },
  frost: { id: 'frost', name: 'tower.frost.name', desc: 'tower.frost.desc', cost: 140, range: 150, damage: 12, cooldown: 0.8 },
  multishot: { id: 'multishot', name: 'tower.multishot.name', desc: 'tower.multishot.desc', cost: 160, range: 165, damage: 16, cooldown: 0.7 },
  sunflower: { id: 'sunflower', name: 'tower.sunflower.name', desc: 'tower.sunflower.desc', cost: 180, range: 115, damage: 10, cooldown: 0.5 },
  fan: { id: 'fan', name: 'tower.fan.name', desc: 'tower.fan.desc', cost: 220, range: 190, damage: 26, cooldown: 0.9 },
  rocket: { id: 'rocket', name: 'tower.rocket.name', desc: 'tower.rocket.desc', cost: 260, range: 185, damage: 55, cooldown: 1.6 },
};

/** 升级倍率表（Lv1~3）：伤害/射程/攻速 */
export const DMG_MUL = [1, 1.5, 2.25];
export const RANGE_MUL = [1, 1.12, 1.25];
export const CD_MUL = [1, 0.92, 0.85];

/** Lv3 分支：升到 Lv3 时二选一。数值以乘数形式叠加在 Lv3 的基础属性上 */
export interface BranchDef {
  key: 'A' | 'B';
  name: TKey;
  desc: TKey;
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
    { key: 'A', name: 'branch.bottle.A.name', desc: 'branch.bottle.A.desc', dmgMul: 0.85, rangeMul: 1, cdMul: 0.6 },
    { key: 'B', name: 'branch.bottle.B.name', desc: 'branch.bottle.B.desc', dmgMul: 1.5, rangeMul: 1, cdMul: 1.25, splash: { radius: 46, ratio: 0.45 } },
  ],
  frost: [
    { key: 'A', name: 'branch.frost.A.name', desc: 'branch.frost.A.desc', dmgMul: 1, rangeMul: 1, cdMul: 1, slow: { ratio: 0.25, dur: 3.5 } },
    { key: 'B', name: 'branch.frost.B.name', desc: 'branch.frost.B.desc', dmgMul: 1.1, rangeMul: 1, cdMul: 1.1, splash: { radius: 60, ratio: 0.5 } },
  ],
  multishot: [
    { key: 'A', name: 'branch.multishot.A.name', desc: 'branch.multishot.A.desc', dmgMul: 0.8, rangeMul: 1, cdMul: 1, extraTargets: 5 },
    { key: 'B', name: 'branch.multishot.B.name', desc: 'branch.multishot.B.desc', dmgMul: 1.9, rangeMul: 1, cdMul: 1.25 },
  ],
  sunflower: [
    { key: 'A', name: 'branch.sunflower.A.name', desc: 'branch.sunflower.A.desc', dmgMul: 1, rangeMul: 1.3, cdMul: 1 },
    { key: 'B', name: 'branch.sunflower.B.name', desc: 'branch.sunflower.B.desc', dmgMul: 1.9, rangeMul: 1, cdMul: 1.2 },
  ],
  fan: [
    { key: 'A', name: 'branch.fan.A.name', desc: 'branch.fan.A.desc', dmgMul: 1, rangeMul: 1.3, cdMul: 1 },
    { key: 'B', name: 'branch.fan.B.name', desc: 'branch.fan.B.desc', dmgMul: 1.7, rangeMul: 1, cdMul: 1.3 },
  ],
  rocket: [
    { key: 'A', name: 'branch.rocket.A.name', desc: 'branch.rocket.A.desc', dmgMul: 1, rangeMul: 1, cdMul: 1, splashRadiusMul: 1.5 },
    { key: 'B', name: 'branch.rocket.B.name', desc: 'branch.rocket.B.desc', dmgMul: 1.5, rangeMul: 1, cdMul: 1.2 },
  ],
};

/** 从 level 升到 level+1 的费用（取整到 10） */
export function upgradeCost(base: TowerType, level: number): number {
  return Math.round((base.cost * [0.8, 1.2][level - 1]) / 10) * 10;
}
