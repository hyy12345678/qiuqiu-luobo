import type { LevelDef } from './types';

/** 第 5 关：巨兽巢穴——关底 Boss「萝卜巨兽」登场 */
export const LEVEL_5: LevelDef = {
  id: 5,
  name: '巨兽巢穴',
  startGold: 350,
  carrotHp: 10,
  unlockedTowers: ['bottle', 'frost', 'multishot', 'sunflower', 'fan', 'rocket'],
  paths: [
    [
      [-1, 7],
      [5, 7],
      [5, 2],
      [10, 2],
      [10, 7],
      [14.6, 7],
    ],
  ],
  obstacles: [
    { col: 2, row: 5, type: 'chest' },
    { col: 7, row: 4, type: 'chest' },
    { col: 12, row: 5, type: 'crate' },
    { col: 3, row: 1, type: 'crate' },
    { col: 13, row: 1, type: 'rock' },
    { col: 7, row: 8, type: 'rock' },
  ],
  waves: [
    { entries: [{ monster: 'grunt', count: 8, interval: 0.9 }] },
    { entries: [{ monster: 'runner', count: 6, interval: 0.7 }] },
    {
      entries: [
        { monster: 'grunt', count: 10, interval: 0.55 },
        { monster: 'healer', count: 1, interval: 1.0, delay: 5 },
      ],
    },
    { entries: [{ monster: 'tank', count: 3, interval: 1.8 }] },
    {
      entries: [
        { monster: 'bomber', count: 8, interval: 0.6 },
        { monster: 'runner', count: 6, interval: 0.6, delay: 3 },
      ],
    },
    { entries: [{ monster: 'grunt', count: 16, interval: 0.45, hpScale: 1.4 }] },
    {
      entries: [
        { monster: 'tank', count: 3, interval: 1.6 },
        { monster: 'healer', count: 2, interval: 3.0, delay: 4 },
        { monster: 'runner', count: 8, interval: 0.5, delay: 1 },
      ],
    },
    {
      entries: [
        { monster: 'boss', count: 1, interval: 1.0 },
        { monster: 'bomber', count: 6, interval: 0.8, delay: 3 },
        { monster: 'healer', count: 2, interval: 3.0, delay: 6 },
      ],
    },
  ],
};
