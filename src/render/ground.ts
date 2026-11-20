import { DESIGN_W, DESIGN_H } from './Renderer';
import { drawFlower, drawTuft, drawPebble, drawBush, drawMushroom } from './decor';
import { mulberry32 } from '../utils/rng';
import { t } from '../i18n';
import { distToPolyline } from '../utils/math';
import { TILTED, Y_TOP, projectY, depthScale, enterUpright } from './projection';

/** 离屏背景的超采样倍率：保证高分屏下地面纹理清晰 */
const GROUND_RES = 2;

export interface Pt {
  x: number;
  y: number;
}

/**
 * 把整张静态地图（草地、泥路、装饰、入口木牌、南瓜土丘、暗角）
 * 一次性画进离屏画布。战斗中每帧只 drawImage 一次，性能与观感双赢。
 * 支持多条进攻路径。
 */
export function buildGround(paths: Pt[][], pumpkin: Pt, seed: number, pad = 0): GroundBuild {
  // 画布左右各多出 pad 的世界宽度，坐标系平移后仍用设计坐标作图
  const props: PropDraw[] = [];
  const cv = document.createElement('canvas');
  cv.width = (DESIGN_W + 2 * pad) * GROUND_RES;
  cv.height = DESIGN_H * GROUND_RES;
  const g = cv.getContext('2d')!;
  g.scale(GROUND_RES, GROUND_RES);
  g.translate(pad, 0);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const rng = mulberry32(seed);
  // 世界 x 的随机范围：包含左右多出的部分
  const randX = (): number => -pad + rng() * (DESIGN_W + 2 * pad);
  // 装饰避开的区域：所有路径走廊、南瓜周围、入口木牌
  const start = paths[0][0];
  const signZone = { x0: start.x + 20, y0: start.y + 55, x1: start.x + 260, y1: start.y + 300 };
  const distToRoads = (x: number, y: number): number =>
    Math.min(...paths.map((pts) => distToPolyline(x, y, pts)));
  const freeSpot = (margin: number): Pt | null => {
    for (let tries = 0; tries < 24; tries++) {
      const p = { x: randX(), y: rng() * DESIGN_H };
      if (distToRoads(p.x, p.y) < margin) continue;
      if (Math.hypot(p.x - pumpkin.x, p.y - pumpkin.y) < 115) continue;
      if (p.x > signZone.x0 && p.x < signZone.x1 && p.y > signZone.y0 && p.y < signZone.y1) continue;
      return p;
    }
    return null;
  };

  // ---- 草地底色 + 明暗斑驳 ----
  const grassGrad = g.createLinearGradient(0, 0, 0, DESIGN_H);
  grassGrad.addColorStop(0, '#5a7a3c');
  grassGrad.addColorStop(1, '#3c5528');
  g.fillStyle = grassGrad;
  g.fillRect(-pad, 0, DESIGN_W + 2 * pad, DESIGN_H);
  for (let i = 0; i < 46; i++) {
    g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(28,80,18,0.06)';
    g.beginPath();
    g.ellipse(randX(), rng() * DESIGN_H, 50 + rng() * 150, 35 + rng() * 90, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 170; i++) {
    const p = { x: randX(), y: rng() * DESIGN_H };
    if (distToRoads(p.x, p.y) < 52) continue;
    g.fillStyle = 'rgba(30,70,15,0.08)';
    g.beginPath();
    g.arc(p.x, p.y, 1.2 + rng() * 1.8, 0, Math.PI * 2);
    g.fill();
  }

  // ---- 泥土路：深边 → 主体 → 浅心，形成立体断面（每条路径） ----
  for (const pts of paths) {
    const strokePoly = (width: number, color: string): void => {
      g.lineWidth = width;
      g.strokeStyle = color;
      g.beginPath();
      pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.stroke();
    };
    strokePoly(78, '#8a5c33');
    strokePoly(64, '#6e5a44');
    strokePoly(46, '#8f7558');
    g.setLineDash([16, 26]);
    strokePoly(3, 'rgba(255,255,255,0.22)');
    g.setLineDash([]);
  }

  // ---- 入口木牌：地面影子留在地面，木柱与牌面作为直立道具 ----
  const sx = start.x + 105;
  const sy = start.y + 118;
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(sx + 4, sy + 66, 44, 10, 0, 0, Math.PI * 2);
  g.fill();
  props.push(
    makeProp(sx, sy + 66, (c) => {
      c.save();
      c.translate(sx, sy);
      c.rotate(-0.05);
      c.fillStyle = '#8b5e34';
      c.fillRect(-6, -14, 12, 80);                   // 木柱
      roundRectBoard(c, -62, -46, 124, 40, 9);       // 牌面
      c.restore();
    }),
  );

  // ---- 终点：南瓜脚下的土丘 ----
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.beginPath();
  g.ellipse(pumpkin.x, pumpkin.y + 34, 74, 22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#5e4a3a';
  g.beginPath();
  g.ellipse(pumpkin.x, pumpkin.y + 26, 68, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4a3a2e';
  g.beginPath();
  g.ellipse(pumpkin.x, pumpkin.y + 22, 54, 13, 0, 0, Math.PI * 2);
  g.fill();

  // ---- 散布装饰 ----
  // 夜色里的小花：紫、橙两色，点缀暗色草地
  const FLOWERS: Array<[string, string]> = [
    ['#b388ff', '#fff176'],
    ['#ff9f43', '#fff3e0'],
    ['#7e57c2', '#ffeb3b'],
    ['#ff7043', '#3a1d05'],
  ];
  for (let i = 0; i < 9; i++) {
    const p = freeSpot(58);
    if (p) drawFlower(g, p.x, p.y, 5 + rng() * 5, ...FLOWERS[Math.floor(rng() * FLOWERS.length)]);
  }
  for (let i = 0; i < 30; i++) {
    const p = freeSpot(56);
    if (p) drawTuft(g, p.x, p.y, 9 + rng() * 9, rng() > 0.5 ? '#4a6b2c' : '#56793a');
  }
  for (let i = 0; i < 14; i++) {
    const p = freeSpot(58);
    if (p) drawPebble(g, p.x, p.y, 3 + rng() * 5);
  }
  // 灌木、蘑菇是直立物体，作为道具参与深度排序（rng 调用顺序保持不变，位置与原来一致）
  for (let i = 0; i < 6; i++) {
    const p = freeSpot(72);
    if (p) {
      const size = 16 + rng() * 14;
      props.push(makeProp(p.x, p.y, (c) => drawBush(c, p.x, p.y, size)));
    }
  }
  for (let i = 0; i < 5; i++) {
    const p = freeSpot(58);
    if (p) {
      const size = 9 + rng() * 7;
      props.push(makeProp(p.x, p.y, (c) => drawMushroom(c, p.x, p.y, size)));
    }
  }

  // ---- 四周暗角：聚焦画面中心 ----
  const vig = g.createRadialGradient(
    DESIGN_W / 2, DESIGN_H / 2, DESIGN_H * 0.42,
    DESIGN_W / 2, DESIGN_H / 2, DESIGN_W * 0.72,
  );
  vig.addColorStop(0, 'rgba(10,6,24,0)');
  vig.addColorStop(1, 'rgba(10,6,24,0.5)');
  g.fillStyle = vig;
  g.fillRect(-pad, 0, DESIGN_W + 2 * pad, DESIGN_H);

  return { canvas: cv, props };
}

/** 深度排序用的直立道具：锚点为脚下点，绘制时按远近缩放 */
export interface PropDraw {
  readonly depthY: number;
  render(ctx: CanvasRenderingContext2D): void;
}

export interface GroundBuild {
  /** 静态地面（已扭曲为斜视角时为扭曲后的结果） */
  canvas: HTMLCanvasElement;
  /** 需要和塔、怪物一起按 y 排序绘制的直立装饰 */
  props: PropDraw[];
}

function makeProp(x: number, y: number, draw: (c: CanvasRenderingContext2D) => void): PropDraw {
  return {
    depthY: y,
    render(ctx: CanvasRenderingContext2D): void {
      ctx.save();
      enterUpright(ctx, x, y);
      draw(ctx);
      ctx.restore();
    },
  };
}

function roundRectBoard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fillStyle = '#4a3360';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#ff9f1c';
  g.stroke();
  g.fillStyle = '#ffd08a';
  // 字号按文字宽度自动缩小，保证英文与中文都落在牌面之内
  const label = t('ground.sign');
  let size = 21;
  g.font = `bold ${size}px system-ui, "PingFang SC", sans-serif`;
  while (size > 11 && g.measureText(label).width > w - 14) {
    size -= 1;
    g.font = `bold ${size}px system-ui, "PingFang SC", sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, x + w / 2, y + h / 2 + 1);
}

/** 扭曲时每条带的世界高度（设计单位）。越小接缝越少，调用次数越多；这里 360 次，每关只做一次 */
const WARP_STRIP = 2;

/**
 * 把平面地面图扭曲成斜视角：每条横带按自己的远近比例缩放并放到投影后的 Y 位置。
 * 同时在梯形外的四角与顶部补上草地和天空远景。只在缓存时调用一次。
 * 平面模式（?flat）直接返回原图。
 */
export function tiltGround(flat: HTMLCanvasElement, pad: number): HTMLCanvasElement {
  if (!TILTED) return flat;
  // flat 的宽度是 (DESIGN_W + 2·pad) 个设计单位，按像素反推采样倍率
  const worldW = DESIGN_W + 2 * pad;
  const res = flat.width / worldW;
  // 输出只保留屏幕尺寸：左右多出的世界宽度扭曲后正好落在屏幕外或边缘上
  const out = document.createElement('canvas');
  out.width = DESIGN_W * res;
  out.height = flat.height;
  const g = out.getContext('2d')!;
  g.scale(res, res);

  drawBackdrop(g);

  const cx = DESIGN_W / 2;
  for (let y0 = 0; y0 < DESIGN_H; y0 += WARP_STRIP) {
    const yA = projectY(y0);
    const yB = projectY(y0 + WARP_STRIP);
    const s = depthScale(y0 + WARP_STRIP / 2);
    // 整幅地面（含左右多出的部分）按远近比例收拢到屏幕中线两侧
    const left = cx - (cx + pad) * s;
    const dw = worldW * s;
    // 多给 0.6px 重叠，避免相邻条带之间露出缝隙
    g.drawImage(flat, 0, y0 * res, flat.width, WARP_STRIP * res, left, yA, dw, yB - yA + 0.6);
  }
  return out;
}

/** 远景：草地底色（梯形外的四角）、天空渐变、两层远山、几朵云 */
function drawBackdrop(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#3c5528';
  g.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // 黄昏夜空：深紫到橙
  const sky = g.createLinearGradient(0, 0, 0, Y_TOP);
  sky.addColorStop(0, '#1d1238');
  sky.addColorStop(1, '#e8783a');
  g.fillStyle = sky;
  g.fillRect(0, 0, DESIGN_W, Y_TOP);

  g.fillStyle = '#3b2a52';
  g.beginPath();
  g.moveTo(0, Y_TOP);
  g.quadraticCurveTo(160, 80, 360, 118);
  g.quadraticCurveTo(520, 90, 660, 124);
  g.quadraticCurveTo(840, 70, 1020, 112);
  g.quadraticCurveTo(1150, 96, DESIGN_W, 120);
  g.lineTo(DESIGN_W, Y_TOP);
  g.closePath();
  g.fill();

  g.fillStyle = '#2a1d3d';
  g.beginPath();
  g.moveTo(0, Y_TOP);
  g.quadraticCurveTo(220, 118, 470, 132);
  g.quadraticCurveTo(760, 112, 1000, 134);
  g.quadraticCurveTo(1150, 122, DESIGN_W, 130);
  g.lineTo(DESIGN_W, Y_TOP);
  g.closePath();
  g.fill();

  g.fillStyle = 'rgba(200,170,230,0.3)';
  const clouds: ReadonlyArray<readonly [number, number, number]> = [
    [200, 50, 26],
    [1010, 36, 32],
    [640, 74, 18],
  ];
  for (const [cx, cy, r] of clouds) {
    g.beginPath();
    g.ellipse(cx, cy, r * 1.6, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
  }
}
