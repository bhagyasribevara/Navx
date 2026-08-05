import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdmin } from '../context/AdminContext';
import { getBlocks, getFloors, generateCampusQR, getCampusQR } from '../services/adminApi';

// Try to import QRCode - if not installed, we show a placeholder
let QRCode = null;
try { QRCode = require('react-native-qrcode-svg').default; } catch (e) {}

export default function QRGeneratorScreen({ navigation, route }) {
  const { admin } = useAdmin();
  const campusId = route.params?.campusId || admin?.campusId?._id || admin?.campusId;

  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [campusQR, setCampusQR] = useState(null);

  const loadData = useCallback(async () => {
    if (!campusId) { setLoading(false); return; }
    try {
      const blocksRes = await getBlocks(campusId);
      const blockList = blocksRes?.data || blocksRes || [];
      setBlocks(Array.isArray(blockList) ? blockList : []);

      // Try loading existing campus QR
      try {
        const qr = await getCampusQR(campusId);
        if (qr?.campusQRImage) setCampusQR(qr.campusQRImage);
      } catch (e) {}
    } catch (e) {
      console.warn('Failed to load blocks:', e);
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectBlock = async (block) => {
    setSelectedBlock(block);
    setSelectedFloor(null);
    try {
      const floorsRes = await getFloors(block._id);
      const floorList = floorsRes?.data || floorsRes || [];
      setFloors(Array.isArray(floorList) ? floorList : []);
    } catch (e) {
      setFloors([]);
    }
  };

  const handleGenerateCampusQR = async () => {
    setGenerating(true);
    try {
      const res = await generateCampusQR(campusId);
      if (res?.campusQRImage) {
        setCampusQR(res.campusQRImage);
        Alert.alert('Success', 'Campus QR code generated successfully!');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to generate QR');
    } finally {
      setGenerating(false);
    }
  };

  const getQRValue = () => {
    if (selectedFloor) {
      return JSON.stringify({
        type: 'navx_floor',
        campusId,
        blockId: selectedBlock?._id,
        floorId: selectedFloor._id,
        floorName: selectedFloor.name,
        blockName: selectedBlock?.name,
      });
    }
    if (selectedBlock) {
      return JSON.stringify({
        type: 'navx_block',
        campusId,
        blockId: selectedBlock._id,
        blockName: selectedBlock.name,
      });
    }
    return JSON.stringify({ type: 'navx_campus', campusId });
  };

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
      <View style={styles.orb2} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Generator</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* QR Preview */}
        <View style={styles.qrCard}>
          <View style={styles.qrFrame}>
            {QRCode ? (
              <QRCode
                value={getQRValue()}
                size={180}
                color="#1e293b"
                backgroundColor="#ffffff"
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={80} color="#8b5cf6" />
                <Text style={styles.qrPlaceholderText}>QR Preview</Text>
              </View>
            )}
          </View>
          <Text style={styles.qrLabel}>
            {selectedFloor ? `${selectedBlock?.name} → ${selectedFloor.name}`
              : selectedBlock ? selectedBlock.name
              : 'Campus QR Code'}
          </Text>
          <Text style={styles.qrSub}>Scan to initialize localization</Text>
        </View>

        {/* Building Selector */}
        <Text style={styles.sectionTitle}>Select Building</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.blockRow}
        >
          <TouchableOpacity
            style={[styles.blockChip, !selectedBlock && styles.blockChipActive]}
            onPress={() => { setSelectedBlock(null); setSelectedFloor(null); setFloors([]); }}
          >
            <Ionicons name="globe" size={16} color={!selectedBlock ? '#fff' : '#8b5cf6'} />
            <Text style={[styles.blockChipText, !selectedBlock && styles.blockChipTextActive]}>Campus</Text>
          </TouchableOpacity>
          {blocks.map(block => (
            <TouchableOpacity
              key={block._id}
              style={[styles.blockChip, selectedBlock?._id === block._id && styles.blockChipActive]}
              onPress={() => handleSelectBlock(block)}
            >
              <Ionicons name="business" size={16} color={selectedBlock?._id === block._id ? '#fff' : '#8b5cf6'} />
              <Text style={[styles.blockChipText, selectedBlock?._id === block._id && styles.blockChipTextActive]}>
                {block.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Floor Selector */}
        {selectedBlock && floors.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Select Floor</Text>
            <View style={styles.floorGrid}>
              {floors.map(floor => (
                <TouchableOpacity
                  key={floor._id}
                  style={[styles.floorCard, selectedFloor?._id === floor._id && styles.floorCardActive]}
                  onPress={() => setSelectedFloor(floor)}
                >
                  <Ionicons
                    name="layers"
                    size={20}
                    color={selectedFloor?._id === floor._id ? '#8b5cf6' : '#64748b'}
                  />
                  <Text style={[styles.floorName, selectedFloor?._id === floor._id && { color: '#8b5cf6', fontWeight: '700' }]}>
                    {floor.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleGenerateCampusQR}
            disabled={generating}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8b5cf6', '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtnInner}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>Generate & Save QR</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Export', 'PDF export functionality coming soon!')}>
            <Ionicons name="document-text" size={20} color="#8b5cf6" style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Export to PDF</Text>
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
  orb1: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: 'rgba(16,185,129,0.04)', top: -60, right: -80 },
  orb2: { position: 'absolute', width: 180, height: 180, borderRadius: 999, backgroundColor: 'rgba(139,92,246,0.04)', bottom: 100, left: -40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  scrollContent: { paddingHorizontal: 16 },
  // QR Card
  qrCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center',
    marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
  },
  qrFrame: {
    padding: 20, borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#8b5cf6', marginBottom: 16,
  },
  qrPlaceholder: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center' },
  qrPlaceholderText: { color: '#94a3b8', fontSize: 13, marginTop: 8, fontWeight: '500' },
  qrLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  qrSub: { fontSize: 12, color: '#94a3b8' },
  // Section
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12, marginTop: 4 },
  // Block chips
  blockRow: { paddingBottom: 16, gap: 8 },
  blockChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.06)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.12)',
    marginRight: 8,
  },
  blockChipActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  blockChipText: { fontSize: 13, fontWeight: '600', color: '#8b5cf6', marginLeft: 6 },
  blockChipTextActive: { color: '#fff' },
  // Floor grid
  floorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  floorCard: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9',
  },
  floorCardActive: { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.06)' },
  floorName: { fontSize: 13, fontWeight: '500', color: '#475569', marginLeft: 8 },
  // Actions
  actions: { marginTop: 8 },
  actionBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 12, shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  actionBtnInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 54, borderRadius: 14 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 54,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#8b5cf6',
  },
  secondaryBtnText: { color: '#8b5cf6', fontSize: 15, fontWeight: '700' },
});
