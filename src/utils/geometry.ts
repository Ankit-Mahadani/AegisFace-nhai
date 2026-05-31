import type { NormPoint } from '../interfaces/FaceDetector';

/**
 * Eye Aspect Ratio  (Soukupová & Čech, 2016).
 *
 * Landmark indices for MediaPipe 468-point mesh (per-eye):
 *   Upper lid: p1, p2   Lower lid: p3, p4   Horizontal: p0, p5
 *
 * Standard 6-point EAR:
 *   EAR = (|p1-p5| + |p2-p4|) / (2 * |p0-p3|)
 *
 * MediaPipe left-eye relevant indices (out of 468):
 *   outer=33, inner=133, top1=160, top2=158, bot1=144, bot2=153
 * Right-eye:
 *   outer=362, inner=263, top1=385, top2=387, bot1=373, bot2=380
 */
export function eyeAspectRatio(
  p0: NormPoint, p1: NormPoint, p2: NormPoint,
  p3: NormPoint, p4: NormPoint, p5: NormPoint,
): number {
  const A = dist(p1, p5);
  const B = dist(p2, p4);
  const C = dist(p0, p3);
  if (C < 1e-6) return 0;
  return (A + B) / (2.0 * C);
}

/** Mouth Aspect Ratio — simplified for smile detection. */
export function mouthAspectRatio(
  topLip: NormPoint, bottomLip: NormPoint,
  leftCorner: NormPoint, rightCorner: NormPoint,
): number {
  const vertical = dist(topLip, bottomLip);
  const horizontal = dist(leftCorner, rightCorner);
  if (horizontal < 1e-6) return 0;
  return vertical / horizontal;
}

/**
 * Estimate head yaw from 3D landmark projections.
 * Uses the vector between nose-tip and chin projected on the horizontal axis.
 * Returns angle in degrees (positive = turned right, negative = turned left).
 *
 * Landmark indices: nose-tip=1, left-ear=234, right-ear=454
 */
export function estimateYaw(landmarks: NormPoint[]): number {
  if (landmarks.length < 455) return 0;
  const noseTip = landmarks[1]!;
  const leftEar = landmarks[234]!;
  const rightEar = landmarks[454]!;
  const midX = (leftEar.x + rightEar.x) / 2;
  const noseOffset = noseTip.x - midX;
  // Normalise by face width to get an angle proxy
  const faceWidth = Math.abs(rightEar.x - leftEar.x);
  if (faceWidth < 1e-6) return 0;
  return (noseOffset / faceWidth) * 90; // rough degrees
}

export function dist(a: NormPoint, b: NormPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Cosine similarity between two Float32 embeddings (assumed L2-normalised). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i]! * b[i]!);
  return dot; // already normalised → dot == cosine
}

/** L2-normalise a Float32Array in-place and return it. */
export function l2Normalise(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i]! * v[i]!;
  norm = Math.sqrt(norm);
  if (norm < 1e-9) return v;
  for (let i = 0; i < v.length; i++) v.set([v[i]! / norm], i);
  return v;
}
