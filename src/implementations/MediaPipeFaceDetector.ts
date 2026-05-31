import type { FaceDetection, FaceDetector, FaceBBox, NormPoint } from '../interfaces/FaceDetector';
import { MediaPipe } from '../native/MediaPipeModule';
import type { NativeFaceResult } from '../native/types';

function toDetection(r: NativeFaceResult): FaceDetection {
  const [left, top, right, bottom] = r.bbox;
  const bbox: FaceBBox = { left: left!, top: top!, right: right!, bottom: bottom! };
  const landmarks: NormPoint[] = r.landmarks.map(([x, y]) => ({ x: x!, y: y! }));
  return { bbox, landmarks, blendshapes: r.blendshapes, score: r.score };
}

export class MediaPipeFaceDetector implements FaceDetector {
  async detect(
    pixelBuffer: ArrayBuffer,
    width: number,
    height: number,
    format: string,
  ): Promise<FaceDetection[]> {
    const results = MediaPipe.detectFaces(pixelBuffer, width, height, format);
    return results.map(toDetection);
  }

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
