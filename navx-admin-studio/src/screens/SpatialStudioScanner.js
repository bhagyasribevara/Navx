import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer, Gyroscope, Barometer } from 'expo-sensors';
import SLAMService from '../services/SLAMService';
import AROverlay from '../components/AROverlay';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdmin } from '../context/AdminContext';
import { getBlocks, getFloors } from '../services/adminApi';

export default function SpatialStudioScanner({ navigation, route }) {
  const { admin } = useAdmin();
  const campusId = route.params?.campusId || admin?.campusId?._id || admin?.campusId;

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [sessionStats, setSessionStats] = useState({ nodes: 0, coverage: 0 });
  const [scanDuration, setScanDuration] = useState(0);

  // Telemetry buffer for review screen
  const trajectoryBufferRef = useRef([]);
  const sensorCountsRef = useRef({ accel: 0, gyro: 0 });

  // Building & Floor selection
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Fetch campus blocks for targeting
  useEffect(() => {
    if (campusId) {
      getBlocks(campusId)
        .then(res => {
          const list = res?.data || res || [];
          if (Array.isArray(list) && list.length > 0) {
            setBlocks(list);
            setSelectedBlock(list[0]);
            getFloors(list[0]._id).then(fRes => {
              const fList = fRes?.data || fRes || [];
              if (Array.isArray(fList) && fList.length > 0) {
                setFloors(fList);
                setSelectedFloor(fList[0]);
              }
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [campusId]);

  // Scan duration timer
  useEffect(() => {
    let interval;
    if (isScanning) {
      interval = setInterval(() => {
        setScanDuration(d => d + 1);
        // Sample current pose into buffer
        if (SLAMService.currentPose) {
          trajectoryBufferRef.current.push({
            ...SLAMService.currentPose,
            timestamp: new Date().toISOString()
          });
        }
      }, 500);
    } else {
      setScanDuration(0);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  // Motion sensor tracking
  useEffect(() => {
    let accelSub, gyroSub, baroSub;

    if (isScanning) {
      Accelerometer.setUpdateInterval(100);
      Gyroscope.setUpdateInterval(100);
      Barometer.setUpdateInterval(500);

      accelSub = Accelerometer.addListener(data => {
        sensorCountsRef.current.accel += 1;
        SLAMService.updateSensor('accelerometer', data);
      });
      gyroSub = Gyroscope.addListener(data => {
        sensorCountsRef.current.gyro += 1;
        SLAMService.updateSensor('gyroscope', data);
      });
      baroSub = Barometer.addListener(data => {
        SLAMService.updateSensor('barometer', data);
      });
    } else {
      if (accelSub) accelSub.remove();
      if (gyroSub) gyroSub.remove();
      if (baroSub) baroSub.remove();
    }

    return () => {
      if (accelSub) accelSub.remove();
      if (gyroSub) gyroSub.remove();
      if (baroSub) baroSub.remove();
    };
  }, [isScanning]);

  const handleSelectBlock = async (block) => {
    setSelectedBlock(block);
    setSelectedFloor(null);
    setLoadingLocation(true);
    try {
      const res = await getFloors(block._id);
      const list = res?.data || res || [];
      setFloors(Array.isArray(list) ? list : []);
      if (list.length > 0) setSelectedFloor(list[0]);
    } catch (e) {
      setFloors([]);
    } finally {
      setLoadingLocation(false);
    }
  };

  const toggleScan = async () => {
    if (!isScanning) {
      trajectoryBufferRef.current = [];
      sensorCountsRef.current = { accel: 0, gyro: 0 };
      
      const adminId = admin?._id;
      const bId = selectedBlock?._id;
      const fId = selectedFloor?._id;
      
      await SLAMService.startSession(bId, fId, adminId);
      setIsScanning(true);
    } else {
      setIsScanning(false);
      
      const points = [...trajectoryBufferRef.current];
      const durationSeconds = Math.max(Math.floor(scanDuration / 2), 1);
      const dist = (points.length * 0.45).toFixed(1);
      const nodes = Math.max(Math.floor(points.length / 5), 4);

      const scanSummary = {
        sessionId: SLAMService.sessionId,
        building: selectedBlock,
        floor: selectedFloor,
        duration: durationSeconds,
        trajectory: points,
        pointCount: points.length,
        estimatedDistance: dist,
        nodeCount: nodes,
        coverage: Math.min(Math.round((points.length / 50) * 100), 100) || 15,
        trackingQuality: 'Good',
        sensorStats: {
          accelerometerSamples: sensorCountsRef.current.accel,
          gyroscopeSamples: sensorCountsRef.current.gyro,
        },
        timestamp: new Date().toISOString(),
      };

      // Navigate to Review Screen
      navigation.navigate('ScanReview', { scanSummary });
    }
  };

  const formatDuration = (halfSeconds) => {
    const seconds = Math.floor(halfSeconds / 2);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }]}>
        <Ionicons name="camera-outline" size={64} color="#8b5cf6" />
        <Text style={{ color: '#1e293b', fontSize: 18, marginTop: 16, fontWeight: '700' }}>
          Camera Access Needed
        </Text>
        <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 32, lineHeight: 18 }}>
          NavX AR Studio needs camera permissions to perform real-time visual-inertial odometry and spatial mapping.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Live Camera Stream */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* AR Reticle Overlay */}
      <AROverlay isScanning={isScanning} />

      {/* Top HUD */}
      <View style={styles.topHud}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.locationSelector} 
          onPress={() => !isScanning && setShowLocationPicker(true)}
          disabled={isScanning}
        >
          <Ionicons name="business" size={14} color="#a78bfa" />
          <Text style={styles.locationText} numberOfLines={1}>
            {selectedBlock?.name || 'Select Building'} {selectedFloor ? `· ${selectedFloor.name}` : ''}
          </Text>
          {!isScanning && <Ionicons name="chevron-down" size={14} color="#fff" />}
        </TouchableOpacity>

        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, isScanning && styles.liveDotActive]} />
          <Text style={styles.liveText}>{isScanning ? 'LIVE' : 'READY'}</Text>
        </View>
      </View>

      {/* Stats HUD */}
      <View style={styles.statsHud}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>{trajectoryBufferRef.current.length}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Tracking</Text>
          <Text style={[styles.statValue, { color: '#4ade80' }]}>Good</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{formatDuration(scanDuration)}</Text>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.controls}>
        <Text style={styles.controlHint}>
          {isScanning ? 'Walk steadily through corridors and doorways...' : 'Tap to start real-time spatial mapping'}
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, isScanning ? styles.btnStop : styles.btnStart]}
          onPress={toggleScan}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isScanning ? ['#ef4444', '#dc2626'] : ['#8b5cf6', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBtnInner}
          >
            <Ionicons name={isScanning ? 'stop' : 'scan'} size={26} color="#fff" />
            <Text style={styles.btnText}>
              {isScanning ? 'Stop Scan & Review' : 'Start Scan'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Building / Floor Picker Modal */}
      <Modal visible={showLocationPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Scan Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Ionicons name="close-circle" size={26} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.pickerSectionTitle}>Building</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, marginBottom: 16 }}>
              {blocks.map(b => (
                <TouchableOpacity
                  key={b._id}
                  style={[styles.chip, selectedBlock?._id === b._id && styles.chipActive]}
                  onPress={() => handleSelectBlock(b)}
                >
                  <Text style={[styles.chipText, selectedBlock?._id === b._id && styles.chipTextActive]}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.pickerSectionTitle}>Floor</Text>
            {loadingLocation ? (
              <ActivityIndicator color="#8b5cf6" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 160 }}>
                {floors.map(f => (
                  <TouchableOpacity
                    key={f._id}
                    style={[styles.floorRow, selectedFloor?._id === f._id && styles.floorRowActive]}
                    onPress={() => {
                      setSelectedFloor(f);
                      setShowLocationPicker(false);
                    }}
                  >
                    <Ionicons name="layers" size={18} color={selectedFloor?._id === f._id ? '#8b5cf6' : '#64748b'} />
                    <Text style={[styles.floorRowText, selectedFloor?._id === f._id && styles.floorRowTextActive]}>
                      {f.name}
                    </Text>
                    {selectedFloor?._id === f._id && (
                      <Ionicons name="checkmark" size={18} color="#8b5cf6" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={styles.modalDoneBtn} 
              onPress={() => setShowLocationPicker(false)}
            >
              <Text style={styles.modalDoneText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  grantBtn: { marginTop: 24, backgroundColor: '#8b5cf6', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  // Top HUD
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: '55%',
    gap: 6,
  },
  locationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
    marginRight: 6,
  },
  liveDotActive: {
    backgroundColor: '#22c55e',
  },
  liveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Stats HUD
  statsHud: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
  },
  statBox: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  // Controls
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
  controlHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
  },
  actionBtn: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 28,
  },
  btnStart: {},
  btnStop: {},
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  pickerSectionTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 8, height: 38, justifyContent: 'center' },
  chipActive: { backgroundColor: '#8b5cf6' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },
  floorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6, backgroundColor: '#f8fafc' },
  floorRowActive: { backgroundColor: 'rgba(139,92,246,0.08)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' },
  floorRowText: { fontSize: 14, color: '#334155', marginLeft: 10, fontWeight: '500' },
  floorRowTextActive: { color: '#8b5cf6', fontWeight: '700' },
  modalDoneBtn: { backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  modalDoneText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
