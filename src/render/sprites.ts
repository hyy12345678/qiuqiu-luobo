/**
 * 程序化绘制的角色精灵（万圣节主题）。
 * 后续如需替换为图片素材，只需替换本文件的实现，函数签名保持不变即可无缝切换。
 */

const TAU = Math.PI * 2;

export type PumpkinMood = 'happy' | 'worried' | 'hurt';

/**
 * 南瓜主基地（终点）：分瓣的橙色身体、棕色南瓜蒂、挖空的灯笼脸，
 * 脸后面透出烛光。三种表情对应血量阶段。
 */
export function drawPumpkin(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  mood: PumpkinMood = 'happy',
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const h = size;
  const w = size * 1.0;
  const bodyRy = h * 0.4;

  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.42, w * 0.6, h * 0.08, 0, 0, TAU);
  ctx.fill();

  // 南瓜蒂与叶子（画在身体后面）
  ctx.fillStyle = '#5b3a1a';
  roundRectLocal(ctx, -h * 0.07, -h * 0.6, h * 0.14, h * 0.26, h * 0.05);
  ctx.fill();
  ctx.fillStyle = '#5fa83a';
  ctx.beginPath();
  ctx.ellipse(h * 0.2, -h * 0.5, h * 0.2, h * 0.09, -0.4, 0, TAU);
  ctx.fill();

  // 身体：三片重叠的瓣，逐瓣填色并描边，形成南瓜的棱线
  const bodyGrad = ctx.createRadialGradient(-w * 0.2, -h * 0.2, h * 0.05, 0, 0, w * 0.6);
  bodyGrad.addColorStop(0, '#ffb347');
  bodyGrad.addColorStop(1, '#e8620c');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#a4430a';
  ctx.lineWidth = h * 0.03;
  for (const k of [-0.24, 0.24, 0]) {
    ctx.beginPath();
    ctx.ellipse(k * w, 0, w * 0.3, bodyRy, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.3, -h * 0.2, w * 0.09, h * 0.06, -0.6, 0, TAU);
  ctx.fill();

  // 受击：身体上的裂纹
  if (mood === 'hurt') {
    ctx.strokeStyle = '#5a2a00';
    ctx.lineWidth = h * 0.022;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, -bodyRy * 0.9);
    ctx.lineTo(w * 0.26, -bodyRy * 0.4);
    ctx.lineTo(w * 0.16, -bodyRy * 0.05);
    ctx.lineTo(w * 0.24, bodyRy * 0.3);
    ctx.stroke();
  }

  // ---- 挖空的脸：烛光晕 + 发亮的刻痕 ----
  const faceY = -h * 0.03;
  const glow = ctx.createRadialGradient(0, faceY, 0, 0, faceY, w * 0.42);
  glow.addColorStop(0, 'rgba(255,230,120,0.5)');
  glow.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, faceY, w * 0.42, 0, TAU);
  ctx.fill();

  const faceFill = '#ffe27a';
  const faceEdge = '#5a2a00';
  ctx.fillStyle = faceFill;
  ctx.strokeStyle = faceEdge;
  ctx.lineWidth = h * 0.02;
  ctx.lineJoin = 'round';

  // 眼睛：三角形刻痕。担心时眼角下垂，受伤时眯起
  const eyeX = w * 0.2;
  const eyeY = faceY - h * 0.06;
  const es = mood === 'hurt' ? h * 0.085 : h * 0.11;
  for (const side of [-1, 1]) {
    const rot = mood === 'happy' ? 0 : mood === 'worried' ? side * 0.4 : -side * 0.35;
    const ey = mood === 'hurt' ? eyeY + h * 0.03 : eyeY;
    triangleAt(ctx, side * eyeX, ey, es, rot);
  }

  // 嘴：笑脸、锯齿担心、张口受伤
  if (mood === 'happy') {
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, faceY + h * 0.08);
    ctx.quadraticCurveTo(0, faceY + h * 0.34, w * 0.3, faceY + h * 0.08);
    ctx.quadraticCurveTo(0, faceY + h * 0.2, -w * 0.3, faceY + h * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (mood === 'worried') {
    const y0 = faceY + h * 0.18;
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, y0);
    for (let i = 1; i <= 6; i++) {
      ctx.lineTo(-w * 0.24 + i * w * 0.08, y0 + (i % 2 ? h * 0.1 : 0));
    }
    ctx.lineWidth = h * 0.04;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#5a2a00';
    ctx.beginPath();
    ctx.ellipse(0, faceY + h * 0.2, w * 0.1, h * 0.09, 0, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

/** 三角形刻痕（南瓜灯的眼睛） */
function triangleAt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number): void {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const pts: Array<[number, number]> = [[0, -s], [s * 0.9, s * 0.7], [-s * 0.9, s * 0.7]];
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const X = x + px * cos - py * sin;
    const Y = y + px * sin + py * cos;
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export type MonsterKind = 'round' | 'tall' | 'tank' | 'healer' | 'boss' | 'bomb';

export interface MonsterSkin {
  body: string;
  dark: string;
  kind: MonsterKind;
}

/**
 * 菜单小剧场用的皮肤：[0] 小幽灵，[2] 炸弹南瓜。
 * 与 data/monsters.ts 中各怪的皮肤保持一致。
 */
export const MONSTER_SKINS: MonsterSkin[] = [
  { body: '#d9d4f5', dark: '#8b84b8', kind: 'round' },
  { body: '#2d2433', dark: '#110b17', kind: 'tall' },
  { body: '#ff8c1a', dark: '#b34a00', kind: 'bomb' },
];

/**
 * 怪物绘制。种类决定外形：
 * round 小幽灵（波浪下摆）、tall 黑猫（尖耳）、tank 木乃伊（绷带）、
 * healer 女巫（尖帽）、bomb 炸弹南瓜（火绳）、boss 吸血鬼伯爵（双角）。
 * phase 为走路相位，dirAngle 为移动方向（眼睛跟随）。
 */
export function drawMonster(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  r: number,
  skin: MonsterSkin,
  phase: number,
  dirAngle: number,
  blink = 0,
): void {
  ctx.save();
  const bounce = Math.abs(Math.sin(phase)) * r * 0.14;
  const by = y - bounce;
  const tall = skin.kind === 'tall' ? 1.12 : 1;
  const ghost = skin.kind === 'round';

  // 影子（不随身体弹跳）
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.82, r * 0.95, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 小脚：幽灵没有脚，其余怪左右交替迈步
  if (!ghost) {
    const stride = Math.sin(phase) * r * 0.32;
    ctx.fillStyle = skin.dark;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * r * 0.38 + side * stride, y + r * 0.72, r * 0.27, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 身体：径向渐变
  ctx.save();
  ctx.translate(x, by);
  ctx.fillStyle = bodyGradient(ctx, skin, r, tall);
  ctx.beginPath();
  if (ghost) ghostOutline(ctx, r);
  else ctx.ellipse(0, 0, r * 0.96, r * tall, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.15;
  ctx.strokeStyle = skin.dark;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 木乃伊绷带：裁剪在身体内画横向条纹
  if (skin.kind === 'tank') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.96, r * tall, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = skin.dark;
    ctx.lineWidth = r * 0.13;
    for (const yy of [-0.5, -0.12, 0.26, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(-r, yy * r * tall);
      ctx.quadraticCurveTo(0, yy * r * tall + r * 0.12, r, yy * r * tall - r * 0.05);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // 肚皮（幽灵和木乃伊不画）
  if (skin.kind !== 'round' && skin.kind !== 'tank') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, by + r * 0.42 * tall, r * 0.42, r * 0.3 * tall, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 种族头饰 ----
  if (skin.kind === 'healer') {
    // 女巫尖帽：帽檐 + 帽锥 + 橙色帽带
    const hatY = by - r * 0.62;
    ctx.fillStyle = '#1f1630';
    ctx.strokeStyle = '#0c0814';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.ellipse(x, hatY, r * 0.85, r * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, hatY);
    ctx.lineTo(x + r * 0.12, by - r * 1.95);
    ctx.lineTo(x + r * 0.5, hatY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(x - r * 0.48, hatY - r * 0.14, r * 0.96, r * 0.12);
  } else if (skin.kind === 'bomb') {
    // 头顶一根小火绳，末端一点火花
    ctx.strokeStyle = '#5b4636';
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, by - r * 0.9);
    ctx.quadraticCurveTo(x + r * 0.5, by - r * 1.5, x + r * 0.2, by - r * 1.6);
    ctx.stroke();
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(x + r * 0.2, by - r * 1.6, r * 0.14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff6c2';
    ctx.beginPath();
    ctx.arc(x + r * 0.2, by - r * 1.6, r * 0.06, 0, TAU);
    ctx.fill();
  } else if (skin.kind === 'boss') {
    // 吸血鬼双角
    ctx.fillStyle = '#efe6c8';
    ctx.strokeStyle = skin.dark;
    ctx.lineWidth = r * 0.1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.42, by - r * 0.72);
      ctx.lineTo(x + side * r * 0.78, by - r * 1.28);
      ctx.lineTo(x + side * r * 0.12, by - r * 0.92);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // 黑猫尖耳（tall）：外侧深色，内侧暗粉
  if (skin.kind === 'tall') {
    for (const side of [-1, 1]) {
      ctx.fillStyle = skin.body;
      ctx.strokeStyle = skin.dark;
      ctx.lineWidth = r * 0.1;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.1, by - r * 0.55);
      ctx.lineTo(x + side * r * 0.66, by - r * 0.5);
      ctx.lineTo(x + side * r * 0.46, by - r * 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff8fa3';
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.22, by - r * 0.62);
      ctx.lineTo(x + side * r * 0.5, by - r * 0.6);
      ctx.lineTo(x + side * r * 0.4, by - r * 1.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 眼睛看向移动方向
  const lookX = Math.cos(dirAngle) * r * 0.16;
  const lookY = Math.sin(dirAngle) * r * 0.16;
  const eyeY = by - r * 0.18;
  // 眨眼：eyeK 为眼睛的竖向开合比例（1 为睁开）
  const eyeK = 1 - blink * 0.9;
  for (const side of [-1, 1]) {
    const ex = x + side * r * 0.36;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, r * 0.34, r * 0.37 * eyeK, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d2333';
    ctx.beginPath();
    ctx.arc(ex + lookX, eyeY + lookY, r * 0.17 * eyeK, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + lookX - r * 0.06, eyeY + lookY - r * 0.07, r * 0.055 * eyeK, 0, Math.PI * 2);
    ctx.fill();
  }
  // 腮红
  ctx.fillStyle = 'rgba(255,120,130,0.42)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.66, by + r * 0.16, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 吸血鬼与炸弹南瓜：凶巴巴的斜眉
  if (skin.kind === 'boss' || skin.kind === 'bomb') {
    ctx.strokeStyle = skin.dark;
    ctx.lineWidth = r * 0.13;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.14, eyeY - r * 0.5);
      ctx.lineTo(x + side * r * 0.56, eyeY - r * 0.32);
      ctx.stroke();
    }
  }

  // 嘴巴
  ctx.strokeStyle = '#2d2333';
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x + lookX * 0.6, by + r * 0.3 * tall, r * 0.22, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

/** 小幽灵的外形：上半圆 + 三段波浪下摆。坐标原点为身体中心 */
function ghostOutline(ctx: CanvasRenderingContext2D, r: number): void {
  const rr = r * 0.96;
  ctx.moveTo(-rr, 0);
  ctx.arc(0, 0, rr, Math.PI, 0, false);
  const xs = [rr, rr / 3, -rr / 3, -rr];
  ctx.lineTo(rr, r * 0.9);
  for (let i = 0; i < 3; i++) {
    ctx.quadraticCurveTo((xs[i] + xs[i + 1]) / 2, r * 1.3, xs[i + 1], r * 0.9);
  }
  ctx.closePath();
}

/**
 * 身体渐变缓存：按 皮肤对象 → 半径 分组。tall 由皮肤种类决定，所以不需要进键。
 * 渐变使用局部坐标（原点为身体中心），调用前需已平移到身体中心。
 */
const bodyGradCache = new Map<MonsterSkin, Map<number, CanvasGradient>>();

function bodyGradient(ctx: CanvasRenderingContext2D, skin: MonsterSkin, r: number, tall: number): CanvasGradient {
  let byR = bodyGradCache.get(skin);
  if (!byR) {
    byR = new Map();
    bodyGradCache.set(skin, byR);
  }
  let g = byR.get(r);
  if (!g) {
    g = ctx.createRadialGradient(-r * 0.35, -r * 0.4 * tall, r * 0.15, 0, 0, r * 1.15 * tall);
    g.addColorStop(0, lighten(skin.body));
    g.addColorStop(1, skin.body);
    byR.set(r, g);
  }
  return g;
}

/** 颜色提亮：把 #rrggbb 变亮一档，用于渐变高光侧 */
function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 42);
  const gg = Math.min(255, ((n >> 8) & 255) + 42);
  const b = Math.min(255, (n & 255) + 42);
  return `rgb(${r},${gg},${b})`;
}

/** 糖果桶（宝箱障碍）：万圣节讨糖用的橙黑条纹桶，桶口露出几颗糖 */
export function drawCandyBucket(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 32, 9, 0, 0, TAU);
  ctx.fill();

  // 桶身（梯形）
  ctx.beginPath();
  ctx.moveTo(x - 26, y - 12);
  ctx.lineTo(x + 26, y - 12);
  ctx.lineTo(x + 20, y + 20);
  ctx.lineTo(x - 20, y + 20);
  ctx.closePath();
  ctx.fillStyle = '#ff7a18';
  ctx.fill();
  ctx.strokeStyle = '#3a1d05';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 黑色斜条纹（裁剪在桶身内）
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - 26, y - 12);
  ctx.lineTo(x + 26, y - 12);
  ctx.lineTo(x + 20, y + 20);
  ctx.lineTo(x - 20, y + 20);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#2a1505';
  for (const dx of [-16, -2, 12]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - 12);
    ctx.lineTo(x + dx + 6, y - 12);
    ctx.lineTo(x + dx + 1, y + 20);
    ctx.lineTo(x + dx - 5, y + 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 提手
  ctx.strokeStyle = '#3a1d05';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y - 12, 22, Math.PI, 0);
  ctx.stroke();

  // 桶口
  ctx.fillStyle = '#ffa940';
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 26, 6, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // 桶里的糖果
  const candies: Array<[number, number, string]> = [
    [-12, -20, '#7e57c2'],
    [1, -24, '#ffeb3b'],
    [13, -19, '#4fc3f7'],
  ];
  for (const [dx, dy, color] of candies) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a1d05';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** 棺材（木箱障碍）：紫色六边形棺身，白色十字 */
export function drawCoffin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 20, 28, 8, 0, 0, TAU);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - 12, y - 26);
  ctx.lineTo(x + 12, y - 26);
  ctx.lineTo(x + 22, y - 14);
  ctx.lineTo(x + 26, y + 8);
  ctx.lineTo(x + 14, y + 24);
  ctx.lineTo(x - 14, y + 24);
  ctx.lineTo(x - 26, y + 8);
  ctx.lineTo(x - 22, y - 14);
  ctx.closePath();
  ctx.fillStyle = '#4b2c5e';
  ctx.fill();
  ctx.strokeStyle = '#1d0f2a';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 十字（棺盖装饰）
  ctx.fillStyle = '#d9cfe8';
  ctx.fillRect(x - 2.5, y - 16, 5, 34);
  ctx.fillRect(x - 9, y - 6, 18, 5);

  // 高光
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 12);
  ctx.lineTo(x - 10, y - 22);
  ctx.stroke();
  ctx.restore();
}

/** 墓碑（大石头障碍）：灰色圆顶石碑，刻着 RIP，底部长着苔藓 */
export function drawTombstone(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 26, 8, 0, 0, TAU);
  ctx.fill();

  // 碑身
  ctx.beginPath();
  ctx.moveTo(-20, 20);
  ctx.lineTo(-20, -6);
  ctx.arc(0, -6, 20, Math.PI, 0);
  ctx.lineTo(20, 20);
  ctx.closePath();
  ctx.fillStyle = '#9aa6b2';
  ctx.fill();
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 裂纹
  ctx.strokeStyle = 'rgba(60,70,80,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, -10);
  ctx.lineTo(10, 2);
  ctx.lineTo(4, 10);
  ctx.stroke();

  // 刻字
  ctx.fillStyle = '#3b4450';
  ctx.font = 'bold 10px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RIP', 0, 4);

  // 底部苔藓
  ctx.fillStyle = 'rgba(79,122,58,0.9)';
  ctx.beginPath();
  ctx.ellipse(-12, 17, 8, 4, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(10, 18, 6, 3, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function roundRectLocal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

