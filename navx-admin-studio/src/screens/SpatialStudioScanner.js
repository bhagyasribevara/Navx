import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer, Gyroscope, Barometer } from 'expo-sensors';
import SLAMService from '../services/SLAMService';
import AROverlay from '../components/AROverlay';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdmin } from '../context/AdminContext';
import { getBlocks, getFloors, createFloor } from '../services/adminApi';

export default function SpatialStudioScanner({ navigation, route }) {
  const { admin } = useAdmin();
  const campusId = route.params?.campusId || admin?.campusId?._id || admin?.campusId;

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scanDuration, setScanDuration] = useState(0);

  // Room tagging state
  const [roomSegments, setRoomSegments] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null); // { name: string, startTimestamp: date }
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

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

  // New Floor state
  const [showNewFloorMode, setShowNewFloorMode] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [creatingFloor, setCreatingFloor] = useState(false);

  // Fetch campus blocks for targeting
  useEffect(() => {
    if (campusId) {
      getBlocks(campusId)
        .then(res => {
          const list = res?.data || res || [];
          if (Array.isArray(list) && list.length > 0) {
            setBlocks(list);
            setSelectedBlock(list[0]);
            fetchFloors(list[0]._id);
          }
        })
        .catch(() => {});
    }
  }, [campusId]);

  const fetchFloors = (blockId) => {
    setLoadingLocation(true);
    getFloors(blockId).then(fRes => {
      const fList = fRes?.data || fRes || [];
      if (Array.isArray(fList)) {
        setFloors(fList);
        if (fList.length > 0) setSelectedFloor(fList[0]);
      }
    }).catch(() => {
      setFloors([]);
    }).finally(() => setLoadingLocation(false));
  };

  // Scan duration timer
  useEffect(() => {
    let interval;
    if (isScanning) {
      interval = setInterval(() => {
        setScanDuration(d => d + 1);
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

  const handleSelectBlock = (block) => {
    setSelectedBlock(block);
    setSelectedFloor(null);
    fetchFloors(block._id);
  };

  const handleCreateFloor = async () => {
    if (!newFloorName.trim() || !selectedBlock) return;
    setCreatingFloor(true);
    try {
      const res = await createFloor({
        blockId: selectedBlock._id,
        campusId,
        name: newFloorName.trim(),
        floorNumber: newFloorName.trim()
      });
      if (res.success && res.floor) {
        setFloors([...floors, res.floor]);
        setSelectedFloor(res.floor);
        setShowNewFloorMode(false);
        setNewFloorName('');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create floor');
    } finally {
      setCreatingFloor(false);
    }
  };

  const toggleScan = async () => {
    if (!isScanning) {
      if (!selectedBlock || !selectedFloor) {
        Alert.alert('Error', 'Please select a building and floor first.');
        return;
      }
      trajectoryBufferRef.current = [];
      sensorCountsRef.current = { accel: 0, gyro: 0 };
      setRoomSegments([]);
      setActiveRoom(null);
      
      const adminId = admin?._id;
      await SLAMService.startSession(selectedBlock._id, selectedFloor._id, adminId);
      setIsScanning(true);
    } else {
      if (activeRoom) {
        Alert.alert('Active Room', 'Please finish the active room before stopping the scan.');
        return;
      }

      setIsScanning(false);
      
      const points = [...trajectoryBufferRef.current];
      const durationSeconds = Math.max(Math.floor(scanDuration / 2), 1);
      const dist = (points.length * 0.45).toFixed(1);
      const nodes = Math.max(Math.floor(points.length / 5), 4);

      // Generate scannedElements array (rooms + main corridor segments)
      const scannedElements = [];

      // 1. Convert roomSegments to 3D room mesh elements
      roomSegments.forEach((r, idx) => {
        const startT = new Date(r.startTimestamp || Date.now()).getTime();
        const endT = new Date(r.endTimestamp || Date.now()).getTime();
        const roomDurationSec = Math.max(3, Math.round((endT - startT) / 1000));
        
        const w = parseFloat(Math.max(2.8, Math.min(6.5, roomDurationSec * 0.75)).toFixed(2));
        const l = parseFloat(Math.max(3.2, Math.min(8.5, roomDurationSec * 1.05)).toFixed(2));
        const h = 2.8;

        const hw = w / 2;
        const hl = l / 2;

        scannedElements.push({
          id: `room_${Date.now()}_${idx}`,
          name: r.roomName || `Room ${idx + 1}`,
          type: 'room',
          geometry3D: {
            dimensions: { width: w, length: l, height: h },
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            vertices: [
              { x: -hw, y: 0, z: -hl }, { x: hw, y: 0, z: -hl },
              { x: hw, y: 0, z: hl }, { x: -hw, y: 0, z: hl },
              { x: -hw, y: h, z: -hl }, { x: hw, y: h, z: -hl },
              { x: hw, y: h, z: hl }, { x: -hw, y: h, z: hl }
            ],
            faces: [
              [0, 1, 2, 3], [4, 5, 6, 7],
              [0, 1, 5, 4], [1, 2, 6, 5],
              [2, 3, 7, 6], [3, 0, 4, 7]
            ],
            color: '#3b82f6'
          },
          status: 'unplaced'
        });
      });

      // 2. Generate Corridor Wireframe Segment
      const corridorLength = parseFloat(Math.max(12, dist).toFixed(1));
      scannedElements.push({
        id: `corridor_${Date.now()}`,
        name: `${selectedFloor?.name || 'Floor'} Main Corridor`,
        type: 'corridor',
        geometry3D: {
          dimensions: { width: 2.4, length: corridorLength, height: 2.8 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          vertices: [
            { x: -1.2, y: 0, z: -corridorLength / 2 }, { x: 1.2, y: 0, z: -corridorLength / 2 },
            { x: 1.2, y: 0, z: corridorLength / 2 }, { x: -1.2, y: 0, z: corridorLength / 2 },
            { x: -1.2, y: 2.8, z: -corridorLength / 2 }, { x: 1.2, y: 2.8, z: -corridorLength / 2 },
            { x: 1.2, y: 2.8, z: corridorLength / 2 }, { x: -1.2, y: 2.8, z: corridorLength / 2 }
          ],
          faces: [
            [0, 1, 2, 3], [4, 5, 6, 7],
            [0, 1, 5, 4], [1, 2, 6, 5],
            [2, 3, 7, 6], [3, 0, 4, 7]
          ],
          color: '#8b5cf6'
        },
        status: 'unplaced'
      });

      const scanSummary = {
        sessionId: SLAMService.sessionId,
        building: selectedBlock,
        floor: selectedFloor,
        duration: durationSeconds,
        trajectory: points,
        roomSegments: roomSegments,
        scannedElements: scannedElements,
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

      navigation.navigate('ScanReview', { scanSummary });
    }
  };

  const handleStartRoom = () => {
    if (!newRoomName.trim()) return;
    setActiveRoom({
      roomName: newRoomName.trim(),
      startTimestamp: new Date().toISOString()
    });
    setNewRoomName('');
    setShowRoomModal(false);
  };

  const handleFinishRoom = () => {
    if (!activeRoom) return;
    const startT = new Date(activeRoom.startTimestamp).getTime();
    const endT = Date.now();
    const roomDurationSec = Math.max(3, Math.round((endT - startT) / 1000));
    
    const w = parseFloat(Math.max(2.8, Math.min(6.5, roomDurationSec * 0.75)).toFixed(2));
    const l = parseFloat(Math.max(3.2, Math.min(8.5, roomDurationSec * 1.05)).toFixed(2));
    const h = 2.8;

    const finishedRoom = {
      ...activeRoom,
      endTimestamp: new Date(endT).toISOString(),
      status: 'completed',
      geometry3D: {
        dimensions: { width: w, length: l, height: h },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        color: '#3b82f6'
      }
    };

    setRoomSegments([
      ...roomSegments,
      finishedRoom
    ]);
    setActiveRoom(null);
  };

  const formatDuration = (halfSeconds) => {
    const seconds = Math.floor(halfSeconds / 2);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }]}>
        <Ionicons name="camera-outline" size={64} color="#8b5cf6" />
        <Text style={{ color: '#1e293b', fontSize: 18, marginTop: 16, fontWeight: '700' }}>Camera Access Needed</Text>
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
      <CameraView style={StyleSheet.absoluteFill} facing="back" />
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
          <Text style={styles.statLabel}>Rooms Tagged</Text>
          <Text style={styles.statValue}>{roomSegments.length}</Text>
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
        {isScanning ? (
          activeRoom ? (
            <View style={styles.activeRoomContainer}>
              <Text style={styles.activeRoomText}>Recording Room: {activeRoom.roomName}</Text>
              <TouchableOpacity style={styles.finishRoomBtn} onPress={handleFinishRoom}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginRight: 6}} />
                <Text style={styles.finishRoomBtnText}>Finish Room</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.newRoomBtn} onPress={() => setShowRoomModal(true)}>
              <Ionicons name="add-circle" size={24} color="#fff" style={{marginRight: 8}} />
              <Text style={styles.newRoomBtnText}>New Room Tag</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={styles.controlHint}>Tap to start continuous recording</Text>
        )}

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
              {isScanning ? 'Finish Floor Scan' : 'Start Floor Scan'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Room Modal */}
      <Modal visible={showRoomModal} transparent animationType="fade">
        <View style={styles.modalBackdropCenter}>
          <View style={styles.roomModalContent}>
            <Text style={styles.modalTitle}>Tag New Room</Text>
            <Text style={styles.modalSub}>Enter room name before stepping inside.</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Room 101"
              value={newRoomName}
              onChangeText={setNewRoomName}
              autoFocus
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowRoomModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleStartRoom}>
                <Text style={styles.modalConfirmText}>Start Recording</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                  <Text style={[styles.chipText, selectedBlock?._id === b._id && styles.chipTextActive]}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.pickerSectionTitle, { marginBottom: 0 }]}>Floor</Text>
              {!showNewFloorMode && (
                <TouchableOpacity onPress={() => setShowNewFloorMode(true)}>
                  <Text style={{ color: '#8b5cf6', fontWeight: '600', fontSize: 13 }}>+ New Floor</Text>
                </TouchableOpacity>
              )}
            </View>

            {showNewFloorMode ? (
              <View style={styles.newFloorContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Floor Name/Number (e.g. Ground Floor)"
                  value={newFloorName}
                  onChangeText={setNewFloorName}
                />
                <View style={styles.modalRow}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNewFloorMode(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleCreateFloor} disabled={creatingFloor}>
                    {creatingFloor ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.modalConfirmText}>Create</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : loadingLocation ? (
              <ActivityIndicator color="#8b5cf6" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 160 }}>
                {floors.map(f => (
                  <TouchableOpacity
                    key={f._id}
                    style={[styles.floorRow, selectedFloor?._id === f._id && styles.floorRowActive]}
                    onPress={() => setSelectedFloor(f)}
                  >
                    <Ionicons name="layers" size={18} color={selectedFloor?._id === f._id ? '#8b5cf6' : '#64748b'} />
                    <Text style={[styles.floorRowText, selectedFloor?._id === f._id && styles.floorRowTextActive]}>{f.name}</Text>
                    {selectedFloor?._id === f._id && <Ionicons name="checkmark" size={18} color="#8b5cf6" style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowLocationPicker(false)}>
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
  topHud: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  locationSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, maxWidth: '55%', gap: 6 },
  locationText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8', marginRight: 6 },
  liveDotActive: { backgroundColor: '#22c55e' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statsHud: { position: 'absolute', top: 120, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 10 },
  statBox: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 50, paddingTop: 16, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 },
  controlHint: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500', marginBottom: 16 },
  newRoomBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, marginBottom: 16 },
  newRoomBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  activeRoomContainer: { alignItems: 'center', marginBottom: 16 },
  activeRoomText: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  finishRoomBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24 },
  finishRoomBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  actionBtn: { borderRadius: 28, overflow: 'hidden', shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  actionBtnInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 36, borderRadius: 28 },
  btnStart: {}, btnStop: {},
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 10, letterSpacing: 0.3 },
  modalBackdropCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  roomModalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%' },
  modalSub: { color: '#64748b', fontSize: 14, marginBottom: 16 },
  textInput: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16, color: '#1e293b' },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { color: '#64748b', fontWeight: '600' },
  modalConfirm: { backgroundColor: '#8b5cf6', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
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
  newFloorContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 16 },
  modalDoneBtn: { backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  modalDoneText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
