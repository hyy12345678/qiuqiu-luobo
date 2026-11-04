# 球球萝卜 · 架构与设计文档

> 描述当前代码的实际实现（基线 commit `723a02b`，2026-11-04 核对）。
> 原始玩法规划见 [`PLAN.md`](../PLAN.md)；两者不一致之处见 [PROGRESS.md 第五节](./PROGRESS.md#五文档与代码偏差)。

---

## 一、技术栈

| 项 | 实际选型 |
|----|----------|
| 语言 | TypeScript 5.9（`strict`，`noUnusedLocals`） |
| 构建 | Vite 7 + `vite-plugin-singlefile`，产物为单个 `dist/index.html`（约 70 KB，gzip 后约 22 KB） |
| 渲染 | 原生 Canvas 2D，全部程序化绘制，无图片/音频素材 |
| UI | DOM 覆盖层（`#ui-root`），按钮、面板、HUD 都是 DOM 元素 |
| 音频 | Web Audio API 合成音效与 BGM |
| 存档 | localStorage，键名 `qqlb-save-v1` |
| 测试 | `scripts/smoke.ts`（Node 逻辑冒烟）、`scripts/click-test.cjs`（puppeteer-core 驱动本机 Chrome） |

运行时没有任何框架和第三方运行时依赖。`puppeteer-core` 只用于回归脚本。

---

## 二、目录结构

```
index.html              页面骨架：#stage > canvas#game-canvas + #ui-root，内联 CSS
src/
├── main.ts             入口：装配 Renderer / SceneManager / Input / Game，注册全局音频解锁
├── core/
│   ├── Game.ts         固定步长主循环，倍速、暂停、切后台，并绘制 FPS 调试标签
│   ├── SceneManager.ts 场景注册与切换；切换时清空 #ui-root
│   ├── Input.ts        pointerdown/up 识别「点击」，换算成设计坐标
│   ├── EventBus.ts     全局事件总线（单例 bus）
│   └── settings.ts     全局可变状态：speed（1/2）、paused
├── scenes/
│   ├── MenuScene.ts    选关界面（Canvas 画背景 + DOM 关卡卡片）
│   └── BattleScene.ts  战斗场景：状态、更新、渲染、HUD、建造/塔面板、暂停与结算
├── battle/
│   ├── Path.ts         格子坐标拐点 → 像素折线，按里程取位置
│   ├── Grid.ts         16×9 建造网格，计算哪些格子不可建
│   ├── WaveManager.ts  波次时间线、波间倒计时、提前召唤
│   ├── Economy.ts      金币收支
│   ├── effects.ts      飘字、烟雾等短时特效
│   ├── explode.ts      爆爆虫死亡爆炸的范围伤害（纯函数，便于验证）
│   ├── target.ts       CombatTarget 接口（怪物与障碍共用）
│   └── entities/
│       ├── Tower.ts    六种塔的索敌、开火、三级成长与绘制
│       ├── Bullet.ts   追踪弹（Bullet）与穿透风刃（FanBlade）
│       ├── Monster.ts  沿路径行进的怪物：减速、治疗目标、血条
│       └── Obstacle.ts 地图道具（宝箱/木箱/石头）
├── data/               全部玩法数值（纯 TS 对象，无 JSON）
│   ├── towers.ts       六塔属性与升级倍率
│   ├── monsters.ts     六种怪（五怪 + Boss）属性与外观
│   ├── obstacles.ts    三种道具的血量与奖励
│   └── levels/         level01~05.ts + types.ts（LevelDef）+ index.ts（ALL_LEVELS、selection）
├── render/
│   ├── Renderer.ts     设计分辨率 1280×720 的 letterbox 缩放、DPR 封顶 2
│   ├── ground.ts       地面离屏缓存（草地、路面、装饰）
│   ├── sprites.ts      萝卜、怪物、障碍物的手绘函数
│   └── decor.ts        云、花、草丛、圆角矩形等装饰与工具
├── audio/AudioManager.ts  合成音效（SfxName 枚举）与 BGM 定时器
├── save/SaveManager.ts    星级记录与静音偏好
└── utils/              math.ts（点到折线距离等）、rng.ts（种子随机）
scripts/
├── smoke.ts            逻辑冒烟：路径、网格、障碍、波次时长、存档解锁
└── click-test.cjs      真实点击回归：选关 → 点草地建塔 → 点路面不弹面板
```

---

## 三、运行时架构

### 3.1 启动流程

1. `main.ts` 获取 DOM 节点，注册 `pointerdown` 解锁音频、`visibilitychange` 停/续 BGM。
2. 创建 `Renderer`（设置 canvas 尺寸）、`SceneManager`、`Input`。
3. 注册 `MenuScene` 与 `BattleScene`，切到 `menu`。
4. `Input.onTap` 把设计坐标交给 `scenes.current.onTap`。
5. `Game.start()` 启动 rAF 循环。

### 3.2 主循环（`Game.tick`）

- rAF 的时间差上限 250 ms，防止切后台后一次补太多帧。
- 逻辑更新采用固定步长 `1/60 s` 的累加器，每帧最多补 12 步。倍速 = 时间差 × `settings.speed`。
- 暂停（`settings.paused`）时跳过 `update`，但仍会 `render`。
- 每帧调用 `scene.render(ctx)` 后，若 URL 带 `?debug`，绘制左上角 FPS 标签。正式访问不显示。

### 3.3 场景接口

```ts
interface Scene {
  readonly name: string;
  enter(): void;     // 建 DOM、订阅事件
  exit(): void;      // 取消订阅（SceneManager 会清空 #ui-root）
  update(dt: number): void;   // 固定步长
  render(ctx): void;          // 每帧，设计坐标系
  onTap?(x, y): void;
}
```

`SceneManager.reloadCurrent()` 用于「再来一局」和「下一关」：先 `exit` 再 `enter`，战斗状态全部重建。

### 3.4 坐标与缩放

- 逻辑全部使用设计坐标 **1280×720**。
- `Renderer.resize` 计算 `scale = min(窗口宽/1280, 窗口高/720)`，canvas 物理像素 = CSS 尺寸 × `min(dpr, 2)`。
- `Input` 点击时用 `getBoundingClientRect` 和 `scale` 换算回设计坐标。
- DOM UI 的字号随 `scale` 缩放（`stage.style.fontSize = 16 × scale`）。

### 3.5 事件总线

| 事件 | 发出方 | 订阅方 | 作用 |
|------|--------|--------|------|
| `monster:killed` | `Monster.takeDamage` | `BattleScene` | 加赏金、飘字、音效 |
| `monster:escaped` | `Monster.update` | `BattleScene` | 萝卜扣血，血量 ≤ 0 判负 |
| `app:paused` | `Game`（切后台） | `BattleScene` | 弹出暂停面板 |

事件总线只用于战斗内部通知。塔、子弹、障碍物之间的直接调用仍然通过 `TowerContext` 回调完成。

---

## 四、战斗系统

### 4.1 战斗一帧的 update 顺序（`BattleScene.update`）

1. `WaveManager.update`：按时间线把怪物推入 `monsters`，波次变化时显示横幅。
2. 所有怪物 `update`（推进里程、更新位置，到终点时发出 `escaped`）。
3. 医生怪治疗光环：每 2.5 s 给 90 px 内血量未满的其他怪回血 25。
4. 过滤已死亡的怪物。
5. 所有塔 `update`，塔可以向 `projectiles` 添加子弹。
6. 所有子弹 `update`，命中后移除。
7. 障碍物：受击闪光衰减，死亡时结算奖励并移除。
8. 特效、震动、横幅计时；刷新波次条。
9. 胜负判定：波次结束且场上无怪 → 胜利。

### 4.2 地图与建造规则

- 网格 16 列 × 9 行，格子 80 px。
- 格子不可建的条件：
  - 中心点到任一路径折线的距离 < 58 px，或
  - 中心点到萝卜的距离 < 95 px。
- 障碍物所在格子在它存在期间不可建。障碍被打碎后，该格只要不在路上就变为可建。这是隐式解锁，没有单独的解锁状态。
- 关卡数据里的障碍物位置由 `smoke.ts` 检查：必须落在可建格上，且不重叠。

### 4.3 塔（`data/towers.ts`、`entities/Tower.ts`）

| 塔 | 造价 | 射程 | 伤害 | 冷却（秒） | 行为 |
|----|------|------|------|------------|------|
| 瓶子塔 `bottle` | 100 | 155 | 22 | 0.55 | 单体追踪弹 |
| 冰冻星 `frost` | 140 | 150 | 12 | 0.8 | 追踪弹，命中减速 40% 持续 2 s |
| 多重箭 `multishot` | 160 | 165 | 16 | 0.7 | 同时攻击前 3 个目标 |
| 太阳花 `sunflower` | 180 | 115 | 10 | 0.5 | 无弹道，周期灼烧范围内所有目标 |
| 风扇塔 `fan` | 220 | 190 | 26 | 0.9 | 直线风刃，穿透路径上的目标，每个目标只伤一次 |
| 火箭塔 `rocket` | 260 | 185 | 55 | 1.6 | 追踪弹，落点溅射（半径 62 + 8×等级，伤害 70%） |

- **索敌**：怪物优先，按「走得最远」排序。没有怪物时，才攻击射程内最近的障碍物。
- **升级**：伤害 ×[1, 1.5, 2.25]，射程 ×[1, 1.12, 1.25]，冷却 ×[1, 0.92, 0.85]。升级费用为 `round(造价 × 0.8 或 1.2, 取整到 10)`。
- **出售**：返还累计投入（`invested`）的 70%。
- **建造流程**：点击空地后，建造面板列出本关 `unlockedTowers` 中的塔种。点选某个塔种会更新射程预览（虚线圆）和确认按钮上的费用，再点「建造」才扣费放置。金币不足时确认按钮禁用。
- **逐关解锁**：第 1 关仅瓶子塔；第 2 关加冰冻星、多重箭；第 3 关加太阳花；第 4、5 关加风扇、火箭。多重箭的解锁关是本文档的假设，PLAN 未明确（见 PROGRESS 第五节）。

### 4.4 怪物（`data/monsters.ts`）

| 怪 | 血量 | 速度（px/s） | 赏金 | 啃萝卜伤害 | 备注 |
|----|------|------|------|------|------|
| 果冻小兵 `grunt` | 100 | 62 | 10 | 1 | |
| 飞毛腿 `runner` | 60 | 112 | 12 | 1 | |
| 铁壳 `tank` | 420 | 44 | 25 | 2 | |
| 医生怪 `healer` | 160 | 58 | 20 | 1 | 每 2.5 s 治疗光环 |
| 爆爆虫 `bomber` | 85 | 92 | 15 | 2 | 死亡时爆炸：半径 85，伤害 50，可连锁（v1.2） |
| 萝卜巨兽 `boss` | 3200 | 42 | 200 | 3 | 减速抗性 0.5；受击硬直 0.2 秒，期间速度降为 30%，并轻微压扁（v1.2） |

- 波次表中的 `hpScale` 会按比例放大血量。
- 怪物沿路径匀速移动。减速比率在 `applySlow` 中按抗性折算。

### 4.5 道具障碍（`data/obstacles.ts`）

| 道具 | 血量 | 打碎奖励 |
|------|------|------|
| 宝箱 `chest` | 150 | 120 |
| 木箱 `crate` | 100 | 60 |
| 大石头 `rock` | 260 | 50 |

道具会挡住塔的建造位。塔在没有怪物时才会攻击道具。

### 4.6 经济、萝卜与星级

- 起始金币：220~350（每关不同）。击杀奖励等于怪物赏金。
- 萝卜血量：全部关卡为 10。
- 星级：通关后剩余血量 ≥ 8 得 3 星，≥ 4 得 2 星，否则 1 星。只升不降。
- 提前召唤：`bonus = ceil(min(剩余倒计时, 6) × 10)`。

### 4.7 波次时间线（`WaveManager`）

- 状态机：`prelude`（开局）→ `spawning`（出怪）→ `countdown`（波间）→ … → `done`。
- 首波前倒计时 3.5 s，波间倒计时 6 s。
- 每个 `WaveEntry` 在 `delay + n × interval` 秒出怪。同一波内的条目按时间排序。
- 可用 `path` 字段指定入口路径（双入口关卡使用）。

---

## 五、数据格式

### 5.1 关卡（`LevelDef`，`data/levels/types.ts`）

```ts
interface LevelDef {
  id: number;                 // 1 起，用于存档键与解锁判断
  name: string;
  startGold: number;
  carrotHp: number;
  unlockedTowers: TowerKind[];  // 本关可建造的塔种，必须包含 'bottle'，逐关只增不减
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;  // 格子坐标拐点，多条即多入口
  obstacles: Array<{ col: number; row: number; type: 'chest' | 'crate' | 'rock' }>;
  waves: WaveDef[];           // { entries: [{ monster, count, interval, delay?, hpScale?, path? }] }
}
```

新增关卡的步骤：复制一个 `levelNN.ts`，改配置，在 `data/levels/index.ts` 的 `ALL_LEVELS` 里注册。`smoke.ts` 会自动检查新关卡。

### 5.2 存档（`SaveManager`）

```json
{ "stars": { "1": 3, "2": 1 }, "muted": false }
```

存储键为 `qqlb-save-v1`。如果存储不可用，会自动降级为内存模式。关卡 N 的解锁条件是：关卡 N−1 的星级 > 0。

---

## 六、渲染与音频

- **地面**：`buildGround` 生成离屏 canvas 并按关卡缓存，每帧只 `drawImage` 一次。
- **实体**：怪物、塔、障碍、萝卜、子弹、特效每帧直接绘制。怪物和障碍按 y 坐标排序以获得遮挡关系。
- **HUD**：金币、波次、速度、静音、暂停都是 DOM 元素。`refreshHud` 在金币变化时更新。
- **音频**：`AudioManager` 在首次 `pointerdown` 时解锁 AudioContext。BGM 在切后台时停止。音效共 17 种（`SfxName`），全部由 Web Audio 合成。

---

## 七、已知的设计取舍

- **不做寻路**：怪物沿固定拐点行进，没有 A\*。
- **不做对象池**：子弹、飘字、特效每次都 `new`。PLAN 原定要池化，目前未做（见 DEV_PLAN T-09）。
- **不做碰撞体**：索敌用距离判断，风刃用圆形距离判断。
- **数值集中在 `data/`**：调数值不需要改逻辑代码。
- **零素材**：所有图形都是运行时绘制，没有图片文件。
