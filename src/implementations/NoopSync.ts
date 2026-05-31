/**
 * NoopSync — default CloudSync stub.
 *
 * Simulates an ACK so the two-phase purge flow works end-to-end
 * without any AWS configuration.  Logs events to the console.
 */
import type { CloudSync, SyncResult } from '../interfaces/CloudSync';
import type { AttendanceEvent } from '../interfaces/EventStore';

export class NoopSync implements CloudSync {
  readonly name = 'noop';

  async uploadBatch(events: AttendanceEvent[]): Promise<SyncResult> {
    console.log(`[NoopSync] Simulating upload of ${events.length} event(s):`,
      events.map(e => e.eventId));
    // Simulate a short network delay
    await new Promise<void>(res => { setTimeout(() => res(), 300); });
    return {
      ackedIds: events.map(e => e.eventId),
      failedIds: [],
    };
  }
}

export const noopSync = new NoopSync();
