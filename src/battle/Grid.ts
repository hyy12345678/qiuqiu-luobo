import { CELL } from './Path';
import { distToPolyline } from '../utils/math';

export interface Cell {
  col: number;
  row: number;
}

const COLS = 16;
const ROWS = 9;

/** 建造网格：预计算哪些格子被路面/南瓜占用，不可建造（支持多条路径） */
export class Grid {
  private blocked = new Set<number>();

  constructor(pathPolylines: Array<Array<{ x: number; y: number }>>, pumpkin: { x: number; y: number }) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cx = col * CELL + CELL / 2;
        const cy = row * CELL + CELL / 2;
        const nearRoad = pathPolylines.some((pts) => distToPolyline(cx, cy, pts) < 58);
        if (nearRoad || Math.hypot(cx - pumpkin.x, cy - pumpkin.y) < 95) {
          this.blocked.add(row * COLS + col);
        }
      }
    }
  }

  worldToCell(x: number, y: number): Cell | null {
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    return this.isInside(col, row) ? { col, row } : null;
  }

  isInside(col: number, row: number): boolean {
    return col >= 0 && col < COLS && row >= 0 && row < ROWS;
  }

  isBuildable(col: number, row: number): boolean {
    return this.isInside(col, row) && !this.blocked.has(row * COLS + col);
  }

  cellCenter(col: number, row: number): { x: number; y: number } {
    return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
  }

  static key(col: number, row: number): number {
    return row * COLS + col;
  }
}
