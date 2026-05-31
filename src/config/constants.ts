// ─── Recognition thresholds ────────────────────────────────────────────────
// TAU must be tuned on a validation ROC curve.
// At cosine similarity (dot-product of L2-normalised vectors):
//   0.40 → permissive  (~FAR 5 %)
//   0.50 → balanced    (~FAR 1 %)   ← default
//   0.60 → strict      (~FAR 0.1 %)
// Run tools/bench_tau.py on a labelled set to pick the right trade-off.
export const MATCH_THRESHOLD_TAU = 0.50;

// Number of enrollment frames captured per user (varied pose / expression)
export const ENROLL_FRAMES = 3;

// ─── Liveness ──────────────────────────────────────────────────────────────
export const LIVENESS_CHALLENGE_COUNT = 2; // challenges per session (2–3)
export const LIVENESS_WINDOW_MS = 4000;    // time allowed per challenge

// Eye Aspect Ratio blink detection
export const EAR_BLINK_THRESHOLD = 0.20;  // below this → eye closed
export const EAR_OPEN_MIN = 0.25;          // must recover above this

// Mouth / smile detection
export const SMILE_MAR_THRESHOLD = 0.35;  // Mouth Aspect Ratio min for smile

// Head turn – yaw angle in degrees
export const TURN_YAW_THRESHOLD_DEG = 20; // degrees off-centre to count as turn

// ─── Embedding ─────────────────────────────────────────────────────────────
export const EMBEDDING_DIM = 128;          // MobileFaceNet output dimension
export const INPUT_SIZE = 112;             // face crop size fed to embedder

// ─── Feature flags ─────────────────────────────────────────────────────────
// Set to false once models/ contains real .tflite files
export const USE_MOCK_EMBEDDER = true;

// Passive anti-spoof (MiniFASNet) — disabled by default; ~2 MB model needed
export const ENABLE_PASSIVE_ANTISPOOF = false;

// Set USE_AMPLIFY_SYNC = true and configure AWS in src/config/aws.ts to enable real sync
export const USE_AMPLIFY_SYNC = false;

// ─── Performance targets ───────────────────────────────────────────────────
export const PERF_TARGET_MS = 1000; // end-to-end verification target

// ─── Security ──────────────────────────────────────────────────────────────
export const KEYCHAIN_SERVICE = 'com.aegisface.embeddings';
export const DB_NAME = 'aegisface.db';
