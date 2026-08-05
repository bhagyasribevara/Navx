import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdmin } from '../context/AdminContext';
import { triggerEmergency, getCampus } from '../services/adminApi';

const EMERGENCY_TYPES = [
  { type: 'Fire', icon: 'flame', color: '#ef4444' },
  { type: 'Earthquake', icon: 'earth', color: '#f59e0b' },
  { type: 'Flood', icon: 'water', color: '#3b82f6' },
  { type: 'Gas Leak', icon: 'cloud', color: '#8b5cf6' },
  { type: 'Security', icon: 'shield', color: '#ec4899' },
  { type: 'Other', icon: 'alert-circle', color: '#64748b' },
];

export default function EmergencyScreen({ navigation, route }) {
  const { admin } = useAdmin();
  const campusId = route.params?.campusId || admin?.campusId?._id || admin?.campusId;

  const [emergencyState, setEmergencyState] = useState(null);
  const [selectedType, setSelectedType] = useState('Fire');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const loadEmergencyState = useCallback(async () => {
    if (!campusId) { setLoading(false); return; }
    try {
      const campus = await getCampus(campusId);
      setEmergencyState(campus?.emergencyState || { isActive: false });
    } catch (e) {
      console.warn('Failed to load emergency state:', e);
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => { loadEmergencyState(); }, [loadEmergencyState]);

  const handleTrigger = () => {
    Alert.alert(
      '⚠️ Confirm Emergency',
      `This will trigger a campus-wide ${selectedType} emergency alert. All app users will be notified immediately.\n\nAre you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'TRIGGER NOW', style: 'destructive',
          onPress: async () => {
            setTriggering(true);
            try {
              await triggerEmergency(campusId, {
                isActive: true,
                type: selectedType,
                message: message.trim() || `${selectedType} emergency declared. Please follow evacuation procedures.`,
              });
              setEmergencyState({
                isActive: true,
                type: selectedType,
                message: message.trim() || `${selectedType} emergency declared.`,
                timestamp: new Date(),
              });
              Alert.alert('Emergency Triggered', 'All users have been notified.');
            } catch (e) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to trigger emergency');
            } finally {
              setTriggering(false);
            }
          },
        },
      ]
    );
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Emergency',
      'This will deactivate the current emergency alert for all users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'default',
          onPress: async () => {
            setTriggering(true);
            try {
              await triggerEmergency(campusId, {
                isActive: false,
                type: '',
                message: '',
              });
              setEmergencyState({ isActive: false });
              Alert.alert('Emergency Cleared', 'The emergency alert has been deactivated.');
            } catch (e) {
              Alert.alert('Error', 'Failed to clear emergency');
            } finally {
              setTriggering(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  const isActive = emergencyState?.isActive;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.orb1} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency System</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Current Status */}
        <View style={[styles.statusCard, isActive ? styles.statusActive : styles.statusInactive]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? '#ef4444' : '#22c55e' }]} />
            <Text style={[styles.statusTitle, { color: isActive ? '#ef4444' : '#22c55e' }]}>
              {isActive ? 'EMERGENCY ACTIVE' : 'ALL CLEAR'}
            </Text>
          </View>
          {isActive && (
            <>
              <Text style={styles.statusType}>Type: {emergencyState.type}</Text>
              <Text style={styles.statusMsg}>{emergencyState.message}</Text>
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear} disabled={triggering}>
                {triggering ? (
                  <ActivityIndicator color="#22c55e" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                    <Text style={styles.clearBtnText}>Clear Emergency</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
          {!isActive && (
            <Text style={styles.statusSubtext}>No active emergencies. The campus is safe.</Text>
          )}
        </View>

        {/* Emergency Type Selector */}
        {!isActive && (
          <>
            <Text style={styles.sectionTitle}>Emergency Type</Text>
            <View style={styles.typeGrid}>
              {EMERGENCY_TYPES.map(et => (
                <TouchableOpacity
                  key={et.type}
                  style={[
                    styles.typeCard,
                    selectedType === et.type && { borderColor: et.color, borderWidth: 2, backgroundColor: et.color + '08' }
                  ]}
                  onPress={() => setSelectedType(et.type)}
                >
                  <View style={[styles.typeIconWrap, { backgroundColor: et.color + '15' }]}>
                    <Ionicons name={et.icon} size={22} color={et.color} />
                  </View>
                  <Text style={[styles.typeName, selectedType === et.type && { color: et.color, fontWeight: '700' }]}>
                    {et.type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Message */}
            <Text style={styles.sectionTitle}>Custom Alert Message</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Optional: Enter a custom alert message..."
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
            />

            {/* Trigger Button */}
            <TouchableOpacity
              style={styles.triggerBtn}
              onPress={handleTrigger}
              disabled={triggering}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.triggerBtnInner}
              >
                {triggering ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="warning" size={22} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.triggerBtnText}>TRIGGER EVACUATION</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.warningText}>
              ⚠️ This will immediately alert all users on campus and trigger evacuation routes
            </Text>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orb1: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: 'rgba(239,68,68,0.03)', top: -60, right: -80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  scrollContent: { paddingHorizontal: 16 },
  // Status card
  statusCard: {
    borderRadius: 20, padding: 20, marginBottom: 24,
    borderWidth: 1,
  },
  statusActive: { backgroundColor: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.15)' },
  statusInactive: { backgroundColor: 'rgba(34,197,94,0.04)', borderColor: 'rgba(34,197,94,0.15)' },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  statusType: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 4 },
  statusMsg: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 14 },
  statusSubtext: { fontSize: 13, color: '#64748b', marginTop: 4 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#22c55e',
  },
  clearBtnText: { color: '#22c55e', fontWeight: '700', fontSize: 14, marginLeft: 8 },
  // Type selector
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  typeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24,
  },
  typeCard: {
    width: '31%', backgroundColor: '#fff', borderRadius: 14, padding: 14,
    alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  typeIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  typeName: { fontSize: 12, fontWeight: '500', color: '#475569' },
  // Message input
  messageInput: {
    backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, fontSize: 14, color: '#1e293b',
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24, minHeight: 80, textAlignVertical: 'top',
  },
  // Trigger button
  triggerBtn: {
    borderRadius: 16, overflow: 'hidden', marginBottom: 12,
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5,
  },
  triggerBtnInner: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    height: 56, borderRadius: 16,
  },
  triggerBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  warningText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});
