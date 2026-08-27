export const CELL = 80;

export interface PathPoint {
  x: number;
  y: number;
  angle: number;
}

/** 固定路径：按格子坐标给出拐点，支持按里程取位置（怪物移动的基础） */
export class Path {
  readonly points: Array<{ x: number; y: number }> = [];
  private cum: number[] = [];
  readonly total: number;

  constructor(cells: ReadonlyArray<readonly [number, number]>) {
    this.points = cells.map(([col, row]) => ({
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
    }));
    let acc = 0;
    this.cum.push(0);
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      acc += Math.hypot(b.x - a.x, b.y - a.y);
      this.cum.push(acc);
    }
    this.total = acc;
  }

  /** 里程 d 处的坐标与朝向（自动循环取模） */
  getPos(d: number): PathPoint {
    let dd = d % this.total;
    if (dd < 0) dd += this.total;
    let i = 0;
    while (i < this.cum.length - 2 && this.cum[i + 1] < dd) i++;
    const a = this.points[i];
    const b = this.points[i + 1];
    const t = (dd - this.cum[i]) / (this.cum[i + 1] - this.cum[i]);
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
}
