/**
 * 六座塔的万圣节造型（程序化绘制）。
 *
 * - 药剂塔 bottle：三爪铁坩埚，冒泡的毒药水，锅身上是一张大眼脸
 * - 蜘蛛网 frost：两根枯木桩之间拉着蛛网，毛茸茸的大蜘蛛蹲在网心
 * - 蝙蝠箭 multishot：枯树枝上倒挂的吸血蝙蝠，开火时猛地张开双翼
 * - 烛火塔 sunflower：头骨烛台，紫蜡烛融化流下头盖骨，眼窝里有余烬
 * - 女巫扫帚 fan：活的女巫帽，帽檐下一双发光的眼睛，身后飘着扫帚
 * - 南瓜炮 rocket：怒脸南瓜灯，头顶装一门铁臼炮，开火时炮口喷火
 *
 * 所有函数在本地坐标中绘制：原点为格子中心，塔脚落在 y=+12（塔座顶面约 y=+11）。
 * 调用方负责投影、等级缩放与 save/restore。渐变定义在本地坐标并按画布缓存，
 * 同类塔共用同一批渐变对象，每帧不新建。
 */
import type { TowerKind } from '../data/towers';

const TAU = Math.PI * 2;
/** 统一描边色：深紫黑 */
const INK = '#1b1026';

export type TowerMood = 'happy' | 'blink' | 'excited';
export type BranchKey = 'A' | 'B' | null;

export interface TowerArtState {
  /** 1..3 */
  level: number;
  branch: BranchKey;
  /** 开火动画 1 → 0 */
  fire: number;
  /** 持续递增的秒数，驱动待机动画 */
  t: number;
  mood: TowerMood;
  /** 朝目标的水平偏向 -1..1（没有目标时回到 0） */
  lean: number;
  /** 烛火塔灼烧脉冲 1 → 0 */
  pulse: number;
}

/** 每种塔（及 Lv3 分支）的属性色：地面光晕、符文、灵火都用它 */
const ACCENT: Record<TowerKind, [base: string, a: string, b: string]> = {
  bottle: ['#8dff5a', '#c6ff3a', '#c86bff'],
  frost: ['#c08cff', '#7fe7ff', '#e0a0ff'],
  multishot: ['#ff5a5a', '#ff6b6b', '#ffb02e'],
  sunflower: ['#ffa53a', '#ff6a2a', '#5fb8ff'],
  fan: ['#5ee6c8', '#5ee6c8', '#ff5fa2'],
  rocket: ['#ff8a1a', '#ffb02e', '#ff4a3a'],
};

export function towerAccent(kind: TowerKind, branch: BranchKey): string {
  const c = ACCENT[kind];
  return branch === 'A' ? c[1] : branch === 'B' ? c[2] : c[0];
}

export function drawTowerArt(ctx: CanvasRenderingContext2D, kind: TowerKind, s: TowerArtState): void {
  const accent = towerAccent(kind, s.branch);
  if (s.level >= 3) {
    // 塔身后面一道淡淡的光柱
    ctx.globalAlpha = 0.28 + Math.sin(s.t * 2.4) * 0.06;
    glowEllipse(ctx, 0, -34, 24, 52, hexRgb(accent));
    ctx.globalAlpha = 1;
    drawWisps(ctx, s, accent, false);
  }
  switch (kind) {
    case 'bottle': drawCauldron(ctx, s); break;
    case 'frost': drawSpider(ctx, s); break;
    case 'multishot': drawBatRoost(ctx, s); break;
    case 'sunflower': drawSkullCandles(ctx, s); break;
    case 'fan': drawWitchHat(ctx, s); break;
    case 'rocket': drawPumpkinMortar(ctx, s); break;
  }
  if (s.level >= 3) drawWisps(ctx, s, accent, true);
}

// ================= 塔座（地面层） =================

/**
 * 塔座：裂纹墓石圆台。Lv2 刻一圈发光符文并镶铁边，Lv3 换金边、符文呼吸闪烁。
 * 在 enterGround 之后、本地坐标中调用（原点为格子中心）。
 */
export function drawTowerPlinth(
  ctx: CanvasRenderingContext2D,
  level: number,
  accent: string,
  t: number,
): void {
  const rgb = hexRgb(accent);
  // 投影：月光在左上，影子向右下拉长、边缘虚化；塔座正下方再压一圈接触暗部
  softShadow(ctx, 10, 26, 50, 19, 0.55);
  softShadow(ctx, 0, 20, 38, 14, 0.5);
  // 等级光晕
  if (level >= 2) {
    ctx.globalAlpha = level >= 3 ? 0.6 + Math.sin(t * 2.4) * 0.12 : 0.38;
    glow(ctx, 0, 14, 64, rgb);
    ctx.globalAlpha = 1;
  }
  // 侧面（厚度）
  ctx.fillStyle = '#272130';
  ctx.beginPath();
  ctx.ellipse(0, 18, 35, 13.5, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = level >= 3 ? '#e8b93c' : level === 2 ? '#8d849c' : INK;
  ctx.stroke();
  // 顶面
  ctx.fillStyle = cached(ctx, 'plinthTop', () => {
    const g = ctx.createRadialGradient(-8, 8, 2, 0, 12, 32);
    g.addColorStop(0, '#7a7189');
    g.addColorStop(1, '#4a4257');
    return g;
  });
  ctx.beginPath();
  ctx.ellipse(0, 13, 31, 11, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,30,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 裂纹与苔点
  ctx.strokeStyle = '#3a3346';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-22, 9); ctx.lineTo(-15, 12); ctx.lineTo(-17, 16);
  ctx.moveTo(14, 18); ctx.lineTo(19, 14); ctx.lineTo(25, 15);
  ctx.stroke();
  ctx.fillStyle = 'rgba(110,150,70,0.55)';
  ctx.beginPath();
  ctx.ellipse(-24, 15, 4, 2, 0, 0, TAU);
  ctx.ellipse(21, 9, 3, 1.6, 0, 0, TAU);
  ctx.fill();

  // 符文环
  if (level >= 2) {
    const a = level >= 3 ? 0.75 + Math.sin(t * 3) * 0.25 : 0.7;
    ctx.strokeStyle = `rgba(${rgb},${a})`;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * TAU + 0.2;
      const px = Math.cos(ang) * 27;
      const py = 13 + Math.sin(ang) * 9.4;
      ctx.beginPath();
      // 简单的符文：竖线 + 斜钩，奇偶交替
      ctx.moveTo(px, py - 2.2);
      ctx.lineTo(px, py + 2.2);
      ctx.moveTo(px, py - (i % 2 ? 1 : -1) * 1.4);
      ctx.lineTo(px + 2, py - (i % 2 ? 1 : -1) * 2.6);
      ctx.stroke();
    }
  }

  // 等级宝石
  for (let i = 0; i < level; i++) {
    const px = (i - (level - 1) / 2) * 11;
    const py = 28;
    ctx.fillStyle = accent;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, py - 4.5);
    ctx.lineTo(px + 3.6, py);
    ctx.lineTo(px, py + 4.5);
    ctx.lineTo(px - 3.6, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(px - 1, py - 1.5, 1, 0, TAU);
    ctx.fill();
  }
}

/**
 * 塔身发光部件投在塔座和草地上的光（加色混合）。随火焰闪烁、开火时一亮。
 * 与 drawTowerPlinth 一样在地面坐标中调用，放在塔座之后。
 */
export function drawTowerGroundLight(ctx: CanvasRenderingContext2D, kind: TowerKind, s: TowerArtState): void {
  const { t, fire: f, pulse, branch } = s;
  let rgb: string;
  let a: number;
  let r: number;
  switch (kind) {
    case 'bottle':
      rgb = (branch === 'A' ? BREW_LIME : branch === 'B' ? BREW_PURPLE : BREW_GREEN).rgb;
      a = 0.42 + Math.sin(t * 3) * 0.06 + f * 0.5;
      r = 48;
      break;
    case 'sunflower':
      rgb = candleFlameRgb(branch);
      a = 0.5 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.05 + pulse * 0.55 + (s.level - 1) * 0.08;
      r = 58;
      break;
    case 'rocket':
      rgb = '255,170,50';
      a = 0.32 + Math.sin(t * 6) * 0.04 + f * 0.9;
      r = 50 + f * 14;
      break;
    case 'frost':
      rgb = hexRgb(towerAccent(kind, branch));
      a = 0.2 + f * 0.4;
      r = 40;
      break;
    case 'fan':
      rgb = branch === 'A' ? '94,230,200' : branch === 'B' ? '255,95,162' : '255,224,102';
      a = 0.18 + f * 0.45;
      r = 40;
      break;
    default:
      rgb = branch === 'B' ? '255,210,58' : '255,74,74';
      a = 0.16 + f * 0.35;
      r = 36;
  }
  ctx.globalAlpha = Math.min(1, a);
  glow(ctx, 0, 12, r, rgb);
  ctx.globalAlpha = 1;
}

