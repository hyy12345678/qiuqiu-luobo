/** 金币经济：只管收支，不关心来源 */
export class Economy {
  constructor(public gold: number) {}

  canAfford(n: number): boolean {
    return this.gold >= n;
  }

  spend(n: number): boolean {
    if (!this.canAfford(n)) return false;
    this.gold -= n;
    return true;
  }

  add(n: number): void {
    this.gold += n;
  }
}
