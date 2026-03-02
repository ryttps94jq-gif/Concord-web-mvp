// Concord Mobile — Connection State Indicator
// Shows online / mesh-only / offline status

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConnectionState } from '../../utils/types';

const STATE_CONFIG: Record<ConnectionState, { color: string; label: string }> = {
  online: { color: '#00ff88', label: 'Online' },
  'mesh-only': { color: '#ffaa00', label: 'Mesh Only' },
  offline: { color: '#ff4444', label: 'Offline' },
};

interface Props {
  state: ConnectionState;
  showLabel?: boolean;
}

export function ConnectionIndicator({ state, showLabel = true }: Props) {
  const config = STATE_CONFIG[state];

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      {showLabel && <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});
