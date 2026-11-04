import type { LevelDef } from './types';

/** 第 2 关：双溪口——两条入怪口汇流，学会分兵布防 */
export const LEVEL_2: LevelDef = {
  id: 2,
  name: '双溪口',
  startGold: 300,
  carrotHp: 10,
  unlockedTowers: ['bottle', 'frost', 'multishot'],
  paths: [
    [
      [-1, 2],
      [4, 2],
      [4, 6],
      [9, 6],
      [9, 3],
      [13, 3],
      [13, 5],
      [14.6, 5],
    ],
    [
      [11, -1],
      [11, 7],
      [13, 7],
      [13, 5],
      [14.6, 5],
    ],
  ],
  obstacles: [
    { col: 2, row: 4, type: 'crate' },
    { col: 6, row: 4, type: 'chest' },
    { col: 12, row: 0, type: 'rock' },
    { col: 6, row: 0, type: 'crate' },
    { col: 0, row: 6, type: 'rock' },
  ],
  waves: [
    { entries: [{ monster: 'grunt', count: 8, interval: 0.9, path: 0 }] },
    { entries: [{ monster: 'grunt', count: 8, interval: 0.75, path: 1 }] },
    {
      entries: [
        { monster: 'grunt', count: 10, interval: 0.65, path: 0 },
        { monster: 'runner', count: 4, interval: 1.0, delay: 3, path: 1 },
      ],
    },
    {
      entries: [
        { monster: 'tank', count: 2, interval: 2.0, path: 0 },
        { monster: 'runner', count: 6, interval: 0.7, path: 1 },
        { monster: 'healer', count: 1, interval: 1.0, delay: 6, path: 0 },
      ],
    },
    {
      entries: [
        { monster: 'grunt', count: 12, interval: 0.5, hpScale: 1.3, path: 0 },
        { monster: 'bomber', count: 5, interval: 0.8, delay: 2, path: 1 },
      ],
    },
  ],
};
