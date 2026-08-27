export type ObstacleKind = 'chest' | 'crate' | 'rock';

export interface ObstacleType {
  id: ObstacleKind;
  name: string;
  hp: number;
  /** 打碎后的金币奖励 */
  reward: number;
}

/** 地图道具障碍：占着建造位，打碎掉金币并解锁格子（本作特色玩法） */
export const OBSTACLES: Record<ObstacleKind, ObstacleType> = {
  chest: { id: 'chest', name: '宝箱', hp: 150, reward: 120 },
  crate: { id: 'crate', name: '木箱', hp: 100, reward: 60 },
  rock: { id: 'rock', name: '大石头', hp: 260, reward: 50 },
};

export interface ObstacleSpawn {
  col: number;
  row: number;
  type: ObstacleKind;
}