// ================= 药剂塔：三爪坩埚 =================

interface Brew { hi: string; mid: string; lo: string; rgb: string }
const BREW_GREEN: Brew = { hi: '#d4ff8a', mid: '#7dff4a', lo: '#2a9e2a', rgb: '125,255,74' };
const BREW_LIME: Brew = { hi: '#f4ffb0', mid: '#c6ff3a', lo: '#6aa800', rgb: '198,255,58' };
const BREW_PURPLE: Brew = { hi: '#f0c8ff', mid: '#c86bff', lo: '#6a2aa8', rgb: '200,107,255' };

function drawCauldron(ctx: CanvasRenderingContext2D, s: TowerArtState): void {
  const { t, fire: f, level, branch, mood, lean } = s;
  const brew = branch === 'A' ? BREW_LIME : branch === 'B' ? BREW_PURPLE : BREW_GREEN;

  // 锅口上方的药水荧光
  ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.08 + f * 0.4;
  glow(ctx, 0, -26, 34, brew.rgb);
  ctx.globalAlpha = 1;

  // 三只弯爪脚（中间那只在锅后，只露爪尖）
  ctx.fillStyle = '#2a2136';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 11, 2);
    ctx.lineTo(side * 19, 0);
    ctx.quadraticCurveTo(side * 21, 7, side * 24, 12);
    ctx.lineTo(side * 15, 12);
    ctx.quadraticCurveTo(side * 15, 7, side * 10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#e8dcc0';
  for (const side of [-1, 1]) {
    for (const k of [0, 1]) {
      const cx = side * (16 + k * 5);
      ctx.beginPath();
      ctx.moveTo(cx - 2, 11);
      ctx.lineTo(cx + side * 1.5, 14.5);
      ctx.lineTo(cx + 2, 11);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 锅身
  const potPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-21, -20);
    ctx.bezierCurveTo(-32, -10, -28, 9, 0, 9.5);
    ctx.bezierCurveTo(28, 9, 32, -10, 21, -20);
    ctx.closePath();
  };
  potPath();
  ctx.fillStyle = cached(ctx, 'cauldronIron', () => {
    const g = ctx.createRadialGradient(-10, -12, 2, 0, -6, 32);
    g.addColorStop(0, '#76688e');
    g.addColorStop(0.5, '#3d3350');
    g.addColorStop(1, '#1c1526');
    return g;
  });
  ctx.fill();
  shade(ctx, potPath, 'pot', -30, -20, 30, 10, 0.5, false);
  potPath();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = INK;
  ctx.stroke();

  ctx.save();
  potPath();
  ctx.clip();
  // 药水从上方映在锅身上的绿光
  ctx.globalAlpha = 0.45 + f * 0.3;
  glow(ctx, 0, -24, 22, brew.rgb);
  ctx.globalAlpha = 1;
  // Lv2 铁箍 / Lv3 金箍
  if (level >= 2) {
    const gold = level >= 3;
    ctx.fillStyle = gold ? '#c99a2e' : '#544a68';
    ctx.fillRect(-30, -1, 60, 4.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-30, -1, 60, 4.5);
    ctx.fillStyle = gold ? '#ffe08a' : '#a99cc2';
    for (const rx of [-19, -10, 10, 19]) {
      ctx.beginPath();
      ctx.arc(rx, 1.25, 1.3, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  // 左侧高光
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.ellipse(-17, -6, 2.6, 7, 0.35, 0, TAU);
  ctx.fill();

  // 脸：白眼仁 + 会看向目标的瞳孔
  const eyeY = -8;
  for (const side of [-1, 1]) {
    const ex = side * 8.5;
    if (mood === 'blink') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - 4.5, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + 3, ex + 4.5, eyeY);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#fffdf4';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 5.2, 6.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const pr = mood === 'excited' ? 2.3 : 3;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + lean * 1.8, eyeY - 0.6, pr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + lean * 1.8 - 1, eyeY - 1.8, 1, 0, TAU);
    ctx.fill();
    if (mood === 'excited') {
      // 怒眉
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - side * 5.5, eyeY - 8.5);
      ctx.lineTo(ex + side * 4.5, eyeY - 5.5);
      ctx.stroke();
    }
  }
  if (mood === 'excited') {
    // 张嘴吼：深色口腔 + 一颗尖牙
    ctx.fillStyle = '#2a0f1f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.quadraticCurveTo(0, -1.5, 7, 0);
    ctx.quadraticCurveTo(0, 9, -7, 0);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 0.5);
    ctx.quadraticCurveTo(0, 6.5, 7, 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath();
  ctx.moveTo(2, 2.4);
  ctx.lineTo(3.4, 5.6);
  ctx.lineTo(4.8, 2.1);
  ctx.closePath();
  ctx.fill();

  // 锅沿：粗铁环
  ctx.fillStyle = '#4f4463';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, -21, 23.5, 6.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // 药水面
  ctx.fillStyle = brew.mid;
  ctx.beginPath();
  ctx.ellipse(0, -21.8, 19, 4.2, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = brew.lo;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = brew.hi;
  ctx.beginPath();
  ctx.ellipse(-5, -22.6, 8, 1.5, 0, 0, TAU);
  ctx.fill();
  // 锅沿前缘高光
  ctx.strokeStyle = '#8b7da6';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, -21, 22, 5.4, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // 溢出锅沿的药水滴
  for (const [dx, ph] of [[-13, 0], [10, 2.1]] as const) {
    const len = 4 + Math.sin(t * 1.4 + ph) * 1.8;
    ctx.fillStyle = brew.mid;
    ctx.strokeStyle = brew.lo;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dx - 3, -17);
    ctx.lineTo(dx - 2.4, -15 + len);
    ctx.arc(dx, -15 + len, 2.4, Math.PI, 0, true);
    ctx.lineTo(dx + 3, -17);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Lv3：药水里斜插两根骨头
  if (level >= 3) {
    drawBone(ctx, -9, -21, -15, -35, 1.8);
    drawBone(ctx, 7, -21, 14, -33, 1.6);
  }

  // 气泡：上浮、变小、破掉
  const n = 3 + (level >= 2 ? 1 : 0) + (branch === 'A' ? 2 : 0);
  const speed = branch === 'A' ? 0.9 : 0.55;
  for (let i = 0; i < n; i++) {
    const p = (t * speed + i / n) % 1;
    const bx = Math.sin(i * 12.9 + 1) * 12 * (1 - p * 0.4);
    const by = -23 - p * 18;
    const br = (1.6 + (i % 3) * 0.9) * (1 - p * 0.45);
    ctx.globalAlpha = p > 0.82 ? (1 - p) / 0.18 : 1;
    bubble(ctx, bx, by, br, brew);
  }
  ctx.globalAlpha = 1;
  // B 分支：一个大泡慢慢鼓起
  if (branch === 'B') {
    const p = (t * 0.4) % 1;
    bubble(ctx, 4, -25 - p * 5, 3 + p * 5, brew);
  }

  // 开火：药水从锅里喷出
  if (f > 0.05) {
    ctx.fillStyle = brew.mid;
    ctx.strokeStyle = brew.lo;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6, -22);
    ctx.quadraticCurveTo(-4, -30 - f * 8, 0, -32 - f * 12);
    ctx.quadraticCurveTo(4, -30 - f * 8, 6, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    bubble(ctx, -8 * f, -36 - f * 10, 2.5, brew);
    bubble(ctx, 7 * f, -34 - f * 8, 2, brew);
  }
}

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, brew: Brew): void {
  ctx.fillStyle = brew.hi;
  ctx.strokeStyle = brew.lo;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU);
  ctx.fill();
}

/** 骨头：两端各两个圆疙瘩 */
function drawBone(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, r: number): void {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const nx = -Math.sin(ang) * r;
  const ny = Math.cos(ang) * r;
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 2 + 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x2 + nx, y2 + ny, r * 1.15 + 1.2, 0, TAU);
  ctx.arc(x2 - nx, y2 - ny, r * 1.15 + 1.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#f1e9d6';
  ctx.lineWidth = r * 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.fillStyle = '#f1e9d6';
  ctx.beginPath();
  ctx.arc(x2 + nx, y2 + ny, r * 1.15, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x2 - nx, y2 - ny, r * 1.15, 0, TAU);
  ctx.fill();
}

// ================= 蜘蛛网：网心大蜘蛛 =================

function drawSpider(ctx: CanvasRenderingContext2D, s: TowerArtState): void {
  const { t, fire: f, level, branch, mood, lean } = s;
  const accent = towerAccent('frost', branch);
  const silk = branch === 'A' ? 'rgba(200,245,255,0.85)' : 'rgba(236,228,255,0.8)';
  const cx = 0;
  const cy = -26;

  ctx.globalAlpha = 0.28 + f * 0.3;
  glow(ctx, cx, cy, 34, hexRgb(accent));
  ctx.globalAlpha = 1;

  // 两根歪扭的枯木桩
  for (const side of [-1, 1]) {
    const x0 = side * 27;
    const pts: Array<[number, number]> = [[x0, 11], [x0 + side * 1.5, -10], [x0 - side * 1, -32], [x0 + side * 2.5, -52]];
    for (const [w, c] of [[7.5, INK], [4.6, '#6b5240']] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.moveTo(x0 + side * 0.5, -40);
      ctx.lineTo(x0 + side * 8, -47);
      ctx.stroke();
    }
    // 木纹
    ctx.strokeStyle = '#4a3828';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 - 0.5, -2);
    ctx.lineTo(x0 + 0.5, -14);
    ctx.stroke();
  }

  // 蛛网：顶线 + 九根辐射丝 + 三圈下垂的横丝
  const ends: Array<[number, number]> = [
    [-26, -48], [-26, -28], [-26, -7], [-10, 9], [10, 9], [26, -7], [26, -28], [26, -48], [0, -46],
  ];
  // 按角度排序，横丝依次连接
  ends.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  ctx.strokeStyle = silk;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-27, -50);
  ctx.quadraticCurveTo(0, -43, 27, -50);
  for (const [ex, ey] of ends) {
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
  }
  for (const k of [0.32, 0.58, 0.84]) {
    for (let i = 0; i < ends.length; i++) {
      const a = ends[i];
      const b = ends[(i + 1) % ends.length];
      const ax = cx + (a[0] - cx) * k, ay = cy + (a[1] - cy) * k;
      const bx = cx + (b[0] - cx) * k, by = cy + (b[1] - cy) * k;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx + (mx - cx) * 0.8, cy + (my - cy) * 0.8, bx, by);
    }
  }
  ctx.stroke();

  // 网上的露珠（A：冰晶，B：紫水晶）
  if (level >= 2) {
    const gem = branch === 'B' ? '#e0a0ff' : branch === 'A' ? '#c8f6ff' : 'rgba(255,255,255,0.85)';
    ctx.fillStyle = gem;
    for (const [dx, dy] of [[-15, -40], [17, -14], [-18, -4], [12, -42]] as const) {
      if (branch) {
        ctx.beginPath();
        ctx.moveTo(dx, dy - 3.5);
        ctx.lineTo(dx + 2, dy);
        ctx.lineTo(dx, dy + 3.5);
        ctx.lineTo(dx - 2, dy);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(dx, dy, 1.4, 0, TAU);
        ctx.fill();
      }
    }
  }
  // A 分支：顶线挂冰锥
  if (branch === 'A') {
    ctx.fillStyle = '#c8f6ff';
    ctx.strokeStyle = '#5db4e8';
    ctx.lineWidth = 1;
    for (const [ix, h] of [[-18, 7], [-8, 5], [6, 8], [17, 5]] as const) {
      const iy = -47.5 + Math.abs(ix) * 0.1;
      ctx.beginPath();
      ctx.moveTo(ix - 2, iy);
      ctx.lineTo(ix, iy + h);
      ctx.lineTo(ix + 2, iy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // Lv2 起：右桩挂一个蛛丝茧
  if (level >= 2) {
    const sway = Math.sin(t * 1.3) * 0.12;
    ctx.save();
    ctx.translate(25, -36);
    ctx.rotate(sway);
    ctx.strokeStyle = silk;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.fillStyle = '#ece4f6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 14, 4, 7, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b3a6c8';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const yy of [10, 13, 16, 19]) {
      ctx.moveTo(-3.5, yy);
      ctx.lineTo(3.5, yy + 1.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- 蜘蛛 ----
  const rear = f * 4;
  const sy = cy - rear;
  // 八条腿：髋 → 膝（高）→ 脚（落在网上）
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const hipX = side * 5;
      const hipY = sy + 1 + i * 2.2;
      const twitch = Math.sin(t * 5 + i * 1.7 + side) * 1.1;
      const spread = 1 + f * 0.12;
      const kneeX = side * (13 + i * 1.8) * spread;
      const kneeY = sy - 11 + i * 7 + twitch;
      const footX = side * (21 - i * 0.6) * spread;
      const footY = cy - 18 + i * 13 + (i === 3 ? 4 : 0);
      for (const [w, c] of [[3.8, INK], [1.5, '#5b4778']] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
      }
    }
  }
  // 腹部（在头后面，略高）：毛边
  fuzzyBlob(ctx, 0, sy - 10, 12.5, 11.5, 20, 1.8, 'spiderAbd', -4, -16);
  // 腹背花纹：Lv2 起是发光的骷髅纹
  if (level >= 2) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, sy - 13, 3.4, 0, TAU);
    ctx.fill();
    ctx.fillRect(-1.8, sy - 11, 3.6, 2.6);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-1.3, sy - 13.3, 0.9, 0, TAU);
    ctx.arc(1.3, sy - 13.3, 0.9, 0, TAU);
    ctx.fill();
  }
  // B 分支：腹背长出紫水晶刺
  if (branch === 'B') {
    ctx.fillStyle = '#e0a0ff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    for (const [px, h, a] of [[-7, 8, -0.5], [0, 10, 0], [7, 8, 0.5]] as const) {
      ctx.save();
      ctx.translate(px, sy - 19);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-2.5, 2);
      ctx.lineTo(0, -h);
      ctx.lineTo(2.5, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  // 头
  fuzzyBlob(ctx, 0, sy + 2, 10, 9, 16, 1.5, 'spiderHead', -3, -2);
  // 眼睛：两只大的 + 四只小的
  const eyeRgb = hexRgb(accent);
  ctx.globalAlpha = 0.6;
  glow(ctx, 0, sy, 12, eyeRgb);
  ctx.globalAlpha = 1;
  for (const side of [-1, 1]) {
    glowEye(ctx, side * 4.4, sy + 1, 4, accent, mood, side, lean);
  }
  ctx.fillStyle = accent;
  for (const [ex, ey] of [[-6.5, -4.5], [-2.3, -6], [2.3, -6], [6.5, -4.5]] as const) {
    ctx.beginPath();
    ctx.arc(ex, sy + ey, mood === 'blink' ? 0.6 : 1.3, 0, TAU);
    ctx.fill();
  }
  // 獠牙：开火时张开
  const open = mood === 'excited' ? 1.6 : 0;
  ctx.fillStyle = '#fffdf4';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 1.2, sy + 6.5);
    ctx.quadraticCurveTo(side * (4 + open), sy + 8, side * (2.2 + open), sy + 11.5);
    ctx.lineTo(side * 3.6, sy + 6.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** 毛茸茸的椭圆：边缘一圈锯齿，径向渐变着色（渐变按 key 缓存） */
function fuzzyBlob(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number,
  n: number, fuzz: number, key: string, hx: number, hy: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  const path = (): void => {
    ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAU;
      const k = i % 2 === 0 ? 1 : 1 + fuzz / Math.min(rx, ry);
      const px = Math.cos(a) * rx * k;
      const py = Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  path();
  ctx.fillStyle = cached(ctx, key, () => {
    const g = ctx.createRadialGradient(hx * 0.4, hy * 0.25 - ry * 0.3, 1, 0, 0, Math.max(rx, ry) * 1.15);
    g.addColorStop(0, '#5d4682');
    g.addColorStop(0.55, '#2e2142');
    g.addColorStop(1, '#160e20');
    return g;
  });
  ctx.fill();
  shade(ctx, path, key, -rx - fuzz, -ry - fuzz, rx + fuzz, ry + fuzz, 0.45);
  path();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

// ================= 蝙蝠箭：倒挂的吸血蝙蝠 =================

function drawBatRoost(ctx: CanvasRenderingContext2D, s: TowerArtState): void {
  const { t, fire: f, level, branch, mood, lean } = s;

  // 枯树干（左侧）
  const treePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-31, 12);
    ctx.quadraticCurveTo(-25, 6, -25, -6);
    ctx.quadraticCurveTo(-27, -28, -23, -48);
    ctx.lineTo(-25, -60);
    ctx.lineTo(-19, -54);
    ctx.quadraticCurveTo(-4, -61, 14, -58);
    ctx.lineTo(19, -66);
    ctx.lineTo(20, -58);
    ctx.quadraticCurveTo(26, -58, 31, -55);
    ctx.quadraticCurveTo(10, -52, -15, -48);
    ctx.quadraticCurveTo(-18, -26, -15, -6);
    ctx.quadraticCurveTo(-14, 6, -7, 12);
    ctx.closePath();
  };
  treePath();
  ctx.fillStyle = cached(ctx, 'batTree', () => {
    const g = ctx.createLinearGradient(-30, 0, -10, 0);
    g.addColorStop(0, '#3a2c28');
    g.addColorStop(0.5, '#62493c');
    g.addColorStop(1, '#3a2c28');
    return g;
  });
  ctx.fill();
  shade(ctx, treePath, 'tree', -31, -66, 31, 12, 0.4);
  treePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // 树皮纹 + 树洞
  ctx.strokeStyle = '#2a1f1c';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-22, 4); ctx.quadraticCurveTo(-21, -6, -22, -14);
  ctx.moveTo(-19, -32); ctx.lineTo(-20, -42);
  ctx.moveTo(-6, -55); ctx.lineTo(6, -56);
  ctx.stroke();
  ctx.fillStyle = '#120a14';
  ctx.beginPath();
  ctx.ellipse(-20.5, -22, 2.4, 3.6, 0, 0, TAU);
  ctx.fill();

  // 箭袋：绑在树干上，箭数随分支变化
  const arrows = branch === 'A' ? 5 : branch === 'B' ? 2 : 3;
  ctx.save();
  ctx.translate(-20, -6);
  ctx.rotate(-0.18);
  for (let i = 0; i < arrows; i++) {
    const ax = (i - (arrows - 1) / 2) * (branch === 'B' ? 4.5 : 2.6);
    const heavy = branch === 'B';
    ctx.strokeStyle = '#e8dcc8';
    ctx.lineWidth = heavy ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(ax, -6);
    ctx.lineTo(ax, -17);
    ctx.stroke();
    ctx.fillStyle = heavy ? '#ffb02e' : '#d8364a';
    ctx.beginPath();
    ctx.moveTo(ax, -21);
    ctx.lineTo(ax - (heavy ? 3 : 2), -14);
    ctx.lineTo(ax + (heavy ? 3 : 2), -14);
    ctx.closePath();
    ctx.fill();
  }
  roundRect(ctx, -6, -8, 12, 17, 3);
  ctx.fillStyle = '#7a4a2a';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = '#c99a2e';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-6, -4); ctx.lineTo(6, -4);
  ctx.moveTo(-6, 4); ctx.lineTo(6, 4);
  ctx.stroke();
  ctx.restore();

  // 小伙伴：Lv2 起在枝头多一只，A 分支再多一只（多目标的意象）
  const open = Math.min(1, f * 1.4);
  if (level >= 2) bat(ctx, 25, -56, 0.55, t + 1.3, Math.min(1, open * 1.2), mood, lean, false);
  if (branch === 'A') bat(ctx, -11, -51, 0.52, t + 2.6, open, mood, lean, false);
  // 主角
  const sc = branch === 'B' ? 1.22 : 1.1;
  bat(ctx, 3, -57, sc, t, open, mood, lean, branch === 'B');
}

