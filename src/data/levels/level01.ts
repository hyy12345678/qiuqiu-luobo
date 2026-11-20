import type { LevelDef } from './types';

/** 第 1 关：教学关，单条 S 路，认识基本塔与道具 */
export const LEVEL_1: LevelDef = {
  id: 1,
  name: 'level.1',
  startGold: 300,
  pumpkinHp: 10,
  unlockedTowers: ['bottle'],
  paths: [
    [
      [-1, 1],
      [3, 1],
      [3, 4],
      [8, 4],
      [8, 7],
      [12, 7],
      [12, 2],
      [14.6, 2],
    ],
  ],
  obstacles: [
    { col: 2, row: 3, type: 'chest' },
    { col: 6, row: 6, type: 'chest' },
    { col: 13, row: 3, type: 'crate' },
    { col: 9, row: 0, type: 'crate' },
    { col: 4, row: 7, type: 'rock' },
    { col: 11, row: 1, type: 'rock' },
  ],
  waves: [
    { entries: [{ monster: 'grunt', count: 8, interval: 0.95 }] },
    {
      entries: [
        { monster: 'grunt', count: 10, interval: 0.7 },
        { monster: 'runner', count: 4, interval: 1.0, delay: 4 },
      ],
    },
    {
      entries: [
        { monster: 'grunt', count: 12, interval: 0.55 },
        { monster: 'tank', count: 2, interval: 2.0, delay: 5 },
      ],
    },
    {
      entries: [
        { monster: 'runner', count: 8, interval: 0.6 },
        { monster: 'bomber', count: 6, interval: 0.9, delay: 3 },
        { monster: 'healer', count: 2, interval: 3.0, delay: 6 },
      ],
    },
  ],
};
