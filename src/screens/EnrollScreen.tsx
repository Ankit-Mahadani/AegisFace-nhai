/**
 * EnrollScreen — capture ENROLL_FRAMES frames automatically, embed, and save.
 *
 * Uses VisionCamera v5's useFrameOutput (requires react-native-vision-camera-worklets).
 * Samples at ~5 fps, auto-captures frames when a face is confidently detected.
 * Falls back to a manual mock-capture button on simulator / when no device is present.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert,
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
import { faceDetector } from '../implementations/MediaPipeFaceDetector';
import type { FaceDetection } from '../interfaces/FaceDetector';
import { enroll } from '../AegisFace';
import { ENROLL_FRAMES } from '../config/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Enroll'>;

type Stage = 'input' | 'capturing' | 'processing' | 'done' | 'error';

export function EnrollScreen({ navigation }: Props) {
  const [userId, setUserId] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [frames, setFrames] = useState<number>(0);
  const [faces, setFaces] = useState<FaceDetection[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Always-current refs — avoid stale closures in callbacks
  const userIdRef   = useRef('');
  userIdRef.current = userId;

  const capturedFrames = useRef<Array<{
    pixelBuffer: ArrayBuffer; width: number; height: number; format: string;
  }>>([]);
  const enrolling = useRef(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  // Shared values (worklet thread)
  const frameCounter      = useSharedValue(0);
  const isCapturingShared = useSharedValue(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // ─── JS-thread handler ────────────────────────────────────────────────────
  const onFrameData = useCallback(async (
    buffer: ArrayBuffer, w: number, h: number, fmt: string,
  ) => {
    if (enrolling.current) return;

    try {
      const detections = await faceDetector.detect(buffer, w, h, fmt);
      setFaces(detections);

      const bestFace = detections.find(d => d.score > 0.65);
      if (bestFace && capturedFrames.current.length < ENROLL_FRAMES) {
        capturedFrames.current.push({ pixelBuffer: buffer, width: w, height: h, format: fmt });
        const count = capturedFrames.current.length;
        setFrames(count);

        if (count >= ENROLL_FRAMES) {
          isCapturingShared.value = false;
          void processEnrollment();
        }
      }
    } catch {
      // skip bad frames
    }
  }, [isCapturingShared]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── VisionCamera v5 frame output (worklet) ───────────────────────────────
  const onFrameWorklet = useCallback((frame: Frame) => {
    'worklet';
    if (!isCapturingShared.value) { frame.dispose(); return; }

    // Sample at ~5 fps (skip 5 out of 6 frames at 30 fps)
    frameCounter.value = (frameCounter.value + 1) % 6;
    if (frameCounter.value !== 0) { frame.dispose(); return; }

    if (!frame.isValid || !frame.hasPixelBuffer) { frame.dispose(); return; }

    const buf = frame.getPixelBuffer();
    const copy = buf.slice(0);          // copy while frame is valid
    const fmt  = frame.pixelFormat as string;
    frame.dispose();                    // release to camera pipeline

    runOnJS(onFrameData)(copy, frame.width, frame.height, fmt);
  }, [onFrameData, isCapturingShared, frameCounter]);

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    onFrame: onFrameWorklet,
  });

  // ─── Enrollment flow ──────────────────────────────────────────────────────
  const handleStartCapture = useCallback(() => {
    if (!userIdRef.current.trim()) {
      Alert.alert('Error', 'Please enter a User ID first.');
      return;
    }
    capturedFrames.current = [];
    enrolling.current = false;
    setFrames(0);
    setFaces([]);
    isCapturingShared.value = true;
    setStage('capturing');
  }, [isCapturingShared]);

  async function processEnrollment() {
    if (enrolling.current) return;
    enrolling.current = true;
    setStage('processing');
    try {
      const result = await enroll(userIdRef.current.trim(), { frames: capturedFrames.current });
      if (result.ok) {
        setStage('done');
      } else {
        setErrorMsg('No face detected in captured frames. Please try again.');
        setStage('error');
      }
    } catch (e) {
      setErrorMsg(String(e));
      setStage('error');
    }
  }

  // ─── Mock capture fallback (simulator / no device) ────────────────────────
  const handleMockCapture = useCallback(async () => {
    if (capturedFrames.current.length >= ENROLL_FRAMES) return;
    const id  = userIdRef.current;
    const buf = new ArrayBuffer(112 * 112 * 3);
    const view = new Uint8Array(buf);
    let h = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    const fi = capturedFrames.current.length;
    for (let i = 0; i < view.length; i += 3) {
      view[i]     = ((h ^ (i * 7  + fi * 11)) & 0xff);
      view[i + 1] = ((h ^ (i * 13 + fi * 5))  & 0xff);
      view[i + 2] = ((h ^ (i * 3  + fi * 17)) & 0xff);
    }
    capturedFrames.current.push({ pixelBuffer: buf, width: 112, height: 112, format: 'rgb' });
    const count = capturedFrames.current.length;
    setFrames(count);
    if (count >= ENROLL_FRAMES) {
      void processEnrollment();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      <Text style={styles.title}>Enroll User</Text>

      {stage === 'input' && (
        <View style={styles.form}>
          <Text style={styles.label}>User ID / Employee Number</Text>
          <TextInput
            style={styles.input}
            value={userId}
            onChangeText={setUserId}
            placeholder="e.g. EMP-001"
            placeholderTextColor="#555"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.btn} onPress={handleStartCapture}>
            <Text style={styles.btnText}>Start Capture →</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === 'capturing' && (
        <View style={styles.cameraContainer}>
          {device ? (
            <>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive
                outputs={[frameOutput]}
              />
              <FaceOverlay faces={faces} viewWidth={300} viewHeight={400} />
            </>
          ) : (
            <View style={styles.noCamera}>
              <Text style={styles.label}>No front camera found.</Text>
            </View>
          )}

          <View style={styles.captureOverlay}>
            <Text style={styles.captureCount}>
              {frames} / {ENROLL_FRAMES} frames
            </Text>
            <Text style={styles.captureHint}>
              {frames < ENROLL_FRAMES
                ? device ? 'Hold still — auto-capturing…' : 'Tap to capture'
                : 'Processing…'}
            </Text>
            {!device && frames < ENROLL_FRAMES && (
              <TouchableOpacity
                style={[styles.btn, { marginTop: 16 }]}
                onPress={handleMockCapture}
              >
                <Text style={styles.btnText}>Capture Frame {frames + 1}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {stage === 'processing' && (
        <View style={styles.center}>
          <Text style={styles.label}>Generating face templates…</Text>
        </View>
      )}

      {stage === 'done' && (
        <View style={styles.center}>
          <Text style={styles.success}>✓ Enrolled Successfully</Text>
          <Text style={styles.label}>User: {userId}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === 'error' && (
        <View style={styles.center}>
          <Text style={styles.error}>Enrollment Failed</Text>
          <Text style={styles.label}>{errorMsg}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => setStage('input')}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: {
    fontSize: 28, fontWeight: '800', color: '#fff',
    textAlign: 'center', paddingTop: 24, paddingBottom: 16,
  },
  form: { padding: 24, gap: 14 },
  label: { color: '#aaa', fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: '#1A1A2E', color: '#fff', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    borderWidth: 1, borderColor: '#333',
  },
  btn: {
    backgroundColor: '#00FF88', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  cameraContainer: {
    flex: 1, margin: 16, borderRadius: 20,
    overflow: 'hidden', position: 'relative',
  },
  noCamera: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  captureOverlay: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  captureCount: { color: '#00FF88', fontSize: 18, fontWeight: '700' },
  captureHint: { color: '#ccc', fontSize: 13, marginTop: 4 },
  success: { color: '#00FF88', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  error: { color: '#FF4444', fontSize: 20, fontWeight: '800', marginBottom: 8 },
});