/**
 * 一只倒挂的蝙蝠。(x, y) 为爪子抓住树枝的位置，身体向下垂。
 * open 0 为双翼裹身，1 为完全张开。
 */
function bat(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sc: number, t: number, open: number,
  mood: TowerMood, lean: number, vampire: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.6) * 0.07 - lean * 0.12 * (1 - open));
  ctx.scale(sc, sc);

  // 爪子
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(side * 2.5, 6);
    ctx.lineTo(side * 2.5, 1);
    ctx.quadraticCurveTo(side * 2.5, -2, side * 0.5, -1.5);
  }
  ctx.stroke();

  const wingFill = '#33204a';
  const lining = vampire ? '#8a1f3a' : '#4a2f64';
  const drawWings = (): void => {
    for (const side of [-1, 1]) {
      // 三个指尖：闭合时贴着身体，张开时向外展开
      const tip = (cx: number, cy: number, ox: number, oy: number): [number, number] =>
        [side * (cx + (ox - cx) * open), cy + (oy - cy) * open];
      const sh: [number, number] = [side * 5, 6];
      const t1 = tip(10, 5, 34, -3);
      const t2 = tip(12, 17, 33, 14);
      const t3 = tip(9.5, 30, 21, 30);
      const end: [number, number] = [side * 4, 30];
      ctx.beginPath();
      ctx.moveTo(sh[0], sh[1]);
      ctx.lineTo(t1[0], t1[1]);
      // 翼膜下缘是向内凹的扇贝边
      const scallop = (a: [number, number], b: [number, number]): void => {
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        ctx.quadraticCurveTo(mx - side * (4 + open * 3), my, b[0], b[1]);
      };
      scallop(t1, t2);
      scallop(t2, t3);
      scallop(t3, end);
      ctx.closePath();
      ctx.fillStyle = open > 0.3 ? lining : wingFill;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
      // 翼骨
      ctx.strokeStyle = open > 0.3 ? '#1f1230' : '#4a3466';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const p of [t1, t2, t3]) {
        ctx.moveTo(sh[0], sh[1]);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }
  };

  const body = (): void => {
    ctx.beginPath();
    ctx.ellipse(0, 17, 8.5, 13.5, 0, 0, TAU);
    ctx.fillStyle = '#4a3068';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#7a58a0';
    ctx.beginPath();
    ctx.ellipse(0, 20, 4.5, 8, 0, 0, TAU);
    ctx.fill();
  };
  // 张开时翼在身后；裹身时翼在身前
  if (open > 0.4) { drawWings(); body(); } else { body(); drawWings(); }

  // 头：在下方，按正常朝向画好后整体上下翻转
  ctx.save();
  ctx.translate(0, 35);
  ctx.scale(1.18, -1.18);
  // 耳朵（翻转后朝下）
  ctx.fillStyle = '#3a2550';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 2.5, -6);
    ctx.lineTo(side * 9.5, -15);
    ctx.lineTo(side * 8.5, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c4607a';
    ctx.beginPath();
    ctx.moveTo(side * 4.5, -6.5);
    ctx.lineTo(side * 8.5, -12);
    ctx.lineTo(side * 7.8, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a2550';
  }
  ctx.beginPath();
  ctx.arc(0, 0, 8.5, 0, TAU);
  ctx.fillStyle = '#5a3a7c';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // 眼：红光（吸血鬼分支是金光）
  const eye = vampire ? '#ffd23a' : '#ff4a4a';
  ctx.globalAlpha = 0.55;
  glow(ctx, 0, -1, 11, hexRgb(eye));
  ctx.globalAlpha = 1;
  for (const side of [-1, 1]) glowEye(ctx, side * 3.6, -1, 2.6, eye, mood === 'excited' ? 'happy' : mood, side, lean * (-1));
  // 鼻子 + 两颗獠牙
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, 2.6, 1.4, 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fffdf4';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.6, 4.5);
    ctx.lineTo(side * 1.8, 8 + (mood === 'excited' ? 1.2 : 0));
    ctx.lineTo(side * 3, 4.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3.5, 4.4);
  ctx.quadraticCurveTo(0, 5.6, 3.5, 4.4);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ================= 烛火塔：头骨烛台 =================

interface Flame { outer: string; mid: string; core: string; rgb: string; scale: number }
const FLAME_ORANGE: Flame = { outer: '#ff7a1a', mid: '#ffb23a', core: '#fff1a8', rgb: '255,150,40', scale: 1 };
const FLAME_BLAZE: Flame = { outer: '#ff3d1a', mid: '#ff8a1a', core: '#ffe27a', rgb: '255,100,30', scale: 1.35 };
const FLAME_BLUE: Flame = { outer: '#2f7bff', mid: '#6fc8ff', core: '#f4fdff', rgb: '90,170,255', scale: 1.1 };

/** 烛火颜色（地面脉冲环也用它） */
export function candleFlameRgb(branch: BranchKey): string {
  return branch === 'A' ? FLAME_BLAZE.rgb : branch === 'B' ? FLAME_BLUE.rgb : FLAME_ORANGE.rgb;
}

/** 每级的蜡烛：x、底部 y（落在头盖骨上）、高、宽 */
const CANDLES: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number]>> = [
  [[0, -27.5, 15, 10]],
  [[-7.5, -26, 11, 8.5], [6.5, -27, 17, 9.5]],
  [[-11, -23.5, 9, 8], [1, -28, 18, 10], [11.5, -23.5, 12, 8]],
];

