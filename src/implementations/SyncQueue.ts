/**
 * SyncQueue — resilient two-phase upload with exponential backoff.
 *
 * Phase 1: Upload batch → get ACK'd IDs
 * Phase 2: Mark those IDs synced=true in SQLite → then purge on user request
 *
 * Records are NEVER deleted before server ACK.
 */
import NetInfo from '@react-native-community/netinfo';
import type { EventStore } from '../interfaces/EventStore';
import type { CloudSync } from '../interfaces/CloudSync';

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

export class SyncQueue {
  private running = false;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private eventStore: EventStore,
    private cloudSync: CloudSync,
  ) {}

  /** Start watching connectivity and auto-sync when online. */
  startWatching(): void {
    this.unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        void this.sync();
      }
    });
  }

  stopWatching(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Manually trigger a sync attempt. */
  async sync(): Promise<{ uploaded: number; failed: number }> {
    if (this.running) return { uploaded: 0, failed: 0 };
    this.running = true;
    let uploaded = 0;
    let failed = 0;
    try {
      const pending = await this.eventStore.listPending();
      if (pending.length === 0) return { uploaded: 0, failed: 0 };

      const result = await this.uploadWithRetry(pending);
      // PHASE 2: mark as synced ONLY after server ACK
      if (result.ackedIds.length > 0) {
        await this.eventStore.markSynced(result.ackedIds);
        uploaded = result.ackedIds.length;
      }
      failed = result.failedIds.length;
    } finally {
      this.running = false;
    }
    return { uploaded, failed };
  }

  private async uploadWithRetry(events: Parameters<CloudSync['uploadBatch']>[0]) {
    let attempt = 0;
    let remaining = events;
    const allAcked: string[] = [];
    const allFailed: string[] = [];

    while (remaining.length > 0 && attempt < MAX_RETRIES) {
      const result = await this.cloudSync.uploadBatch(remaining);
      allAcked.push(...result.ackedIds);

      if (result.failedIds.length === 0) break;

      // Retry only the failed subset
      remaining = remaining.filter(e => result.failedIds.includes(e.eventId));
      attempt++;
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await new Promise<void>(res => { setTimeout(() => res(), backoff); });
      } else {
        allFailed.push(...result.failedIds);
      }
    }

    return { ackedIds: allAcked, failedIds: allFailed };
  }
}
