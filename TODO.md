# AegisFace — TODO

## TODO(human) — needs your input or a physical device

- [ ] **Model weights**: Obtain `mobilefacenet_int8.tflite` (see `models/README.md`)
      and drop it in `models/`. Then set `USE_MOCK_EMBEDDER = false` in `src/config/constants.ts`.

- [ ] **face_landmarker.task**: Download from MediaPipe (Apache-2.0).
      Copy to `android/app/src/main/assets/` and add to iOS Xcode bundle.
      Then un-comment the real MediaPipe code in `MediaPipeModule.kt` and `MediaPipeModule.swift`.

- [ ] **Free up C: drive space** (currently 100% full): The NDK (27.1.12297006) partially
      installed at `%LOCALAPPDATA%\Android\Sdk\ndk\27.1.12297006` but has no files.
      Free ≥ 2 GB on C:, then reinstall NDK via Android Studio SDK Manager or:
      ```
      %LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager "ndk;27.1.12297006"
      ```
      Then re-run `npm run android`.
      Note: Gradle 9.3.1 + Java 24 patches are already applied (foojay removed, jvmToolchain=24).

- [ ] **Android build**: Set `ANDROID_HOME` env var to your SDK path:
      ```
      $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
      $env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"
      ```
      Then run: `npm run android`

- [ ] **iOS build (macOS required)**: 
      ```
      cd ios && pod install && cd ..
      npm run ios
      ```

- [ ] **MediaPipe Android**: Add to `android/app/build.gradle`:
      ```groovy
      implementation 'com.google.mediapipe:tasks-vision:0.10.14'
      ```
      Un-comment the real code in `MediaPipeModule.kt`.

- [ ] **MediaPipe iOS**: Add to `ios/Podfile`:
      ```ruby
      pod 'MediaPipeTasksVision', '~> 0.10.14'
      ```
      Un-comment the real code in `MediaPipeModule.swift`.

- [ ] **AWS (optional)**: Configure Amplify for real cloud sync.
      Follow the guide in `README.md §AWS-Setup`.
      Set `USE_AMPLIFY_SYNC = true` in `src/config/constants.ts`.

- [ ] **TAU calibration**: After integrating the real model, collect a labelled
      validation set and run accuracy benchmarks. Fill in the results table
      in `ARCHITECTURE.md §Benchmarking`.

- [ ] **VisionCamera frame processor**: The current AuthenticateScreen uses a
      simulated frame loop for the demo. To wire real camera frames to the
      liveness engine, use `useFrameOutput` from `react-native-vision-camera`
      with a worklet callback that calls `faceDetector.detectSync()`.
      See `ARCHITECTURE.md §Per-frame-pipeline`.

- [ ] **Passive anti-spoof**: Set `ENABLE_PASSIVE_ANTISPOOF = true` and drop
      `minifasnet_int8.tflite` in `models/`. Implement `PassiveAntiSpoof` class
      in `src/implementations/`.

## Completed (auto-built)

- [x] P1: Project scaffold — Expo bare, RN 0.85.3, TypeScript
- [x] P1: All dependencies installed (VisionCamera v5, fast-tflite v3, op-sqlite, keychain, netinfo)
- [x] P1: tsconfig, babel, metro config
- [x] P1: All TS interfaces (FaceDetector, FaceEmbedder, LivenessEngine, TemplateStore, EventStore, CloudSync)
- [x] P1: MediaPipe JS bridge + Android/iOS native module stubs
- [x] P1: Camera screen with SVG face overlay (FaceOverlay component)
- [x] P2: MockEmbedder (deterministic, hash-based)
- [x] P2: TfliteFaceEmbedder (requires model file)
- [x] P2: EncryptedTemplateStore (AES-256-GCM + Keychain)
- [x] P2: enroll() + authenticate() + 1:N match
- [x] P3: ChallengeLivenessEngine (BLINK/SMILE/TURN_LEFT/TURN_RIGHT randomised state machine)
- [x] P3: LivenessPrompt UI component
- [x] P4: SqliteEventStore
- [x] P4: SyncQueue (NetInfo + exponential backoff + two-phase purge)
- [x] P4: NoopSync (default stub) + AmplifySync (TODO stub)
- [x] P5: TfliteFaceEmbedder (loadTensorflowModel, INT8 path)
- [x] P5: tools/convert_model.py (Keras/ONNX/SavedModel → INT8 TFLite)
- [x] P5: Performance instrumentation (makeStopwatch, logPerfTable, perfMs in AuthResult)
- [x] P5: README.md, ARCHITECTURE.md, LICENSES.md
- [x] P5: Camera permissions (AndroidManifest + Info.plist)
- [x] P5: models/README.md
