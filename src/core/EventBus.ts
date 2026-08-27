type Handler<T> = (payload: T) => void;

/** 轻量事件总线：战斗系统内部解耦用（如「怪物死亡」「萝卜受伤」） */
class EventBus {
  private map = new Map<string, Set<Handler<never>>>();

  on<T>(type: string, handler: Handler<T>): () => void {
    let set = this.map.get(type);
    if (!set) {
      set = new Set();
      this.map.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(type, handler);
  }

  off<T>(type: string, handler: Handler<T>): void {
    this.map.get(type)?.delete(handler as Handler<never>);
  }

  emit<T>(type: string, payload?: T): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const handler of set) (handler as Handler<T | undefined>)(payload);
  }
}

export const bus = new EventBus();
