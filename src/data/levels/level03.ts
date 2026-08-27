import type { LevelDef } from './types';

/** 第 3 关：财宝园——遍地宝箱，靠打道具滚起经济 */
export const LEVEL_3: LevelDef = {
  id: 3,
  name: '财宝园',
  startGold: 220,
  carrotHp: 10,
  paths: [
    [
      [-1, 4],
      [3, 4],
      [3, 1],
      [7, 1],
      [7, 7],
      [11, 7],
      [11, 3],
      [14.6, 3],
    ],
  ],
  obstacles: [
    { col: 1, row: 1, type: 'chest' },
    { col: 5, row: 4, type: 'chest' },
    { col: 13, row: 1, type: 'chest' },
    { col: 9, row: 1, type: 'crate' },
    { col: 9, row: 5, type: 'crate' },
    { col: 1, row: 6, type: 'rock' },
    { col: 13, row: 6, type: 'rock' },
  ],
  waves: [
    { entries: [{ monster: 'grunt', count: 10, interval: 0.8 }] },
    {
      entries: [
        { monster: 'grunt', count: 8, interval: 0.6 },
        { monster: 'runner', count: 6, interval: 0.9, delay: 3 },
      ],
    },
    {
      entries: [
        { monster: 'tank', count: 2, interval: 1.8 },
        { monster: 'grunt', count: 10, interval: 0.55, delay: 4 },
      ],
    },
    {
      entries: [
        { monster: 'bomber', count: 6, interval: 0.7 },
        { monster: 'healer', count: 2, interval: 3.0, delay: 4 },
      ],
    },
    {
      entries: [
        { monster: 'runner', count: 10, interval: 0.45 },
        { monster: 'tank', count: 2, interval: 2.0, delay: 5 },
      ],
    },
    {
      entries: [
        { monster: 'grunt', count: 16, interval: 0.4, hpScale: 1.6 },
        { monster: 'healer', count: 2, interval: 3.0, delay: 6 },
        { monster: 'bomber', count: 6, interval: 0.8, delay: 3 },
      ],
    },
  ],
};
