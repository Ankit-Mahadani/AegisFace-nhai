# AegisFace — Architecture

## Stack choice: Expo Bare Workflow

Chosen over plain React Native CLI because:
- Config plugins reduce per-platform boilerplate for react-native-vision-camera and react-native-fast-tflite
- `expo prebuild` regenerates the native tree deterministically
- Still gives full access to android/ and ios/ for MediaPipe custom native modules

---

## Module graph

```
App.tsx
  └── AppNavigator (React Navigation)
        ├── HomeScreen
        ├── EnrollScreen ──────────────────┐
        ├── AuthenticateScreen ────────────┤
        └── RecordsScreen                  │
                                           │
  ┌────────────────────────────────────────┘
  │
  ▼  src/AegisFace.ts  (public API surface)
        │
        ├── FaceDetector (interface)
        │     └── MediaPipeFaceDetector  ──► native AegisFaceMediaPipe
        │              (JS stub if native not built)
        │
        ├── FaceEmbedder (interface)
        │     ├── MockEmbedder          ← default (USE_MOCK_EMBEDDER=true)
        │     └── TfliteFaceEmbedder   ← real (needs .tflite file)
        │              └── react-native-fast-tflite (JSI/Nitro)
        │
        ├── LivenessEngine (interface)
        │     └── ChallengeLivenessEngine
        │              (BLINK/SMILE/TURN_LEFT/TURN_RIGHT state machine)
        │
        ├── TemplateStore (interface)
        │     └── EncryptedTemplateStore
        │              └── op-sqlite  (encrypted SQLite)
        │              └── AES-256-GCM via Web Crypto API
        │              └── Key in react-native-keychain
        │
        ├── EventStore (interface)
        │     └── SqliteEventStore
        │
        └── CloudSync (interface)
              ├── NoopSync   ← default (simulates ACK)
              └── AmplifySync ← real (needs AWS config, USE_AMPLIFY_SYNC=true)
                     └── SyncQueue (NetInfo + exponential backoff + 2-phase purge)
```

---

## Per-frame pipeline (authenticate path)

```
Camera frame (VisionCamera useFrameOutput worklet)
  │
  ▼ [detect] MediaPipeFaceDetector.detectSync()
  │   → bbox + 468 landmarks + blendshapes (if available)
  │   Timing target: <80 ms (native) / ~5 ms stub
  │
  ▼ [align] imageProcessing.alignFaceCrop()
  │   → 112×112 RGB crop, histogram-equalised
  │   Timing target: <20 ms
  │
  ▼ [embed] FaceEmbedder.embed()
  │   → Float32[128] L2-normalised embedding
  │   Timing target: <300 ms (TFLite INT8 w/ NNAPI/CoreML)
  │
  ▼ [match] cosineSimilarity() vs enrolled templates
      → best score, best userId
      Timing target: <10 ms for ≤50 enrolled users
```

Total target: **<1 second end-to-end** on mid-range hardware (3 GB RAM, no dedicated GPU).

---

## Liveness state machine

```
start()
  → pick RANDOM 2-3 challenges from {BLINK, SMILE, TURN_LEFT, TURN_RIGHT}
  → state = { challenges[0].status='in_progress', passed=null }

update(state, landmarks, blendshapes)
  → detect current challenge from landmark geometry / blendshapes
  → on success: advance to next challenge
  → on LIVENESS_WINDOW_MS timeout: passed=false
  → when all challenges pass: passed=true
```

Challenge detection:
- **BLINK**: EAR (Eye Aspect Ratio) drops below `EAR_BLINK_THRESHOLD` then recovers above `EAR_OPEN_MIN`
- **SMILE**: mouth blendshape or MAR (Mouth Aspect Ratio) > `SMILE_MAR_THRESHOLD`
- **TURN_LEFT/RIGHT**: head yaw estimated from nose-tip + ear landmarks crosses `TURN_YAW_THRESHOLD_DEG`

A photo or replay attack fails because:
1. The challenge sequence is randomised at runtime (unknown to attacker)
2. EAR/MAR require temporal change — a static image cannot satisfy them

---

## Security model

- **Embeddings** are encrypted with AES-256-GCM before SQLite write
- **Encryption key** is stored in Android Keystore / iOS Secure Enclave via react-native-keychain
- **Raw images / face crops** are NEVER persisted (JS variable, collected by GC after decision)
- **Uploaded events** contain ONLY: eventId, userId, timestamp, score, livenessPassed, deviceId — NO biometrics

---

## Native MediaPipe module

### Android (Kotlin — `android/app/src/main/java/com/aegisface/mediapipe/`)

1. Add to `android/app/build.gradle`:
   ```groovy
   implementation 'com.google.mediapipe:tasks-vision:0.10.14'
   ```
2. Copy `face_landmarker.task` (Apache-2.0) to `android/app/src/main/assets/`
3. Un-comment the real implementation in `MediaPipeModule.kt`

### iOS (Swift — `ios/AegisFace/`)

1. Add to `ios/Podfile`:
   ```ruby
   pod 'MediaPipeTasksVision', '~> 0.10.14'
   ```
2. Add `face_landmarker.task` to Xcode project bundle
3. Un-comment the real implementation in `MediaPipeModule.swift`

Until the native module is built, a JS stub in `src/native/MediaPipeModule.ts`
returns a centred placeholder face so the entire UI is demoable.

---

## Two-phase sync purge

```
SyncQueue.sync()
  │
  ├── [1] eventStore.listPending()       → get unsynced events
  ├── [2] cloudSync.uploadBatch(events)  → upload + get ACK'd IDs
  ├── [3] eventStore.markSynced(acked)   → set synced=true
  │           ↑ ONLY after server ACK
  └── [4] user calls purgeSynced()       → DELETE WHERE synced=1

Records are NEVER deleted before step [3] completes successfully.
```

---

## Performance instrumentation

`src/utils/performance.ts` exposes `makeStopwatch()` and `logPerfTable()`.
Every `authenticate()` call logs a table to the console:

```
[AegisFace Perf — authenticate]
  detect :  45 ms
  align  :  12 ms
  embed  : 280 ms
  match  :   3 ms
  ─────────────────────
  TOTAL  : 340 ms  (target <1000 ms)
```

The `perfMs` field is also returned in `AuthResult` and shown on the UI.

---

## Accuracy benchmarking (fill in after model integration)

| Threshold (TAU) | TAR @ FAR=1% | TAR @ FAR=0.1% | Notes |
|---|---|---|---|
| 0.40 | TODO | TODO | permissive |
| 0.50 | TODO | TODO | balanced (default) |
| 0.60 | TODO | TODO | strict |

Methodology: run `tools/bench_tau.py` (TODO) on a labelled dataset split
(LFW or a field-collected set with N ≥ 100 genuine pairs, N ≥ 1000 impostors).
Plot the ROC curve and pick TAU at the FAR operating point matching your
security/convenience trade-off.
