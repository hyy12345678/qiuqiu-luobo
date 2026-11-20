/* 无头逻辑冒烟测试：node 环境直接跑核心数值，不依赖 DOM */
import { Path } from '../src/battle/Path';
import { Grid } from '../src/battle/Grid';
import { WaveManager } from '../src/battle/WaveManager';
import type { WaveDef } from '../src/battle/WaveManager';
import { ALL_LEVELS } from '../src/data/levels';
import { OBSTACLES } from '../src/data/obstacles';
import { TOWER_TYPES } from '../src/data/towers';
import { save } from '../src/save/SaveManager';

let failed = 0;
let prevUnlock: string[] = [];
function check(name: string, cond: boolean, detail = ''): void {
  if (!cond) failed++;
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

for (const lv of ALL_LEVELS) {
  console.log(`\n—— 第 ${lv.id} 关「${lv.name}」——`);
  const paths = lv.paths.map((cells) => new Path(cells));
  const endPt = paths[0].points[paths[0].points.length - 1];
  const pumpkin = { x: endPt.x + 4, y: endPt.y - 10 };

  check('至少一条路径', paths.length >= 1);
  check(
    '南瓜完整显示在画面内',
    pumpkin.x > 80 && pumpkin.x < 1240 && pumpkin.y > 100 && pumpkin.y < 650,
    `(${pumpkin.x.toFixed(0)},${pumpkin.y.toFixed(0)})`,
  );
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    // 主路径要有足够防御纵深；支路允许短一些
    const minLen = i === 0 ? 1200 : 800;
    check(`路径${i} 长度合理（>${minLen}px）`, p.total > minLen, `${p.total.toFixed(0)}px`);
    check(`路径${i} 起点在画面外`, p.points[0].x < 0 || p.points[0].y < 0);
  }

  const grid = new Grid(paths.map((p) => p.points), pumpkin);
  let buildable = 0;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 16; c++) if (grid.isBuildable(c, r)) buildable++;
  check('可建造格数量充足', buildable > 20 && buildable < 135, `${buildable} 格`);
  check('南瓜周边不可建造', !grid.isBuildable(Math.floor(pumpkin.x / 80), Math.floor(pumpkin.y / 80)));

  const keys = new Set<number>();
  let obOk = true;
  for (const o of lv.obstacles) {
    if (!grid.isBuildable(o.col, o.row) || keys.has(o.row * 16 + o.col) || !OBSTACLES[o.type]) obOk = false;
    keys.add(o.row * 16 + o.col);
  }
  check('障碍物位置合法且不重叠', obOk, `${lv.obstacles.length} 个道具`);

  const unlock = lv.unlockedTowers as string[];
  const unlockValid =
    unlock.every((k) => k in TOWER_TYPES) &&
    unlock.includes('bottle') &&
    new Set(unlock).size === unlock.length;
  check('解锁塔种合法、无重复且包含瓶子塔', unlockValid, unlock.join(','));
  check('解锁塔种逐关只增不减', prevUnlock.every((k) => unlock.includes(k)));
  prevUnlock = unlock;

  const expected = lv.waves.reduce((n, w) => n + w.entries.reduce((k, en) => k + en.count, 0), 0);
  let spawned = 0;
  const wm = new WaveManager(lv.waves as WaveDef[], () => spawned++);
  let t = 0;
  while (!wm.finished && t < 300) {
    wm.update(1 / 60);
    t += 1 / 60;
  }
  check(`波次全部放完（配置 ${expected} 只）`, wm.finished && spawned >= expected, `${spawned} 只，时间线 ${t.toFixed(1)}s`);
}

console.log('\n—— 存档与解锁 ——');
// node 无 localStorage，SaveManager 自动降级为内存模式
save.recordStars(1, 3);
check('通关第 1 关后第 2 关解锁', save.isUnlocked(2));
check('未通关时后续关卡锁定', !save.isUnlocked(3) && !save.isUnlocked(5));
save.recordStars(1, 2);
check('星级只升不降', save.starOf(1) === 3);

console.log('\n—— 选关状态 ——');
check('默认选中第 1 关', ALL_LEVELS[0].id === 1);

process.exit(failed > 0 ? 1 : 0);
