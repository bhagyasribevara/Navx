import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, TextInput, Animated,
  Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { ThemeContext } from "../context/ThemeContext";
import { getCampuses, cachedGet, downloadCampusOffline } from "../api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SHADOWS, RADIUS, QUICK_ACTIONS, ROOM_COLORS } from "../theme/designSystem";

const { width: SW } = Dimensions.get("window");
const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? "Good Morning" : HOUR < 17 ? "Good Afternoon" : "Good Evening";

const VENUE_CATS = {
  campus: [
    { label: "Labs", icon: "flask", color: "#22c55e", filter: "lab" },
    { label: "Classes", icon: "school", color: "#3b82f6", filter: "classroom" },
    { label: "Offices", icon: "business", color: "#8b5cf6", filter: "office" },
    { label: "Cafeteria", icon: "restaurant", color: "#ef4444", filter: "cafeteria" },
    { label: "Library", icon: "library", color: "#06b6d4", filter: "library" },
    { label: "Restrooms", icon: "water", color: "#f59e0b", filter: "restroom" },
  ],
  hospital: [
    { label: "Wards", icon: "bed", color: "#3b82f6", filter: "ward" },
    { label: "ICU", icon: "pulse", color: "#ef4444", filter: "icu" },
    { label: "Emergency", icon: "alert-circle", color: "#dc2626", filter: "emergency" },
    { label: "Pharmacy", icon: "medkit", color: "#22c55e", filter: "pharmacy" },
    { label: "Reception", icon: "information-circle", color: "#8b5cf6", filter: "reception" },
    { label: "Radiology", icon: "scan", color: "#f59e0b", filter: "radiology" },
  ],
  airport: [
    { label: "Gates", icon: "airplane", color: "#3b82f6", filter: "gate" },
    { label: "Check-in", icon: "checkmark-circle", color: "#22c55e", filter: "check_in" },
    { label: "Lounge", icon: "cafe", color: "#8b5cf6", filter: "lounge" },
    { label: "Baggage", icon: "briefcase", color: "#f59e0b", filter: "baggage_claim" },
    { label: "Security", icon: "shield-checkmark", color: "#ef4444", filter: "security" },
    { label: "Duty Free", icon: "bag-handle", color: "#ec4899", filter: "duty_free" },
  ],
  mall: [
    { label: "Stores", icon: "storefront", color: "#3b82f6", filter: "store" },
    { label: "Food Court", icon: "fast-food", color: "#ef4444", filter: "food_court" },
    { label: "Entertain", icon: "game-controller", color: "#ec4899", filter: "entertainment" },
    { label: "ATM", icon: "card", color: "#22c55e", filter: "atm" },
    { label: "Parking", icon: "car", color: "#64748b", filter: "parking" },
    { label: "Restrooms", icon: "water", color: "#f59e0b", filter: "restroom" },
  ],
  building: [
    { label: "Offices", icon: "business", color: "#8b5cf6", filter: "office" },
    { label: "Conference", icon: "people", color: "#3b82f6", filter: "conference" },
    { label: "Lobby", icon: "home", color: "#6366f1", filter: "lobby" },
    { label: "Gym", icon: "fitness", color: "#22c55e", filter: "gym" },
    { label: "Cafeteria", icon: "restaurant", color: "#ef4444", filter: "cafeteria" },
    { label: "Restrooms", icon: "water", color: "#f59e0b", filter: "restroom" },
  ],
};

