/**
 * EncryptedTemplateStore — stores face embeddings encrypted in SQLite.
 *
 * Uses @op-engineering/op-sqlite for the database and AES-256-GCM
 * from src/utils/cryptography.ts for encryption.
 *
 * Raw images are NEVER stored — only encrypted Float32 embeddings.
 */
import { open, type DB } from '@op-engineering/op-sqlite';
import type { EnrolledTemplate, TemplateStore } from '../interfaces/TemplateStore';
import { encryptEmbedding, decryptEmbedding } from '../utils/cryptography';
import { DB_NAME } from '../config/constants';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS templates (
    user_id   TEXT    NOT NULL,
    idx       INTEGER NOT NULL,
    enc_blob  TEXT    NOT NULL,
    enrolled_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, idx)
  );
`;

let db: DB | null = null;

async function getDb(): Promise<DB> {
  if (!db) {
    db = open({ name: DB_NAME });
    await db.execute(CREATE_TABLE);
  }
  return db;
}

export class EncryptedTemplateStore implements TemplateStore {
  async save(userId: string, embeddings: Float32Array[]): Promise<void> {
    const conn = await getDb();
    const now = Date.now();
    await conn.execute('DELETE FROM templates WHERE user_id = ?', [userId]);
    for (let i = 0; i < embeddings.length; i++) {
      const blob = await encryptEmbedding(embeddings[i]!);
      await conn.execute(
        'INSERT INTO templates (user_id, idx, enc_blob, enrolled_at) VALUES (?, ?, ?, ?)',
        [userId, i, blob, now],
      );
    }
  }

  async loadAll(): Promise<EnrolledTemplate[]> {
    const conn = await getDb();
    const result = await conn.execute(
      'SELECT user_id, idx, enc_blob, enrolled_at FROM templates ORDER BY user_id, idx',
    );
    return buildTemplates(result.rows);
  }

  async load(userId: string): Promise<EnrolledTemplate | null> {
    const conn = await getDb();
    const result = await conn.execute(
      'SELECT user_id, idx, enc_blob, enrolled_at FROM templates WHERE user_id = ? ORDER BY idx',
      [userId],
    );
    if (result.rows.length === 0) return null;
    const templates = await buildTemplates(result.rows);
    return templates[0] ?? null;
  }

  async delete(userId: string): Promise<void> {
    const conn = await getDb();
    await conn.execute('DELETE FROM templates WHERE user_id = ?', [userId]);
  }

  async count(): Promise<number> {
    const conn = await getDb();
    const result = await conn.execute(
      'SELECT COUNT(DISTINCT user_id) as cnt FROM templates',
    );
    return (result.rows[0]?.['cnt'] as number) ?? 0;
  }
}

async function buildTemplates(rows: Record<string, unknown>[]): Promise<EnrolledTemplate[]> {
  const byUser = new Map<string, { embeddings: Float32Array[]; enrolledAt: number }>();
  for (const row of rows) {
    const userId = row['user_id'] as string;
    const blob = row['enc_blob'] as string;
    const enrolledAt = row['enrolled_at'] as number;
    const embedding = await decryptEmbedding(blob);
    if (!byUser.has(userId)) byUser.set(userId, { embeddings: [], enrolledAt });
    byUser.get(userId)!.embeddings.push(embedding);
  }
  return Array.from(byUser.entries()).map(([userId, { embeddings, enrolledAt }]) => ({
    userId,
    embeddings: embeddings.map(e => Array.from(e)),
    enrolledAt,
  }));
}

export const templateStore = new EncryptedTemplateStore();
