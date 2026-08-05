import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, StatusBar, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from '../context/AdminContext';
import { getBuildings } from '../services/adminApi';

const { width: SW } = Dimensions.get('window');

const ROOM_TYPE_ICONS = {
  classroom: 'school', office: 'business', lab: 'flask', restroom: 'water',
  cafeteria: 'restaurant', library: 'library', auditorium: 'megaphone',
  elevator: 'arrow-up', stairs: 'trending-up', corridor: 'walk',
  entrance: 'enter', exit: 'exit', other: 'location',
  ward: 'bed', icu: 'pulse', pharmacy: 'medkit', reception: 'information-circle',
  store: 'storefront', food_court: 'fast-food', gate: 'airplane',
  conference: 'people', lobby: 'home', gym: 'fitness',
};

const ROOM_TYPE_COLORS = {
  classroom: '#3b82f6', office: '#8b5cf6', lab: '#22c55e', restroom: '#f59e0b',
  cafeteria: '#ef4444', library: '#06b6d4', elevator: '#6366f1', stairs: '#f97316',
  entrance: '#10b981', corridor: '#64748b', other: '#94a3b8',
};

export default function AdminBuildingsScreen({ navigation, route }) {
  const { admin } = useAdmin();
  const campusId = route.params?.campusId || admin?.campusId?._id || admin?.campusId;

  const [buildings, setBuildings] = useState([]);
  const [expandedBlock, setExpandedBlock] = useState(null);
  const [expandedFloor, setExpandedFloor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBuildings = useCallback(async (isRefresh = false) => {
    if (!campusId) { setLoading(false); return; }
    try {
      if (!isRefresh) setLoading(true);
      const data = await getBuildings(campusId);
      setBuildings(data?.buildings || []);
    } catch (e) {
      console.warn('Failed to load buildings:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campusId]);

  useEffect(() => { loadBuildings(); }, [loadBuildings]);

  const toggleBlock = (blockId) => {
    setExpandedBlock(expandedBlock === blockId ? null : blockId);
    setExpandedFloor(null);
  };

  const toggleFloor = (floorId) => {
    setExpandedFloor(expandedFloor === floorId ? null : floorId);
  };

  const getRoomTypeCount = (rooms) => {
    const counts = {};
    rooms.forEach(r => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.orb1} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buildings & Floors</Text>
        <View style={styles.readOnlyBadge}>
          <Ionicons name="eye" size={14} color="#8b5cf6" />
          <Text style={styles.readOnlyText}>Read Only</Text>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Ionicons name="business" size={20} color="#8b5cf6" />
          <Text style={styles.summaryValue}>{buildings.length}</Text>
          <Text style={styles.summaryLabel}>Buildings</Text>
        </View>
        <View style={styles.summaryCard}>
          <Ionicons name="layers" size={20} color="#3b82f6" />
          <Text style={styles.summaryValue}>{buildings.reduce((s, b) => s + (b.floorCount || 0), 0)}</Text>
          <Text style={styles.summaryLabel}>Floors</Text>
        </View>
        <View style={styles.summaryCard}>
          <Ionicons name="location" size={20} color="#22c55e" />
          <Text style={styles.summaryValue}>{buildings.reduce((s, b) => s + (b.totalRooms || 0), 0)}</Text>
          <Text style={styles.summaryLabel}>Rooms</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBuildings(true); }} tintColor="#8b5cf6" />}
      >
        {buildings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Buildings Yet</Text>
            <Text style={styles.emptyDesc}>Buildings will appear here once added via the web dashboard</Text>
          </View>
        ) : (
          buildings.map(block => (
            <View key={block._id} style={styles.blockCard}>
              <TouchableOpacity
                style={styles.blockHeader}
                onPress={() => toggleBlock(block._id)}
                activeOpacity={0.7}
              >
                <View style={styles.blockIconWrap}>
                  <Ionicons name="business" size={22} color="#8b5cf6" />
                </View>
                <View style={styles.blockInfo}>
                  <Text style={styles.blockName}>{block.name}</Text>
                  <Text style={styles.blockMeta}>
                    {block.floorCount} floor{block.floorCount !== 1 ? 's' : ''} · {block.totalRooms} room{block.totalRooms !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons
                  name={expandedBlock === block._id ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#94a3b8"
                />
              </TouchableOpacity>

              {expandedBlock === block._id && block.floors && (
                <View style={styles.floorsList}>
                  {block.floors.map(floor => (
                    <View key={floor._id}>
                      <TouchableOpacity
                        style={styles.floorItem}
                        onPress={() => toggleFloor(floor._id)}
                      >
                        <View style={styles.floorIconWrap}>
                          <Ionicons name="layers" size={16} color="#3b82f6" />
                        </View>
                        <View style={styles.floorInfo}>
                          <Text style={styles.floorName}>{floor.name}</Text>
                          <Text style={styles.floorMeta}>{floor.roomCount} rooms</Text>
                        </View>
                        <Ionicons
                          name={expandedFloor === floor._id ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color="#cbd5e1"
                        />
                      </TouchableOpacity>

                      {expandedFloor === floor._id && floor.rooms && floor.rooms.length > 0 && (
                        <View style={styles.roomsList}>
                          {getRoomTypeCount(floor.rooms).map(([type, count]) => (
                            <View key={type} style={styles.roomTypeRow}>
                              <View style={[styles.roomTypeDot, { backgroundColor: (ROOM_TYPE_COLORS[type] || '#94a3b8') + '20' }]}>
                                <Ionicons
                                  name={ROOM_TYPE_ICONS[type] || 'location'}
                                  size={14}
                                  color={ROOM_TYPE_COLORS[type] || '#94a3b8'}
                                />
                              </View>
                              <Text style={styles.roomTypeName}>{type.replace(/_/g, ' ')}</Text>
                              <Text style={styles.roomTypeCount}>{count}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orb1: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: 'rgba(99,102,241,0.03)', top: -60, right: -80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  readOnlyBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(139,92,246,0.06)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(139,92,246,0.1)',
  },
  readOnlyText: { fontSize: 11, fontWeight: '600', color: '#8b5cf6', marginLeft: 4 },
  // Summary
  summaryRow: {
    flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 10,
  },
  summaryCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  summaryValue: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginTop: 4 },
  summaryLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
  scrollContent: { paddingHorizontal: 16 },
  // Block card
  blockCard: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
    overflow: 'hidden',
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  blockIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(139,92,246,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  blockInfo: { flex: 1 },
  blockName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  blockMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  // Floors list
  floorsList: { borderTopWidth: 1, borderTopColor: '#f8fafc' },
  floorItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#fafafa',
  },
  floorIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  floorInfo: { flex: 1 },
  floorName: { fontSize: 14, fontWeight: '600', color: '#334155' },
  floorMeta: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  // Rooms list
  roomsList: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#fafbfc' },
  roomTypeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  roomTypeDot: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  roomTypeName: { flex: 1, fontSize: 13, color: '#475569', textTransform: 'capitalize', fontWeight: '500' },
  roomTypeCount: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 16 },
  emptyDesc: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
