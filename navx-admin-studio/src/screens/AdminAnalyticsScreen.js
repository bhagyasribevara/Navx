import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, StatusBar, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from '../context/AdminContext';
import { getAnalytics } from '../services/adminApi';

const { width: SW } = Dimensions.get('window');

export default function AdminAnalyticsScreen({ navigation, route }) {
  const { admin } = useAdmin();
  const campusId = route.params?.campusId || admin?.campusId?._id || admin?.campusId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(30);

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    if (!campusId) { setLoading(false); return; }
    try {
      if (!isRefresh) setLoading(true);
      const res = await getAnalytics(campusId, period);
      setData(res);
    } catch (e) {
      console.warn('Failed to load analytics:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campusId, period]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const maxBarValue = (items) => Math.max(...items.map(i => i.value || 0), 1);

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
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {[7, 30, 90].map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.periodChip, period === d && styles.periodChipActive]}
            onPress={() => setPeriod(d)}
          >
            <Text style={[styles.periodText, period === d && styles.periodTextActive]}>
              {d}D
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalytics(true); }} tintColor="#8b5cf6" />}
      >
        {/* Stat cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(59,130,246,0.08)' }]}>
              <Ionicons name="navigate" size={20} color="#3b82f6" />
            </View>
            <Text style={styles.statValue}>{data?.navCount || 0}</Text>
            <Text style={styles.statLabel}>Navigations</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(139,92,246,0.08)' }]}>
              <Ionicons name="search" size={20} color="#8b5cf6" />
            </View>
            <Text style={styles.statValue}>{data?.searchCount || 0}</Text>
            <Text style={styles.statLabel}>Searches</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(34,197,94,0.08)' }]}>
              <Ionicons name="qr-code" size={20} color="#22c55e" />
            </View>
            <Text style={styles.statValue}>{data?.qrCount || 0}</Text>
            <Text style={styles.statLabel}>QR Scans</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
              <Ionicons name="people" size={20} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{data?.averageAttendance || 0}%</Text>
            <Text style={styles.statLabel}>Attendance</Text>
          </View>
        </View>

        {/* Attendance Trend */}
        {data?.attendanceTrend && data.attendanceTrend.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Attendance Trend</Text>
            <View style={styles.barChart}>
              {data.attendanceTrend.map((item, i) => {
                const max = maxBarValue(data.attendanceTrend);
                const height = Math.max((item.value / max) * 100, 4);
                return (
                  <View key={i} style={styles.barItem}>
                    <Text style={styles.barValue}>{item.value}%</Text>
                    <View style={[styles.bar, { height, backgroundColor: '#8b5cf6' }]} />
                    <Text style={styles.barLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* QR Scan Trend */}
        {data?.qrScans && data.qrScans.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>QR Scans (Weekly)</Text>
            <View style={styles.barChart}>
              {data.qrScans.map((item, i) => {
                const max = maxBarValue(data.qrScans);
                const height = Math.max((item.value / max) * 100, 4);
                return (
                  <View key={i} style={styles.barItem}>
                    <Text style={styles.barValue}>{item.value}</Text>
                    <View style={[styles.bar, { height, backgroundColor: '#22c55e' }]} />
                    <Text style={styles.barLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Top Searches */}
        {data?.topSearches && data.topSearches.length > 0 && (
          <View style={styles.listCard}>
            <Text style={styles.chartTitle}>Top Searches</Text>
            {data.topSearches.map((s, i) => (
              <View key={i} style={styles.listItem}>
                <View style={styles.listRank}>
                  <Text style={styles.listRankText}>{i + 1}</Text>
                </View>
                <Text style={styles.listItemText}>{s._id || 'Unknown'}</Text>
                <View style={styles.listCount}>
                  <Text style={styles.listCountText}>{s.count}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Top Routes */}
        {data?.topRoutes && data.topRoutes.length > 0 && (
          <View style={styles.listCard}>
            <Text style={styles.chartTitle}>Popular Routes</Text>
            {data.topRoutes.slice(0, 5).map((r, i) => (
              <View key={i} style={styles.listItem}>
                <View style={styles.listRank}>
                  <Text style={styles.listRankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemText}>
                    {r._id?.from || '?'} → {r._id?.to || '?'}
                  </Text>
                </View>
                <View style={styles.listCount}>
                  <Text style={styles.listCountText}>{r.count}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No data state */}
        {!data?.navCount && !data?.searchCount && !data?.qrCount && (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Analytics Data</Text>
            <Text style={styles.emptyDesc}>Analytics will appear as users interact with navigation</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orb1: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: 'rgba(245,158,11,0.03)', top: -60, right: -80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  // Period
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  periodChip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9',
  },
  periodChipActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  periodText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  periodTextActive: { color: '#fff' },
  scrollContent: { paddingHorizontal: 16 },
  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  statCard: {
    width: (SW - 48) / 2, backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  // Chart card
  chartCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
  },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  barChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140 },
  barItem: { alignItems: 'center', flex: 1 },
  bar: { width: 28, borderRadius: 6, marginVertical: 6 },
  barValue: { fontSize: 11, fontWeight: '700', color: '#475569' },
  barLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  // List card
  listCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
  },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  listRank: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.06)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  listRankText: { fontSize: 12, fontWeight: '700', color: '#8b5cf6' },
  listItemText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#334155' },
  listCount: { backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  listCountText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 16 },
  emptyDesc: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
