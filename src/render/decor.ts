/** 小型绘制工具：圆角矩形路径、花草石等地图装饰元素 */

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 小花：花瓣环绕花心 */
export function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  petal: string, center: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = petal;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * s * 0.62, Math.sin(a) * s * 0.62, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 草丛：三两根弯曲的叶片 */
export function drawTuft(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number, color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.16;
  for (const [dx, bend] of [[-0.5, -0.55], [0, 0], [0.5, 0.55]]) {
    ctx.beginPath();
    ctx.moveTo(dx * s * 0.5, 0);
    ctx.quadraticCurveTo(dx * s * 1.1 + bend * s * 0.4, -s * 0.7, dx * s * 1.3 + bend * s, -s * 1.15);
    ctx.stroke();
  }
  ctx.restore();
}

/** 鹅卵石 */
export function drawPebble(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#aab3bc';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.25, r * 0.4, r * 0.24, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 灌木：三球叠色 */
export function drawBush(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#4c9e3a';
  for (const [dx, dy, r] of [[-0.55, -0.1, 0.55], [0.55, -0.1, 0.55], [0, -0.42, 0.62]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#63ba4b';
  for (const [dx, dy, r] of [[-0.5, -0.22, 0.36], [0.42, -0.3, 0.4], [0.05, -0.55, 0.34]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 小蘑菇 */
export function drawMushroom(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#efe3cf';
  ctx.fillRect(-s * 0.18, -s * 0.5, s * 0.36, s * 0.55);
  ctx.fillStyle = '#ef5350';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.5, s * 0.62, s * 0.42, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [dx, dy, r] of [[-0.28, -0.62, 0.09], [0.1, -0.78, 0.07], [0.3, -0.55, 0.06]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 扁平云朵（菜单天空用） */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number, alpha: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.arc(-s * 0.9, 0, s * 0.55, 0, Math.PI * 2);
  ctx.arc(0, -s * 0.35, s * 0.75, 0, Math.PI * 2);
  ctx.arc(s * 0.9, 0, s * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
