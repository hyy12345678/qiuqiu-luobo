/** 全局游戏设置：场景与主循环共享的开关 */
export const settings = {
  /** 战斗倍速：1 或 2 */
  speed: 1,
  /** 暂停中：主循环跳过所有 update */
  paused: false,
};

export function resetSettings(): void {
  settings.speed = 1;
  settings.paused = false;
}
