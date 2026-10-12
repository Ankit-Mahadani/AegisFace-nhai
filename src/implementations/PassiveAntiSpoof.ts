/**
 * PassiveAntiSpoof — MiniFASNet INT8 TFLite wrapper.
 *
 * MiniFASNet is a lightweight face anti-spoofing network (~2 MB) that
 * classifies a 112×112 RGB crop as "live" vs "spoof".
 *
 * Activation steps:
 *   1. Download minifasnet_int8.tflite and drop it in models/
 *      (see models/README.md for a download link).
 *   2. Set ENABLE_PASSIVE_ANTISPOOF = true in src/config/constants.ts.
 *   3. Call antiSpoof.load() in bootstrap() (see src/AegisFace.ts).
 *
 * When the model file is absent the module falls back gracefully:
 * predict() always returns { passed: true, score: 1.0 } so the
 * enroll / authenticate flows continue normally.
 *
 * MiniFASNet output: softmax over [spoof, live] → we take index 1 as the
 * liveness score.  Threshold 0.5 is standard but tune on your dataset.
 */
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TfliteModel } from 'react-native-fast-tflite';
import type { AntiSpoof, AntiSpoofResult } from '../interfaces/AntiSpoof';
import { INPUT_SIZE } from '../config/constants';

const ANTISPOOF_THRESHOLD = 0.5; // liveness probability threshold

// The require() is evaluated at build time; Metro will error if the file is
// absent ONLY when ENABLE_PASSIVE_ANTISPOOF = true.  Keep this lazy so
// it never crashes when the feature flag is off.
let MODEL_ASSET: number | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MODEL_ASSET = require('../../models/minifasnet_int8.tflite') as number;
} catch {
  // Model file not present — passive anti-spoof stays disabled
}

class PassiveAntiSpoofImpl implements AntiSpoof {
  private model: TfliteModel | null = null;
  private _isReady = false;

  get isReady() { return this._isReady; }

  async load(): Promise<void> {
    if (!MODEL_ASSET) return; // no model file — stay in fallback mode
    try {
      this.model = await loadTensorflowModel(MODEL_ASSET, []);
      this._isReady = true;
    } catch {
      // keep _isReady = false → fallback path
    }
  }

  async predict(
    alignedCrop: ArrayBuffer,
    width: number,
    height: number,
  ): Promise<AntiSpoofResult> {
    if (!this.model) {
      return { passed: true, score: 1.0 };
    }

    if (width !== INPUT_SIZE || height !== INPUT_SIZE) {
      return { passed: true, score: 1.0 };
    }

    // Normalise RGB [0,255] → Float32 [-1, 1]  (same as MobileFaceNet)
    const input = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
    const src = new Uint8Array(alignedCrop);
    for (let i = 0; i < src.length; i++) {
      input[i] = (src[i]! - 127.5) / 128.0;
    }

    const outputs = await this.model.run([input.buffer]);
    // MiniFASNet output shape: [1, 2] — softmax [spoof_prob, live_prob]
    const logits = new Float32Array(outputs[0]!);
    const liveScore = logits.length >= 2 ? logits[1]! : 0.5;

    return {
      passed: liveScore >= ANTISPOOF_THRESHOLD,
      score:  liveScore,
    };
  }
}

export const antiSpoof = new PassiveAntiSpoofImpl();
