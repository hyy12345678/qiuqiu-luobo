import type { LevelDef } from './types';

/** 第 4 关：回旋谷——超长蛇形路，防线纵深就是一切 */
export const LEVEL_4: LevelDef = {
  id: 4,
  name: '回旋谷',
  startGold: 260,
  carrotHp: 10,
  paths: [
    [
      [-1, 1],
      [13, 1],
      [13, 3],
      [2, 3],
      [2, 5],
      [13, 5],
      [13, 7],
      [4, 7],
    ],
  ],
  obstacles: [
    { col: 0, row: 3, type: 'chest' },
    { col: 15, row: 2, type: 'chest' },
    { col: 8, row: 2, type: 'crate' },
    { col: 8, row: 4, type: 'crate' },
    { col: 0, row: 7, type: 'rock' },
    { col: 14, row: 6, type: 'rock' },
  ],
  waves: [
    { entries: [{ monster: 'grunt', count: 10, interval: 0.7 }] },
    {
      entries: [
        { monster: 'runner', count: 8, interval: 0.6 },
        { monster: 'grunt', count: 8, interval: 0.6, delay: 4 },
      ],
    },
    { entries: [{ monster: 'tank', count: 3, interval: 1.6 }] },
    {
      entries: [
        { monster: 'healer', count: 2, interval: 3.0 },
        { monster: 'grunt', count: 12, interval: 0.5, delay: 3, hpScale: 1.3 },
      ],
    },
    {
      entries: [
        { monster: 'bomber', count: 8, interval: 0.55 },
        { monster: 'tank', count: 2, interval: 2.0, delay: 5 },
      ],
    },
    {
      entries: [
        { monster: 'runner', count: 12, interval: 0.4 },
        { monster: 'healer', count: 2, interval: 3.0, delay: 4 },
        { monster: 'grunt', count: 10, interval: 0.5, delay: 2 },
      ],
    },
    {
      entries: [
        { monster: 'tank', count: 4, interval: 1.4, hpScale: 1.5 },
        { monster: 'grunt', count: 16, interval: 0.35, delay: 4, hpScale: 1.6 },
        { monster: 'bomber', count: 8, interval: 0.6, delay: 8 },
      ],
    },
  ],
};
