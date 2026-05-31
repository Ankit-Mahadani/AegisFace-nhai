import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LivenessState, ChallengeType } from '../interfaces/LivenessEngine';

const LABELS: Record<ChallengeType, string> = {
  BLINK: '👁  Blink your eyes',
  SMILE: '😊  Smile',
  TURN_LEFT: '⬅  Turn head left',
  TURN_RIGHT: '➡  Turn head right',
};

interface Props {
  state: LivenessState;
}

export function LivenessPrompt({ state }: Props) {
  const current = state.challenges[state.currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.challengeRow}>
        {state.challenges.map((c, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              c.status === 'passed' && styles.dotPassed,
              c.status === 'in_progress' && styles.dotActive,
              (c.status === 'timeout' || c.status === 'failed') && styles.dotFailed,
            ]}
          />
        ))}
      </View>
      {current && state.passed === null && (
        <Text style={styles.label}>{LABELS[current.type]}</Text>
      )}
      {state.passed === true && (
        <Text style={[styles.label, styles.passed]}>Liveness check PASSED ✓</Text>
      )}
      {state.passed === false && (
        <Text style={[styles.label, styles.failed]}>Liveness check FAILED ✗</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
  },
  challengeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#888',
  },
  dotActive: { backgroundColor: '#FFD700' },
  dotPassed: { backgroundColor: '#00FF88' },
  dotFailed: { backgroundColor: '#FF4444' },
  label: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  passed: { color: '#00FF88' },
  failed: { color: '#FF4444' },
});
