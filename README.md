# AegisFace

> **Fully offline facial recognition + liveness detection for field personnel attendance**
> 
> React Native · TypeScript · MediaPipe · TFLite INT8 · Zero network inference

---

## Overview

AegisFace is a cross-platform (Android 8.0+ / iOS 12+) React Native module that runs the entire face recognition and liveness pipeline **on-device with zero network**. Attendance events are queued locally and synced to the cloud only when a connection is available, with two-phase confirmation before any local purge.

| Property | Value |
|---|---|
| Platforms | Android 8.0+ (API 26+), iOS 12+ |
| RAM requirement | ≥ 2 GB (targets 3 GB mid-range) |
| Model bundle size | ≤ 8 MB (INT8 TFLite) |
| Verification latency | < 1 s on mid-range hardware |
| Network dependency | Zero (inference) / Optional (sync only) |
| Licence | MIT — all deps MIT/Apache-2.0 |

---

## Quick start (demo mode with MockEmbedder)

```bash
# Prerequisites: Node 18+, JDK 17+, Android SDK (API 26+)
git clone https://github.com/Ankit-Mahadani/AegisFace-nhai.git
cd AegisFace-nhai
npm install

# Set ANDROID_HOME (Windows PowerShell)
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

# Connect Android device / start emulator, then:
npm run android
```

The app starts with `MockEmbedder` enabled — the full UI, liveness challenges, enrollment, attendance records, and sync flow all work without a real model.

---

## Architecture overview

```
src/
├── AegisFace.ts              Public API (enroll / authenticate / sync)
├── config/constants.ts       All tunable thresholds (TAU, EAR, etc.)
├── interfaces/               TypeScript contracts for each subsystem
├── implementations/          Concrete implementations
│   ├── MediaPipeFaceDetector  Wraps native AegisFaceMediaPipe module
│   ├── MockEmbedder           Deterministic fake (demo)
│   ├── TfliteFaceEmbedder     Real MobileFaceNet INT8 (needs .tflite)
│   ├── ChallengeLivenessEngine BLINK/SMILE/TURN state machine
│   ├── EncryptedTemplateStore  AES-256-GCM SQLite
│   ├── SqliteEventStore        Attendance log
│   ├── SyncQueue               NetInfo + backoff + two-phase purge
│   ├── NoopSync                Default stub (no AWS needed)
│   └── AmplifySync             Real sync (configure AWS separately)
├── native/MediaPipeModule.ts  JS bridge to native (with JS stub fallback)
├── utils/                     geometry, cryptography, imageProcessing, perf
├── components/                FaceOverlay, LivenessPrompt, OnlineIndicator
├── screens/                   Home, Enroll, Authenticate, Records
└── navigation/AppNavigator.tsx
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full data-flow diagram.

---

## On-device recognition pipeline

```
Frame → [Detect] MediaPipe 468 landmarks
      → [Align]  112×112 crop + CLAHE normalisation
      → [Embed]  MobileFaceNet INT8 → 128-d L2-normalised vector
      → [Match]  Cosine similarity ≥ TAU (default 0.50)
```

All four stages run on the device. The network is never touched during inference.

---

## Liveness detection

A randomised 2–3 challenge sequence is generated per session from:
`BLINK | SMILE | TURN_LEFT | TURN_RIGHT`

Each challenge is detected from MediaPipe landmarks:
- **BLINK**: Eye Aspect Ratio (EAR) drops then recovers
- **SMILE**: Mouth Aspect Ratio / blendshape threshold
- **TURN**: Head yaw from nose-tip + ear landmark geometry

A photo or screen replay cannot pass because the sequence is unknown until runtime and EAR/MAR require temporal change.

---

## Integration guide for Datalake 3.0

### 1. Add the package

```bash
npm install  # AegisFace is a local module in your repo
```

### 2. Bundle the model

Copy `mobilefacenet_int8.tflite` to `models/` (see `models/README.md`).

### 3. Camera permission

**Android** (`AndroidManifest.xml`) — already set:
```xml
<uses-permission android:name="android.permission.CAMERA"/>
```

**iOS** (`Info.plist`) — already set:
```xml
<key>NSCameraUsageDescription</key>
<string>AegisFace uses the camera for facial recognition...</string>
```

### 4. Bootstrap + call enroll

```typescript
import { bootstrap, enroll } from './src/AegisFace';

