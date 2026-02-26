import type { RecentEvent } from './types.js';
import { makeId, nowIso } from './utils.js';

export class MemoryStore {
  private readonly recentEvents: RecentEvent[] = [];
  private readonly seenKeys = new Set<string>();
  private readonly state = new Map<string, unknown>();
  private readonly maxEvents: number;

  constructor(maxEvents = 200) {
    this.maxEvents = maxEvents;
  }

  hasSeen(key: string): boolean {
    return this.seenKeys.has(key);
  }

  remember(key: string): void {
    this.seenKeys.add(key);
  }

  addEvent(event: Omit<RecentEvent, 'id' | 'createdAt'>): RecentEvent {
    const full: RecentEvent = { id: makeId(event.kind), createdAt: nowIso(), ...event };
    this.recentEvents.unshift(full);
    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents.length = this.maxEvents;
    }
    return full;
  }

  listEvents(limit = 50): RecentEvent[] {
    return this.recentEvents.slice(0, limit);
  }

  setState<T>(key: string, value: T): void {
    this.state.set(key, value);
  }

  getState<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }
}