function drawSkullCandles(ctx: CanvasRenderingContext2D, s: TowerArtState): void {
  const { t, level, branch, mood, pulse } = s;
  const flame = branch === 'A' ? FLAME_BLAZE : branch === 'B' ? FLAME_BLUE : FLAME_ORANGE;
  const heat = pulse;

  // 头盖骨被烛光照亮的暖光
  ctx.globalAlpha = 0.35 + heat * 0.4;
  glow(ctx, 0, -30, 38, flame.rgb);
  ctx.globalAlpha = 1;

  // 头骨：头盖骨 + 下颌一笔连成的轮廓
  const skullPath = (): void => {
    ctx.beginPath();
    ctx.arc(0, -12, 17, Math.PI * 0.78, Math.PI * 2.22);
    ctx.lineTo(10.5, 4);
    ctx.quadraticCurveTo(10.5, 11, 4, 11);
    ctx.lineTo(-4, 11);
    ctx.quadraticCurveTo(-10.5, 11, -10.5, 4);
    ctx.closePath();
  };
  skullPath();
  ctx.fillStyle = cached(ctx, 'skullBone', () => {
    const g = ctx.createRadialGradient(-5, -19, 2, 0, -8, 26);
    g.addColorStop(0, '#fffaf0');
    g.addColorStop(0.6, '#e6d9bc');
    g.addColorStop(1, '#a8977a');
    return g;
  });
  ctx.fill();
  shade(ctx, skullPath, 'skull', -17, -29, 17, 11, 0.42);
  // 头盖骨左上的一点高光
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-8, -22, 3.2, 1.8, -0.6, 0, TAU);
  ctx.fill();
  skullPath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // 颧骨阴影
  ctx.fillStyle = 'rgba(120,100,80,0.35)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 11, -1, 3, 4.5, side * 0.3, 0, TAU);
    ctx.fill();
  }
  // 裂纹
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-13, -21); ctx.lineTo(-10, -18); ctx.lineTo(-12, -15); ctx.lineTo(-9, -13);
  ctx.stroke();
  // 牙齿
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-7.5, 5.5);
  ctx.quadraticCurveTo(0, 7, 7.5, 5.5);
  for (const tx of [-4.5, -1.5, 1.5, 4.5]) {
    ctx.moveTo(tx, 2.6);
    ctx.lineTo(tx, 9.5);
  }
  ctx.stroke();
  // 鼻孔：倒心形
  ctx.fillStyle = '#2a1420';
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.quadraticCurveTo(-3.6, -2.5, -1.4, -4.4);
  ctx.quadraticCurveTo(0, -3.6, 0, -2.6);
  ctx.quadraticCurveTo(0, -3.6, 1.4, -4.4);
  ctx.quadraticCurveTo(3.6, -2.5, 0, 0.5);
  ctx.fill();
  // 眼窝 + 余烬瞳孔
  for (const side of [-1, 1]) {
    const ex = side * 6.8;
    const ey = -9.5;
    ctx.fillStyle = '#2a1420';
    ctx.beginPath();
    if (mood === 'excited' || heat > 0.3) {
      // 怒：内眼角压低
      ctx.moveTo(ex - side * 5, ey - 1);
      ctx.lineTo(ex + side * 5.4, ey - 6.5);
      ctx.quadraticCurveTo(ex + side * 6.5, ey + 5.5, ex, ey + 5.8);
      ctx.quadraticCurveTo(ex - side * 6, ey + 5, ex - side * 5, ey - 1);
    } else {
      ctx.ellipse(ex, ey, 5.4, 6, 0, 0, TAU);
    }
    ctx.fill();
    if (mood !== 'blink') {
      const pr = 1.8 + heat * 1.2;
      ctx.globalAlpha = 0.7;
      glow(ctx, ex, ey + 0.5, 7 + heat * 4, flame.rgb);
      ctx.globalAlpha = 1;
      ctx.fillStyle = flame.core;
      ctx.beginPath();
      ctx.arc(ex + s.lean * 1.2, ey + 0.8, pr, 0, TAU);
      ctx.fill();
    }
  }

  // 烛光打在头盖骨顶上，跟着火焰一起闪
  ctx.globalAlpha = 0.28 + heat * 0.35 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.04;
  glowEllipse(ctx, 0, -25, 18, 9, flame.rgb);
  ctx.globalAlpha = 1;

  // 蜡烛：紫蜡、蜡油流到头骨上、火焰摇曳
  const list = CANDLES[level - 1];
  list.forEach(([cx, base, h, w], i) => {
    const top = base - h;
    // 头盖骨上的一摊蜡
    ctx.fillStyle = '#7b4bb0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, base + 0.5, w * 0.8, 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // 蜡身：平移到蜡烛中心，让缓存的横向渐变对齐每根蜡烛
    ctx.save();
    ctx.translate(cx, 0);
    roundRect(ctx, -w / 2, top, w, h + 0.5, 2);
    ctx.fillStyle = cached(ctx, 'wax', () => {
      const g = ctx.createLinearGradient(-5, 0, 5, 0);
      g.addColorStop(0, '#9b6fd0');
      g.addColorStop(0.45, '#7b4bb0');
      g.addColorStop(1, '#4a2878');
      return g;
    });
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    // 顶部融化的蜡沿 + 两道蜡泪
    ctx.fillStyle = '#b08ae0';
    ctx.beginPath();
    ctx.ellipse(cx, top + 0.8, w / 2 - 0.6, 1.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9b6fd0';
    for (const [dx, len] of [[-w * 0.3, h * 0.55 + 2], [w * 0.28, h * 0.8 + 5]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + dx - 1.4, top + 1);
      ctx.lineTo(cx + dx - 1.2, top + len);
      ctx.arc(cx + dx, top + len, 1.3, Math.PI, 0, true);
      ctx.lineTo(cx + dx + 1.4, top + 1);
      ctx.closePath();
      ctx.fill();
    }
    // 灯芯
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + 0.5, top - 3);
    ctx.stroke();
    // 火焰
    const k = flame.scale * (1 + Math.sin(t * 13 + i * 2) * 0.07 + heat * 0.45);
    const sway = Math.sin(t * 7 + i * 1.3) * 1.3;
    const fy = top - 2.5;
    ctx.globalAlpha = 0.75 + heat * 0.25;
    glow(ctx, cx, fy - 5 * k, 16 * k, flame.rgb);
    ctx.globalAlpha = 1;
    flameShape(ctx, cx, fy, 5.2 * k, 13 * k, sway, flame.outer);
    flameShape(ctx, cx, fy, 3.4 * k, 8.5 * k, sway * 0.7, flame.mid);
    flameShape(ctx, cx, fy, 1.8 * k, 4.5 * k, sway * 0.4, flame.core);
  });

  // A 分支：火星往上飘
  if (branch === 'A') {
    ctx.fillStyle = '#ffd23a';
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.7 + i / 4) % 1;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.arc(Math.sin(i * 7.7 + p * 5) * 10, -44 - p * 22, 1.4 * (1 - p * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** 水滴形火焰：(x, y) 为底部中心，w 为半宽，h 为高，sway 使火尖左右摆 */
function flameShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sway: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + sway, y - h);
  ctx.bezierCurveTo(x + w * 0.4 + sway * 0.5, y - h * 0.6, x + w * 1.1, y - h * 0.35, x + w * 0.9, y - h * 0.12);
  ctx.quadraticCurveTo(x + w * 0.7, y + h * 0.12, x, y + h * 0.12);
  ctx.quadraticCurveTo(x - w * 0.7, y + h * 0.12, x - w * 0.9, y - h * 0.12);
  ctx.bezierCurveTo(x - w * 1.1, y - h * 0.35, x - w * 0.4 + sway * 0.5, y - h * 0.6, x + sway, y - h);
  ctx.closePath();
  ctx.fill();
}