// Call once at app start
await bootstrap();

// Enroll a user (supply 1–3 camera frames)
const result = await enroll('EMP-001', {
  frames: [{ pixelBuffer, width, height, format: 'rgb' }]
});
// result.ok === true, result.templates === 1
```

### 5. Call authenticate

```typescript
import { authenticate } from './src/AegisFace';

const result = await authenticate({
  pixelBuffer, width, height, format: 'rgb',
  livenessPassed,  // from ChallengeLivenessEngine
});

// result.success    — true if score ≥ TAU and livenessPassed
// result.userId     — matched user or undefined
// result.score      — cosine similarity [0,1]
// result.eventId    — UUID (idempotency key for sync)
// result.perfMs     — total end-to-end latency
```

### 6. Consume attendance events

```typescript
import { listPendingEvents, syncNow, purgeSynced } from './src/AegisFace';

// Events are automatically synced when online (SyncQueue watches NetInfo)
// Manually trigger:
await syncNow();

// Purge locally only after server ACK (two-phase):
await purgeSynced();
```

---

## Plug in the real model

1. Obtain `mobilefacenet_int8.tflite` — see `models/README.md` for sources
2. Run conversion if needed: `python tools/convert_model.py weights.onnx models/mobilefacenet_int8.tflite`
3. Set `USE_MOCK_EMBEDDER = false` in `src/config/constants.ts`
4. Rebuild: `npm run android`

---

## AWS sync setup (optional)

1. `npm install aws-amplify @aws-amplify/datastore`
2. Run `amplify init && amplify add api` (REST or GraphQL)
3. Create `src/config/aws.ts` with your Amplify config
4. Implement the TODO block in `src/implementations/AmplifySync.ts`
5. Set `USE_AMPLIFY_SYNC = true` in `src/config/constants.ts`

No biometric images are ever uploaded — only: eventId, userId, timestamp, score, livenessPassed, deviceId.

---

## Android build setup (Windows)

```powershell
# Set ANDROID_HOME
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"

# Required Java: JDK 17 or 21 (JDK 24 may have issues with some Gradle plugins)
# If build fails with Java 24, install JDK 17:
#   https://adoptium.net/temurin/releases/?version=17
```

---

## iOS build (macOS only)

```bash
cd ios && pod install && cd ..
npm run ios
```

---

## Benchmark methodology

After integrating the real model, measure accuracy on a labelled dataset:

1. Collect genuine pairs (same person, different session) and impostor pairs
2. Run each pair through `authenticate()`, collect scores
3. Plot ROC curve (TAR vs FAR)
4. Pick TAU at your target FAR (e.g. 1%)
5. Fill in `ARCHITECTURE.md §Benchmarking`

Expected latency breakdown (target hardware: Snapdragon 665, 4 GB RAM):

| Stage | Target |
|---|---|
| Detect (MediaPipe) | < 80 ms |
| Align + CLAHE | < 20 ms |
| Embed (INT8 TFLite + NNAPI) | < 300 ms |
| Match (50 users) | < 10 ms |
| **Total** | **< 410 ms** |

---

## Project structure quick reference

| Path | Purpose |
|---|---|
| `src/AegisFace.ts` | Public API |
| `src/config/constants.ts` | All tunable thresholds |
| `src/interfaces/` | TypeScript contracts |
| `src/implementations/` | Concrete implementations |
| `src/native/MediaPipeModule.ts` | Native module JS bridge |
| `android/…/mediapipe/` | Android Kotlin native module |
| `ios/AegisFace/MediaPipeModule.swift` | iOS Swift native module |
| `models/` | Place .tflite files here |
| `tools/convert_model.py` | ONNX/Keras → INT8 TFLite converter |
| `TODO.md` | Remaining human tasks |
| `ARCHITECTURE.md` | Full design document |
| `LICENSES.md` | Dependency licence audit |
