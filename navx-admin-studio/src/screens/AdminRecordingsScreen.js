import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StatusBar, RefreshControl, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSpatialSessions, deleteSpatialSession, sendScanToWeb } from '../services/adminApi';
import { useAdmin } from '../context/AdminContext';

const { width: SW } = Dimensions.get('window');

export default function AdminRecordingsScreen({ navigation }) {
  const { admin } = useAdmin();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchRecordings = useCallback(async () => {
    try {
      const res = await getSpatialSessions();
      if (res?.success) {
        setSessions(res.sessions || []);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.warn('Error fetching spatial sessions:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecordings();
  };

  const handleDelete = (session) => {
    Alert.alert(
      'Delete Scan Recording?',
      `Are you sure you want to delete the recording for ${session.floor?.name || 'Floor'} (${session.building?.name || 'Building'})?\n\nThis will immediately remove the associated 3D Digital Twin and trajectory map from the Web Admin Studio as well.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(session._id);
              const res = await deleteSpatialSession(session._id);
              if (res?.success) {
                Alert.alert('Deleted', 'Scan recording and associated 3D Digital Twin successfully purged.');
                fetchRecordings();
              } else {
                Alert.alert('Error', res?.error || 'Could not delete session.');
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete recording.');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const handleSendToWeb = async (session) => {
    try {
      const rooms = session.roomSegments || session.detectedRooms || [];
      const scannedElements = session.scannedElements || rooms.map((r, idx) => ({
        id: `room_${session._id}_${idx}`,
        name: r.roomName || r.roomNumber || `Room ${idx + 1}`,
        type: 'room',
        geometry3D: {
          dimensions: { width: 3.2, length: 4.0, height: 2.8 },
          position: { x: (Math.floor(idx / 2) * 4) - 6, y: 0, z: idx % 2 === 0 ? 1.15 : -1.15 },
          rotation: { x: 0, y: 0, z: 0 },
          color: '#3b82f6'
        },
        status: 'unplaced'
      }));

      // Include a Corridor element if none present
      if (!scannedElements.some(e => e.type === 'corridor')) {
        const estimatedCorridorLength = Math.max(10, rooms.length * 4.0);
        scannedElements.push({
          id: `corridor_${session._id}`,
          name: `${session.floor?.name || 'Floor'} Main Corridor`,
          type: 'corridor',
          geometry3D: {
            dimensions: { width: 2.4, length: estimatedCorridorLength, height: 2.8 },
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            color: '#8b5cf6'
          },
          status: 'unplaced'
        });
      }

      const res = await sendScanToWeb(session._id, {
        roomSegments: session.roomSegments,
        scannedElements
      });
      if (res?.success) {
        Alert.alert('Success', 'Scan 3D components sent to Web Dashboard staging area.');
        fetchRecordings();
      } else {
        Alert.alert('Error', 'Failed to send scan to web.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Network error.');
    }
  };

  const renderItem = ({ item }) => {
    const isDeleting = deletingId === item._id;
    const rooms = item.roomSegments && item.roomSegments.length > 0 
      ? item.roomSegments 
      : (item.detectedRooms || []);
    const wallColors = item.wallColors || { top: '#f6f5ee', bottom: '#b5a68e' };
    const floorColor = item.floorColor || '#d6cebf';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <Ionicons name="videocam" size={20} color="#8b5cf6" />
            </View>
            <View>
              <Text style={styles.buildingName}>{item.building?.name || 'Academic Block'}</Text>
              <Text style={styles.floorName}>
                <Ionicons name="layers-outline" size={12} color="#64748b" /> {item.floor?.name || 'Floor'}
              </Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status === 'completed' ? 'Synced to Twin' : item.status}</Text>
          </View>
        </View>

        {/* Telemetry metadata */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date Recorded</Text>
            <Text style={styles.metaVal}>
              {new Date(item.createdAt || item.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>SLAM Points</Text>
            <Text style={styles.metaVal}>{item.trajectory?.length || 0} pts</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Coverage</Text>
            <Text style={[styles.metaVal, { color: '#10b981' }]}>{item.coveragePercentage || 85}%</Text>
          </View>
        </View>

        {/* Detected Rooms Chips */}
        <View style={styles.roomsContainer}>
          <Text style={styles.sectionSubtitle}>Tagged Rooms:</Text>
          <View style={styles.roomChips}>
            {rooms.length === 0 && <Text style={{fontSize: 11, color: '#94a3b8'}}>No rooms tagged</Text>}
            {rooms.map((r, i) => (
              <View key={i} style={styles.chip}>
                <MaterialCommunityIcons name="door-open" size={13} color="#3b82f6" />
                <Text style={styles.chipText}>{r.roomName || `Room ${r.roomNumber}`}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Extracted Colors */}
        <View style={styles.paletteContainer}>
          <Text style={styles.sectionSubtitle}>Palette:</Text>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: wallColors.top, borderColor: '#cbd5e1', borderWidth: 1 }]} />
            <Text style={styles.swatchLabel}>Upper Wall</Text>
            <View style={[styles.swatch, { backgroundColor: wallColors.bottom }]} />
            <Text style={styles.swatchLabel}>Dado</Text>
            <View style={[styles.swatch, { backgroundColor: floorColor }]} />
            <Text style={styles.swatchLabel}>Floor</Text>
          </View>
        </View>

        {/* Card Footer with Delete Action */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[styles.sendBtn, item.isAvailableOnWeb && styles.sendBtnDisabled]}
            onPress={() => handleSendToWeb(item)}
            disabled={item.isAvailableOnWeb || isDeleting}
          >
            <Ionicons name={item.isAvailableOnWeb ? "cloud-done" : "cloud-upload-outline"} size={15} color={item.isAvailableOnWeb ? "#10b981" : "#fff"} />
            <Text style={[styles.sendBtnText, item.isAvailableOnWeb && styles.sendBtnTextDisabled]}>
              {item.isAvailableOnWeb ? 'Sent to Web' : 'Send to Web'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={15} color="#ef4444" />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.orb1} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Scan Recordings</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Fetching spatial recordings...</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="videocam-outline" size={36} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>No Recordings Yet</Text>
              <Text style={styles.emptySubtitle}>
                Mobile scan recordings captured via Spatial Studio Scanner will be listed here. You can inspect or delete them at any time.
              </Text>
              <TouchableOpacity
                style={styles.startScanBtn}
                onPress={() => navigation.navigate('SpatialStudio')}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startScanBtnInner}
                >
                  <Ionicons name="camera" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.startScanBtnText}>Start New Mobile Scan</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b', fontWeight: '500' },
  orb1: { position: 'absolute', width: 260, height: 260, borderRadius: 999, backgroundColor: 'rgba(139,92,246,0.04)', top: -60, right: -80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.08)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  listContent: { padding: 16, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(139,92,246,0.1)', justifyContent: 'center', alignItems: 'center' },
  buildingName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  floorName: { fontSize: 12, color: '#64748b', marginTop: 1 },
  statusBadge: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#10b981' },

  // Meta row
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 12 },
  metaCol: { alignItems: 'center' },
  metaLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  metaVal: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginTop: 2 },

  // Rooms
  roomsContainer: { marginBottom: 10 },
  sectionSubtitle: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  roomChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },

  // Palette
  paletteContainer: { marginBottom: 12 },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  swatchLabel: { fontSize: 10, color: '#64748b', marginRight: 8 },

  // Card Footer
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 8 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#8b5cf6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  sendBtnDisabled: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  sendBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  sendBtnTextDisabled: { color: '#10b981' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef2f2', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fee2e2' },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#ef4444' },

  // Empty state
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(139,92,246,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  startScanBtn: { borderRadius: 12, overflow: 'hidden' },
  startScanBtnInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  startScanBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
