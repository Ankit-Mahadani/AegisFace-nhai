export interface AttendanceEvent {
  eventId: string;      // uuid v4 — also the idempotency key for sync
  userId: string;
  timestamp: number;    // Unix epoch ms
  score: number;        // cosine similarity [0, 1]
  livenessPassed: boolean;
  deviceId: string;
  geo?: { lat: number; lon: number };
  synced: boolean;
}

export interface EventStore {
  insert(event: Omit<AttendanceEvent, 'synced'>): Promise<void>;
  listPending(): Promise<AttendanceEvent[]>;
  /** Mark a batch as synced — called ONLY after server ACK (two-phase). */
  markSynced(eventIds: string[]): Promise<void>;
  /** Hard-delete records that have been confirmed synced. */
  deleteSynced(): Promise<number>;
  listAll(): Promise<AttendanceEvent[]>;
}
