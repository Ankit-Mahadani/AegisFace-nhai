/** Raw result from the native MediaPipe module. */
export interface NativeFaceResult {
  score: number;
  bbox: [number, number, number, number]; // [left, top, right, bottom] normalised
  landmarks: Array<[number, number]>;      // 468 [x, y] normalised points
  blendshapes?: Record<string, number>;
}

export interface NativeMediaPipeModule {
  /**
   * Run FaceDetector + FaceLandmarker on a raw pixel buffer.
   * Runs synchronously on the calling thread (safe inside worklets).
   */
  detectFaces(
    pixelData: ArrayBuffer,
    width: number,
    height: number,
    format: string, // 'rgb' | 'yuv' | 'bgr'
  ): NativeFaceResult[];
}
