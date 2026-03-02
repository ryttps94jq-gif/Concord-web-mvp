// Concord Mobile — Marketplace Screen
// Browse, buy, sell creative works

import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useEconomyStore } from '../../store/economy-store';
import type { MarketplaceListing } from '../../utils/types';

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
        <Text style={styles.cardPrice}>{listing.price} CC</Text>
      </View>
      <Text style={styles.cardDescription} numberOfLines={2}>{listing.description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardCategory}>{listing.category}</Text>
        <View style={styles.cardTags}>
          {listing.tags.slice(0, 3).map(tag => (
            <Text key={tag} style={styles.tag}>{tag}</Text>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function MarketplaceScreen() {
  const listings = useEconomyStore(s => s.listings);
  const listingCount = useEconomyStore(s => s.listingCount);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = useMemo(() => {
    const cats = new Set(listings.map(l => l.category));
    return ['all', ...Array.from(cats).sort()];
  }, [listings]);

  const filteredListings = useMemo(() => {
    let result = listings.filter(l => l.active);
    if (selectedCategory !== 'all') {
      result = result.filter(l => l.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [listings, searchQuery, selectedCategory]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketplace</Text>
        <Text style={styles.headerCount}>{listingCount} listings</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search marketplace..."
          placeholderTextColor="#666"
        />
      </View>

      {categories.length > 1 && (
        <FlatList
          horizontal
          data={categories}
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
        />
      )}

      <FlatList
        data={filteredListings}
        renderItem={({ item }) => <ListingCard listing={item} />}
        keyExtractor={item => item.id}
        style={styles.listingsList}
        contentContainerStyle={styles.listingsContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {listings.length === 0 ? 'No listings cached' : 'No matches'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {listings.length === 0
                ? 'Connect to the network to browse available creative works'
                : 'Try adjusting your search or category filter'}
            </Text>
          </View>
        }
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
  categoryList: { maxHeight: 44, paddingLeft: 16, marginBottom: 8 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#14141f', marginRight: 8, borderWidth: 1, borderColor: '#2a2a3e',
  },
  categoryChipActive: { backgroundColor: '#1a3a5c', borderColor: '#00d4ff' },
  categoryText: { color: '#888', fontSize: 13 },
  categoryTextActive: { color: '#00d4ff' },
  listingsList: { flex: 1 },
  listingsContent: { padding: 16 },
  card: {
    backgroundColor: '#14141f', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#1a1a2e',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: '#e0e0e0', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 12 },
  cardPrice: { color: '#00d4ff', fontSize: 16, fontWeight: '700' },
  cardDescription: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: { color: '#555', fontSize: 11, textTransform: 'uppercase' },
  cardTags: { flexDirection: 'row' },
  tag: {
    color: '#00d4ff', fontSize: 10, backgroundColor: '#1a3a5c',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4,
  },
  emptyState: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { color: '#e0e0e0', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { color: '#666', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
