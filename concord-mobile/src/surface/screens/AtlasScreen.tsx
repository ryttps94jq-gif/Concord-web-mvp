// Concord Mobile — Atlas Screen
// Map view of Foundation data and signal visualization

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLatticeStore } from '../../store/lattice-store';
import { DTU_TYPES } from '../../utils/constants';

export function AtlasScreen() {
  const getDTUsByType = useLatticeStore(s => s.getDTUsByType);
  const foundationDTUs = getDTUsByType(DTU_TYPES.FOUNDATION_SENSE);
  const sensorDTUs = getDTUsByType(DTU_TYPES.SENSOR_READING);
  const signalDTUs = getDTUsByType(DTU_TYPES.ATLAS_SIGNAL);

  const totalReadings = foundationDTUs.length + sensorDTUs.length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Atlas</Text>
        <Text style={styles.headerSubtitle}>Foundation Sense Visualization</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalReadings}</Text>
          <Text style={styles.statLabel}>Sensor Readings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{signalDTUs.length}</Text>
          <Text style={styles.statLabel}>Atlas Signals</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Signal Map</Text>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.placeholderText}>
            Foundation Sense data visualization will render here.
            {'\n\n'}
            WiFi propagation · Bluetooth density · GPS multipath
            {'\n'}
            Barometric · Magnetometer · Accelerometer
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Readings</Text>
        {foundationDTUs.slice(0, 10).map(dtu => (
          <View key={dtu.id} style={styles.readingRow}>
            <Text style={styles.readingType}>{dtu.tags[0] || 'sensor'}</Text>
            <Text style={styles.readingTime}>
              {new Date(dtu.header.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        ))}
        {totalReadings === 0 && (
          <Text style={styles.emptyText}>No Foundation Sense data yet</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  headerTitle: { color: '#00d4ff', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#888', fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#14141f', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#1a1a2e',
  },
  statValue: { color: '#00d4ff', fontSize: 28, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  section: { padding: 16, borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  sectionTitle: { color: '#e0e0e0', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  mapPlaceholder: {
    height: 200, backgroundColor: '#14141f', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', padding: 20,
    borderWidth: 1, borderColor: '#1a3a5c', borderStyle: 'dashed',
  },
  placeholderText: { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  readingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#14141f',
  },
  readingType: { color: '#e0e0e0', fontSize: 14, textTransform: 'capitalize' },
  readingTime: { color: '#888', fontSize: 12 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
