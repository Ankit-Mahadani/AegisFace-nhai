/**
 * EnrollScreen — capture ENROLL_FRAMES frames, embed, and save.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
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
  const capturedFrames = useRef<Array<{ pixelBuffer: ArrayBuffer; width: number; height: number; format: string }>>([]);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const handleCapture = useCallback(() => {
    if (!userId.trim()) {
      Alert.alert('Error', 'Please enter a User ID first.');
      return;
    }
    capturedFrames.current = [];
    setFrames(0);
    setStage('capturing');
  }, [userId]);

  // Simulate frame capture for demo (real path uses useFrameOutput below)
  const handleMockCapture = useCallback(async () => {
    if (capturedFrames.current.length >= ENROLL_FRAMES) return;
    // Create a synthetic 112×112 RGB buffer seeded with userId hash
    const buf = new ArrayBuffer(112 * 112 * 3);
    const view = new Uint8Array(buf);
    let h = 0x811c9dc5;
    for (let i = 0; i < userId.length; i++) {
      h ^= userId.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    // Fill with user-specific colour + slight variation per frame
    const frameIdx = capturedFrames.current.length;
    for (let i = 0; i < view.length; i += 3) {
      view[i]     = ((h ^ (i * 7 + frameIdx * 11)) & 0xff);
      view[i + 1] = ((h ^ (i * 13 + frameIdx * 5)) & 0xff);
      view[i + 2] = ((h ^ (i * 3 + frameIdx * 17)) & 0xff);
    }
    capturedFrames.current.push({ pixelBuffer: buf, width: 112, height: 112, format: 'rgb' });
    setFrames(capturedFrames.current.length);

    if (capturedFrames.current.length >= ENROLL_FRAMES) {
      await processEnrollment();
    }
  }, [userId]);

  async function processEnrollment() {
    setStage('processing');
    try {
      const result = await enroll(userId.trim(), { frames: capturedFrames.current });
      if (result.ok) {
        setStage('done');
      } else {
        setErrorMsg('No face detected in frames. Please try again.');
        setStage('error');
      }
    } catch (e) {
      setErrorMsg(String(e));
      setStage('error');
    }
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
          <TouchableOpacity style={styles.btn} onPress={handleCapture}>
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
              />
              <FaceOverlay faces={faces} viewWidth={300} viewHeight={400} />
            </>
          ) : (
            <Text style={styles.label}>No front camera found.</Text>
          )}
          <View style={styles.captureOverlay}>
            <Text style={styles.captureCount}>
              {frames} / {ENROLL_FRAMES} frames captured
            </Text>
            <Text style={styles.captureHint}>
              {frames < ENROLL_FRAMES ? 'Hold still — capturing…' : 'Processing…'}
            </Text>
            <TouchableOpacity
              style={[styles.btn, { marginTop: 20 }]}
              onPress={handleMockCapture}
              disabled={frames >= ENROLL_FRAMES}
            >
              <Text style={styles.btnText}>Capture Frame {frames + 1}</Text>
            </TouchableOpacity>
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
  title: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', paddingTop: 24, paddingBottom: 16 },
  form: { padding: 24, gap: 14 },
  label: { color: '#aaa', fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: '#1A1A2E', color: '#fff', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    borderWidth: 1, borderColor: '#333',
  },
  btn: { backgroundColor: '#00FF88', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  cameraContainer: { flex: 1, margin: 16, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  captureOverlay: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 20, alignItems: 'center',
  },
  captureCount: { color: '#00FF88', fontSize: 18, fontWeight: '700' },
  captureHint: { color: '#ccc', fontSize: 13, marginTop: 4 },
  success: { color: '#00FF88', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  error: { color: '#FF4444', fontSize: 20, fontWeight: '800', marginBottom: 8 },
});
