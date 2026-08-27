import { DESIGN_W, DESIGN_H } from './Renderer';
import { drawFlower, drawTuft, drawPebble, drawBush, drawMushroom } from './decor';
import { mulberry32 } from '../utils/rng';
import { distToPolyline } from '../utils/math';

/** 离屏背景的超采样倍率：保证高分屏下地面纹理清晰 */
const GROUND_RES = 2;

export interface Pt {
  x: number;
  y: number;
}

/**
 * 把整张静态地图（草地、泥路、装饰、入口木牌、萝卜土丘、暗角）
 * 一次性画进离屏画布。战斗中每帧只 drawImage 一次，性能与观感双赢。
 * 支持多条进攻路径。
 */
export function buildGround(paths: Pt[][], carrot: Pt, seed: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = DESIGN_W * GROUND_RES;
  cv.height = DESIGN_H * GROUND_RES;
  const g = cv.getContext('2d')!;
  g.scale(GROUND_RES, GROUND_RES);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const rng = mulberry32(seed);
  // 装饰避开的区域：所有路径走廊、萝卜周围、入口木牌
  const start = paths[0][0];
  const signZone = { x0: start.x + 20, y0: start.y + 55, x1: start.x + 260, y1: start.y + 300 };
  const distToRoads = (x: number, y: number): number =>
    Math.min(...paths.map((pts) => distToPolyline(x, y, pts)));
  const freeSpot = (margin: number): Pt | null => {
    for (let tries = 0; tries < 24; tries++) {
      const p = { x: rng() * DESIGN_W, y: rng() * DESIGN_H };
      if (distToRoads(p.x, p.y) < margin) continue;
      if (Math.hypot(p.x - carrot.x, p.y - carrot.y) < 115) continue;
      if (p.x > signZone.x0 && p.x < signZone.x1 && p.y > signZone.y0 && p.y < signZone.y1) continue;
      return p;
    }
    return null;
  };

  // ---- 草地底色 + 明暗斑驳 ----
  const grassGrad = g.createLinearGradient(0, 0, 0, DESIGN_H);
  grassGrad.addColorStop(0, '#a3de67');
  grassGrad.addColorStop(1, '#7fc247');
  g.fillStyle = grassGrad;
  g.fillRect(0, 0, DESIGN_W, DESIGN_H);
  for (let i = 0; i < 46; i++) {
    g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(28,80,18,0.06)';
    g.beginPath();
    g.ellipse(rng() * DESIGN_W, rng() * DESIGN_H, 50 + rng() * 150, 35 + rng() * 90, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 170; i++) {
    const p = { x: rng() * DESIGN_W, y: rng() * DESIGN_H };
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
    strokePoly(64, '#d8a867');
    strokePoly(46, '#ecc98f');
    g.setLineDash([16, 26]);
    strokePoly(3, 'rgba(255,255,255,0.22)');
    g.setLineDash([]);
  }

  // ---- 入口木牌：「怪物入侵」警示 ----
  const sx = start.x + 105;
  const sy = start.y + 118;
  g.save();
  g.translate(sx, sy);
  g.rotate(-0.05);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(4, 66, 44, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8b5e34';
  g.fillRect(-6, -14, 12, 80);                       // 木柱
  roundRectBoard(g, -62, -46, 124, 40, 9);           // 牌面
  g.restore();

  // ---- 终点：萝卜脚下的土丘 ----
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.beginPath();
  g.ellipse(carrot.x, carrot.y + 34, 74, 22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c9995d';
  g.beginPath();
  g.ellipse(carrot.x, carrot.y + 26, 68, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b9854a';
  g.beginPath();
  g.ellipse(carrot.x, carrot.y + 22, 54, 13, 0, 0, Math.PI * 2);
  g.fill();

  // ---- 散布装饰 ----
  const FLOWERS: Array<[string, string]> = [
    ['#ffffff', '#ffca28'],
    ['#ffd54f', '#f57f17'],
    ['#ff8fb1', '#fff'],
    ['#ffffff', '#ff7043'],
  ];
  for (let i = 0; i < 9; i++) {
    const p = freeSpot(58);
    if (p) drawFlower(g, p.x, p.y, 5 + rng() * 5, ...FLOWERS[Math.floor(rng() * FLOWERS.length)]);
  }
  for (let i = 0; i < 30; i++) {
    const p = freeSpot(56);
    if (p) drawTuft(g, p.x, p.y, 9 + rng() * 9, rng() > 0.5 ? '#5fae38' : '#71c046');
  }
  for (let i = 0; i < 14; i++) {
    const p = freeSpot(58);
    if (p) drawPebble(g, p.x, p.y, 3 + rng() * 5);
  }
  for (let i = 0; i < 6; i++) {
    const p = freeSpot(72);
    if (p) drawBush(g, p.x, p.y, 16 + rng() * 14);
  }
  for (let i = 0; i < 5; i++) {
    const p = freeSpot(58);
    if (p) drawMushroom(g, p.x, p.y, 9 + rng() * 7);
  }

  // ---- 四周暗角：聚焦画面中心 ----
  const vig = g.createRadialGradient(
    DESIGN_W / 2, DESIGN_H / 2, DESIGN_H * 0.42,
    DESIGN_W / 2, DESIGN_H / 2, DESIGN_W * 0.72,
  );
  vig.addColorStop(0, 'rgba(40,30,10,0)');
  vig.addColorStop(1, 'rgba(40,30,10,0.26)');
  g.fillStyle = vig;
  g.fillRect(0, 0, DESIGN_W, DESIGN_H);

  return cv;
}

function roundRectBoard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fillStyle = '#dda45e';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#7c4a1e';
  g.stroke();
  g.fillStyle = '#5b3208';
  g.font = 'bold 21px system-ui, "PingFang SC", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('⚠ 怪物入侵', x + w / 2, y + h / 2 + 1);
}
