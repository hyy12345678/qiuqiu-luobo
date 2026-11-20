export type ObstacleKind = 'chest' | 'crate' | 'rock';

import type { TKey } from '../i18n';

export interface ObstacleType {
  id: ObstacleKind;
  /** 字典键，显示时用 t() 翻译 */
  name: TKey;
  hp: number;
  /** 打碎后的金币奖励 */
  reward: number;
}

/** 地图道具障碍：占着建造位，打碎掉金币并解锁格子（本作特色玩法） */
export const OBSTACLES: Record<ObstacleKind, ObstacleType> = {
  chest: { id: 'chest', name: 'obstacle.chest', hp: 150, reward: 120 },
  crate: { id: 'crate', name: 'obstacle.crate', hp: 100, reward: 60 },
  rock: { id: 'rock', name: 'obstacle.rock', hp: 260, reward: 50 },
};

export interface ObstacleSpawn {
  col: number;
  row: number;
  type: ObstacleKind;
}
