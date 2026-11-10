import { DESIGN_W, DESIGN_H } from './Renderer';

/**
 * 伪 3D 投影。
 *
 * 逻辑坐标仍是 1280×720 平面（路径、格子、射程、命中都不变）。只在绘制和点击时换算：
 * - 远端（y 小）缩小，纵向压缩，地面呈斜视角；
 * - 直立物体（塔、怪、道具、萝卜）以脚下点为锚点整体缩放，保持正面朝向；
 * - 地面物体（塔座、射程圈、格子高亮）水平按 s、纵向按 s·GROUND_K 压扁。
 *
 * URL 加 ?flat 时投影退化为恒等变换，即原来的平面画法（用于 A/B 对比）。
 */
const FLAT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('flat');
export const TILTED = !FLAT;

const CX = DESIGN_W / 2;
const WORLD_H = DESIGN_H;

/** 远端（y=0）的缩放比，近端（y=720）为 1 */
const S_FAR = TILTED ? 0.7 : 1;
/** 地面纵向压缩比：世界 720 行在屏幕上占 504px */
export const GROUND_K = TILTED ? 0.7 : 1;
/** 地面顶边的屏幕 Y：让世界底边落在屏幕底部，上方留给天空与远景 */
export const Y_TOP = DESIGN_H * (1 - GROUND_K);

/**
 * 地面图左右各多画的世界宽度（设计单位）。远端缩到 S_FAR 后，屏幕左右边缘对应的
 * 世界 x 会超出 [0, 1280]，需要这段额外地面才能让扭曲后的画面铺满屏幕，没有纯色缝。
 */
export const WORLD_PAD = TILTED ? Math.ceil(CX * (1 / S_FAR - 1)) + 8 : 0;

export interface SpriteBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 世界 y 处的远近缩放比（与屏幕 X 方向的收拢程度一致） */
export function depthScale(y: number): number {
  return S_FAR + (1 - S_FAR) * (y / WORLD_H);
}

export function projectX(x: number, y: number): number {
  return CX + (x - CX) * depthScale(y);
}

export function projectY(y: number): number {
  return Y_TOP + y * GROUND_K;
}

/** 屏幕 Y → 世界 y（闭式解，无需迭代） */
export function unprojectY(sy: number): number {
  return (sy - Y_TOP) / GROUND_K;
}

/** 屏幕 X 与世界 y → 世界 x */
export function unprojectX(sx: number, y: number): number {
  return CX + (sx - CX) / depthScale(y);
}

/**
 * 直立物体：把当前坐标系切到以 (x, y) 为脚下锚点的投影坐标。
 * 之后的绘制仍使用世界（设计）坐标，但会按远近整体缩放。
 * 调用方负责 ctx.save() / ctx.restore()。
 */
export function enterUpright(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const s = depthScale(y);
  ctx.translate(projectX(x, y), projectY(y));
  ctx.scale(s, s);
  ctx.translate(-x, -y);
}

/**
 * 地面物体：同上，但纵向再压缩 GROUND_K，使圆形变成符合斜视角的椭圆。
 * 调用方负责 ctx.save() / ctx.restore()。
 */
export function enterGround(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const s = depthScale(y);
  ctx.translate(projectX(x, y), projectY(y));
  ctx.scale(s, s * GROUND_K);
  ctx.translate(-x, -y);
}

/** 屏幕点 (px, py) 是否落在直立物体的包围盒内（盒的边界以锚点投影点为基准，随远近缩放） */
export function hitUpright(ax: number, ay: number, px: number, py: number, box: SpriteBox): boolean {
  const s = depthScale(ay);
  const X = projectX(ax, ay);
  const Y = projectY(ay);
  return px >= X + box.left * s && px <= X + box.right * s && py >= Y + box.top * s && py <= Y + box.bottom * s;
}
