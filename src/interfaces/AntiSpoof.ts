/**
 * Passive anti-spoofing: decide if the face in a crop is a live person
 * vs a printed photo, replay attack, or 3-D mask.
 *
 * Implementation can be MiniFASNet (TFLite) or any future model.
 * When no model is loaded the result should default to `passed: true`
 * so the rest of the pipeline continues normally.
 */
export interface AntiSpoofResult {
  passed: boolean;
  score: number;  // liveness probability [0, 1] — higher = more likely live
}

export interface AntiSpoof {
  /**
   * Test a 112×112 RGB face crop for liveness.
   * Returns { passed: true, score: 1 } immediately if the model is not loaded.
   */
  predict(alignedCrop: ArrayBuffer, width: number, height: number): Promise<AntiSpoofResult>;

  /** Whether the TFLite model has been loaded. */
  readonly isReady: boolean;
}