// ================= 女巫扫帚：活的女巫帽 =================

function drawWitchHat(ctx: CanvasRenderingContext2D, s: TowerArtState): void {
  const { t, fire: f, level, branch, mood, lean } = s;
  const bob = Math.sin(t * 2.2) * 1.5;
  const swipe = f * (lean >= 0 ? 1 : -1);

  // A 分支：后半圈旋风
  if (branch === 'A') windRibbons(ctx, t, false);

  // 扫帚：悬在帽子后面，随呼吸上下浮动，开火时扫向目标一侧
  ctx.save();
  ctx.translate(0, -24 + bob);
  ctx.rotate(-0.5 + swipe * 0.55);
  // 柄
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(30, 0);
  ctx.stroke();
  ctx.strokeStyle = '#9a6a3c';
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.strokeStyle = '#c4935e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-20, -0.8);
  ctx.lineTo(26, -0.8);
  ctx.stroke();
  // 扫帚头
  const hot = branch === 'B';
  if (hot) {
    ctx.globalAlpha = 0.6;
    glow(ctx, -40, 0, 18, '255,95,162');
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.moveTo(-26, -3.5);
  ctx.quadraticCurveTo(-38, -10, -48, -10);
  ctx.quadraticCurveTo(-52, 0, -48, 10);
  ctx.quadraticCurveTo(-38, 10, -26, 3.5);
  ctx.closePath();
  ctx.fillStyle = hot ? '#ff7ab8' : '#e0b04e';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = hot ? '#c22a6e' : '#a8782a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const k of [-6, -2.5, 1, 4.5]) {
    ctx.moveTo(-28, k * 0.4);
    ctx.lineTo(-47, k * 1.6);
  }
  ctx.stroke();
  // 绑绳
  ctx.fillStyle = '#6b3fa0';
  roundRect(ctx, -29, -4.5, 5, 9, 1.5);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // 帽子整体朝目标侧倾斜
  ctx.save();
  ctx.translate(0, 8);
  ctx.rotate(lean * 0.1 + swipe * 0.1);
  ctx.translate(0, -8);

  // 帽檐
  const brimPath = (): void => {
    ctx.beginPath();
    ctx.ellipse(0, 6, 29, 8.5, 0, 0, TAU);
  };
  brimPath();
  ctx.fillStyle = '#25163a';
  ctx.fill();
  shade(ctx, brimPath, 'brim', -29, -2.5, 29, 14.5, 0.35);
  brimPath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = '#3a2558';
  ctx.beginPath();
  ctx.ellipse(0, 4.6, 27, 6.4, 0, 0, TAU);
  ctx.fill();
  // B 分支：帽檐一圈尖钉
  if (branch === 'B') {
    ctx.fillStyle = '#c9c0d8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    for (const a of [0.35, 0.65, 1.0, 2.15, 2.5, 2.8]) {
      const px = Math.cos(a) * 26;
      const py = 6 + Math.sin(a) * 7.6;
      ctx.beginPath();
      ctx.moveTo(px - 1.8, py);
      ctx.lineTo(px + Math.cos(a) * 3, py + 3.5);
      ctx.lineTo(px + 1.8, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 帽身：歪着的尖锥，帽尖向一侧耷拉，随时间轻轻晃
  const flop = Math.sin(t * 1.8) * 1.6 - lean * 2;
  const conePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-15.5, 4);
    ctx.bezierCurveTo(-13, -16, -8, -34, -3, -45);
    ctx.quadraticCurveTo(2 + flop * 0.3, -53, 11 + flop, -51);
    ctx.quadraticCurveTo(17 + flop, -50, 19 + flop, -44 + flop * 0.3);
    ctx.quadraticCurveTo(12 + flop * 0.6, -47, 7, -42);
    ctx.bezierCurveTo(10, -28, 13, -12, 15.5, 4);
    ctx.closePath();
  };
  conePath();
  ctx.fillStyle = cached(ctx, 'hatCone', () => {
    const g = ctx.createLinearGradient(-16, 0, 16, 0);
    g.addColorStop(0, '#3e2764');
    g.addColorStop(0.32, '#6e48a8');
    g.addColorStop(1, '#271640');
    return g;
  });
  ctx.fill();
  shade(ctx, conePath, 'cone', -16, -53, 20, 4, 0.4);
  conePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.save();
  conePath();
  ctx.clip();
  // 帽带
  ctx.fillStyle = branch === 'B' ? '#d83a5a' : '#ff8a1f';
  ctx.fillRect(-20, -5, 40, 7);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-20, -5, 40, 7);
  // 补丁 + 针脚
  ctx.save();
  ctx.translate(6.5, -29);
  ctx.rotate(0.3);
  ctx.fillStyle = '#8a6ab8';
  ctx.fillRect(-3.5, -3.5, 7, 7);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const k of [-2, 0, 2]) {
    ctx.moveTo(-4.5, k); ctx.lineTo(-2.5, k + 0.6);
    ctx.moveTo(2.5, k); ctx.lineTo(4.5, k + 0.6);
  }
  ctx.stroke();
  ctx.restore();
  // 帽身褶皱
  ctx.strokeStyle = 'rgba(20,10,35,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-8, -32); ctx.quadraticCurveTo(-3, -34, 1, -32);
  ctx.stroke();
  // Lv2 起：金色小星星
  if (level >= 2) {
    ctx.fillStyle = '#ffd54a';
    star(ctx, -6, -37, 2.2);
    star(ctx, -9, -24, 1.6);
  }
  ctx.restore();

  // 帽扣：Lv2 起金扣，B 分支是小骷髅
  if (level >= 2) {
    if (branch === 'B') {
      ctx.fillStyle = '#f1e9d6';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, -2.4, 3.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(-1.2, -2.6, 0.9, 0, TAU);
      ctx.arc(1.2, -2.6, 0.9, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.6;
      ctx.strokeRect(-4, -5.5, 8, 6.5);
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 2;
      ctx.strokeRect(-4, -5.5, 8, 6.5);
    }
  }

  // 脸：帽身上一双发光的眼睛，褶皱成眉
  const eyeY = -16;
  const eyeCol = '#ffe066';
  ctx.globalAlpha = 0.5 + f * 0.4;
  glow(ctx, 0, eyeY, 14, '255,224,102');
  ctx.globalAlpha = 1;
  for (const side of [-1, 1]) {
    glowEye(ctx, side * 5.4, eyeY, 3.3, eyeCol, mood, side, lean);
    // 眉
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'excited') {
      ctx.moveTo(side * 9, eyeY - 6.5);
      ctx.lineTo(side * 2.2, eyeY - 3.8);
    } else {
      ctx.moveTo(side * 8.5, eyeY - 4.8);
      ctx.quadraticCurveTo(side * 5.5, eyeY - 6.8, side * 2.5, eyeY - 5.2);
    }
    ctx.stroke();
  }
  // 嘴：褶皱笑 / 开火时张口
  if (mood === 'excited') {
    ctx.fillStyle = '#12081c';
    ctx.beginPath();
    ctx.moveTo(-7, -9.5);
    ctx.quadraticCurveTo(0, -11, 7, -9.5);
    ctx.quadraticCurveTo(0, -3, -7, -9.5);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, -7.4, 3, 1.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-7.5, -9.8);
    ctx.quadraticCurveTo(-1, -5.5, 7, -10.5);
    ctx.moveTo(7, -10.5);
    ctx.lineTo(8.5, -11.8);
    ctx.stroke();
  }

  // 帽尖挂着的月亮吊坠
  const tipX = 19 + flop;
  const tipY = -44 + flop * 0.3;
  const swing = Math.sin(t * 2.6) * 2;
  ctx.strokeStyle = '#c9b8e8';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + swing, tipY + 7);
  ctx.stroke();
  ctx.fillStyle = '#ffd54a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(tipX + swing, tipY + 10, 3.4, -Math.PI * 0.45, Math.PI * 1.15);
  ctx.arc(tipX + swing + 1.6, tipY + 9.2, 2.6, Math.PI * 1.1, -Math.PI * 0.4, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  if (branch === 'A') windRibbons(ctx, t, true);
}

