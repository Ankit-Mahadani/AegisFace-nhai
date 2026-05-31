/**
 * FaceOverlay — renders bounding box and 468 landmark dots on top of
 * the camera preview using SVG (no native drawing required).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Rect, Circle, G } from 'react-native-svg';
import type { FaceDetection } from '../interfaces/FaceDetector';

interface Props {
  faces: FaceDetection[];
  /** Dimensions of the view that contains this overlay */
  viewWidth: number;
  viewHeight: number;
}

export function FaceOverlay({ faces, viewWidth, viewHeight }: Props) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${viewWidth} ${viewHeight}`}>
      {faces.map((face, fi) => {
        const { bbox, landmarks } = face;
        const x = bbox.left * viewWidth;
        const y = bbox.top * viewHeight;
        const w = (bbox.right - bbox.left) * viewWidth;
        const h = (bbox.bottom - bbox.top) * viewHeight;
        return (
          <G key={fi}>
            {/* Bounding box */}
            <Rect
              x={x} y={y} width={w} height={h}
              stroke="#00FF88" strokeWidth={2} fill="none"
            />
            {/* Landmark dots — render only every 4th point for performance */}
            {landmarks
              .filter((_, i) => i % 4 === 0)
              .map((pt, pi) => (
                <Circle
                  key={pi}
                  cx={pt.x * viewWidth}
                  cy={pt.y * viewHeight}
                  r={1.5}
                  fill="#00FF88"
                  opacity={0.7}
                />
              ))}
          </G>
        );
      })}
    </Svg>
  );
}
