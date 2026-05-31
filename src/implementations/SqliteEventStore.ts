import { open, type DB } from '@op-engineering/op-sqlite';
import type { AttendanceEvent, EventStore } from '../interfaces/EventStore';
import { DB_NAME } from '../config/constants';

const CREATE_EVENTS = `
  CREATE TABLE IF NOT EXISTS events (
    event_id        TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL,
    timestamp       INTEGER NOT NULL,
    score           REAL    NOT NULL,
    liveness_passed INTEGER NOT NULL,
    device_id       TEXT    NOT NULL,
    geo_lat         REAL,
    geo_lon         REAL,
    synced          INTEGER NOT NULL DEFAULT 0
  );
`;

let db: DB | null = null;

async function getDb(): Promise<DB> {
  if (!db) {
    db = open({ name: DB_NAME });
    await db.execute(CREATE_EVENTS);
  }
  return db;
}

function rowToEvent(r: Record<string, unknown>): AttendanceEvent {
  return {
    eventId: r['event_id'] as string,
    userId: r['user_id'] as string,
    timestamp: r['timestamp'] as number,
    score: r['score'] as number,
    livenessPassed: (r['liveness_passed'] as number) === 1,
    deviceId: r['device_id'] as string,
    geo: r['geo_lat'] != null ? { lat: r['geo_lat'] as number, lon: r['geo_lon'] as number } : undefined,
    synced: (r['synced'] as number) === 1,
  };
}

export class SqliteEventStore implements EventStore {
  async insert(event: Omit<AttendanceEvent, 'synced'>): Promise<void> {
    const conn = await getDb();
    await conn.execute(
      `INSERT OR IGNORE INTO events
        (event_id, user_id, timestamp, score, liveness_passed, device_id, geo_lat, geo_lon, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        event.eventId,
        event.userId,
        event.timestamp,
        event.score,
        event.livenessPassed ? 1 : 0,
        event.deviceId,
        event.geo?.lat ?? null,
        event.geo?.lon ?? null,
      ],
    );
  }

  async listPending(): Promise<AttendanceEvent[]> {
    const conn = await getDb();
    const r = await conn.execute('SELECT * FROM events WHERE synced = 0 ORDER BY timestamp');
    return r.rows.map(rowToEvent);
  }

  async markSynced(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const conn = await getDb();
    const placeholders = eventIds.map(() => '?').join(',');
    await conn.execute(
      `UPDATE events SET synced = 1 WHERE event_id IN (${placeholders})`,
      eventIds,
    );
  }

  async deleteSynced(): Promise<number> {
    const conn = await getDb();
    const r = await conn.execute('DELETE FROM events WHERE synced = 1');
    return r.rowsAffected ?? 0;
  }

  async listAll(): Promise<AttendanceEvent[]> {
    const conn = await getDb();
    const r = await conn.execute('SELECT * FROM events ORDER BY timestamp DESC');
    return r.rows.map(rowToEvent);
  }
}

export const eventStore = new SqliteEventStore();
