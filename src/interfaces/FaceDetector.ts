/** 2D point with normalised coordinates in [0, 1] relative to frame size. */
export interface NormPoint {
  x: number;
  y: number;
}

/** Axis-aligned bounding box, all values normalised [0, 1]. */
export interface FaceBBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * MediaPipe FaceLandmarker produces 468 landmarks.
 * Indices are stable across versions — see MediaPipe topology docs.
 */
export interface FaceDetection {
  bbox: FaceBBox;
  landmarks: NormPoint[]; // 468 points, normalised
  blendshapes?: Record<string, number>; // optional, if FaceLandmarker blendshapes enabled
  score: number;
}

export interface FaceDetector {
  /** Returns all detected faces in the frame, or [] if none. */
  detect(
    pixelBuffer: ArrayBuffer,
    width: number,
    height: number,
    /** 'rgb' | 'yuv' | 'bgr' */
    format: string,
  ): Promise<FaceDetection[]>;

  /** Same as detect() but synchronous — safe to call from a worklet. */
  detectSync(
    pixelBuffer: ArrayBuffer,
    width: number,
    height: number,
    format: string,
  ): FaceDetection[];
}
