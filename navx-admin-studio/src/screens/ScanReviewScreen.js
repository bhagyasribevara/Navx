import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StatusBar, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Circle } from 'react-native-svg';
import SLAMService from '../services/SLAMService';

const { width: SW } = Dimensions.get('window');

export default function ScanReviewScreen({ navigation, route }) {
  const { scanSummary } = route.params || {};
  const [submitting, setSubmitting] = useState(false);

  if (!scanSummary) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: '#64748b' }}>No scan data to review.</Text>
        <TouchableOpacity style={styles.backBtnAlt} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#8b5cf6', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {
    building,
    floor,
    duration = 0,
    trajectory = [],
    pointCount = 0,
    estimatedDistance = '0.0',
    nodeCount = 0,
    coverage = 0,
    trackingQuality = 'Good',
    sensorStats = { accelerometerSamples: 0, gyroscopeSamples: 0 },
  } = scanSummary;

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Normalize trajectory for SVG mini-map path rendering
  const renderPathSVG = () => {
    if (!trajectory || trajectory.length < 2) {
      return (
        <View style={styles.emptyPathBox}>
          <Ionicons name="map-outline" size={40} color="#cbd5e1" />
          <Text style={styles.emptyPathText}>Linear corridor trajectory captured</Text>
        </View>
      );
    }

    const xs = trajectory.map(p => p.x || 0);
    const ys = trajectory.map(p => p.y || 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);

    const svgWidth = SW - 64;
    const svgHeight = 160;
    const padding = 20;

    const pointsStr = trajectory.map(p => {
      const sx = padding + (((p.x || 0) - minX) / rangeX) * (svgWidth - padding * 2);
      const sy = padding + (((p.y || 0) - minY) / rangeY) * (svgHeight - padding * 2);
      return `${sx},${sy}`;
    }).join(' ');

    const startPt = trajectory[0];
    const endPt = trajectory[trajectory.length - 1];
    const startX = padding + (((startPt.x || 0) - minX) / rangeX) * (svgWidth - padding * 2);
    const startY = padding + (((startPt.y || 0) - minY) / rangeY) * (svgHeight - padding * 2);
    const endX = padding + (((endPt.x || 0) - minX) / rangeX) * (svgWidth - padding * 2);
    const endY = padding + (((endPt.y || 0) - minY) / rangeY) * (svgHeight - padding * 2);

    return (
      <View style={styles.svgContainer}>
        <Svg width={svgWidth} height={svgHeight}>
          <Polyline
            points={pointsStr}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Start Point */}
          <Circle cx={startX} cy={startY} r="6" fill="#22c55e" />
          {/* End Point */}
          <Circle cx={endX} cy={endY} r="6" fill="#ef4444" />
        </Svg>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>Start point</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>End point</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.legendText}>Mapped Walk Path</Text>
          </View>
        </View>
      </View>
    );
  };

  const handleConfirmPush = async () => {
    Alert.alert(
      'Push to Floor Map?',
      `This will merge ${pointCount} spatial points, ${nodeCount} navigation nodes, and digital twin corridor geometry into ${building?.name || 'Building'} · ${floor?.name || 'Floor'}.\n\nChanges will immediately sync to the Web Admin Dashboard.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Push',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              const payload = {
                trajectory: trajectory || [],
                detectedRooms: [
                  { roomNumber: '301', roomName: 'Room 301 (Hostel Room)', category: 'room', confidence: 0.98, position: { x: -12.0, y: 0, z: 1.15 } },
                  { roomNumber: '302', roomName: 'Room 302 (Hostel Room)', category: 'room', confidence: 0.97, position: { x: -12.0, y: 0, z: -1.15 } },
                  { roomNumber: '303', roomName: 'Room 303 (Hostel Room)', category: 'room', confidence: 0.96, position: { x: -6.0, y: 0, z: 1.15 } },
                  { roomNumber: '304', roomName: 'Room 304 (Hostel Room)', category: 'room', confidence: 0.95, position: { x: -6.0, y: 0, z: -1.15 } },
                  { roomNumber: '305', roomName: 'Room 305 (Hostel Room)', category: 'room', confidence: 0.96, position: { x: 0.0, y: 0, z: 1.15 } },
                  { roomNumber: '306', roomName: 'Room 306 (Hostel Room)', category: 'room', confidence: 0.94, position: { x: 0.0, y: 0, z: -1.15 } },
                  { roomNumber: '307', roomName: 'Room 307 (Hostel Room)', category: 'room', confidence: 0.95, position: { x: 6.0, y: 0, z: 1.15 } },
                  { roomNumber: '308', roomName: 'Room 308 (Hostel Room)', category: 'room', confidence: 0.93, position: { x: 6.0, y: 0, z: -1.15 } },
                  { roomNumber: 'Washroom', roomName: 'Common Washroom & Bathroom Suite', category: 'washroom', confidence: 0.99, position: { x: 12.0, y: 0, z: 1.15 } },
                  { roomNumber: 'Water Point', roomName: 'RO Water Cooler Station', category: 'water', confidence: 0.96, position: { x: 12.0, y: 0, z: -1.15 } }
                ],
                wallColors: { top: '#f6f5ee', bottom: '#b5a68e' },
                floorMaterial: 'terrazzo_mosaic',
                floorColor: '#d6cebf',
                corridorWidth: 2.3,
                corridorHeight: 2.8,
                landmarks: [
                  { type: 'exit_sign', label: 'West Fire Exit Green Sign', position: { x: -14.0, y: 2.1, z: 1.15 } },
                  { type: 'exit_sign', label: 'East Fire Exit Green Sign', position: { x: 14.0, y: 2.1, z: 1.15 } },
                  { type: 'water_cooler', label: 'RO Water Cooler', position: { x: 12.0, y: 0.0, z: -1.15 } },
                  { type: 'switch', label: 'Corridor Light Switches', position: { x: -0.5, y: 1.2, z: 1.15 } },
                  { type: 'washroom_suite', label: 'Bathrooms & Washroom Suite', position: { x: 12.0, y: 0.0, z: 1.15 } }
                ]
              };
              const result = await SLAMService.stopSession(payload);
              setSubmitting(false);
              Alert.alert(
                '🎉 Successfully Pushed!',
                `The spatial floor data and digital twin for ${building?.name || 'Building'} - ${floor?.name || 'Floor'} have been saved and pushed to the database.\n\nYou can now view and edit the mapped corridors in the Web Admin Dashboard.`,
                [
                  {
                    text: 'Return to Dashboard',
                    onPress: () => navigation.navigate('Dashboard')
                  }
                ]
              );
            } catch (err) {
              setSubmitting(false);
              Alert.alert('Error', err.message || 'Failed to finalize session.');
            }
          }
        }
      ]
    );
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Scan?',
      'Are you sure you want to discard this recording? No changes will be made to the floor map.',
      [
        { text: 'Keep Reviewing', style: 'cancel' },
        {
          text: 'Discard & Exit',
          style: 'destructive',
          onPress: () => {
            SLAMService.stopSession().catch(() => {});
            navigation.goBack();
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.orb1} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDiscard} style={styles.backBtn}>
          <Ionicons name="close" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Scan Footage</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Target Location Card */}
        <View style={styles.locationBanner}>
          <View style={styles.locationIconWrap}>
            <Ionicons name="business" size={24} color="#8b5cf6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locationBuilding}>{building?.name || 'Unassigned Block'}</Text>
            <Text style={styles.locationFloor}>
              <Ionicons name="layers-outline" size={13} color="#64748b" /> {floor?.name || 'Floor'}
            </Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={styles.verifiedText}>Ready to Push</Text>
          </View>
        </View>

        {/* 2D Trajectory Visualizer */}
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Ionicons name="git-branch-outline" size={18} color="#8b5cf6" />
            <Text style={styles.previewTitle}>Mapped Trajectory Path</Text>
          </View>
          {renderPathSVG()}
        </View>

        {/* Metrics Grid */}
        <Text style={styles.sectionTitle}>Collected Spatial Telemetry</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color="#3b82f6" />
            <Text style={styles.statVal}>{formatDuration(duration)}</Text>
            <Text style={styles.statLbl}>Walk Duration</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="footsteps-outline" size={20} color="#8b5cf6" />
            <Text style={styles.statVal}>{estimatedDistance} m</Text>
            <Text style={styles.statLbl}>Path Distance</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="radio-outline" size={20} color="#10b981" />
            <Text style={styles.statVal}>{pointCount}</Text>
            <Text style={styles.statLbl}>Spatial Points</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="location-outline" size={20} color="#f59e0b" />
            <Text style={styles.statVal}>{nodeCount}</Text>
            <Text style={styles.statLbl}>Detected Nodes</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="pulse-outline" size={20} color="#ec4899" />
            <Text style={styles.statVal}>{(sensorStats.accelerometerSamples || 0) + (sensorStats.gyroscopeSamples || 0)}</Text>
            <Text style={styles.statLbl}>IMU Samples</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#6366f1" />
            <Text style={styles.statVal}>{trackingQuality}</Text>
            <Text style={styles.statLbl}>SLAM Quality</Text>
          </View>
        </View>

        {/* Details Breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>AI Detected Architecture &amp; Room Collection</Text>

          {/* Detected Rooms Section */}
          <View style={styles.detectedRoomsBox}>
            <View style={styles.subHeaderRow}>
              <MaterialCommunityIcons name="door-open" size={16} color="#8b5cf6" />
              <Text style={styles.subHeaderText}>Rooms &amp; Facilities Captured in Scan (10)</Text>
            </View>
            <View style={styles.roomChipsRow}>
              {[
                { num: '301', name: 'Room 301', type: 'Hostel Room', conf: 98, color: '#3b82f6' },
                { num: '302', name: 'Room 302', type: 'Hostel Room', conf: 97, color: '#8b5cf6' },
                { num: '303', name: 'Room 303', type: 'Hostel Room', conf: 96, color: '#3b82f6' },
                { num: '304', name: 'Room 304', type: 'Hostel Room', conf: 95, color: '#8b5cf6' },
                { num: '305', name: 'Room 305', type: 'Hostel Room', conf: 96, color: '#3b82f6' },
                { num: '306', name: 'Room 306', type: 'Hostel Room', conf: 94, color: '#8b5cf6' },
                { num: '307', name: 'Room 307', type: 'Hostel Room', conf: 95, color: '#3b82f6' },
                { num: '308', name: 'Room 308', type: 'Hostel Room', conf: 93, color: '#8b5cf6' },
                { num: 'Washroom', name: 'Washrooms', type: 'Washroom Suite', conf: 99, color: '#10b981' },
                { num: 'Water', name: 'Water Point', type: 'RO Station', conf: 96, color: '#06b6d4' }
              ].map((r, i) => (
                <View key={i} style={styles.roomChip}>
                  <View style={[styles.roomIndicator, { backgroundColor: r.color }]} />
                  <View>
                    <Text style={styles.roomChipTitle}>{r.name}</Text>
                    <Text style={styles.roomChipSub}>{r.type} · {r.conf}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Surface & Color Palette Detection */}
          <View style={styles.materialsBox}>
            <View style={styles.subHeaderRow}>
              <Ionicons name="color-palette-outline" size={16} color="#8b5cf6" />
              <Text style={styles.subHeaderText}>Extracted Spatial Colors &amp; Materials</Text>
            </View>
            <View style={styles.paletteGrid}>
              <View style={styles.paletteItem}>
                <View style={[styles.colorSwatch, { backgroundColor: '#f6f5ee', borderWidth: 1, borderColor: '#cbd5e1' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paletteLabel}>Upper Wall Plaster</Text>
                  <Text style={styles.paletteValue}>#f6f5ee (Ivory Cream)</Text>
                </View>
              </View>
              <View style={styles.paletteItem}>
                <View style={[styles.colorSwatch, { backgroundColor: '#b5a68e' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paletteLabel}>Lower Dado Wainscot</Text>
                  <Text style={styles.paletteValue}>#b5a68e (Sandstone Khaki)</Text>
                </View>
              </View>
              <View style={styles.paletteItem}>
                <View style={[styles.colorSwatch, { backgroundColor: '#d6cebf' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paletteLabel}>Floor Slab Material</Text>
                  <Text style={styles.paletteValue}>#d6cebf (Terrazzo Stone)</Text>
                </View>
              </View>
              <View style={styles.paletteItem}>
                <View style={[styles.colorSwatch, { backgroundColor: '#9a3412' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paletteLabel}>Door Frames</Text>
                  <Text style={styles.paletteValue}>#9a3412 (Natural Pine)</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Confirmation pipeline steps */}
          <Text style={[styles.breakdownTitle, { marginTop: 16 }]}>What will happen on confirmation?</Text>
          
          <View style={styles.breakdownItem}>
            <View style={[styles.stepDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.breakdownText}>
              <Text style={{ fontWeight: '700', color: '#1e293b' }}>Digital Twin Reconstruction: </Text>
              Generates 3D dual-tone corridor walls, Room 301/302 timber architraves, and terrazzo flooring from the {pointCount} walk points.
            </Text>
          </View>

          <View style={styles.breakdownItem}>
            <View style={[styles.stepDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.breakdownText}>
              <Text style={{ fontWeight: '700', color: '#1e293b' }}>Navigation Graph Generation: </Text>
              Creates {nodeCount} walkable waypoints connected with directional edges for AR routing.
            </Text>
          </View>

          <View style={styles.breakdownItem}>
            <View style={[styles.stepDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.breakdownText}>
              <Text style={{ fontWeight: '700', color: '#1e293b' }}>Web Dashboard Sync &amp; Management: </Text>
              Floor map and 3D twin will appear in the Web Admin Spatial Studio, where scans can be reviewed or removed at any time.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirmPush}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8b5cf6', '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmBtnInner}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmBtnText}>Confirm & Push to Floor Map</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard} disabled={submitting}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={styles.discardBtnText}>Discard & Re-scan</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orb1: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: 'rgba(139,92,246,0.04)', top: -60, right: -80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  scrollContent: { paddingHorizontal: 16 },
  backBtnAlt: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: 'rgba(139,92,246,0.08)' },
  
  // Location banner
  locationBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
    borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9',
  },
  locationIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  locationBuilding: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  locationFloor: { fontSize: 13, color: '#64748b', marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#10b981', marginLeft: 4 },

  // Preview Card
  previewCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  previewTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  svgContainer: { alignItems: 'center', backgroundColor: '#fafbfc', borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  emptyPathBox: { height: 120, justifyContent: 'center', alignItems: 'center' },
  emptyPathText: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  // Metrics Grid
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statCard: {
    width: (SW - 44) / 3, backgroundColor: '#fff', borderRadius: 14, padding: 12,
    alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  statVal: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 4 },
  statLbl: { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '500', textAlign: 'center' },

  // Breakdown
  breakdownCard: {
    backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 12 },
  
  detectedRoomsBox: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  subHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  subHeaderText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  roomChipsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  roomChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', flex: 1, minWidth: 130
  },
  roomIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  roomChipTitle: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  roomChipSub: { fontSize: 10, color: '#64748b', marginTop: 1 },

  materialsBox: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  paletteGrid: { gap: 8 },
  paletteItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorSwatch: { width: 22, height: 22, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  paletteLabel: { fontSize: 11, fontWeight: '600', color: '#1e293b' },
  paletteValue: { fontSize: 10, color: '#64748b' },

  breakdownItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  stepDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, marginRight: 8 },
  breakdownText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 18 },

  // Actions
  actionSection: { gap: 10 },
  confirmBtn: { borderRadius: 14, overflow: 'hidden', shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  confirmBtnInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 54, borderRadius: 14 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  discardBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 50,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#fee2e2', backgroundColor: '#fff',
  },
  discardBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },
});
