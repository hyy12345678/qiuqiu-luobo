import type { WaveDef } from '../../battle/WaveManager';
import type { ObstacleSpawn } from '../obstacles';

export interface LevelDef {
  id: number;
  name: string;
  startGold: number;
  carrotHp: number;
  /** 每条进攻路径的拐点（格子坐标）；多路径关卡怪从不同入口汇流 */
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  obstacles: ObstacleSpawn[];
  waves: WaveDef[];
}
