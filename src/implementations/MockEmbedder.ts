/**
 * MockEmbedder — deterministic fake embedder for UI/flow testing.
 *
 * Produces a consistent 128-d L2-normalised vector derived from a
 * FNV-1a hash of the pixel buffer.  Two crops of the SAME face will
 * produce the SAME vector (deterministic), so enroll → authenticate
 * works correctly in demo mode.
 *
 * Selected at runtime when USE_MOCK_EMBEDDER = true in constants.ts.
 */
import type { FaceEmbedder } from '../interfaces/FaceEmbedder';
import { EMBEDDING_DIM } from '../config/constants';
import { simpleHash } from '../utils/cryptography';
import { l2Normalise } from '../utils/geometry';

export class MockEmbedder implements FaceEmbedder {
  readonly isReady = true;
  readonly mode = 'mock' as const;

  async embed(alignedCrop: ArrayBuffer): Promise<Float32Array> {
    const bytes = new Uint8Array(alignedCrop);
    // Use FNV hash as seed then produce a pseudo-random but deterministic vector
    const seed = simpleHash(bytes);
    const vec = new Float32Array(EMBEDDING_DIM);
    let rng = seed;
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      // Xorshift32
      rng ^= rng << 13;
      rng ^= rng >> 17;
      rng ^= rng << 5;
      vec[i] = (rng / 0x7fffffff) - 1.0; // [-1, 1]
    }
    return l2Normalise(vec);
  }
}