const VENUE_ICONS_MAP = { campus: 'school', hospital: 'medkit', airport: 'airplane', mall: 'cart', building: 'business' };

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useContext(ThemeContext);
  const [campuses, setCampuses] = useState([]);
  const [recentRooms, setRecentRooms] = useState([]);
  const [activeCampusId, setActiveCampusId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingCampus, setDownloadingCampus] = useState(false);
  const [downloadedStatus, setDownloadedStatus] = useState({});
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(QUICK_ACTIONS.map(() => new Animated.Value(0))).current;

  useFocusEffect(useCallback(() => {
    Animated.stagger(70, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 130, friction: 9 })
    )).start();
    // Load real recent rooms
    AsyncStorage.getItem("navx_recent").then(stored => {
      if (stored) setRecentRooms(JSON.parse(stored));
    }).catch(() => {});
    // Load active campus
    AsyncStorage.getItem("navx_active_campus").then(stored => {
      if (stored) {
        const parsed = JSON.parse(stored);
        setActiveCampusId(parsed.id);
      }
    }).catch(() => {});
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

  useEffect(() => {
    if (activeCampusId) {
      AsyncStorage.getItem(`navx_offline_${activeCampusId}`).then(res => {
        if (res) setDownloadedStatus(prev => ({ ...prev, [activeCampusId]: true }));
      }).catch(() => {});
    }
  }, [activeCampusId]);

  const [showNotifs, setShowNotifs] = useState(false);
  const MOCK_NOTIFS = [
    { id: 1, title: "Map Updated", desc: "Admin published new navigation paths for CSE Block.", time: "Just now", unread: true },
    { id: 2, title: "New Floor Added", desc: "Floor 2 was added to Block A.", time: "1d ago", unread: false },
  ];

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
    <>
    <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greetingText}>{GREETING} 👋</Text>
            <Text style={s.appName}>Nav<Text style={s.appAccent}>X</Text></Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity style={[s.avatar, { width: 42, height: 42 }]} onPress={() => setShowNotifs(true)}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
              <View style={s.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.avatar, { width: 42, height: 42 }]} onPress={() => navigation.navigate("Settings")}>
              <Ionicons name="person" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
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
          {(VENUE_CATS[campuses.find(c => c._id === activeCampusId)?.venueType] || VENUE_CATS.campus).map((c, i) => (
            <TouchableOpacity key={i} style={s.catChip} onPress={() => navigation.navigate("Search", { filter: c.filter })} activeOpacity={0.78}>
              <Ionicons name={c.icon} size={16} color={c.color} />
              <Text style={s.catLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recently Visited */}
      {recentRooms.length > 0 && (
      <View style={s.section}>
        <View style={s.secRow}>
          <Text style={s.secTitle}>Recently Visited</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Favorites")}>
            <Text style={s.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>
        {recentRooms.map(rm => {
          const roomColor = ROOM_COLORS[rm.type] || colors.primary;
          return (
          <TouchableOpacity key={rm._id} style={s.recentCard} onPress={() => navigation.navigate("Navigation", { room: rm, campusId: rm.campusId })} activeOpacity={0.82}>
            <View style={[s.recentIcon, { backgroundColor: roomColor + "20" }]}>
              <Ionicons name="location" size={22} color={roomColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.recentName}>{rm.name}</Text>
              <Text style={s.recentMeta}>{(rm.type || "room").toUpperCase()}{rm.roomNumber ? ` · Room ${rm.roomNumber}` : ""}</Text>
            </View>
            <View style={s.navBadge}>
              <Ionicons name="navigate" size={18} color={colors.primary} />
            </View>
          </TouchableOpacity>
          );
        })}
      </View>
      )}

      {/* Campuses */}
      <View style={s.section}>
        <View style={s.secRow}>
          <Text style={s.secTitle}>{activeCampusId ? "Your Venue" : "Unlock Your Venue"}</Text>
          <Ionicons name={VENUE_ICONS_MAP[campuses.find(c => c._id === activeCampusId)?.venueType] || "business-outline"} size={18} color={colors.textMuted} />
        </View>
        {(!activeCampusId || !campuses.find(c => c._id === activeCampusId)) ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="qr-code-outline" size={30} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No Venue Unlocked</Text>
            <Text style={s.emptyText}>Scan the venue QR code at the entrance{"\n"}to load the map and navigation.</Text>
            <TouchableOpacity 
              style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
              onPress={() => navigation.navigate("QRScan")}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          campuses.filter(c => c._id === activeCampusId).map((campus, i) => {
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
                    <TouchableOpacity style={s.arBtn} onPress={() => navigation.navigate("Search", { campusId: campus._id })}>
                      <Ionicons name="search" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, marginLeft: 6 }}>Search</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[s.arBtn, downloadedStatus[campus._id] && { borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.1)" }]} 
                      onPress={async () => {
                        if (downloadingCampus || downloadedStatus[campus._id]) return;
                        setDownloadingCampus(true);
                        const success = await downloadCampusOffline(campus._id);
                        if (success) {
                          setDownloadedStatus(prev => ({ ...prev, [campus._id]: true }));
                        }
                        setDownloadingCampus(false);
                      }}
                    >
                      {downloadingCampus ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name={downloadedStatus[campus._id] ? "cloud-done" : "cloud-download"} size={16} color={downloadedStatus[campus._id] ? "#22c55e" : colors.primary} />
                          <Text style={{ color: downloadedStatus[campus._id] ? "#22c55e" : colors.primary, fontWeight: "700", fontSize: 13, marginLeft: 6 }}>
                            {downloadedStatus[campus._id] ? "Downloaded" : "Download"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>

    {/* ── Notifications Panel ──────────────────────────────── */}
    {showNotifs && (
      <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 100 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={() => setShowNotifs(false)} />
        <Animated.View style={{ position: "absolute", top: Platform.OS === "ios" ? 100 : 70, right: 20, width: SW * 0.85, backgroundColor: colors.card, borderRadius: RADIUS.lg, ...SHADOWS.lg, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotifs(false)}>
              <Ionicons name="close" size={20} color={colors.textSec} />
            </TouchableOpacity>
          </View>
          {MOCK_NOTIFS.map(n => (
            <View key={n.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {n.unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" }} />}
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{n.title}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: "auto" }}>{n.time}</Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textSec, lineHeight: 18 }}>{n.desc}</Text>
            </View>
          ))}
        </Animated.View>
      </View>
    )}
  </>
  );
}
