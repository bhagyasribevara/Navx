import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdmin } from '../context/AdminContext';
import { getBlocks, getFloors, createFloor } from '../services/adminApi';
import StreetViewUploadService from '../services/StreetViewUploadService';

export default function SpatialStudioScanner({ navigation, route }) {
  const { admin } = useAdmin();
  const campusId = route.params?.campusId || admin?.campusId?._id || admin?.campusId;

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Ready'); // 'Ready', 'Walking', 'Uploading'

  const cameraRef = useRef(null);

  // Capture state
  const framesRef = useRef([]);
  const [frameCount, setFrameCount] = useState(0);
  const [distanceWalked, setDistanceWalked] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [roomsTagged, setRoomsTagged] = useState(0);

  // Upload Progress Modal
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Distance / Sensor Tracking — heading-based dead reckoning
  const headingRef = useRef(0);
  const smoothedHeadingRef = useRef(0);
  const posRef = useRef({ x: 0, z: 0 });       // cumulative 2D position
  const totalDistRef = useRef(0);                // total distance walked
  const lastCaptureDistRef = useRef(0);          // distance at last capture
  // Step detection via accelerometer magnitude
  const accelHistoryRef = useRef([]);
  const lastStepTimeRef = useRef(0);
  const STEP_LENGTH = 0.7;                       // average step length in meters
  const CAPTURE_INTERVAL = 1.5;                  // meters between captures
  const STEP_COOLDOWN = 300;                     // ms between steps

  // Doorway Tagging
  const [showDoorModal, setShowDoorModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const pendingDoorwayRef = useRef(null); // stores the room name for the NEXT capture

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

  // Low-pass filter for compass heading to reduce jitter
  const smoothHeading = (rawHeading) => {
    const prev = smoothedHeadingRef.current;
    // Handle wrap-around (e.g. 359° → 1°)
    let diff = rawHeading - prev;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const alpha = 0.3; // smoothing factor (lower = smoother)
    const smoothed = (prev + alpha * diff + 360) % 360;
    smoothedHeadingRef.current = smoothed;
    return smoothed;
  };

  // Detect a walking step from accelerometer magnitude
  const detectStep = (data) => {
    const mag = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
    const history = accelHistoryRef.current;
    history.push(mag);
    if (history.length > 5) history.shift();

    // Need at least 5 samples for peak detection
    if (history.length < 5) return false;

    const now = Date.now();
    if (now - lastStepTimeRef.current < STEP_COOLDOWN) return false;

    // Peak detection: middle sample is higher than neighbours and above threshold
    const mid = history[2];
    const threshold = 1.15; // ~1G + step impact
    if (mid > threshold && mid >= history[1] && mid >= history[3] &&
        mid > history[0] && mid > history[4]) {
      lastStepTimeRef.current = now;
      return true;
    }
    return false;
  };

  useEffect(() => {
    let accelSub, magSub;
    if (isScanning && !showDoorModal) {
      setScanStatus('Walking');
      Accelerometer.setUpdateInterval(60);  // ~16Hz for better step detection
      Magnetometer.setUpdateInterval(100);

      accelSub = Accelerometer.addListener(data => {
        if (detectStep(data)) {
          // Project step onto 2D plane using current smoothed heading
          const headingRad = smoothedHeadingRef.current * Math.PI / 180;
          posRef.current.x += Math.sin(headingRad) * STEP_LENGTH;
          posRef.current.z += Math.cos(headingRad) * STEP_LENGTH;
          totalDistRef.current += STEP_LENGTH;
          setDistanceWalked(totalDistRef.current);

          // Auto-capture when we've walked enough since last capture
          if (totalDistRef.current - lastCaptureDistRef.current >= CAPTURE_INTERVAL) {
            lastCaptureDistRef.current = totalDistRef.current;
            capturePhoto();
          }
        }
      });

      magSub = Magnetometer.addListener(data => {
        let h = Math.atan2(data.y, data.x) * (180 / Math.PI);
        if (h < 0) h += 360;
        headingRef.current = h;
        const smoothed = smoothHeading(h);
        setCurrentHeading(smoothed);
      });
    } else {
      if (isScanning && showDoorModal) {
        setScanStatus('Ready');
      }
    }

    return () => {
      if (accelSub) accelSub.remove();
      if (magSub) magSub.remove();
    };
  }, [isScanning, showDoorModal]);

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: true });
      
      const isDoor = !!pendingDoorwayRef.current;
      const tName = pendingDoorwayRef.current;
      
      const frame = {
        uri: photo.uri,
        telemetry: {
          stepIndex: framesRef.current.length,
          relativeCoords: { x: posRef.current.x, y: 0, z: posRef.current.z },
          compassHeading: smoothedHeadingRef.current,
          pitch: 0,
          isDoorway: isDoor,
          targetRoomName: tName
        }
      };
      
      framesRef.current.push(frame);
      setFrameCount(framesRef.current.length);

      if (isDoor) {
        pendingDoorwayRef.current = null;
        setRoomsTagged(prev => prev + 1);
      }

    } catch (err) {
      console.warn("Capture failed", err);
    }
  };

  const toggleScan = async () => {
    if (!isScanning) {
      if (!selectedBlock || !selectedFloor) {
        Alert.alert('Error', 'Please select a building and floor first.');
        return;
      }
      framesRef.current = [];
      setFrameCount(0);
      setDistanceWalked(0);
      setRoomsTagged(0);
      posRef.current = { x: 0, z: 0 };
      totalDistRef.current = 0;
      lastCaptureDistRef.current = 0;
      accelHistoryRef.current = [];
      lastStepTimeRef.current = 0;
      smoothedHeadingRef.current = headingRef.current;
      pendingDoorwayRef.current = null;
      setIsScanning(true);
      
      // Capture the first frame immediately
      await capturePhoto();
    } else {
      setIsScanning(false);
      setScanStatus('Uploading');
      handleUpload();
    }
  };

  const handleUpload = async () => {
    if (framesRef.current.length === 0) {
      Alert.alert("Empty Scan", "No frames were captured.");
      setScanStatus('Ready');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);

    const config = {
      campusId,
      blockId: selectedBlock._id,
      floorId: selectedFloor._id,
      adminId: admin?._id
    };

    try {
      await StreetViewUploadService.uploadSession(framesRef.current, config, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percentCompleted);
      });
      setIsUploading(false);
      Alert.alert("Success", "Upload Complete", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      setIsUploading(false);
      setScanStatus('Ready');
      Alert.alert("Upload Failed", "Would you like to retry?", [
        { text: "Cancel", style: "cancel" },
        { text: "Retry", onPress: handleUpload }
      ]);
    }
  };

  const handleTagDoor = () => {
    setShowDoorModal(true);
  };

  const submitDoorTag = () => {
    if (roomName.trim()) {
      pendingDoorwayRef.current = roomName.trim();
      setRoomName('');
    }
    setShowDoorModal(false);
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
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      
      {/* Dark semi-transparent overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} />
      </View>

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
          <Text style={styles.liveText}>{scanStatus.toUpperCase()}</Text>
        </View>
      </View>

      {/* Stats HUD */}
      <View style={styles.statsHud}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Frames</Text>
          <Text style={styles.statValue}>{frameCount}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={[styles.statValue, { color: '#4ade80' }]}>{distanceWalked.toFixed(1)}m</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Heading</Text>
          <Text style={styles.statValue}>{Math.round(currentHeading)}°</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Rooms</Text>
          <Text style={styles.statValue}>{roomsTagged}</Text>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.controls}>
        {isScanning && (
          <TouchableOpacity style={styles.newRoomBtn} onPress={handleTagDoor}>
            <Ionicons name="add-circle" size={24} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.newRoomBtnText}>Tag Doorway</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionBtn}
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
              {isScanning ? 'Stop & Upload' : 'Start Walkthrough'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Door Modal */}
      <Modal visible={showDoorModal} transparent animationType="fade">
        <View style={styles.modalBackdropCenter}>
          <View style={styles.roomModalContent}>
            <Text style={styles.modalTitle}>Tag Doorway</Text>
            <Text style={styles.modalSub}>Enter room name for the doorway. The next captured frame will be tagged.</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Room 101"
              value={roomName}
              onChangeText={setRoomName}
              autoFocus
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => {setShowDoorModal(false); setRoomName('');}}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={submitDoorTag}>
                <Text style={styles.modalConfirmText}>Tag Door</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Progress Modal */}
      <Modal visible={isUploading} transparent animationType="fade">
        <View style={styles.modalBackdropCenter}>
          <View style={styles.uploadModalContent}>
             <ActivityIndicator size="large" color="#8b5cf6" />
             <Text style={styles.modalTitle}>Uploading Walkthrough</Text>
             <Text style={styles.uploadProgressText}>{uploadProgress}% Complete</Text>
             <View style={styles.progressBarBg}>
               <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
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
  statValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 50, paddingTop: 16, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 },
  newRoomBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, marginBottom: 16 },
  newRoomBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  actionBtn: { borderRadius: 28, overflow: 'hidden', shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  actionBtnInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 36, borderRadius: 28 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 10, letterSpacing: 0.3 },
  modalBackdropCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  roomModalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%' },
  uploadModalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%', alignItems: 'center' },
  uploadProgressText: { color: '#64748b', fontSize: 15, marginVertical: 12, fontWeight: '600' },
  progressBarBg: { width: '100%', height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#8b5cf6' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8, marginTop: 8 },
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
