import fs from 'node:fs';
import path from 'node:path';
import type { RecentEvent } from './types.js';
import { makeId, nowIso } from './utils.js';

export class MemoryStore {
  private readonly recentEvents: RecentEvent[] = [];
  private readonly seenKeys = new Set<string>();
  private readonly state = new Map<string, unknown>();
  private readonly ttlKeys = new Map<string, number>();
  private readonly maxEvents: number;
  private readonly stateFilePath?: string;

  constructor(maxEvents = 200, stateFilePath?: string) {
    this.maxEvents = maxEvents;
    this.stateFilePath = stateFilePath;
    this.loadPersistentState();
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
    this.persistState();
  }

  getState<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  hasRecentKey(key: string): boolean {
    this.cleanupTtlKeys();
    const expiresAt = this.ttlKeys.get(key);
    return typeof expiresAt === 'number' && expiresAt > Date.now();
  }

  rememberKeyWithTtl(key: string, ttlMs: number): void {
    this.cleanupTtlKeys();
    this.ttlKeys.set(key, Date.now() + Math.max(ttlMs, 1000));
  }

  private loadPersistentState(): void {
    if (!this.stateFilePath) return;
    try {
      if (!fs.existsSync(this.stateFilePath)) return;
      const raw = fs.readFileSync(this.stateFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        this.state.set(key, value);
      }
    } catch {
      // Ignore corrupt/missing state files and continue with empty state.
    }
  }

  private cleanupTtlKeys(): void {
    if (this.ttlKeys.size === 0) return;
    const now = Date.now();
    for (const [key, expiresAt] of this.ttlKeys.entries()) {
      if (expiresAt <= now) this.ttlKeys.delete(key);
    }
  }

  private persistState(): void {
    if (!this.stateFilePath) return;
    const dir = path.dirname(this.stateFilePath);
    const lockPath = `${this.stateFilePath}.lock`;
    const tmpPath = `${this.stateFilePath}.tmp`;
    let lockFd: number | undefined;

    try {
      fs.mkdirSync(dir, { recursive: true });
      lockFd = this.acquireLock(lockPath);
      const payload = Object.fromEntries(this.state.entries());
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.stateFilePath);
    } catch {
      // Do not crash runtime on state persistence errors.
    } finally {
      try {
        if (lockFd !== undefined) fs.closeSync(lockFd);
      } catch {
        // noop
      }
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // noop
      }
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {
        // noop
      }
    }
  }

  private acquireLock(lockPath: string): number {
    const deadline = Date.now() + 1000;
    for (;;) {
      try {
        return fs.openSync(lockPath, 'wx');
      } catch (error) {
        if (Date.now() >= deadline) {
          throw error;
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
      }
    }
  }
}
