import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../App';
import { getCampuses, getBlocks, cachedGet } from '../api';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedGet('campuses', getCampuses)
      .then(data => { setCampuses(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const quickActions = [
    { icon: 'qr-code', label: 'Scan QR', color: '#6366f1', screen: 'QRScan' },
    { icon: 'navigate', label: 'Navigate', color: '#22c55e', screen: 'Map' },
    { icon: 'search', label: 'Search', color: '#3b82f6', screen: 'Search' },
    { icon: 'camera', label: 'AR View', color: '#f59e0b', screen: 'AR' },
  ];

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { padding: 20, paddingTop: 60, backgroundColor: colors.card, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    greeting: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: colors.textSec },
    quickGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: -30 },
    quickBtn: { width: (width - 64) / 4, alignItems: 'center', backgroundColor: colors.card, paddingVertical: 16, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    quickIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    quickLabel: { fontSize: 11, fontWeight: '600', color: colors.textSec },
    section: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
    campusCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    campusName: { fontSize: 16, fontWeight: '700', color: colors.text },
    campusDesc: { fontSize: 13, color: colors.textSec, marginTop: 4 },
    campusBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 12, alignSelf: 'flex-start' },
    campusBtnText: { fontSize: 13, fontWeight: '600', color: '#fff', marginLeft: 6 },
    emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  });

  if (loading) {
    return <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Text style={s.greeting}>NavX</Text>
        <Text style={s.subtitle}>Indoor Navigation System</Text>
        <View style={{ height: 50 }} />
      </View>

      <View style={s.quickGrid}>
        {quickActions.map((action, i) => (
          <TouchableOpacity key={i} style={s.quickBtn} onPress={() => navigation.navigate(action.screen)} activeOpacity={0.7}>
            <View style={[s.quickIcon, { backgroundColor: action.color + '20' }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={s.quickLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Your Campuses</Text>
        {campuses.length === 0 ? (
          <Text style={s.emptyText}>No campuses available.{'\n'}Ask admin to set up your campus.</Text>
        ) : (
          campuses.map(campus => (
            <TouchableOpacity key={campus._id} style={s.campusCard}
              onPress={() => navigation.navigate('Map', { campusId: campus._id, campusName: campus.name })}>
              <Text style={s.campusName}>{campus.name}</Text>
              <Text style={s.campusDesc}>{campus.description || 'Tap to explore'}</Text>
              {campus.address ? <Text style={[s.campusDesc, { fontSize: 12 }]}>📍 {campus.address}</Text> : null}
              <TouchableOpacity style={s.campusBtn} onPress={() => navigation.navigate('Map', { campusId: campus._id })}>
                <Ionicons name="map" size={16} color="#fff" />
                <Text style={s.campusBtnText}>Explore Map</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
