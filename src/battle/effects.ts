interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

interface Poof {
  x: number;
  y: number;
  scale: number;
  color: string;
  t: number;
}

const FLOAT_DUR = 0.9;
const POOF_DUR = 0.38;
/** 烟云的四个小球（相对偏移与半径），模块级常量避免每帧分配 */
const PUFF_BALLS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.5, -0.15, 0.55], [0.5, -0.1, 0.5], [0, -0.5, 0.6], [0, 0.05, 0.65],
];

/** 轻量特效层：飘字（金币/伤害）与烟雾团（死亡/建造） */
export class Effects {
  private floats: FloatText[] = [];
  private poofs: Poof[] = [];

  floatText(x: number, y: number, text: string, color = '#ffd54f'): void {
    if (this.floats.length >= 40) this.floats.shift();
    this.floats.push({ x, y, text, color, t: 0 });
  }

  poof(x: number, y: number, scale = 26, color = '#fbfbf4'): void {
    if (this.poofs.length >= 30) this.poofs.shift();
    this.poofs.push({ x, y, scale, color, t: 0 });
  }

  update(dt: number): void {
    // 原地压缩，不每帧新建数组
    let n = 0;
    for (const f of this.floats) {
      f.t += dt;
      if (f.t < FLOAT_DUR) this.floats[n++] = f;
    }
    this.floats.length = n;
    n = 0;
    for (const p of this.poofs) {
      p.t += dt;
      if (p.t < POOF_DUR) this.poofs[n++] = p;
    }
    this.poofs.length = n;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.poofs) {
      const k = p.t / POOF_DUR;
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.fillStyle = p.color;
      // 一团四球的小烟云，随时间扩散
      for (const [dx, dy, r] of PUFF_BALLS) {
        ctx.beginPath();
        ctx.arc(p.x + dx * p.scale, p.y + dy * p.scale - k * 8, r * p.scale * (0.5 + k * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.font = 'bold 22px system-ui, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / FLOAT_DUR;
      ctx.globalAlpha = 1 - k * k;
      const y = f.y - k * 34;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(40,25,5,0.75)';
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }
}
