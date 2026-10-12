/**
 * JS-side bridge to the native MediaPipe module.
 *
 * Two paths:
 *
 * 1. SYNCHRONOUS STUB (always available) — used by the worklet frame processor
 *    and the JS fallback.  Returns a centred placeholder face so the UI renders
 *    even when no native library is present.
 *
 * 2. ASYNC NATIVE (when "AegisFaceMediaPipe" TurboModule is linked) — sends
 *    the pixel buffer as a base64 string to the Kotlin / Swift implementation
 *    which runs real MediaPipe FaceLandmarker inference.
 *
 * Consumers should call detectFacesAsync() for the JS-thread async path and
 * MediaPipe.detectFaces() only for worklet / synchronous scenarios.
 */
import { NativeModules } from 'react-native';
import type { NativeFaceResult, NativeMediaPipeModule } from './types';

const MODULE_NAME = 'AegisFaceMediaPipe';

// ─── Synchronous JS stub ─────────────────────────────────────────────────────

const mediaPipeStub: NativeMediaPipeModule = {
  detectFaces(_pixelData, _width, _height, _format): NativeFaceResult[] {
    return [
      {
        score: 0.99,
        bbox: [0.25, 0.15, 0.75, 0.85],
        landmarks: Array.from({ length: 468 }, (_, i) => {
          const t = (i / 468) * 2 * Math.PI;
          return [0.5 + 0.18 * Math.cos(t), 0.45 + 0.28 * Math.sin(t)] as [number, number];
        }),
      },
    ];
  },
};

// ─── Native module handle ─────────────────────────────────────────────────────

const nativeModule = NativeModules[MODULE_NAME] as
  | { detectFaces(base64: string, width: number, height: number, format: string): Promise<NativeFaceResult[]> }
  | undefined;

/** Used for worklet / synchronous fallback only. */
export const MediaPipe: NativeMediaPipeModule = mediaPipeStub;

/** True when the native MediaPipe TurboModule has been linked and is usable. */
export const isNativeMediaPipeAvailable = nativeModule != null;

// ─── Base64 encoding ──────────────────────────────────────────────────────────

/**
 * Encode an ArrayBuffer to a base64 string in chunks so large frames
 * (e.g. 640×480 RGB = ~900 KB) don't overflow the call-stack.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

// ─── Async detection (JS-thread, safe to await) ───────────────────────────────

/**
 * Run face detection on the given pixel buffer.
 *
 * When the native MediaPipe module is available the buffer is base64-encoded
 * and forwarded to Kotlin / Swift for real inference.  Otherwise the JS stub
 * is used (returns a single centred placeholder face).
 */
export async function detectFacesAsync(
  pixelBuffer: ArrayBuffer,
  width: number,
  height: number,
  format: string,
): Promise<NativeFaceResult[]> {
  if (nativeModule) {
    try {
      const base64 = arrayBufferToBase64(pixelBuffer);
      return await nativeModule.detectFaces(base64, width, height, format);
    } catch {
      // Fall through to stub on any native error
    }
  }
  return mediaPipeStub.detectFaces(pixelBuffer, width, height, format);
}
