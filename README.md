# 球球萝卜 🥕

保卫萝卜式 H5 塔防小游戏。全程序化绘制 + Web Audio 合成音效，**零素材依赖**，构建产物是单个 HTML 文件，双击即玩、随处部署。

## 玩法

怪物沿路径进攻终点的萝卜（10 点血），在路边空地建塔防守。击杀得金币 → 建塔 / 升级 / 出售；打碎地图上的宝箱木石可解锁建造位并获得赏金；撑过全部波次按剩血评 1~3 星。

- **六种塔**：瓶子速射 / 冰冻减速 / 多重箭 / 太阳花灼烧 / 风扇穿透 / 火箭溅射（均可升 3 级）
- **六种怪**：小兵、飞毛腿、铁壳、医生怪（治疗友军）、爆爆虫、Boss 萝卜巨兽
- **五个关卡**：教学关、双入口汇流、宝箱经济关、长路迷宫关、Boss 决战
- 波间倒计时时点击波次条可**提前召唤换金币**；支持 2x 倍速、暂停、切后台自动暂停

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
node /tmp/qqlb-smoke.cjs # 逻辑冒烟测试（见下）
```

冒烟测试覆盖每关的路径长度/边界、障碍物合法性、波次时间线与存档解锁逻辑：

```bash
npx esbuild scripts/smoke.ts --bundle --platform=node --format=cjs --outfile=/tmp/qqlb-smoke.cjs && node /tmp/qqlb-smoke.cjs
```

## 部署

`dist/index.html` 是自包含单文件：任意静态托管（GitHub Pages、对象存储、nginx）直接扔上去即可，无需服务端。

## 调数值

所有玩法数值都是纯数据，改完即生效：

| 内容 | 文件 |
|------|------|
| 塔属性 / 升级倍率 | `src/data/towers.ts` |
| 怪物属性 | `src/data/monsters.ts` |
| 障碍物奖励与血量 | `src/data/obstacles.ts` |
| 关卡（路径 / 金币 / 波次表） | `src/data/levels/level0*.ts` |

新增关卡：复制一个 level 文件改配置，在 `src/data/levels/index.ts` 注册即可。

## 结构速览

```
src/
├── core/       游戏循环(固定步长+倍速+暂停)、场景管理、事件总线、输入、全局设置
├── scenes/     选关菜单 / 战斗场景
├── battle/     网格、路径、波次、经济、特效 + entities/(塔/怪/子弹/障碍)
├── render/     缩放适配 Renderer、离屏地面缓存 ground、手绘精灵 sprites、装饰 decor
├── audio/      Web Audio 合成音效 + BGM
├── data/       全部数值配置
├── save/       localStorage 进度存档
└── utils/      数学工具、种子随机
```

进度（星级 / 解锁 / 静音偏好）存 localStorage，刷新不丢。
