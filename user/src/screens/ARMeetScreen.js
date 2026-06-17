import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { Magnetometer } from 'expo-sensors';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { useLiveMeet } from '../context/LiveMeetContext';
import { useGeofence } from '../context/GeofenceContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

// Calculates bearing between two coordinates
function getBearing(lat1, lng1, lat2, lng2) {
  const toRad = (val) => (val * Math.PI) / 180;
  const toDeg = (val) => (val * 180) / Math.PI;

  const dLng = toRad(lng2 - lng1);
  lat1 = toRad(lat1);
  lat2 = toRad(lat2);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

export default function ARMeetScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const { activeSession, remoteParticipant } = useLiveMeet();
  const { currentPos } = useGeofence();
  const insets = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState(null);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();

    Magnetometer.setUpdateInterval(100);
    const sub = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      angle = (angle + 360) % 360;
      setHeading(angle);
    });

    return () => sub.remove();
  }, []);

  if (hasPermission === null) return <View style={s.container} />;
  if (hasPermission === false) return (
    <View style={s.center}>
      <Text style={{ color: colors.text }}>No access to camera</Text>
      <TouchableOpacity style={s.btn} onPress={() => navigation.goBack()}>
        <Text style={{ color: '#fff' }}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const targetLat = remoteParticipant?.location?.lat || 0;
  const targetLng = remoteParticipant?.location?.lng || 0;
  const myLat = currentPos?.y || 0;
  const myLng = currentPos?.x || 0;

  const targetBearing = getBearing(myLat, myLng, targetLat, targetLng);
  let angleDiff = targetBearing - heading;

  // Normalize between -180 and 180
  if (angleDiff > 180) angleDiff -= 360;
  if (angleDiff < -180) angleDiff += 360;

  const distance = Math.hypot(myLng - targetLng, myLat - targetLat); // Simulated Euclidean distance

  return (
    <View style={s.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />
      
      {/* Header */}
      <View style={[s.header, { top: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>AR Finder</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* AR Overlay */}
      <View style={s.arOverlay}>
        <Ionicons 
          name="navigate" 
          size={120} 
          color={Math.abs(angleDiff) < 20 ? "#22c55e" : "#ef4444"} 
          style={{ transform: [{ rotate: `${angleDiff}deg` }] }} 
        />
        <Text style={s.distText}>{Math.round(distance)}m Away</Text>
        <Text style={s.helpText}>
          {Math.abs(angleDiff) < 20 ? "Walk Straight Ahead" : angleDiff > 0 ? "Turn Right" : "Turn Left"}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    position: 'absolute', top: 50, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    zIndex: 10
  },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  backBtn: { padding: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  btn: { backgroundColor: '#6366f1', padding: 12, borderRadius: 8, marginTop: 20 },
  arOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  distText: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 40, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  helpText: { color: '#fff', fontSize: 20, fontWeight: '600', marginTop: 10, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
});