/** A 分支的旋风：两圈椭圆弧，back=false 画后半圈，true 画前半圈 */
function windRibbons(ctx: CanvasRenderingContext2D, t: number, front: boolean): void {
  ctx.strokeStyle = 'rgba(94,230,200,0.75)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [y, rx, ph] of [[-6, 30, 0], [-30, 22, 2.2]] as const) {
    const a0 = t * 3 + ph;
    const start = front ? 0.15 : Math.PI + 0.15;
    ctx.beginPath();
    ctx.ellipse(0, y, rx, rx * 0.26, 0, start + (a0 % 0.6), start + 1.9 + (a0 % 0.6));
    ctx.stroke();
  }
}

/** 五角星 */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// ================= 南瓜炮：怒脸南瓜灯 + 铁臼炮 =================

function drawPumpkinMortar(ctx: CanvasRenderingContext2D, s: TowerArtState): void {
  const { t, fire: f, level, branch, mood, lean } = s;
  const hot = Math.max(f, 0);

  // 脸后的烛光透出来
  ctx.globalAlpha = 0.3 + hot * 0.6;
  glow(ctx, 0, -10, 34, '255,180,50');
  ctx.globalAlpha = 1;

  // 藤蔓卷须（左后方）
  ctx.strokeStyle = '#2f5e1e';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -29);
  ctx.bezierCurveTo(-12, -36, -22, -34, -21, -27);
  ctx.bezierCurveTo(-20, -22, -14, -24, -16, -28);
  ctx.stroke();
  ctx.fillStyle = '#5fa83a';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(13, -31, 7, 3.4, -0.5, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // 南瓜：五瓣，先描粗黑边再从后往前填色，只留下外轮廓
  const lobes: ReadonlyArray<readonly [number, number, number]> = [
    [-16, 11, 16], [16, 11, 16], [-8.5, 12.5, 18], [8.5, 12.5, 18], [0, 12, 18.6],
  ];
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  for (const [lx, rx, ry] of lobes) {
    ctx.beginPath();
    ctx.ellipse(lx, -11, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }
  const body = cached(ctx, 'pumpkinBody', () => {
    const g = ctx.createRadialGradient(-9, -20, 2, 0, -10, 34);
    g.addColorStop(0, '#ffc060');
    g.addColorStop(0.5, '#f57c12');
    g.addColorStop(1, '#b83f08');
    return g;
  });
  for (const [lx, rx, ry] of lobes) {
    ctx.beginPath();
    ctx.ellipse(lx, -11, rx, ry, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = '#9a3a08';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  const lobeUnion = (): void => {
    ctx.beginPath();
    for (const [lx, rx, ry] of lobes) {
      ctx.moveTo(lx + rx, -11);
      ctx.ellipse(lx, -11, rx, ry, 0, 0, TAU);
    }
  };
  shade(ctx, lobeUnion, 'pumpkin', -27, -30, 27, 8, 0.45);
  // 高光
  ctx.fillStyle = 'rgba(255,240,200,0.5)';
  ctx.beginPath();
  ctx.ellipse(-12, -20, 2.6, 6, 0.3, 0, TAU);
  ctx.fill();

  // Lv2 起：两侧铁箍 + 铆钉
  if (level >= 2) {
    for (const side of [-1, 1]) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(side * 16, -11, 6, 15.5, 0, side > 0 ? -1.2 : Math.PI - 0.4, side > 0 ? 0.4 : Math.PI + 1.2);
      ctx.stroke();
      ctx.strokeStyle = level >= 3 ? '#c99a2e' : '#5b5468';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = level >= 3 ? '#ffe08a' : '#a59cb8';
      for (const a of [-0.8, -0.2, 0.3]) {
        const ang = side > 0 ? a : Math.PI - a;
        ctx.beginPath();
        ctx.arc(side * 16 + Math.cos(ang) * 6, -11 + Math.sin(ang) * 15.5, 1.2, 0, TAU);
        ctx.fill();
      }
    }
  }

  // 刻出来的怒脸：深色刻痕边 + 发亮的内腔
  const squint = mood === 'blink' ? 0.35 : 1;
  const face = (): void => {
    ctx.beginPath();
    for (const side of [-1, 1]) {
      // 三角眼：内眼角低，外眼角高
      ctx.moveTo(side * 2.5, -14);
      ctx.lineTo(side * 12.5, -14 - 7 * squint);
      ctx.lineTo(side * 11, -14 + 2.5 * squint);
      ctx.closePath();
    }
    // 鼻
    ctx.moveTo(0, -11);
    ctx.lineTo(-2.6, -7);
    ctx.lineTo(2.6, -7);
    ctx.closePath();
    // 锯齿大嘴
    ctx.moveTo(-15, -5);
    ctx.quadraticCurveTo(0, 13 + hot * 3, 15, -5);
    const teeth: ReadonlyArray<readonly [number, number]> = [
      [11, -1.5], [8, 2], [5, -1.5], [2, 2.5], [-1, -1.5], [-4, 2.5], [-7, -1.5], [-10, 2], [-12.5, -2.5],
    ];
    for (const [tx, ty] of teeth) ctx.lineTo(tx, ty);
    ctx.closePath();
  };
  face();
  ctx.strokeStyle = '#4a1800';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = cached(ctx, 'pumpkinFace', () => {
    const g = ctx.createRadialGradient(0, -8, 1, 0, -8, 17);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.5, '#ffd040');
    g.addColorStop(1, '#ff8a10');
    return g;
  });
  ctx.fill();
  if (hot > 0.05) {
    ctx.fillStyle = `rgba(255,255,240,${hot * 0.7})`;
    ctx.fill();
  }
  // 刻痕里透出来的烛光，溢到南瓜皮上
  ctx.globalAlpha = 0.3 + Math.sin(t * 9) * 0.05 + hot * 0.5;
  glowEllipse(ctx, 0, -7, 20, 15, '255,190,70');
  ctx.globalAlpha = 1;

  // 炮：铁箍底座 + 一或两根炮管（A 双管，B 一根粗炮带尖刺）
  ctx.fillStyle = '#3a3346';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -28.5, level >= 2 ? 12 : 9.5, level >= 2 ? 4.4 : 3.6, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (level >= 2) {
    ctx.fillStyle = level >= 3 ? '#ffe08a' : '#a59cb8';
    for (const bx of [-8, -3, 3, 8]) {
      ctx.beginPath();
      ctx.arc(bx, -28 + Math.abs(bx) * -0.08 + 1.5, 1, 0, TAU);
      ctx.fill();
    }
  }
  const aim = Math.max(-0.5, Math.min(0.5, lean * 0.5));
  const recoil = f * 4;
  if (branch === 'A') {
    barrel(ctx, -5, -29, aim - 0.08, recoil, 0.72, t, f, false);
    barrel(ctx, 5, -29, aim + 0.08, recoil * 0.6, 0.72, t + 0.5, f * 0.8, false);
  } else {
    barrel(ctx, 0, -29, aim, recoil, branch === 'B' ? 1.25 : 1, t, f, branch === 'B');
  }
  // 炮口火光照亮南瓜顶
  if (f > 0.2) {
    ctx.globalAlpha = f * 0.55;
    glowEllipse(ctx, 0, -30, 30, 18, '255,170,40');
    ctx.globalAlpha = 1;
  }
}

/** 一根臼炮管。(x, y) 为根部，ang 为偏离竖直的角度，k 为粗细倍率 */
function barrel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, ang: number, recoil: number, k: number,
  t: number, f: number, spikes: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.translate(0, recoil);
  ctx.scale(k, k);
  const len = 20;
  // 炮管
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-7, -len);
  ctx.lineTo(7, -len);
  ctx.lineTo(6, 0);
  ctx.closePath();
  ctx.fillStyle = cached(ctx, 'iron', () => {
    const g = ctx.createLinearGradient(-8, 0, 8, 0);
    g.addColorStop(0, '#221c2b');
    g.addColorStop(0.35, '#857c9c');
    g.addColorStop(0.6, '#4a4458');
    g.addColorStop(1, '#1c1724');
    return g;
  });
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // 箍
  ctx.fillStyle = '#4a4458';
  roundRect(ctx, -7.2, -9, 14.4, 3.6, 1.2);
  ctx.fill();
  ctx.stroke();
  // 炮口
  roundRect(ctx, -9, -len - 4.5, 18, 5.5, 2);
  ctx.fillStyle = '#5b5468';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0d0812';
  ctx.beginPath();
  ctx.ellipse(0, -len - 4.5, 6.2, 1.8, 0, 0, TAU);
  ctx.fill();
  // 炮口里的余火
  ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.15;
  ctx.fillStyle = '#ff8a1a';
  ctx.beginPath();
  ctx.ellipse(0, -len - 4.3, 3.6, 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // B 分支：尖刺环 + 骷髅徽
  if (spikes) {
    ctx.fillStyle = '#c9c0d8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 6.5, -10.5);
      ctx.lineTo(side * 11, -7.5);
      ctx.lineTo(side * 6.5, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#f1e9d6';
    ctx.beginPath();
    ctx.arc(0, -14.5, 2.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-0.9, -14.7, 0.7, 0, TAU);
    ctx.arc(0.9, -14.7, 0.7, 0, TAU);
    ctx.fill();
  }
  // 待机：炮口冒一缕烟
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.5 + i / 3) % 1;
    ctx.fillStyle = `rgba(200,192,216,${(1 - p) * 0.35})`;
    ctx.beginPath();
    ctx.arc(Math.sin(p * 6 + i) * 2.5, -len - 7 - p * 16, 1.8 + p * 3.2, 0, TAU);
    ctx.fill();
  }
  // 开火：炮口火光
  if (f > 0.3) {
    const r = 6 + f * 9;
    ctx.globalAlpha = Math.min(1, f * 1.3);
    glow(ctx, 0, -len - 8, r * 1.8, '255,170,40');
    ctx.fillStyle = '#ff8a1a';
    burst(ctx, 0, -len - 7, r, r * 0.45, 9);
    ctx.fillStyle = '#fff1a8';
    burst(ctx, 0, -len - 6, r * 0.55, r * 0.25, 7);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** 星芒形火光 */
function burst(ctx: CanvasRenderingContext2D, x: number, y: number, ro: number, ri: number, n: number): void {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? ri : ro;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
  }
  ctx.closePath();
  ctx.fill();
}

