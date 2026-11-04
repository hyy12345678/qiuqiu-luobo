/**
 * 程序化绘制的角色精灵 —— 当前是「手绘卡通」风格的上限版本。
 * 后续如需更进一步贴近原版，只需替换本文件的实现为图片素材，
 * 函数签名保持不变即可无缝切换。
 */

const TAU = Math.PI * 2;

export type CarrotMood = 'happy' | 'worried' | 'hurt';

/**
 * 卡通萝卜（终点主基地）：渐变身体、五叶绿冠、大眼睛、腮红，
 * 三种表情状态对应血量阶段。
 */
export function drawCarrot(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  mood: CarrotMood = 'happy',
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const h = size;
  const w = size * 0.74;

  // 影子
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.48, w * 0.55, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- 叶冠：五片叶子两色相间 ----
  const leafAngles = [-0.62, -0.31, 0, 0.31, 0.62];
  leafAngles.forEach((a, i) => {
    ctx.save();
    ctx.translate(0, -h * 0.3);
    ctx.rotate(a);
    const len = h * (i % 2 === 0 ? 0.36 : 0.3);
    const wid = h * 0.1;
    ctx.fillStyle = i % 2 === 0 ? '#4caf50' : '#63c058';
    ctx.beginPath();
    ctx.ellipse(0, -len / 2 - h * 0.06, wid, len / 2 + h * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,90,25,0.5)';
    ctx.lineWidth = h * 0.012;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.08);
    ctx.lineTo(0, -len - h * 0.02);
    ctx.stroke();
    ctx.restore();
  });

  // ---- 身体：上宽下尖的甜筒形，带渐变 ----
  const bodyPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h * 0.28);
    ctx.quadraticCurveTo(0, -h * 0.46, w / 2, -h * 0.28);
    ctx.quadraticCurveTo(w * 0.42, h * 0.16, 0, h * 0.46);
    ctx.quadraticCurveTo(-w * 0.42, h * 0.16, -w / 2, -h * 0.28);
    ctx.closePath();
  };
  const bodyGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  bodyGrad.addColorStop(0, '#ffb148');
  bodyGrad.addColorStop(0.55, '#ff9426');
  bodyGrad.addColorStop(1, '#f57d15');
  bodyPath();
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.lineWidth = h * 0.045;
  ctx.strokeStyle = '#c96a10';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 身体纹路（两条浅弧线模拟萝卜纹理）
  ctx.save();
  bodyPath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(180,90,10,0.28)';
  ctx.lineWidth = h * 0.022;
  for (const yy of [-0.06, 0.14]) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * yy);
    ctx.quadraticCurveTo(0, h * (yy + 0.07), w * 0.5, h * yy);
    ctx.stroke();
  }
  ctx.restore();

  // 受击状态：贴一块创可贴
  if (mood === 'hurt') {
    ctx.save();
    ctx.translate(w * 0.24, h * 0.02);
    ctx.rotate(0.5);
    ctx.fillStyle = '#fff3e0';
    ctx.fillRect(-h * 0.09, -h * 0.032, h * 0.18, h * 0.064);
    ctx.fillStyle = '#e0a26a';
    ctx.fillRect(-h * 0.03, -h * 0.032, h * 0.06, h * 0.064);
    ctx.restore();
  }

  // ---- 表情 ----
  const eyeY = -h * 0.1;
  const eyeDX = w * 0.19;

  // 腮红
  ctx.fillStyle = 'rgba(255,110,110,0.5)';
  for (const dx of [eyeDX * 1.75, -eyeDX * 1.75]) {
    ctx.beginPath();
    ctx.ellipse(dx, eyeY + h * 0.09, h * 0.06, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const pupilShift = mood === 'worried' ? -h * 0.015 : 0;
  for (const side of [-1, 1]) {
    const ex = side * eyeDX;
    // 眼白
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, h * 0.085, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,80,20,0.35)';
    ctx.lineWidth = h * 0.008;
    ctx.stroke();
    // 瞳孔 + 高光
    const pr = mood === 'worried' ? h * 0.038 : h * 0.048;
    ctx.fillStyle = '#3a2410';
    ctx.beginPath();
    ctx.arc(ex, eyeY + pupilShift, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - pr * 0.35, eyeY + pupilShift - pr * 0.4, pr * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // 眉毛：担心时八字眉，受伤时紧皱
  if (mood !== 'happy') {
    ctx.strokeStyle = '#7a4a10';
    ctx.lineWidth = h * 0.022;
    ctx.lineCap = 'round';
    const tilt = mood === 'hurt' ? 0.55 : 0.3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * eyeDX - side * h * 0.07, eyeY - h * 0.17 + tilt * h * 0.04);
      ctx.lineTo(side * eyeDX + side * h * 0.06, eyeY - h * 0.17 - tilt * h * 0.04);
      ctx.stroke();
    }
  }

  // 嘴巴
  ctx.strokeStyle = '#7a3d06';
  ctx.lineWidth = h * 0.028;
  ctx.lineCap = 'round';
  if (mood === 'happy') {
    ctx.beginPath();
    ctx.arc(0, eyeY + h * 0.1, h * 0.085, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (mood === 'worried') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.06, eyeY + h * 0.19);
    ctx.quadraticCurveTo(0, eyeY + h * 0.15, h * 0.06, eyeY + h * 0.19);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#7a3010';
    ctx.beginPath();
    ctx.ellipse(0, eyeY + h * 0.18, h * 0.05, h * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export type MonsterKind = 'round' | 'tall' | 'spiky' | 'tank' | 'healer' | 'boss';

export interface MonsterSkin {
  body: string;
  dark: string;
  kind: MonsterKind;
}

export const MONSTER_SKINS: MonsterSkin[] = [
  { body: '#6cc24a', dark: '#3f8f2a', kind: 'round' },
  { body: '#a97ae8', dark: '#6f47b1', kind: 'tall' },
  { body: '#ff8a5c', dark: '#cf5630', kind: 'spiky' },
];

/**
 * 果冻小怪：影子、交替迈步的小脚、渐变身体、朝移动方向看的大眼睛。
 * phase 为走路相位，dirAngle 为移动方向（眼睛跟随）。
 */
export function drawMonster(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  r: number,
  skin: MonsterSkin,
  phase: number,
  dirAngle: number,
): void {
  ctx.save();
  const bounce = Math.abs(Math.sin(phase)) * r * 0.14;
  const by = y - bounce;
  const tall = skin.kind === 'tall' ? 1.28 : 1;

  // 影子（不随身体弹跳）
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.82, r * 0.95, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 小脚：左右交替迈步
  const stride = Math.sin(phase) * r * 0.32;
  ctx.fillStyle = skin.dark;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.38 + side * stride, y + r * 0.72, r * 0.27, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 尖刺（spiky 专属）：上半圈一圈小三角
  if (skin.kind === 'spiky') {
    ctx.fillStyle = skin.dark;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 1.03 + (i / 6) * Math.PI * 0.94;
      const tipX = x + Math.cos(a) * r * 1.42;
      const tipY = by + Math.sin(a) * r * 1.42;
      const bx = x + Math.cos(a) * r * 0.82;
      const bY = by + Math.sin(a) * r * 0.82;
      const px = -Math.sin(a) * r * 0.22;
      const py = Math.cos(a) * r * 0.22;
      ctx.beginPath();
      ctx.moveTo(bx + px, bY + py);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(bx - px, bY - py);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 身体：径向渐变果冻感。渐变在局部坐标（身体中心为原点）下缓存，平移后绘制
  ctx.save();
  ctx.translate(x, by);
  ctx.fillStyle = bodyGradient(ctx, skin, r, tall);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.96, r * tall, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.15;
  ctx.strokeStyle = skin.dark;
  ctx.stroke();
  ctx.restore();

  // 肚皮
  if (skin.kind !== 'spiky') {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, by + r * 0.42 * tall, r * 0.42, r * 0.3 * tall, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 种族头饰 ----
  if (skin.kind === 'tank') {
    // 钢盔
    ctx.fillStyle = '#7a8ea3';
    ctx.strokeStyle = '#4a5a6a';
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(x, by - r * 0.35, r * 0.92, Math.PI * 1.02, Math.PI * 1.98);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5d7186';
    for (const dx of [-r * 0.45, 0, r * 0.45]) {
      ctx.beginPath();
      ctx.arc(x + dx, by - r * 0.33, r * 0.07, 0, TAU);
      ctx.fill();
    }
  } else if (skin.kind === 'healer') {
    // 医生帽（红十字）
    const capY = by - r * 0.72;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#c5d4cd';
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.ellipse(x, capY, r * 0.66, r * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ef5350';
    const cw = r * 0.13;
    ctx.fillRect(x - cw / 2, capY - cw * 1.1, cw, cw * 2.2);
    ctx.fillRect(x - cw * 1.1, capY - cw / 2, cw * 2.2, cw);
  } else if (skin.kind === 'boss') {
    // 双角
    ctx.fillStyle = '#e8dfc0';
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

  // 眼睛看向移动方向
  const lookX = Math.cos(dirAngle) * r * 0.16;
  const lookY = Math.sin(dirAngle) * r * 0.16;
  const eyeY = by - r * 0.18;
  for (const side of [-1, 1]) {
    const ex = x + side * r * 0.36;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, r * 0.3, r * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d2333';
    ctx.beginPath();
    ctx.arc(ex + lookX, eyeY + lookY, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + lookX - r * 0.05, eyeY + lookY - r * 0.06, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // spiky / boss 怪：凶巴巴的斜眉
  if (skin.kind === 'spiky' || skin.kind === 'boss') {
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

/** 宝箱障碍 */
export function drawChest(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 32, 9, 0, 0, TAU);
  ctx.fill();
  // 箱体
  roundRectLocal(ctx, x - 28, y - 10, 56, 28, 6);
  ctx.fillStyle = '#b07a42';
  ctx.fill();
  ctx.strokeStyle = '#6f4423';
  ctx.lineWidth = 3;
  ctx.stroke();
  // 箱盖
  roundRectLocal(ctx, x - 31, y - 24, 62, 17, 8);
  ctx.fillStyle = '#8a5c33';
  ctx.fill();
  ctx.stroke();
  // 金箍
  ctx.fillStyle = '#ffd54f';
  for (const bx of [x - 11, x + 4]) {
    ctx.fillRect(bx, y - 24, 7, 43);
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, y - 24, 7, 43);
  }
  // 锁扣
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath();
  ctx.arc(x, y - 5, 6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#7a5200';
  ctx.fillRect(x - 1.5, y - 7, 3, 6);
  // 盖上高光
  ctx.strokeStyle = 'rgba(255,235,190,0.6)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 18);
  ctx.quadraticCurveTo(x - 8, y - 21, x + 2, y - 19);
  ctx.stroke();
  ctx.restore();
}

/** 木箱障碍 */
export function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + 20, 28, 8, 0, 0, TAU);
  ctx.fill();
  roundRectLocal(ctx, x - 24, y - 20, 48, 42, 5);
  ctx.fillStyle = '#cfa15f';
  ctx.fill();
  ctx.strokeStyle = '#7a4b1e';
  ctx.lineWidth = 3;
  ctx.stroke();
  // 板条缝
  ctx.strokeStyle = 'rgba(122,75,30,0.5)';
  ctx.lineWidth = 2;
  for (const py of [y - 7, y + 6]) {
    ctx.beginPath();
    ctx.moveTo(x - 21, py);
    ctx.lineTo(x + 21, py);
    ctx.stroke();
  }
  // 斜撑
  ctx.strokeStyle = '#a9743f';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 15);
  ctx.lineTo(x + 18, y + 17);
  ctx.moveTo(x + 18, y - 15);
  ctx.lineTo(x - 18, y + 17);
  ctx.stroke();
  // 铆钉
  ctx.fillStyle = '#7a4b1e';
  for (const [dx, dy] of [[-19, -15], [19, -15], [-19, 17], [19, 17]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** 大石头障碍 */
export function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 30, 9, 0, 0, TAU);
  ctx.fill();
  // 主岩
  ctx.beginPath();
  ctx.moveTo(-26, 12);
  ctx.quadraticCurveTo(-32, -8, -12, -16);
  ctx.quadraticCurveTo(2, -24, 16, -14);
  ctx.quadraticCurveTo(30, -8, 26, 12);
  ctx.closePath();
  ctx.fillStyle = '#b7c0c9';
  ctx.fill();
  ctx.strokeStyle = '#7d8892';
  ctx.lineWidth = 3;
  ctx.stroke();
  // 高光与裂纹
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-10, -8, 10, 5, -0.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,100,110,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, -14);
  ctx.lineTo(9, -2);
  ctx.lineTo(5, 8);
  ctx.stroke();
  // 苔藓
  ctx.fillStyle = 'rgba(103,187,78,0.85)';
  ctx.beginPath();
  ctx.ellipse(-15, -12, 8, 4, -0.4, 0, TAU);
  ctx.fill();
  // 小石块
  ctx.fillStyle = '#a5aeb8';
  ctx.strokeStyle = '#7d8892';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(23, 10, 9, 6.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
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
