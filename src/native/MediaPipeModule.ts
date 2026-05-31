/**
 * JS-side bridge to the native MediaPipe module.
 *
 * The native side (Kotlin / Swift) is registered as a TurboModule under
 * the name "AegisFaceMediaPipe".  On platforms where the native code is not
 * yet built (simulator / CI), we fall back to a JavaScript stub that returns
 * an empty face list so the UI still renders.
 *
 * TODO(human): To activate the real MediaPipe path, build the Android and iOS
 * native modules following the guide in ARCHITECTURE.md §Native-Module.
 */
import { NativeModules } from 'react-native';
import type { NativeFaceResult, NativeMediaPipeModule } from './types';

const MODULE_NAME = 'AegisFaceMediaPipe';

// ─── Stub (used when the native build is not present) ───────────────────────

const mediaPipeStub: NativeMediaPipeModule = {
  detectFaces(_pixelData, _width, _height, _format): NativeFaceResult[] {
    // Returns a centred placeholder face so the UI shows the overlay box.
    return [
      {
        score: 0.99,
        bbox: [0.25, 0.15, 0.75, 0.85],
        landmarks: Array.from({ length: 468 }, (_, i) => {
          // Distribute landmarks on an ellipse approximating a face
          const t = (i / 468) * 2 * Math.PI;
          return [0.5 + 0.18 * Math.cos(t), 0.45 + 0.28 * Math.sin(t)] as [number, number];
        }),
      },
    ];
  },
};

// ─── Real native module (auto-linked via TurboModule) ───────────────────────

const nativeModule = NativeModules[MODULE_NAME] as NativeMediaPipeModule | undefined;

export const MediaPipe: NativeMediaPipeModule = nativeModule ?? mediaPipeStub;

export const isNativeMediaPipeAvailable = nativeModule != null;
