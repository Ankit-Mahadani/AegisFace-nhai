import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { AttendanceEvent } from '../interfaces/EventStore';
import { listAllEvents, syncNow, purgeSynced } from '../AegisFace';

type Props = NativeStackScreenProps<RootStackParamList, 'Records'>;

export function RecordsScreen({ navigation }: Props) {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const data = await listAllEvents();
    setEvents(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    const { uploaded, failed } = await syncNow();
    await load();
    setSyncing(false);
    Alert.alert('Sync complete', `Uploaded: ${uploaded}  Failed: ${failed}`);
  }, [load]);

  const handlePurge = useCallback(async () => {
    Alert.alert(
      'Purge synced records?',
      'This will permanently delete all records that have been confirmed synced to the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge',
          style: 'destructive',
          onPress: async () => {
            const deleted = await purgeSynced();
            await load();
            Alert.alert('Purged', `${deleted} record(s) deleted.`);
          },
        },
      ],
    );
  }, [load]);

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Attendance Records</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
          <Text style={styles.syncBtnText}>{syncing ? 'Syncing…' : 'Sync Now'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.purgeBtn} onPress={handlePurge}>
          <Text style={styles.purgeBtnText}>Purge Synced</Text>
        </TouchableOpacity>
      </View>
      {events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No records yet.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.eventId}
          renderItem={({ item }) => <EventRow event={item} />}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

function EventRow({ event }: { event: AttendanceEvent }) {
  const date = new Date(event.timestamp).toLocaleString();
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowUser}>{event.userId}</Text>
        <Text style={styles.rowDate}>{date}</Text>
        <Text style={styles.rowScore}>
          Score: {(event.score * 100).toFixed(1)}%  •  Liveness: {event.livenessPassed ? '✓' : '✗'}
        </Text>
      </View>
      <View style={[styles.badge, event.synced ? styles.badgeSynced : styles.badgePending]}>
        <Text style={styles.badgeText}>{event.synced ? 'Synced' : 'Pending'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F1A' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', padding: 20, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  syncBtn: { flex: 1, backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  syncBtnText: { color: '#fff', fontWeight: '700' },
  purgeBtn: { flex: 1, backgroundColor: '#FF4444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  purgeBtnText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#555', fontSize: 16 },
  row: {
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
  },
  rowLeft: { flex: 1 },
  rowUser: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rowDate: { color: '#888', fontSize: 12, marginTop: 2 },
  rowScore: { color: '#aaa', fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeSynced: { backgroundColor: '#014421' },
  badgePending: { backgroundColor: '#3B2D00' },
  badgeText: { color: '#ccc', fontSize: 11, fontWeight: '600' },
});
