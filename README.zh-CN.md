[English](README.md) | 中文

# 球球南瓜 🎃

万圣节主题的 H5 塔防小游戏，玩法参考经典塔防。全程序化绘制 + Web Audio 合成音效，**零素材依赖**，构建产物是单个 HTML 文件，双击即玩、随处部署。

## 玩法

怪物沿路径进攻终点的南瓜（10 点血），在路边空地建塔防守。击杀得金币 → 建塔 / 升级 / 出售；打碎地图上的糖果桶、棺材和墓碑可解锁建造位并获得赏金；撑过全部波次按剩血评 1~3 星。

- **六种塔**：药剂塔速射 / 蜘蛛网减速 / 蝙蝠箭多目标 / 烛火塔灼烧 / 女巫扫帚穿透 / 南瓜炮溅射（均可升 3 级，3 级可二选一分支）
- **六种怪**：小幽灵、黑猫（快）、木乃伊（肉）、女巫（治疗友军）、炸弹南瓜（自爆、可连锁）、吸血鬼伯爵 Boss
- **五个关卡**：教学关、双入口汇流、宝箱经济关、长路迷宫关、Boss 决战。塔逐关解锁：第 1 关仅药剂塔，第 2 关加蜘蛛网与蝙蝠箭，第 3 关加烛火塔，第 4 关加女巫扫帚与南瓜炮
- 波间倒计时时点击波次条可**提前召唤换金币**；支持 2x 倍速、暂停、切后台自动暂停
- **语言**：默认英文。在主菜单右上角的按钮可切换为中文，选择会被保存

## 文档

- [docs/PROGRESS.zh-CN.md](docs/PROGRESS.zh-CN.md)：进度跟踪、验证记录、已知问题（接手先看这个）
- [docs/DEV_PLAN.zh-CN.md](docs/DEV_PLAN.zh-CN.md)：后续开发计划与待办
- [docs/ARCHITECTURE.zh-CN.md](docs/ARCHITECTURE.zh-CN.md)：架构与设计说明
- [PLAN.zh-CN.md](PLAN.zh-CN.md)：v1.0 原始规划（历史快照）

英文版见 [README.md](README.md)、[docs/](docs/) 下对应的 `.md` 文件，以及根目录的 [PLAN.md](PLAN.md)。

## 本地开发

```bash
npm install
npm run dev              # 开发服务 http://localhost:5173
npm run dev -- --host    # 开放局域网访问，手机连同一 WiFi 后真机测试
```

## 构建与检查

```bash
npm run typecheck        # TS 类型检查
npm run build            # 产出单文件 dist/index.html
npm run test:smoke       # 逻辑冒烟测试（见下）
npm run test:click       # 无头浏览器真实点击回归（需本机 Chrome，先 build）
```

冒烟测试覆盖每关的路径长度/边界、障碍物合法性、波次时间线、塔种解锁与存档解锁逻辑。

调试：在地址后加 `?debug`（如 `http://localhost:5173/?debug`）会显示左上角 FPS 标签，正式版本不显示。

`test:click` 用 puppeteer-core 驱动本机 Chrome，模拟「选关 → 点草地建塔 → 点路面不误弹面板」的真实指针交互，专门捕捉逻辑冒烟测不到的事件穿透/命中问题。也可传 URL 测线上：`node scripts/click-test.cjs https://你的域名/`。

## 部署

`dist/index.html` 是自包含单文件：任意静态托管（GitHub Pages、对象存储、nginx）直接扔上去即可，无需服务端。

## 调数值与文案

所有玩法数值都是纯数据，改完即生效：

| 内容 | 文件 |
|------|------|
| 塔属性 / 升级倍率 | `src/data/towers.ts` |
| 怪物属性 | `src/data/monsters.ts` |
| 障碍物奖励与血量 | `src/data/obstacles.ts` |
| 关卡（路径 / 金币 / 波次表） | `src/data/levels/level0*.ts` |
| 双语文案 | `src/i18n/en.ts`（键，英文）、`src/i18n/zh.ts`（中文） |

新增关卡：复制一个 level 文件改配置，在 `src/data/levels/index.ts` 注册即可，并在 `en.ts` 与 `zh.ts` 中各加入关卡名的键。冒烟测试会自动检查新关卡。

## 结构速览

```
src/
├── core/       游戏循环(固定步长+倍速+暂停)、场景管理、事件总线、输入、全局设置
├── scenes/     选关菜单 / 战斗场景
├── battle/     网格、路径、波次、经济、特效 + entities/(塔/怪/子弹/障碍)
├── render/     缩放适配 Renderer、离屏地面缓存 ground、南瓜与怪物精灵 sprites、装饰 decor
├── audio/      Web Audio 合成音效 + BGM
├── data/       全部数值与名字（名字为 i18n 键）
├── i18n/       双语文案（en.ts 定义键，zh.ts 为中文）与 t()
├── save/       localStorage 进度存档：星级 / 静音 / 语言
└── utils/      数学工具、种子随机
```

进度（星级 / 解锁 / 静音 / 语言）存 localStorage，刷新不丢。
