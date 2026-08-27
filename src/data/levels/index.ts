import type { LevelDef } from './types';
import { LEVEL_1 } from './level01';
import { LEVEL_2 } from './level02';
import { LEVEL_3 } from './level03';
import { LEVEL_4 } from './level04';
import { LEVEL_5 } from './level05';

export const ALL_LEVELS: LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5];

/** 当前选中要打的关卡（选关界面设置，战斗场景读取） */
export const selection: { current: LevelDef } = { current: ALL_LEVELS[0] };
