export interface FaceEmbedder {
  /**
   * Accepts an aligned, normalised RGB face crop (INPUT_SIZE × INPUT_SIZE).
   * Returns an L2-normalised Float32 embedding vector of length EMBEDDING_DIM.
   */
  embed(alignedCrop: ArrayBuffer, width: number, height: number): Promise<Float32Array>;

  /** True once model weights are loaded and ready. */
  readonly isReady: boolean;

  /** 'mock' | 'tflite' — for display on the Home screen. */
  readonly mode: 'mock' | 'tflite';
}
