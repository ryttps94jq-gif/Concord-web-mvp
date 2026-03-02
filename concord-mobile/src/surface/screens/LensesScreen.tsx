// Concord Mobile — Lenses Screen
// Browsable list of lenses with categories

import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';

interface LensItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}

// Core lenses from the web frontend lens registry
const LENSES: LensItem[] = [
  { id: 'chat', name: 'Chat', description: 'Conversations, forums, daily notes', category: 'core', icon: 'C' },
  { id: 'board', name: 'Board', description: 'Tasks, goals, calendar, timelines', category: 'core', icon: 'B' },
  { id: 'graph', name: 'Graph', description: 'Knowledge mapping, entities, schemas', category: 'core', icon: 'G' },
  { id: 'code', name: 'Code', description: 'Editor, debugging, database', category: 'core', icon: '<>' },
  { id: 'studio', name: 'Studio', description: 'Creative tools, music, art, games', category: 'core', icon: 'S' },
  { id: 'research', name: 'Research', description: 'Papers, analysis, hypothesis testing', category: 'knowledge', icon: 'R' },
  { id: 'atlas', name: 'Atlas', description: 'Foundation data, signal visualization', category: 'knowledge', icon: 'A' },
  { id: 'shield', name: 'Shield', description: 'Security scanning, threat detection', category: 'system', icon: 'Sh' },
  { id: 'governance', name: 'Governance', description: 'Council, voting, sovereignty', category: 'governance', icon: 'Go' },
  { id: 'marketplace', name: 'Marketplace', description: 'Browse, buy, sell creative works', category: 'economy', icon: 'M' },
  { id: 'entity', name: 'Entity', description: 'Emergent entity lifecycle', category: 'ai', icon: 'E' },
  { id: 'memory', name: 'Memory', description: 'DTU lattice explorer, pain memory', category: 'knowledge', icon: 'Me' },
];

const CATEGORIES = ['all', 'core', 'knowledge', 'system', 'governance', 'economy', 'ai'];

export function LensesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredLenses = useMemo(() => {
    let lenses = LENSES;
    if (selectedCategory !== 'all') {
      lenses = lenses.filter(l => l.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      lenses = lenses.filter(l =>
        l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
      );
    }
    return lenses;
  }, [searchQuery, selectedCategory]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lenses</Text>
        <Text style={styles.headerCount}>{filteredLenses.length}</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search lenses..."
          placeholderTextColor="#666"
        />
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === item && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(item)}
          >
            <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={item => item}
        style={styles.categoryList}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryListContent}
      />

      <FlatList
        data={filteredLenses}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.lensCard}>
            <View style={styles.lensIcon}>
              <Text style={styles.lensIconText}>{item.icon}</Text>
            </View>
            <View style={styles.lensInfo}>
              <Text style={styles.lensName}>{item.name}</Text>
              <Text style={styles.lensDescription}>{item.description}</Text>
            </View>
            <Text style={styles.lensCategory}>{item.category}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
        style={styles.lensList}
        contentContainerStyle={styles.lensListContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  headerTitle: { color: '#00d4ff', fontSize: 20, fontWeight: '700' },
  headerCount: { color: '#888', fontSize: 14 },
  searchContainer: { padding: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: '#14141f', color: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  categoryList: { maxHeight: 44, paddingLeft: 16 },
  categoryListContent: { paddingRight: 16 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#14141f', marginRight: 8, borderWidth: 1, borderColor: '#2a2a3e',
  },
  categoryChipActive: { backgroundColor: '#1a3a5c', borderColor: '#00d4ff' },
  categoryText: { color: '#888', fontSize: 13 },
  categoryTextActive: { color: '#00d4ff' },
  lensList: { flex: 1 },
  lensListContent: { padding: 16 },
  lensCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#14141f', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#1a1a2e',
  },
  lensIcon: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#1a3a5c',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  lensIconText: { color: '#00d4ff', fontSize: 14, fontWeight: '700' },
  lensInfo: { flex: 1 },
  lensName: { color: '#e0e0e0', fontSize: 16, fontWeight: '600' },
  lensDescription: { color: '#888', fontSize: 12, marginTop: 2 },
  lensCategory: { color: '#555', fontSize: 10, textTransform: 'uppercase' },
});
