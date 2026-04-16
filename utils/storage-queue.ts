/**
 * Storage Queue — batches and deduplicates AsyncStorage writes.
 *
 * Instead of writing to AsyncStorage on every keystroke / scroll / theme change,
 * calls are queued and flushed in a single `multiSet` every FLUSH_INTERVAL_MS.
 * Also auto-flushes when the app goes to background.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { logger } from './logger';

const FLUSH_INTERVAL_MS = 2000;

class StorageQueueImpl {
  private queue: Map<string, string> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  constructor() {
    // Auto-flush when app backgrounds
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppState);
  }

  private handleAppState = (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') {
      this.flush();
    }
  };

  /**
   * Enqueue a write. If the same key is already queued, it's overwritten
   * (only the latest value matters).
   */
  enqueue(key: string, value: string): void {
    this.queue.set(key, value);
    this.scheduleFlush();
  }

  /**
   * Enqueue a write with JSON serialization.
   */
  enqueueJSON(key: string, value: unknown): void {
    this.enqueue(key, JSON.stringify(value));
  }

  /**
   * Schedule a flush if one isn't already pending.
   */
  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Immediately flush all pending writes as a single multiSet.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.size === 0) return;

    this.flushing = true;
    // Snapshot the current queue and clear it
    const snapshot = new Map(this.queue);
    this.queue.clear();

    try {
      const pairs: [string, string][] = Array.from(snapshot.entries());
      await AsyncStorage.multiSet(pairs);
      logger.debug('StorageQueue flushed', { count: pairs.length });
    } catch (error) {
      // On failure, put items back into the queue for retry
      for (const [key, value] of snapshot) {
        if (!this.queue.has(key)) {
          this.queue.set(key, value);
        }
      }
      logger.error('StorageQueue flush failed', error);
      this.scheduleFlush();
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Convenience: read from AsyncStorage (not queued, immediate).
   * Checks the queue first for pending writes.
   */
  async get(key: string): Promise<string | null> {
    // Check pending writes first
    const pending = this.queue.get(key);
    if (pending !== undefined) return pending;
    return AsyncStorage.getItem(key);
  }

  /**
   * Convenience: read + parse JSON, with queue awareness.
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Remove a key (immediate, not queued).
   */
  async remove(key: string): Promise<void> {
    this.queue.delete(key);
    await AsyncStorage.removeItem(key);
  }

  /**
   * Remove multiple keys (immediate).
   */
  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.queue.delete(key);
    }
    await AsyncStorage.multiRemove(keys);
  }

  /**
   * Get multiple items (immediate, with queue awareness).
   */
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    const results: [string, string | null][] = [];
    const keysToFetch: string[] = [];

    for (const key of keys) {
      const pending = this.queue.get(key);
      if (pending !== undefined) {
        results.push([key, pending]);
      } else {
        keysToFetch.push(key);
      }
    }

    if (keysToFetch.length > 0) {
      const fetched = await AsyncStorage.multiGet(keysToFetch);
      results.push(...fetched);
    }

    // Sort results to match input key order
    const keyOrder = new Map(keys.map((k, i) => [k, i]));
    results.sort((a, b) => (keyOrder.get(a[0]) ?? 0) - (keyOrder.get(b[0]) ?? 0));

    return results;
  }

  /**
   * Destroy the queue (e.g. on app unmount). Flushes pending writes.
   */
  async destroy(): Promise<void> {
    await this.flush();
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.appStateSubscription?.remove();
  }
}

/** Singleton storage queue */
export const StorageQueue = new StorageQueueImpl();
