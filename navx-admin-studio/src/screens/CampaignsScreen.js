import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, StatusBar, TextInput, Alert, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdmin } from '../context/AdminContext';
import { getCampaigns, createCampaign } from '../services/adminApi';

export default function CampaignsScreen({ navigation, route }) {
  const { admin } = useAdmin();
  const campusId = route.params?.campusId || admin?.campusId?._id || admin?.campusId;

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadCampaigns = useCallback(async (isRefresh = false) => {
    if (!campusId) { setLoading(false); return; }
    try {
      if (!isRefresh) setLoading(true);
      const data = await getCampaigns(campusId);
      setCampaigns(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      console.warn('Failed to load campaigns:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campusId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Campaign title is required');
      return;
    }
    setCreating(true);
    try {
      await createCampaign({
        title: newTitle.trim(),
        description: newDesc.trim(),
        campusId,
        type: 'announcement',
        isActive: true,
      });
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      loadCampaigns(true);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const campaignIcon = (type) => {
    const map = {
      announcement: { icon: 'megaphone', color: '#3b82f6' },
      event: { icon: 'calendar', color: '#8b5cf6' },
      notification: { icon: 'notifications', color: '#f59e0b' },
      alert: { icon: 'alert-circle', color: '#ef4444' },
    };
    return map[type] || map.announcement;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campaign Manager</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={22} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{campaigns.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#22c55e' }]}>
            {campaigns.filter(c => c.isActive !== false).length}
          </Text>
          <Text style={styles.statLbl}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#94a3b8' }]}>
            {campaigns.filter(c => c.isActive === false).length}
          </Text>
          <Text style={styles.statLbl}>Inactive</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCampaigns(true); }} tintColor="#8b5cf6" />}
        >
          {campaigns.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="megaphone-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Campaigns Yet</Text>
              <Text style={styles.emptyDesc}>Create your first campaign to reach students and visitors</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
                <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.createBtnText}>Create Campaign</Text>
              </TouchableOpacity>
            </View>
          ) : (
            campaigns.map((c, i) => {
              const ci = campaignIcon(c.type);
              return (
                <View key={c._id || i} style={styles.campaignCard}>
                  <View style={styles.campaignHeader}>
                    <View style={[styles.campaignIconWrap, { backgroundColor: ci.color + '12' }]}>
                      <Ionicons name={ci.icon} size={22} color={ci.color} />
                    </View>
                    <View style={styles.campaignInfo}>
                      <Text style={styles.campaignTitle}>{c.title}</Text>
                      <Text style={styles.campaignType}>{c.type || 'announcement'}</Text>
                    </View>
                    <View style={[styles.statusBadge, c.isActive !== false ? styles.activeBadge : styles.inactiveBadge]}>
                      <Text style={[styles.statusText, c.isActive !== false ? styles.activeText : styles.inactiveText]}>
                        {c.isActive !== false ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  {c.description ? (
                    <Text style={styles.campaignDesc} numberOfLines={2}>{c.description}</Text>
                  ) : null}
                  <View style={styles.campaignFooter}>
                    <Text style={styles.campaignDate}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Create Campaign Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Campaign</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Campaign Title"
              placeholderTextColor="#94a3b8"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Description (optional)"
              placeholderTextColor="#94a3b8"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orb1: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.04)', top: -60, right: -80 },
  orb2: { position: 'absolute', width: 180, height: 180, borderRadius: 999, backgroundColor: 'rgba(139,92,246,0.04)', bottom: 100, left: -40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(139,92,246,0.12)' },
  statsBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: '#fff',
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: '#f1f5f9' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  statLbl: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  scrollContent: { paddingHorizontal: 16 },
  // Campaign card
  campaignCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
  },
  campaignHeader: { flexDirection: 'row', alignItems: 'center' },
  campaignIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  campaignInfo: { flex: 1 },
  campaignTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  campaignType: { fontSize: 11, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  activeBadge: { backgroundColor: 'rgba(34,197,94,0.08)' },
  inactiveBadge: { backgroundColor: 'rgba(148,163,184,0.08)' },
  statusText: { fontSize: 11, fontWeight: '600' },
  activeText: { color: '#22c55e' },
  inactiveText: { color: '#94a3b8' },
  campaignDesc: { fontSize: 13, color: '#64748b', marginTop: 10, lineHeight: 18 },
  campaignFooter: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  campaignDate: { fontSize: 11, color: '#94a3b8' },
  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 16 },
  emptyDesc: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8b5cf6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 24 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  modalInput: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, fontSize: 15, color: '#1e293b',
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#f8fafc' },
  cancelBtnText: { color: '#64748b', fontWeight: '600' },
  submitBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#8b5cf6' },
  submitBtnText: { color: '#fff', fontWeight: '700' },
});