// ================= Lv3 灵火 =================

/** 三团灵火绕塔身公转；front=false 画在塔身后面的那几团，true 画前面的 */
function drawWisps(ctx: CanvasRenderingContext2D, s: TowerArtState, accent: string, front: boolean): void {
  const rgb = hexRgb(accent);
  for (let i = 0; i < 3; i++) {
    const a = s.t * 1.3 + (i / 3) * TAU;
    const depth = Math.sin(a);
    if (depth >= 0 !== front) continue;
    const px = Math.cos(a) * 32;
    const py = -28 + depth * 9 + Math.sin(s.t * 3 + i) * 2;
    const k = 0.8 + depth * 0.2;
    ctx.globalAlpha = 0.55 * k;
    glow(ctx, px, py, 9 * k, rgb);
    ctx.globalAlpha = 0.95;
    flameShape(ctx, px, py + 2.5 * k, 2.6 * k, 7 * k, -Math.cos(a) * 1.5, accent);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, py, 1 * k, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ================= 公共小件 =================

/**
 * 发光的眼睛。happy：圆眼带瞳孔；excited：内眼角压低的怒眼；blink：一道弯弧。
 * side 为 -1（左眼）或 1（右眼），look 让瞳孔看向目标。
 */
function glowEye(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string,
  mood: TowerMood, side: number, look: number,
): void {
  if (mood === 'blink') {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x, y - r * 0.8, x + r, y);
    ctx.stroke();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  ctx.beginPath();
  if (mood === 'excited') {
    ctx.moveTo(-r, -r * 0.15);
    ctx.lineTo(r * 0.95, -r * 0.75);
    ctx.bezierCurveTo(r * 1.3, r * 0.2, r * 0.6, r, 0, r);
    ctx.bezierCurveTo(-r * 0.6, r, -r * 1.05, r * 0.4, -r, -r * 0.15);
  } else {
    ctx.ellipse(0, 0, r * 0.85, r, 0, 0, TAU);
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // 瞳孔（竖缝）与高光
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x + look * r * 0.3, y + r * 0.1, r * 0.28, r * 0.62, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.25, 0, TAU);
  ctx.fill();
}

const gradCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();

/** 按画布缓存渐变：所有渐变都定义在本地坐标，可被同类塔复用 */
function cached(ctx: CanvasRenderingContext2D, key: string, make: () => CanvasGradient): CanvasGradient {
  let m = gradCache.get(ctx);
  if (!m) {
    m = new Map();
    gradCache.set(ctx, m);
  }
  let g = m.get(key);
  if (!g) {
    g = make();
    m.set(key, g);
  }
  return g;
}

/**
 * 柔光圆（加色混合，像真正的发光体一样提亮下面的颜色）。
 * 单位半径的径向渐变按颜色缓存，绘制时平移缩放；透明度由调用方的 globalAlpha 控制。
 */
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string): void {
  glowEllipse(ctx, x, y, r, r, rgb);
}

function glowEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rgb: string): void {
  const g = cached(ctx, `glow|${rgb}`, () => {
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(${rgb},0.9)`);
    gr.addColorStop(0.4, `rgba(${rgb},0.35)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    return gr;
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** 边缘虚化的投影（正常混合） */
function softShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a: number): void {
  const g = cached(ctx, 'softShadow', () => {
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(10,4,20,1)');
    gr.addColorStop(0.55, 'rgba(10,4,20,0.7)');
    gr.addColorStop(1, 'rgba(10,4,20,0)');
    return gr;
  });
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * 统一光照：主光（月光）来自左上，晚霞的暖色轮廓光来自后上方。
 * 在主体填色之后、描黑边之前调用：裁剪在主体轮廓内，
 * 右下叠一层暗部，顶边叠一圈暖色轮廓光。(x0,y0)-(x1,y1) 为主体包围盒。
 * 渐变按 key 缓存，同一种主体共用。
 */
function shade(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  key: string,
  x0: number, y0: number, x1: number, y1: number,
  dark: number,
  rim = true,
): void {
  const w = x1 - x0;
  const h = y1 - y0;
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = cached(ctx, `shade|${key}`, () => {
    const g = ctx.createLinearGradient(x0 + w * 0.35, y0 + h * 0.3, x1, y1);
    g.addColorStop(0, 'rgba(12,4,24,0)');
    g.addColorStop(1, `rgba(12,4,24,${dark})`);
    return g;
  });
  ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  if (rim) {
    path();
    ctx.strokeStyle = cached(ctx, `rim|${key}`, () => {
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.45);
      g.addColorStop(0, 'rgba(255,186,130,0.9)');
      g.addColorStop(1, 'rgba(255,186,130,0)');
      return g;
    });
    ctx.lineWidth = 6;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const rgbCache = new Map<string, string>();
/** '#rrggbb' → 'r,g,b' */
function hexRgb(hex: string): string {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    rgbCache.set(hex, v);
  }
  return v;
}
