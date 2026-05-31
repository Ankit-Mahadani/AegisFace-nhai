import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { OnlineIndicator } from '../components/OnlineIndicator';
import { bootstrap, embedder } from '../AegisFace';
import { isNativeMediaPipeAvailable } from '../native/MediaPipeModule';
import { templateStore } from '../implementations/EncryptedTemplateStore';
import { USE_MOCK_EMBEDDER } from '../config/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [enrolledCount, setEnrolledCount] = useState(0);

  useEffect(() => {
    bootstrap()
      .then(() => templateStore.count())
      .then(setEnrolledCount)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      templateStore.count().then(setEnrolledCount);
    });
    return unsubscribe;
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00FF88" />
        <Text style={styles.loadingText}>Starting AegisFace…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>AegisFace</Text>
        <Text style={styles.subtitle}>Offline Face Attendance</Text>
        <OnlineIndicator />
      </View>

      <View style={styles.statusCard}>
        <StatusRow label="Embedder" value={USE_MOCK_EMBEDDER ? '🟡 Mock' : '🟢 TFLite'} />
        <StatusRow label="MediaPipe" value={isNativeMediaPipeAvailable ? '🟢 Native' : '🟡 Stub'} />
        <StatusRow label="Enrolled users" value={String(enrolledCount)} />
        <StatusRow label="Model" value={embedder.mode} />
      </View>

      <View style={styles.buttons}>
        <Button label="Enroll New User" onPress={() => navigation.navigate('Enroll')} color="#00FF88" />
        <Button label="Authenticate" onPress={() => navigation.navigate('Authenticate')} color="#3B82F6" />
        <Button label="Records" onPress={() => navigation.navigate('Records')} color="#8B5CF6" />
      </View>
    </SafeAreaView>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function Button({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity style={[styles.btn, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F1A' },
  loadingText: { color: '#ccc', marginTop: 12 },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  title: { fontSize: 36, fontWeight: '800', color: '#00FF88', letterSpacing: 2 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  statusCard: {
    marginHorizontal: 20, backgroundColor: '#1A1A2E', borderRadius: 16,
    padding: 20, gap: 10,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusLabel: { color: '#888', fontSize: 14 },
  statusValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  buttons: { flex: 1, padding: 20, justifyContent: 'flex-end', gap: 14 },
  btn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
