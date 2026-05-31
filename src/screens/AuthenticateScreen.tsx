/**
 * AuthenticateScreen
 *
 * Flow:
 *   1. Show live camera with face overlay
 *   2. Run liveness challenge sequence (BLINK / SMILE / TURN)
 *   3. On liveness pass, run face embedding + 1:N match
 *   4. Show PASS/FAIL result with user ID, score, latency
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
} from 'react-native-vision-camera';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { FaceOverlay } from '../components/FaceOverlay';
import { LivenessPrompt } from '../components/LivenessPrompt';
import { livenessEngine } from '../implementations/ChallengeLivenessEngine';
import { faceDetector } from '../implementations/MediaPipeFaceDetector';
import type { FaceDetection } from '../interfaces/FaceDetector';
import type { LivenessState } from '../interfaces/LivenessEngine';
import { authenticate } from '../AegisFace';
import type { AuthResult } from '../AegisFace';

type Props = NativeStackScreenProps<RootStackParamList, 'Authenticate'>;

type Stage = 'liveness' | 'matching' | 'result';

export function AuthenticateScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const [stage, setStage] = useState<Stage>('liveness');
  const [faces, setFaces] = useState<FaceDetection[]>([]);
  const [livenessState, setLivenessState] = useState<LivenessState>(() => livenessEngine.start());
  const [result, setResult] = useState<AuthResult | null>(null);
  const [viewSize] = useState({ width: 300, height: 400 });

  // Simulated frame loop (real device uses useFrameOutput worklet)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const livenessRef = useRef(livenessState);
  livenessRef.current = livenessState;

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (stage !== 'liveness') return;

    // Poll with stub landmarks every 100ms until liveness completes
    timerRef.current = setInterval(async () => {
      const current = livenessRef.current;
      if (current.passed !== null) {
        clearInterval(timerRef.current!);
        return;
      }

      // In mock mode, produce synthetic landmarks that satisfy challenges over time
      const mockLandmarks = Array.from({ length: 468 }, (_, i) => ({
        x: 0.5 + 0.18 * Math.cos((i / 468) * 2 * Math.PI),
        y: 0.45 + 0.28 * Math.sin((i / 468) * 2 * Math.PI),
      }));

      // Mock blendshapes that trigger challenges sequentially
      const elapsed = Date.now() - current.startedAt;
      const challengeIdx = current.currentIndex;
      const challengeType = current.challenges[challengeIdx]?.type;
      const blendshapes: Record<string, number> = {};

      // Simulate challenge completion after 1.5s of looking
      const challengeElapsed = current.challenges[challengeIdx]?.startedAt
        ? Date.now() - current.challenges[challengeIdx]!.startedAt!
        : 0;

      if (challengeType === 'BLINK' && challengeElapsed > 1200) {
        blendshapes['eyeBlinkLeft'] = challengeElapsed > 1200 && challengeElapsed < 1500 ? 0.8 : 0.1;
        blendshapes['eyeBlinkRight'] = blendshapes['eyeBlinkLeft'];
      }
      if (challengeType === 'SMILE' && challengeElapsed > 1200) {
        blendshapes['mouthSmileLeft'] = 0.8;
        blendshapes['mouthSmileRight'] = 0.8;
      }
      if (challengeType === 'TURN_LEFT' && challengeElapsed > 1200) {
        // Override yaw via direct blendshape-like signal
        mockLandmarks[1] = { x: 0.35, y: 0.45 }; // nose tip shifted left
        mockLandmarks[234] = { x: 0.15, y: 0.45 }; // left ear
        mockLandmarks[454] = { x: 0.65, y: 0.45 }; // right ear
      }
      if (challengeType === 'TURN_RIGHT' && challengeElapsed > 1200) {
        mockLandmarks[1] = { x: 0.65, y: 0.45 };
        mockLandmarks[234] = { x: 0.35, y: 0.45 };
        mockLandmarks[454] = { x: 0.85, y: 0.45 };
      }

      const updated = livenessEngine.update(current, mockLandmarks, blendshapes);
      setLivenessState({ ...updated });

      if (updated.passed !== null) {
        clearInterval(timerRef.current!);
        if (updated.passed) {
          await runAuthentication(updated.passed);
        }
      }
    }, 100);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  async function runAuthentication(livenessPassed: boolean) {
    setStage('matching');
    // Synthesise a frame for mock mode
    const buf = new ArrayBuffer(112 * 112 * 3);
    const res = await authenticate({
      pixelBuffer: buf,
      width: 112,
      height: 112,
      format: 'rgb',
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
    setStage('liveness');
  }

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
              />
              <FaceOverlay faces={faces} viewWidth={viewSize.width} viewHeight={viewSize.height} />
            </>
          ) : (
            <View style={styles.noCamera}><Text style={styles.label}>No camera</Text></View>
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
          <ResultRow label="Match score" value={(result.score * 100).toFixed(1) + ' %'} />
          <ResultRow label="Liveness" value={result.livenessPassed ? 'Passed' : 'Failed'} />
          <ResultRow label="Latency" value={result.perfMs + ' ms'} />
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
  cameraWrap: { flex: 1, margin: 16, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  noCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A2E' },
  promptWrap: { padding: 16, alignItems: 'center' },
  label: { color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 8 },
  resultCard: { backgroundColor: '#1A1A2E', margin: 16, borderRadius: 20, gap: 12 },
  resultStatus: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  pass: { color: '#00FF88' },
  fail: { color: '#FF4444' },
  userId: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 24 },
  resultLabel: { color: '#888', fontSize: 14 },
  resultValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { backgroundColor: '#00FF88', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#333' },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
