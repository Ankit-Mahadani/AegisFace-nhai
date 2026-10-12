/**
 * AuthenticateScreen
 *
 * Flow:
 *   1. Show live camera with face overlay
 *   2. Run liveness challenge sequence (BLINK / SMILE / TURN)
 *      - Real device: driven by landmarks from MediaPipe
 *      - Simulator / stub mode: auto-advances with mock blendshapes
 *   3. On liveness pass, run face embedding + 1:N match
 *   4. Show PASS/FAIL result with user ID, score, latency
 *
 * Frame processing uses VisionCamera v5's useFrameOutput API
 * (requires react-native-vision-camera-worklets).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import type { Frame } from 'react-native-vision-camera';
import { runOnJS, useSharedValue } from 'react-native-worklets-core';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { FaceOverlay } from '../components/FaceOverlay';
import { LivenessPrompt } from '../components/LivenessPrompt';
import { livenessEngine } from '../implementations/ChallengeLivenessEngine';
import { faceDetector } from '../implementations/MediaPipeFaceDetector';
import type { FaceDetection } from '../interfaces/FaceDetector';
import type { LivenessState } from '../interfaces/LivenessEngine';
import { authenticate } from '../AegisFace';
import type { AuthResult } from '../AegisFace';
import { isNativeMediaPipeAvailable } from '../native/MediaPipeModule';

type Props = NativeStackScreenProps<RootStackParamList, 'Authenticate'>;

type Stage = 'liveness' | 'matching' | 'result';

export function AuthenticateScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const [stage, setStage] = useState<Stage>('liveness');
  const [faces, setFaces] = useState<FaceDetection[]>([]);
  const [livenessState, setLivenessState] = useState<LivenessState>(() => livenessEngine.start());
  const [result, setResult] = useState<AuthResult | null>(null);

  const livenessRef = useRef(livenessState);
  livenessRef.current = livenessState;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const latestFrameRef = useRef<{
    pixelBuffer: ArrayBuffer; width: number; height: number; format: string;
  } | null>(null);

  // Shared values (worklet thread)
  const frameCounter    = useSharedValue(0);
  const isLiveActive    = useSharedValue(true);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // ─── JS-thread handler ────────────────────────────────────────────────────
  const onFrameData = useCallback(async (
    buffer: ArrayBuffer, w: number, h: number, fmt: string,
  ) => {
    if (stageRef.current !== 'liveness') return;

    latestFrameRef.current = { pixelBuffer: buffer, width: w, height: h, format: fmt };

    try {
      const detections = await faceDetector.detect(buffer, w, h, fmt);
      setFaces(detections);

      if (detections.length > 0 && isNativeMediaPipeAvailable) {
        const face = detections[0]!;
        const updated = livenessEngine.update(
          livenessRef.current, face.landmarks, face.blendshapes,
        );
        setLivenessState({ ...updated });
        if (updated.passed !== null) {
          isLiveActive.value = false;
          void runAuthentication(updated.passed);
        }
      }
    } catch {
      // skip bad frames
    }
  }, [isLiveActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── VisionCamera v5 frame output (worklet) ───────────────────────────────
  const onFrameWorklet = useCallback((frame: Frame) => {
    'worklet';
    if (!isLiveActive.value) { frame.dispose(); return; }

    // ~10 fps at 30 fps camera
    frameCounter.value = (frameCounter.value + 1) % 3;
    if (frameCounter.value !== 0) { frame.dispose(); return; }

    if (!frame.isValid || !frame.hasPixelBuffer) { frame.dispose(); return; }

    const buf  = frame.getPixelBuffer();
    const copy = buf.slice(0);
    const fmt  = frame.pixelFormat as string;
    frame.dispose();

    runOnJS(onFrameData)(copy, frame.width, frame.height, fmt);
  }, [onFrameData, isLiveActive, frameCounter]);

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    onFrame: onFrameWorklet,
  });

  // ─── Mock liveness path (simulator / no native MediaPipe) ─────────────────
  const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isNativeMediaPipeAvailable) return;
    if (stage !== 'liveness') return;

    mockTimerRef.current = setInterval(() => {
      const current = livenessRef.current;
      if (current.passed !== null) { clearInterval(mockTimerRef.current!); return; }

      const mockLandmarks = Array.from({ length: 468 }, (_, i) => ({
        x: 0.5 + 0.18 * Math.cos((i / 468) * 2 * Math.PI),
        y: 0.45 + 0.28 * Math.sin((i / 468) * 2 * Math.PI),
      }));

      const idx      = current.currentIndex;
      const type     = current.challenges[idx]?.type;
      const started  = current.challenges[idx]?.startedAt;
      const cElapsed = started ? Date.now() - started : 0;
      const blendshapes: Record<string, number> = {};

      if (type === 'BLINK' && cElapsed > 1200) {
        const v = cElapsed > 1200 && cElapsed < 1500 ? 0.8 : 0.1;
        blendshapes['eyeBlinkLeft']  = v;
        blendshapes['eyeBlinkRight'] = v;
      }
      if (type === 'SMILE' && cElapsed > 1200) {
        blendshapes['mouthSmileLeft']  = 0.8;
        blendshapes['mouthSmileRight'] = 0.8;
      }
      if (type === 'TURN_LEFT' && cElapsed > 1200) {
        mockLandmarks[1]   = { x: 0.35, y: 0.45 };
        mockLandmarks[234] = { x: 0.15, y: 0.45 };
        mockLandmarks[454] = { x: 0.65, y: 0.45 };
      }
      if (type === 'TURN_RIGHT' && cElapsed > 1200) {
        mockLandmarks[1]   = { x: 0.65, y: 0.45 };
        mockLandmarks[234] = { x: 0.35, y: 0.45 };
        mockLandmarks[454] = { x: 0.85, y: 0.45 };
      }

      const updated = livenessEngine.update(current, mockLandmarks, blendshapes);
      setLivenessState({ ...updated });

      if (updated.passed !== null) {
        clearInterval(mockTimerRef.current!);
        void runAuthentication(updated.passed);
      }
    }, 100);

    return () => { if (mockTimerRef.current) clearInterval(mockTimerRef.current); };
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Authentication step ──────────────────────────────────────────────────
  async function runAuthentication(livenessPassed: boolean) {
    setStage('matching');
    isLiveActive.value = false;

    const frame = latestFrameRef.current ?? {
      pixelBuffer: new ArrayBuffer(112 * 112 * 3),
      width: 112, height: 112, format: 'rgb',
    };

    const res = await authenticate({
      pixelBuffer: frame.pixelBuffer,
      width: frame.width,
      height: frame.height,
      format: frame.format,
      livenessPassed,
    });
    setResult(res);
    setStage('result');
  }

  function restart() {
    livenessEngine.reset();
    const newState = livenessEngine.start();
    setLivenessState(newState);
    setResult(null);
    setFaces([]);
    latestFrameRef.current = null;
    isLiveActive.value = true;
    setStage('liveness');
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.label}>Camera permission required.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {(stage === 'liveness' || stage === 'matching') && (
        <View style={styles.cameraWrap}>
          {device ? (
            <>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={stage === 'liveness'}
                outputs={stage === 'liveness' ? [frameOutput] : []}
              />
              <FaceOverlay faces={faces} viewWidth={300} viewHeight={400} />
            </>
          ) : (
            <View style={styles.noCamera}>
              <Text style={styles.label}>No camera</Text>
            </View>
          )}
        </View>
      )}

      {stage === 'liveness' && (
        <View style={styles.promptWrap}>
          <LivenessPrompt state={livenessState} />
        </View>
      )}

      {stage === 'matching' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.label}>Verifying identity…</Text>
        </View>
      )}

      {stage === 'result' && result && (
        <View style={[styles.center, styles.resultCard]}>
          <Text style={[styles.resultStatus, result.success ? styles.pass : styles.fail]}>
            {result.success ? '✓  ACCESS GRANTED' : '✗  ACCESS DENIED'}
          </Text>
          {result.success && (
            <Text style={styles.userId}>{result.userId}</Text>
          )}
          <ResultRow label="Match score"  value={(result.score * 100).toFixed(1) + ' %'} />
          <ResultRow label="Liveness"     value={result.livenessPassed  ? 'Passed' : 'Failed'} />
          <ResultRow label="Anti-spoof"   value={result.antiSpoofPassed ? 'Passed' : 'Failed'} />
          <ResultRow label="Latency"      value={result.perfMs + ' ms'} />
          <View style={styles.rowButtons}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={restart}>
              <Text style={styles.btnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
              <Text style={styles.btnText}>Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cameraWrap: {
    flex: 1, margin: 16, borderRadius: 20,
    overflow: 'hidden', position: 'relative',
  },
  noCamera: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  promptWrap: { padding: 16, alignItems: 'center' },
  label: { color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 8 },
  resultCard: {
    backgroundColor: '#1A1A2E', margin: 16, borderRadius: 20, gap: 12,
  },
  resultStatus: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  pass: { color: '#00FF88' },
  fail: { color: '#FF4444' },
  userId: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 24,
  },
  resultLabel: { color: '#888', fontSize: 14 },
  resultValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: {
    backgroundColor: '#00FF88', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center',
  },
  btnSecondary: { backgroundColor: '#333' },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
