import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Animated, RefreshControl, Image, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdmin } from '../context/AdminContext';
import { getDashboardStats } from '../services/adminApi';

const { width: SW } = Dimensions.get('window');
const CARD_WIDTH = (SW - 56) / 2;

export default function DashboardScreen({ navigation }) {
  const { admin, logout } = useAdmin();
  const [stats, setStats] = useState(null);
  const [campus, setCampus] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(-20)).current;

  const campusId = admin?.campusId?._id || admin?.campusId;

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!campusId) {
      setLoading(false);
      return;
    }
    try {
      if (!isRefresh) setLoading(true);
      const data = await getDashboardStats(campusId);
      if (data?.success) {
        setStats(data.stats);
        setCampus(data.campus);
        setRecentActivity(data.recentActivity || []);
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        await logout();
        navigation.replace('Login');
        return;
      }
      console.warn('Dashboard notice:', e?.message || e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campusId, logout, navigation]);

  useEffect(() => {
    loadDashboard();
    // Auto-refresh every 30s
    const interval = setInterval(() => loadDashboard(true), 30000);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    return () => clearInterval(interval);
  }, [loadDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard(true);
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  const statCards = [
    { label: 'Buildings', value: stats?.buildings || 0, sub: 'Total Added', icon: 'business', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
    { label: 'Floors', value: stats?.floors || 0, sub: 'Total Added', icon: 'layers', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    { label: 'POIs', value: stats?.pois || 0, sub: 'Total Added', icon: 'location', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
    { label: 'Users', value: stats?.users || 0, sub: 'Total Registered', icon: 'people', color: '#ec4899', bg: 'rgba(236,72,153,0.08)' },
  ];

  const modules = [
    {
      title: 'AR Workspace (Studio)',
      desc: 'Walk through the building with your camera. Our AI maps the space, detects rooms, measures width and builds the navigation graph automatically.',
      icon: 'cube',
      color: '#8b5cf6',
      route: 'SpatialStudio',
      badge: 'New',
    },
    {
      title: 'Admin Scan Recordings',
      desc: 'Manage and review recorded mobile corridor scans. Delete recordings to purge digital twins directly.',
      icon: 'videocam',
      color: '#ec4899',
      route: 'AdminRecordings',
      badge: 'Twin Sync',
    },
    {
      title: 'Campaign Manager',
      desc: 'Create, schedule and manage announcements, events and notification campaigns for students, faculty and visitors.',
      icon: 'megaphone',
      color: '#3b82f6',
      route: 'Campaigns',
    },
    {
      title: 'Emergency System',
      desc: 'Configure emergency exits, safe zones, alerts and real-time emergency communication system.',
      icon: 'warning',
      color: '#ef4444',
      route: 'Emergency',
    },
    {
      title: 'QR Generator (Campus Map)',
      desc: 'Generate QR codes for campus maps or specific buildings. Download and save the map as PDF for offline sharing.',
      icon: 'qr-code',
      color: '#10b981',
      route: 'QRGenerator',
    },
  ];

  const extraModules = [
    { title: 'Buildings & Floors', desc: 'View all buildings, floors and room details', icon: 'grid', color: '#6366f1', route: 'Buildings' },
    { title: 'Analytics', desc: 'Navigation stats, search trends, QR scans', icon: 'bar-chart', color: '#f59e0b', route: 'Analytics' },
  ];

  const activityIcons = {
    navigation: { icon: 'navigate', color: '#3b82f6' },
    search: { icon: 'search', color: '#8b5cf6' },
    qr_scan: { icon: 'qr-code', color: '#22c55e' },
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Background orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: headerAnim }] }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Welcome back, {admin?.username || 'Admin'} 👋</Text>
            <Text style={styles.subGreeting}>
              Manage your {campus?.venueType || 'campus'}, maps and navigation experience.
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Stat Cards Row */}
        <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
          {statCards.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={20} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statSub}>{s.sub}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Module Cards */}
        <View style={styles.moduleGrid}>
          {modules.map((mod, i) => (
            <TouchableOpacity
              key={i}
              style={styles.moduleCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(mod.route, { campusId, admin })}
            >
              {mod.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{mod.badge}</Text>
                </View>
              )}
              <View style={[styles.moduleIconWrap, { backgroundColor: mod.color + '12' }]}>
                <Ionicons name={mod.icon} size={28} color={mod.color} />
              </View>
              <Text style={styles.moduleTitle}>{mod.title}</Text>
              <Text style={styles.moduleDesc} numberOfLines={3}>{mod.desc}</Text>
              <TouchableOpacity
                style={[styles.moduleBtn, { borderColor: mod.color }]}
                onPress={() => navigation.navigate(mod.route, { campusId, admin })}
              >
                <Text style={[styles.moduleBtnText, { color: mod.color }]}>
                  {mod.title.includes('AR') ? 'Open Studio' :
                   mod.title.includes('Campaign') ? 'Manage Campaigns' :
                   mod.title.includes('Emergency') ? 'Open Emergency Panel' :
                   'Generate QR Code'} →
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* Extra modules row */}
        <View style={styles.extraRow}>
          {extraModules.map((mod, i) => (
            <TouchableOpacity
              key={i}
              style={styles.extraCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(mod.route, { campusId, admin })}
            >
              <View style={[styles.extraIconWrap, { backgroundColor: mod.color + '12' }]}>
                <Ionicons name={mod.icon} size={24} color={mod.color} />
              </View>
              <Text style={styles.extraTitle}>{mod.title}</Text>
              <Text style={styles.extraDesc} numberOfLines={2}>{mod.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Analytics', { campusId, admin })}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="time-outline" size={36} color="#cbd5e1" />
              <Text style={styles.emptyText}>No recent activity</Text>
            </View>
          ) : (
            recentActivity.slice(0, 5).map((activity, i) => {
              const ai = activityIcons[activity.type] || { icon: 'ellipsis-horizontal', color: '#94a3b8' };
              return (
                <View key={i} style={styles.activityItem}>
                  <View style={[styles.activityDot, { backgroundColor: ai.color + '15' }]}>
                    <Ionicons name={ai.icon} size={16} color={ai.color} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityDesc}>{activity.description}</Text>
                    <Text style={styles.activityTime}>{formatTime(activity.timestamp)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                </View>
              );
            })
          )}
        </View>

        {/* Admin Footer */}
        <View style={styles.adminFooter}>
          <View style={styles.adminAvatar}>
            <Ionicons name="shield-checkmark" size={22} color="#8b5cf6" />
          </View>
          <View style={styles.adminInfo}>
            <Text style={styles.adminName}>{admin?.username || 'Admin'}</Text>
            <Text style={styles.adminRole}>
              {admin?.role === 'SuperAdmin' ? 'Super Admin' : 'Campus Admin'}
            </Text>
          </View>
          <TouchableOpacity style={styles.moreBtn} onPress={handleLogout}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  scrollContent: {
    paddingTop: 54,
    paddingHorizontal: 16,
  },
  // Background orbs
  orb1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
    top: -80,
    right: -100,
  },
  orb2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.03)',
    bottom: 100,
    left: -60,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  subGreeting: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: (SW - 56) / 4,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  statSub: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 1,
  },
  // Module cards
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  moduleCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  moduleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  moduleDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 12,
  },
  moduleBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  moduleBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Extra modules
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  extraCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  extraIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  extraTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  extraDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  // Activity
  activitySection: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  viewAllText: {
    fontSize: 13,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  activityDot: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  activityTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
  },
  // Admin footer
  adminFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  adminAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  adminRole: {
    fontSize: 11,
    color: '#8b5cf6',
    fontWeight: '600',
    marginTop: 1,
  },
  moreBtn: {
    padding: 8,
  },
});
