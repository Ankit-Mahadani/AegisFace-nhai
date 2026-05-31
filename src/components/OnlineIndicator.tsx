import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function OnlineIndicator() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => {
      setOnline(!!(s.isConnected && s.isInternetReachable));
    });
    return unsub;
  }, []);

  return (
    <View style={styles.row}>
      <View style={[styles.dot, online ? styles.online : styles.offline]} />
      <Text style={styles.text}>{online ? 'Online' : 'Offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  online: { backgroundColor: '#00FF88' },
  offline: { backgroundColor: '#FF4444' },
  text: { color: '#ccc', fontSize: 12 },
});
