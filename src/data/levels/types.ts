import type { WaveDef } from '../../battle/WaveManager';
import type { ObstacleSpawn } from '../obstacles';
import type { TowerKind } from '../towers';

export interface LevelDef {
  id: number;
  name: string;
  startGold: number;
  carrotHp: number;
  /** 本关可建造的塔种（逐关解锁，见 PLAN 3.5）；必须包含 bottle */
  unlockedTowers: TowerKind[];
  /** 每条进攻路径的拐点（格子坐标）；多路径关卡怪从不同入口汇流 */
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  obstacles: ObstacleSpawn[];
  waves: WaveDef[];
}
