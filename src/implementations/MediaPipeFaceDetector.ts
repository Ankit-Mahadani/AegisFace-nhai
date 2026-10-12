import type { FaceDetection, FaceDetector, FaceBBox, NormPoint } from '../interfaces/FaceDetector';
import { MediaPipe, detectFacesAsync } from '../native/MediaPipeModule';
import type { NativeFaceResult } from '../native/types';

function toDetection(r: NativeFaceResult): FaceDetection {
  const [left, top, right, bottom] = r.bbox;
  const bbox: FaceBBox = { left: left!, top: top!, right: right!, bottom: bottom! };
  const landmarks: NormPoint[] = r.landmarks.map(([x, y]) => ({ x: x!, y: y! }));
  return { bbox, landmarks, blendshapes: r.blendshapes, score: r.score };
}

export class MediaPipeFaceDetector implements FaceDetector {
  /**
   * Async detection — uses the native MediaPipe module when available,
   * falling back to the JS stub otherwise.  Safe to call from the JS thread.
   */
  async detect(
    pixelBuffer: ArrayBuffer,
    width: number,
    height: number,
    format: string,
  ): Promise<FaceDetection[]> {
    const results = await detectFacesAsync(pixelBuffer, width, height, format);
    return results.map(toDetection);
  }

  /**
   * Synchronous detection — always uses the JS stub.
   * Only call from a VisionCamera worklet where async is not available.
   */
  detectSync(
    pixelBuffer: ArrayBuffer,
    width: number,
    height: number,
    format: string,
  ): FaceDetection[] {
    'worklet';
    const results = MediaPipe.detectFaces(pixelBuffer, width, height, format);
    return results.map(toDetection);
  }
}

export const faceDetector = new MediaPipeFaceDetector();
