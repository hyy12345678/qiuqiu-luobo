/** 塔与子弹可攻击对象的统一接口（怪物、障碍物都实现它） */
export interface CombatTarget {
  pos: { x: number; y: number };
  radius: number;
  readonly dead: boolean;
  takeDamage(dmg: number): void;
  /** 可被减速的对象（怪物）才实现 */
  applySlow?(ratio: number, dur: number): void;
}
