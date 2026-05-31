import type { AttendanceEvent } from './EventStore';

export interface SyncResult {
  ackedIds: string[];    // event IDs the server confirmed
  failedIds: string[];   // event IDs that failed (will retry)
}

export interface CloudSync {
  /** Upload a batch of events. Returns acked IDs for two-phase delete. */
  uploadBatch(events: AttendanceEvent[]): Promise<SyncResult>;
  readonly name: string; // 'noop' | 'amplify'
}
