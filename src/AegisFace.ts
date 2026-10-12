/**
 * AegisFace — Public Module API
 *
 * This is the single integration surface that Datalake 3.0 (or any
 * external consumer) calls.  Import only from this file.
 *
 * Usage:
 *   import { enroll, authenticate, listPendingEvents, syncNow, purgeSynced } from './AegisFace';
 */
import { v4 as uuidv4 } from 'uuid';
import { MMKV } from 'react-native-mmkv';

import { faceDetector } from './implementations/MediaPipeFaceDetector';
import { MockEmbedder } from './implementations/MockEmbedder';
import { TfliteFaceEmbedder, tfliteEmbedder } from './implementations/TfliteFaceEmbedder';
import { templateStore } from './implementations/EncryptedTemplateStore';
import { eventStore } from './implementations/SqliteEventStore';
import { noopSync } from './implementations/NoopSync';
import { amplifySync } from './implementations/AmplifySync';
import { SyncQueue } from './implementations/SyncQueue';
import { antiSpoof } from './implementations/PassiveAntiSpoof';
import { cosineSimilarity } from './utils/geometry';
import { alignFaceCrop } from './utils/imageProcessing';
import { makeStopwatch, logPerfTable } from './utils/performance';
import {
  USE_MOCK_EMBEDDER,
  USE_AMPLIFY_SYNC,
  ENABLE_PASSIVE_ANTISPOOF,
  MATCH_THRESHOLD_TAU,
  ENROLL_FRAMES,
} from './config/constants';

// ─── Stable device ID ───────────────────────────────────────────────────────

let _deviceStore: MMKV | null = null;
function getDeviceId(): string {
  if (!_deviceStore) _deviceStore = new MMKV({ id: 'aegisface.device' });
  let id = _deviceStore.getString('deviceId');
  if (!id) { id = uuidv4(); _deviceStore.set('deviceId', id); }
  return id;
}

// ─── Singleton wiring ───────────────────────────────────────────────────────

const embedder = USE_MOCK_EMBEDDER ? new MockEmbedder() : tfliteEmbedder;
const cloudSync = USE_AMPLIFY_SYNC ? amplifySync : noopSync;
export const syncQueue = new SyncQueue(eventStore, cloudSync);

// ─── Bootstrap ──────────────────────────────────────────────────────────────

let _bootstrapped = false;
export async function bootstrap(): Promise<void> {
  if (_bootstrapped) return;
  if (embedder instanceof TfliteFaceEmbedder) await embedder.load();
  if (ENABLE_PASSIVE_ANTISPOOF) await antiSpoof.load();
  syncQueue.startWatching();
  _bootstrapped = true;
}

// ─── enroll() ───────────────────────────────────────────────────────────────

export interface EnrollOptions {
  /** Raw camera frame data for the enrollment. Call ENROLL_FRAMES times. */
  frames: Array<{
    pixelBuffer: ArrayBuffer;
    width: number;
    height: number;
    format: string;
  }>;
}

export async function enroll(
  userId: string,
  options: EnrollOptions,
): Promise<{ ok: boolean; templates: number }> {
  const embeddings: Float32Array[] = [];

  for (const frame of options.frames.slice(0, ENROLL_FRAMES)) {
    const faces = await faceDetector.detect(frame.pixelBuffer, frame.width, frame.height, frame.format);
    if (faces.length === 0) continue;

    const face = faces[0]!;
    const crop = alignFaceCrop(
      frame.pixelBuffer, frame.width, frame.height,
      frame.format === 'rgb' ? 'rgb' : 'rgba',
      face.bbox, face.landmarks,
    );
    const embedding = await embedder.embed(crop, 112, 112);
    embeddings.push(embedding);
  }

  if (embeddings.length === 0) return { ok: false, templates: 0 };
  await templateStore.save(userId, embeddings);
  return { ok: true, templates: embeddings.length };
}

// ─── authenticate() ─────────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  userId?: string;
  score: number;
  livenessPassed: boolean;
  antiSpoofPassed: boolean;
  eventId: string;
  perfMs: number;
}

/**
 * 1:N authentication against all enrolled users.
 * Liveness result must be passed in — the caller drives the camera loop.
 */
export async function authenticate(options: {
  pixelBuffer: ArrayBuffer;
  width: number;
  height: number;
  format: string;
  livenessPassed: boolean;
}): Promise<AuthResult> {
  const sw = makeStopwatch();
  const eventId = uuidv4();

  // Detect
  const faces = await faceDetector.detect(options.pixelBuffer, options.width, options.height, options.format);
  const detectMs = sw.lap();

  if (faces.length === 0) {
    return {
      success: false, score: 0,
      livenessPassed: options.livenessPassed, antiSpoofPassed: false,
      eventId, perfMs: detectMs,
    };
  }

  // Align
  const face = faces[0]!;
  const crop = alignFaceCrop(
    options.pixelBuffer, options.width, options.height,
    options.format === 'rgb' ? 'rgb' : 'rgba',
    face.bbox, face.landmarks,
  );
  const alignMs = sw.lap();

  // Passive anti-spoof (runs on the aligned 112×112 crop)
  let antiSpoofPassed = true;
  if (ENABLE_PASSIVE_ANTISPOOF) {
    const as = await antiSpoof.predict(crop, 112, 112);
    antiSpoofPassed = as.passed;
  }

  // Embed
  const queryEmb = await embedder.embed(crop, 112, 112);
  const embedMs = sw.lap();

  // Match 1:N
  const templates = await templateStore.loadAll();
  let bestScore = 0;
  let bestUserId: string | undefined;

  for (const tpl of templates) {
    for (const storedVec of tpl.embeddings) {
      const sim = cosineSimilarity(queryEmb, new Float32Array(storedVec));
      if (sim > bestScore) {
        bestScore = sim;
        bestUserId = tpl.userId;
      }
    }
  }
  const matchMs = sw.lap();
  const totalMs = detectMs + alignMs + embedMs + matchMs;

  logPerfTable('authenticate', { detect: detectMs, align: alignMs, embed: embedMs, match: matchMs, total: totalMs });

  const success = bestScore >= MATCH_THRESHOLD_TAU && options.livenessPassed && antiSpoofPassed;

  // Persist event — NEVER store face image
  const deviceId = getDeviceId();
  await eventStore.insert({
    eventId,
    userId: bestUserId ?? 'UNKNOWN',
    timestamp: Date.now(),
    score: bestScore,
    livenessPassed: options.livenessPassed,
    deviceId,
    synced: false,
  } as Parameters<typeof eventStore.insert>[0]);

  // Purge crop immediately (never persisted — this is just a local variable GC hint)
  // The JS GC will collect `crop` once this function returns.

  return {
    success,
    userId: success ? bestUserId : undefined,
    score: bestScore,
    livenessPassed: options.livenessPassed,
    antiSpoofPassed,
    eventId,
    perfMs: totalMs,
  };
}

// ─── Event management ────────────────────────────────────────────────────────

export async function listPendingEvents() {
  return eventStore.listPending();
}

export async function listAllEvents() {
  return eventStore.listAll();
}

export async function syncNow() {
  return syncQueue.sync();
}

export async function purgeSynced() {
  return eventStore.deleteSynced();
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export { embedder, faceDetector };
export type { AuthResult as AegisAuthResult };
