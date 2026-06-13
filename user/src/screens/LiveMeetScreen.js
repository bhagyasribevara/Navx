import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { useLiveMeet } from '../context/LiveMeetContext';
import { useGeofence } from '../context/GeofenceContext';
import { joinMeetSession, getMeetSession, endMeetSession } from '../api';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

const { width: SW, height: SH } = Dimensions.get('window');

// In a real app, MapView and Marker would be imported from react-native-maps.
// For the sake of this implementation, we simulate the map layer rendering logic.
// import MapView, { Marker, Polyline } from 'react-native-maps';

export default function LiveMeetScreen({ route, navigation }) {
  const { sessionId } = route.params || {};
  const { colors } = useContext(ThemeContext);
  const { activeSession, remoteParticipant, enterMeetSession, leaveMeetSession, broadcastStatus } = useLiveMeet();
  const { currentPos, currentFloorId } = useGeofence();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const distance = currentPos && remoteParticipant?.location
    ? Math.hypot(currentPos.x - remoteParticipant.location.lng, currentPos.y - remoteParticipant.location.lat) // Mock distance calculation
    : null;

  useEffect(() => {
    async function init() {
      try {
        if (!sessionId) {
          setError('Invalid Meet Link');
          return;
        }

        if (activeSession && activeSession.sessionId === sessionId) {
          // Already in this session
          setLoading(false);
          return;
        }

        // Fetch session data
        const sessionData = await getMeetSession(sessionId);
        
        // Mock Device ID
        const mockDeviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        
        let role = 'joiner';
        if (sessionData.creatorDevice === mockDeviceId) {
          role = 'creator';
        }

        if (role === 'joiner') {
          // Join the session via API
          const loc = await Location.getCurrentPositionAsync({});
          await joinMeetSession(sessionId, {
            joinerDevice: mockDeviceId,
            joinerName: 'Friend',
            joinerLocation: { lat: loc.coords.latitude, lng: loc.coords.longitude }
          });
        }

        await enterMeetSession(sessionData, role);
        setLoading(false);

      } catch (err) {
        setError(err.response?.data?.error || 'Failed to join meet session');
        setLoading(false);
      }
    }
    init();
  }, [sessionId]);

  useEffect(() => {
    if (distance !== null && distance < 10 && activeSession?.status !== 'arrived') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      broadcastStatus('arrived');
      // Show success animation logic here
    }
  }, [distance]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text }}>Joining Meet Session...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Ionicons name="warning" size={48} color={colors.danger} />
        <Text style={{ color: colors.text, marginTop: 10, fontWeight: '700' }}>{error}</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.goBack()}>
          <Text style={s.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Fake Map Layer */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.mapBg, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Map Rendering (User A & B Markers)</Text>
      </View>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Live Meet</Text>
        <TouchableOpacity onPress={async () => {
            await endMeetSession(sessionId, 'cancelled');
            leaveMeetSession();
            navigation.goBack();
        }}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>End</Text>
        </TouchableOpacity>
      </View>

      {/* AR Button Trigger */}
      {distance !== null && distance < 30 && (
        <TouchableOpacity 
          style={s.arBtn}
          onPress={() => navigation.navigate('ARMeet')}
        >
          <Ionicons name="scan" size={24} color="#fff" />
          <Text style={s.arText}>AR Friend Finder</Text>
        </TouchableOpacity>
      )}

      {/* Progress Bottom Sheet */}
      <View style={[s.bottomSheet, { backgroundColor: colors.card }]}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          Meeting {remoteParticipant?.name || 'Participant'}
        </Text>
        
        {remoteParticipant?.status === 'arrived' ? (
          <View style={s.arrivedBox}>
            <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 8 }}>You've successfully met!</Text>
          </View>
        ) : (
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>DISTANCE</Text>
              <Text style={[s.statValue, { color: colors.text }]}>
                {distance !== null ? `${Math.round(distance)}m` : 'Calc...'}
              </Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statLabel}>ETA</Text>
              <Text style={[s.statValue, { color: colors.text }]}>
                {distance !== null ? `${Math.ceil(distance / 1.4 / 60)} min` : '--'}
              </Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statLabel}>STATUS</Text>
              <Text style={[s.statValue, { color: colors.primary, fontSize: 14 }]}>Walking</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: {
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
  },
  title: { fontSize: 16, fontWeight: '800' },
  backBtn: { padding: 4 },
  btn: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 20 },
  btnText: { color: '#fff', fontWeight: '700' },
  bottomSheet: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15, elevation: 8
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  arrivedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(22,163,74,0.1)', borderRadius: 12 },
  arBtn: {
    position: 'absolute', bottom: 180, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30,
    shadowColor: '#4f46e5', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6
  },
  arText: { color: '#fff', fontWeight: '800', marginLeft: 8, fontSize: 16 }
});
