import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, TextInput, Animated,
  Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { ThemeContext } from "../context/ThemeContext";
import { getCampuses, cachedGet } from "../api";
import { SHADOWS, RADIUS, QUICK_ACTIONS } from "../theme/designSystem";

const { width: SW } = Dimensions.get("window");
const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? "Good Morning" : HOUR < 17 ? "Good Afternoon" : "Good Evening";

const RECENT = [
  { id: "r1", name: "Computer Lab 3", floor: "Floor 2", block: "Block A", icon: "flask", color: "#22c55e" },
  { id: "r2", name: "Library Hall", floor: "Floor 1", block: "Block B", icon: "library", color: "#06b6d4" },
  { id: "r3", name: "Principal Office", floor: "Floor 3", block: "Block C", icon: "business", color: "#8b5cf6" },
];

const CATS = [
  { label: "Labs", icon: "flask", color: "#22c55e", filter: "lab" },
  { label: "Classes", icon: "school", color: "#3b82f6", filter: "classroom" },
  { label: "Offices", icon: "business", color: "#8b5cf6", filter: "office" },
  { label: "Cafeteria", icon: "restaurant", color: "#ef4444", filter: "cafeteria" },
  { label: "Library", icon: "library", color: "#06b6d4", filter: "library" },
  { label: "Restrooms", icon: "water", color: "#f59e0b", filter: "restroom" },
];

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useContext(ThemeContext);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(QUICK_ACTIONS.map(() => new Animated.Value(0))).current;

  useFocusEffect(useCallback(() => {
    Animated.stagger(70, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 130, friction: 9 })
    )).start();
    return () => cardAnims.forEach(a => a.setValue(0));
  }, []));

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    cachedGet("campuses", getCampuses)
      .then(d => { setCampuses(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingTop: Platform.OS === "ios" ? 56 : (StatusBar.currentHeight || 24) + 12,
      paddingHorizontal: 20, paddingBottom: 24,
      backgroundColor: isDark ? "#0d1526" : "#eef2ff",
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
    greetingText: { fontSize: 13, color: colors.textSec, fontWeight: "600" },
    appName: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
    appAccent: { color: colors.primary },
    avatar: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: colors.primary + "18",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: colors.primary + "35",
    },
    notifDot: {
      position: "absolute", top: 1, right: 1,
      width: 11, height: 11, borderRadius: 6,
      backgroundColor: "#ef4444",
      borderWidth: 2, borderColor: colors.card,
    },
    searchRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: RADIUS.md, paddingHorizontal: 14,
      borderWidth: 1.5, borderColor: colors.border,
      ...SHADOWS.md,
    },
    searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.text, marginLeft: 10 },
    qrBtn: {
      width: 36, height: 36, borderRadius: RADIUS.sm,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    },
    section: { paddingHorizontal: 20, marginTop: 22 },
    secRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    secTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
    seeAll: { fontSize: 13, fontWeight: "600", color: colors.primary },
    quickRow: { flexDirection: "row", justifyContent: "space-between" },
    quickCard: {
      width: (SW - 56) / 4, alignItems: "center",
      backgroundColor: colors.card, paddingVertical: 14, paddingHorizontal: 4,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
      ...SHADOWS.sm,
    },
    quickIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    quickLabel: { fontSize: 11, fontWeight: "700", color: colors.textSec, textAlign: "center" },
    banner: {
      marginHorizontal: 20, marginTop: 22, borderRadius: RADIUS.lg, overflow: "hidden",
      ...SHADOWS.lg,
    },
    bannerInner: { padding: 20 },
    bannerBadge: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 99,
      paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 10,
    },
    bannerBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff", marginLeft: 4, letterSpacing: 0.5 },
    bannerTitle: { fontSize: 21, fontWeight: "800", color: "#fff", marginBottom: 4 },
    bannerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 14 },
    bannerBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: "#fff", paddingHorizontal: 14,
      paddingVertical: 9, borderRadius: RADIUS.sm, alignSelf: "flex-start",
    },
    bannerBtnText: { fontSize: 13, fontWeight: "700", color: "#4f46e5", marginLeft: 6 },
    catChip: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card,
      paddingHorizontal: 14, paddingVertical: 9,
      borderRadius: 99, marginRight: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    catLabel: { fontSize: 13, fontWeight: "600", color: colors.textSec, marginLeft: 6 },
    recentCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: colors.border, ...SHADOWS.sm,
    },
    recentIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", marginRight: 12 },
    recentName: { fontSize: 15, fontWeight: "700", color: colors.text },
    recentMeta: { fontSize: 12, color: colors.textSec, marginTop: 2 },
    navBadge: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center",
    },
    campusCard: {
      backgroundColor: colors.card, borderRadius: RADIUS.lg,
      overflow: "hidden", marginBottom: 12,
      borderWidth: 1, borderColor: colors.border, ...SHADOWS.md,
    },
    campusBar: { height: 4 },
    campusBody: { padding: 16 },
    campusName: { fontSize: 17, fontWeight: "800", color: colors.text },
    campusDesc: { fontSize: 13, color: colors.textSec, marginTop: 4, lineHeight: 18 },
    campusAddr: { flexDirection: "row", alignItems: "center", marginTop: 8 },
    campusActions: { flexDirection: "row", gap: 8, marginTop: 14 },
    mapBtn: {
      flex: 1, flexDirection: "row", alignItems: "center",
      backgroundColor: colors.primary, paddingVertical: 11,
      borderRadius: RADIUS.sm, justifyContent: "center",
    },
    arBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.primary + "18", paddingHorizontal: 14,
      paddingVertical: 11, borderRadius: RADIUS.sm,
      borderWidth: 1, borderColor: colors.primary + "35",
    },
    empty: { alignItems: "center", paddingVertical: 36 },
    emptyIcon: {
      width: 70, height: 70, borderRadius: 35,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 6 },
    emptyText: { fontSize: 13, color: colors.textSec, textAlign: "center", lineHeight: 20 },
  });

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="navigate" size={30} color={colors.primary} />
          </View>
        </Animated.View>
        <Text style={{ color: colors.textSec, marginTop: 18, fontSize: 15, fontWeight: "600" }}>Loading NavX…</Text>
      </View>
    );
  }

  const GRAD_BARS = [["#6366f1", "#4f46e5"], ["#22c55e", "#16a34a"], ["#3b82f6", "#2563eb"]];

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greetingText}>{GREETING} 👋</Text>
            <Text style={s.appName}>Nav<Text style={s.appAccent}>X</Text></Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="person" size={22} color={colors.primary} />
            <View style={s.notifDot} />
          </TouchableOpacity>
        </View>
        <View style={s.searchRow}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search rooms, labs, blocks…"
            placeholderTextColor={colors.textMuted}
            onFocus={() => navigation.navigate("Search")}
          />
          <TouchableOpacity style={s.qrBtn} onPress={() => navigation.navigate("QRScan")}>
            <Ionicons name="qr-code" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Quick Actions */}
      <View style={s.section}>
        <View style={s.secRow}>
          <Text style={s.secTitle}>Quick Actions</Text>
        </View>
        <View style={s.quickRow}>
          {QUICK_ACTIONS.map((a, i) => (
            <Animated.View key={i} style={{
              opacity: cardAnims[i],
              transform: [
                { scale: cardAnims[i] },
                { translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }
              ],
            }}>
              <TouchableOpacity style={s.quickCard} onPress={() => navigation.navigate(a.screen)} activeOpacity={0.78}>
                <View style={[s.quickIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={24} color={a.color} />
                </View>
                <Text style={s.quickLabel}>{a.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Banner */}
      <TouchableOpacity style={s.banner} activeOpacity={0.9} onPress={() => navigation.navigate("Map")}>
        <View style={[s.bannerInner, { backgroundColor: "#4f46e5" }]}>
          <View style={[s.bannerInner, { padding: 0 }]}>
            <View style={{ flexDirection: "row", position: "absolute", right: 20, top: -10, opacity: 0.15 }}>
              <Ionicons name="map" size={100} color="#fff" />
            </View>
          </View>
          <View style={s.bannerBadge}>
            <Ionicons name="flash" size={10} color="#fff" />
            <Text style={s.bannerBadgeText}>LIVE TRACKING</Text>
          </View>
          <Text style={s.bannerTitle}>Interactive Floor Map</Text>
          <Text style={s.bannerSub}>Explore with real-time indoor positioning</Text>
          <TouchableOpacity style={s.bannerBtn} onPress={() => navigation.navigate("Map")}>
            <Ionicons name="map" size={16} color="#4f46e5" />
            <Text style={s.bannerBtnText}>Open Map</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Categories */}
      <View style={{ marginTop: 22 }}>
        <View style={[s.secRow, { paddingHorizontal: 20 }]}>
          <Text style={s.secTitle}>Browse by Category</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {CATS.map((c, i) => (
            <TouchableOpacity key={i} style={s.catChip} onPress={() => navigation.navigate("Search", { filter: c.filter })} activeOpacity={0.78}>
              <Ionicons name={c.icon} size={16} color={c.color} />
              <Text style={s.catLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recently Visited */}
      <View style={s.section}>
        <View style={s.secRow}>
          <Text style={s.secTitle}>Recently Visited</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Favorites")}>
            <Text style={s.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>
        {RECENT.map(loc => (
          <TouchableOpacity key={loc.id} style={s.recentCard} onPress={() => navigation.navigate("Map")} activeOpacity={0.82}>
            <View style={[s.recentIcon, { backgroundColor: loc.color + "20" }]}>
              <Ionicons name={loc.icon} size={22} color={loc.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.recentName}>{loc.name}</Text>
              <Text style={s.recentMeta}>{loc.floor} · {loc.block}</Text>
            </View>
            <View style={s.navBadge}>
              <Ionicons name="navigate" size={18} color={colors.primary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Campuses */}
      <View style={s.section}>
        <View style={s.secRow}>
          <Text style={s.secTitle}>Your Campuses</Text>
          <Ionicons name="business-outline" size={18} color={colors.textMuted} />
        </View>
        {campuses.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="school-outline" size={30} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No Campuses Yet</Text>
            <Text style={s.emptyText}>Ask your admin to set up{"\n"}your campus on NavX.</Text>
          </View>
        ) : (
          campuses.map((campus, i) => {
            const g = GRAD_BARS[i % GRAD_BARS.length];
            return (
              <TouchableOpacity key={campus._id} style={s.campusCard} activeOpacity={0.88} onPress={() => navigation.navigate("Map", { campusId: campus._id, campusName: campus.name })}>
                <View style={[s.campusBar, { backgroundColor: g[0] }]} />
                <View style={s.campusBody}>
                  <Text style={s.campusName}>{campus.name}</Text>
                  <Text style={s.campusDesc}>{campus.description || "Tap to explore campus map"}</Text>
                  {campus.address && (
                    <View style={s.campusAddr}>
                      <Ionicons name="location" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 4 }}>{campus.address}</Text>
                    </View>
                  )}
                  <View style={s.campusActions}>
                    <TouchableOpacity style={s.mapBtn} onPress={() => navigation.navigate("Map", { campusId: campus._id })}>
                      <Ionicons name="map" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, marginLeft: 6 }}>Explore Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.arBtn} onPress={() => navigation.navigate("AR")}>
                      <Ionicons name="camera" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, marginLeft: 6 }}>AR</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
