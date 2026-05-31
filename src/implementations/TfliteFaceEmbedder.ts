/**
 * TfliteFaceEmbedder — loads mobilefacenet_int8.tflite and runs inference.
 *
 * Prerequisites:
 *   1. Drop `models/mobilefacenet_int8.tflite` into the project (see models/README.md).
 *   2. Set USE_MOCK_EMBEDDER = false in src/config/constants.ts.
 *
 * Input:  1 × 112 × 112 × 3  UInt8 (INT8-quantised model expects uint8 input)
 * Output: 1 × 128             Float32 — L2 normalised in JS
 *
 * Delegates: NNAPI on Android (API 27+), Core ML on iOS (fallback to CPU).
 */
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TfliteModel } from 'react-native-fast-tflite';
import type { FaceEmbedder } from '../interfaces/FaceEmbedder';
import { EMBEDDING_DIM, INPUT_SIZE } from '../config/constants';
import { l2Normalise } from '../utils/geometry';

// TODO(human): Place mobilefacenet_int8.tflite in the models/ directory.
// The Metro bundler includes it via `require()` once present.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MODEL_ASSET = require('../../models/mobilefacenet_int8.tflite') as number;

export class TfliteFaceEmbedder implements FaceEmbedder {
  private model: TfliteModel | null = null;
  private _isReady = false;

  readonly mode = 'tflite' as const;

  get isReady() {
    return this._isReady;
  }

  async load(): Promise<void> {
    // Pass empty delegates array → default CPU. Add 'nnapi' or 'core-ml' for hardware acceleration.
    this.model = await loadTensorflowModel(MODEL_ASSET, []);
    this._isReady = true;
  }

  async embed(alignedCrop: ArrayBuffer, width: number, height: number): Promise<Float32Array> {
    if (!this.model) throw new Error('TfliteFaceEmbedder: model not loaded');

    if (width !== INPUT_SIZE || height !== INPUT_SIZE) {
      throw new Error(`Expected ${INPUT_SIZE}×${INPUT_SIZE} crop, got ${width}×${height}`);
    }

    // Convert Uint8 RGB [0,255] → Float32 [-1,1] (MobileFaceNet normalisation)
    const input = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
    const src = new Uint8Array(alignedCrop);
    for (let i = 0; i < src.length; i++) {
      input[i] = (src[i]! - 127.5) / 128.0;
    }

    const outputs = await this.model.run([input.buffer]);
    const embedding = new Float32Array(outputs[0]!);

    if (embedding.length !== EMBEDDING_DIM) {
      throw new Error(`Expected ${EMBEDDING_DIM}-d embedding, got ${embedding.length}`);
    }

    return l2Normalise(embedding);
  }
}

export const tfliteEmbedder = new TfliteFaceEmbedder();
