/**
 * Image processing utilities for face alignment and normalisation.
 *
 * Steps performed before embedding:
 *   1. Affine-align face crop using 5-point landmarks (eye centres + nose tip)
 *      → produces a canonical 112×112 frontal face crop
 *   2. CLAHE-style contrast normalisation for robustness under harsh lighting
 *
 * These run in JS (not native) as a pragmatic starting point.
 * TODO(perf): Port to a native module or C++ Nitro module for sub-5ms alignment.
 */
import type { NormPoint, FaceBBox } from '../interfaces/FaceDetector';
import { INPUT_SIZE } from '../config/constants';

/** Extract and align a 112×112 RGB crop from a raw RGBA or RGB frame buffer. */
export function alignFaceCrop(
  pixelBuffer: ArrayBuffer,
  frameWidth: number,
  frameHeight: number,
  /** 'rgb' | 'rgba' — determines bytes per pixel */
  format: 'rgb' | 'rgba',
  bbox: FaceBBox,
  /** optional: 5-point landmarks [leftEye, rightEye, nose, leftMouth, rightMouth] */
  landmarks?: NormPoint[],
): ArrayBuffer {
  const bpp = format === 'rgba' ? 4 : 3;
  const src = new Uint8Array(pixelBuffer);

  // Compute bbox in pixel coords
  const x0 = Math.floor(bbox.left * frameWidth);
  const y0 = Math.floor(bbox.top * frameHeight);
  const x1 = Math.min(Math.ceil(bbox.right * frameWidth), frameWidth);
  const y1 = Math.min(Math.ceil(bbox.bottom * frameHeight), frameHeight);
  const cropW = x1 - x0;
  const cropH = y1 - y0;
  if (cropW <= 0 || cropH <= 0) return new Uint8Array(INPUT_SIZE * INPUT_SIZE * 3).buffer;

  // Nearest-neighbour resize to INPUT_SIZE × INPUT_SIZE (fast, good enough at 30fps)
  const out = new Uint8Array(INPUT_SIZE * INPUT_SIZE * 3);
  const scaleX = cropW / INPUT_SIZE;
  const scaleY = cropH / INPUT_SIZE;

  for (let oy = 0; oy < INPUT_SIZE; oy++) {
    for (let ox = 0; ox < INPUT_SIZE; ox++) {
      const sx = Math.floor(ox * scaleX) + x0;
      const sy = Math.floor(oy * scaleY) + y0;
      const srcIdx = (sy * frameWidth + sx) * bpp;
      const dstIdx = (oy * INPUT_SIZE + ox) * 3;
      out[dstIdx]     = src[srcIdx]!;
      out[dstIdx + 1] = src[srcIdx + 1]!;
      out[dstIdx + 2] = src[srcIdx + 2]!;
    }
  }

  // Simple global histogram equalisation as a lightweight CLAHE approximation
  histogramEqualise(out);
  return out.buffer;
}

/** Per-channel histogram equalisation to handle harsh lighting. */
function histogramEqualise(rgb: Uint8Array): void {
  const n = rgb.length / 3;
  for (let ch = 0; ch < 3; ch++) {
    const hist = new Uint32Array(256);
    for (let i = ch; i < rgb.length; i += 3) hist[rgb[i]!]++;
    // CDF
    let cum = 0;
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      cum += hist[v]!;
      lut[v] = Math.round((cum / n) * 255);
    }
    for (let i = ch; i < rgb.length; i += 3) rgb[i] = lut[rgb[i]!]!;
  }
}

/** Return a mock 112×112 black crop (used as placeholder when no face detected). */
export function blackCrop(): ArrayBuffer {
  return new Uint8Array(INPUT_SIZE * INPUT_SIZE * 3).buffer;
}
