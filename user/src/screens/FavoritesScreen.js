import React, { useState, useContext, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Platform, Alert, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";
import AnimatedPressable from "../components/AnimatedPressable";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from 'expo-linear-gradient';
import journeyRecorder from "../journey/JourneyRecorder";

const formatJourneyTime = (timestamp) => {
  if (!timestamp) return "Recently";
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) {
    return `Today, ${timeStr}`;
  }
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
};

export default function FavoritesScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [favorites, setFavorites] = useState([]);
  const [recents, setRecents] = useState([]);
  const [activeTab, setActiveTab] = useState("recent");
  const [refreshing, setRefreshing] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(Array(20).fill(0).map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    loadRecents();
  }, []);

  const loadRecents = async () => {
    try {
      // 1. Fetch completed privacy-first journeys stored locally
      const journeys = await journeyRecorder.getRecentJourneys();
      // 2. Also fetch any legacy navx_recent rooms
      const stored = await AsyncStorage.getItem("navx_recent").catch(() => null);
      const legacyRecents = stored ? JSON.parse(stored) : [];

      const journeyRoomIds = new Set(
        journeys
          .map((j) => String(j.destination?.roomId || j.destination?._id || ""))
          .filter(Boolean)
      );

      const filteredLegacy = legacyRecents.filter(
        (r) => !journeyRoomIds.has(String(r._id || r.id || ""))
      );

      const combined = [
        ...journeys.map((j) => ({ ...j, isJourney: true })),
        ...filteredLegacy.map((r) => ({ ...r, isJourney: false })),
      ];

      setRecents(combined);
      Animated.stagger(
        60,
        combined.map((_, i) =>
          Animated.spring(itemAnims[i], {
            toValue: 1,
            tension: 120,
            friction: 10,
            useNativeDriver: true,
          })
        )
      ).start();
    } catch (e) {
      setRecents([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecents();
    setRefreshing(false);
  };

  const removeFavorite = (id) => {
    Alert.alert("Remove Favorite", "Remove this location from favorites?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setFavorites(f => f.filter(x => x._id !== id)) },
    ]);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    header: {
      paddingTop: Platform.OS === 'ios' ? 8 : 22,
      paddingHorizontal: 20, paddingBottom: 20,
      backgroundColor: "transparent",
    },
    headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    title: { fontSize: 24, fontWeight: "800", color: colors.text, flex: 1 },
    addBtn: {
      width: 40, height: 40, borderRadius: RADIUS.sm,
      backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center",
    },
    tabs: { flexDirection: "row", gap: 8 },
    tab: {
      flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm,
      alignItems: "center", borderWidth: 1.5,
    },
    tabText: { fontSize: 14, fontWeight: "700" },
    listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
    card: {
      backgroundColor: colors.card, borderRadius: 18,
      padding: 14, marginBottom: 12,
      borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.25)",
      flexDirection: "row", alignItems: "center",
      ...SHADOWS.sm,
    },
    iconWrap: {
      width: 48, height: 48, borderRadius: 99,
      alignItems: "center", justifyContent: "center", marginRight: 14,
    },
    name: { fontSize: 15, fontWeight: "700", color: colors.text },
    meta: { fontSize: 12, color: colors.textSec, marginTop: 3 },
    actions: { flexDirection: "row", gap: 6, marginLeft: 8 },
    actionBtn: {
      width: 36, height: 36, borderRadius: 99,
      alignItems: "center", justifyContent: "center",
    },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 16,
    },
    emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.textSec, textAlign: "center", lineHeight: 20 },
    statLbl: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
    journeyCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1.5,
      borderColor: "rgba(99, 102, 241, 0.25)",
      ...SHADOWS.sm,
    },
    journeyHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    journeyIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    journeyTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    journeyMeta: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
      marginTop: 2,
    },
    journeyDetailsBox: {
      backgroundColor: colors.surface + "60",
      borderRadius: 14,
      padding: 12,
      gap: 6,
    },
    journeyDetailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    journeyDetailText: {
      fontSize: 13,
      color: colors.textSec,
    },
    journeyStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border + "40",
    },
    journeyStatItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    journeyStatValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    takeMeBackBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: RADIUS.md,
      marginTop: 12,
      gap: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    takeMeBackBtnText: {
      color: "#ffffff",
      fontWeight: "800",
      fontSize: 14,
      letterSpacing: 0.3,
    },
  });

  const data = activeTab === "favorites" ? favorites : recents;

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.22)', 'rgba(99, 102, 241, 0.10)', 'rgba(255, 255, 255, 0)']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 380,
        }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={s.container}>
        <Animated.View style={[s.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
          <View style={s.headerRow}>
            <AnimatedPressable style={{ marginRight: 14 }} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </AnimatedPressable>
            <Text style={s.title}>Saved Places</Text>
            <AnimatedPressable style={s.addBtn}>
              <Ionicons name="add" size={22} color={colors.primary} />
            </AnimatedPressable>
          </View>
          <View style={s.tabs}>
            <AnimatedPressable
              style={[s.tab, { borderColor: activeTab === "favorites" ? colors.primary : colors.border, backgroundColor: activeTab === "favorites" ? colors.primary + "15" : "transparent" }]}
              onPress={() => setActiveTab("favorites")}
            >
              <Text style={[s.tabText, { color: activeTab === "favorites" ? colors.primary : colors.textMuted }]}>
                ⭐ Favorites
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[s.tab, { borderColor: activeTab === "recent" ? colors.primary : colors.border, backgroundColor: activeTab === "recent" ? colors.primary + "15" : "transparent" }]}
              onPress={() => setActiveTab("recent")}
            >
              <Text style={[s.tabText, { color: activeTab === "recent" ? colors.primary : colors.textMuted }]}>
                🕐 Recent
              </Text>
            </AnimatedPressable>
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
              title="Pull to refresh…"
              titleColor={colors.textSec}
            />
          }
        >
          {data.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="heart-outline" size={32} color={colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No {activeTab === "favorites" ? "Saved" : "Recent"} Places</Text>
              <Text style={s.emptyText}>
                {activeTab === "favorites" ? "Tap the ❤️ icon on any\nroom to save it here." : "Your recent navigation history\nwill appear here."}
              </Text>
            </View>
          ) : (
            data.map((loc, i) => (
              <Animated.View key={loc.journeyId || loc._id || loc.id || i} style={{
                opacity: itemAnims[i],
                transform: [
                  { translateX: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }
                ],
              }}>
                {activeTab === "recent" && loc.isJourney ? (
                  <View style={s.journeyCard}>
                    {/* Destination Header */}
                    <View style={s.journeyHeader}>
                      <View style={[s.journeyIcon, { backgroundColor: colors.primary + "18" }]}>
                        <Ionicons name="business" size={22} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.journeyTitle} numberOfLines={1}>
                          {loc.destination?.name || "Destination"}
                        </Text>
                        <Text style={s.journeyMeta}>
                          {loc.destination?.blockName ? `${loc.destination.blockName} • ` : ""}Floor {loc.destinationFloor ?? loc.destination?.floorId ?? 1}
                        </Text>
                      </View>
                      <AnimatedPressable
                        style={[s.actionBtn, { backgroundColor: colors.primary + "15" }]}
                        onPress={() => navigation.navigate("Navigation", { room: loc.destination, campusId: loc.campusId })}
                      >
                        <Ionicons name="navigate" size={18} color={colors.primary} />
                      </AnimatedPressable>
                    </View>

                    {/* Timing, Starting Point, and Distance/Duration */}
                    <View style={s.journeyDetailsBox}>
                      <View style={s.journeyDetailRow}>
                        <Ionicons name="time-outline" size={14} color={colors.textSec} />
                        <Text style={s.journeyDetailText}>{formatJourneyTime(loc.endTime || loc.startTime)}</Text>
                      </View>
                      <View style={s.journeyDetailRow}>
                        <Ionicons name="pin-outline" size={14} color={colors.textSec} />
                        <Text style={s.journeyDetailText}>
                          Started from <Text style={{ fontWeight: "700", color: colors.text }}>{loc.startPoint?.name || "Main Entrance"}</Text>
                        </Text>
                      </View>
                      <View style={s.journeyStatsRow}>
                        <View style={s.journeyStatItem}>
                          <Ionicons name="footsteps-outline" size={14} color={colors.primary} />
                          <Text style={s.journeyStatValue}>{loc.distance || 0} m</Text>
                        </View>
                        <Text style={{ color: colors.textMuted }}>•</Text>
                        <View style={s.journeyStatItem}>
                          <Ionicons name="hourglass-outline" size={14} color={colors.primary} />
                          <Text style={s.journeyStatValue}>{Math.max(1, Math.ceil((loc.duration || 60) / 60))} min</Text>
                        </View>
                      </View>
                    </View>

                    {/* TAKE ME BACK Action Button */}
                    <AnimatedPressable
                      style={s.takeMeBackBtn}
                      onPress={() => {
                        navigation.navigate("Navigation", {
                          retraceJourney: loc,
                          campusId: loc.campusId,
                        });
                      }}
                    >
                      <Ionicons name="return-up-back" size={18} color="#fff" />
                      <Text style={s.takeMeBackBtnText}>Take Me Back</Text>
                    </AnimatedPressable>
                  </View>
                ) : (
                  <AnimatedPressable
                    style={s.card}
                    onPress={() => navigation.navigate("Navigation", { room: loc, campusId: loc.campusId })}
                  >
                    <View style={[s.iconWrap, { backgroundColor: (ROOM_COLORS[loc.type] || colors.primary) + "20" }]}>
                      <Ionicons name="location" size={24} color={ROOM_COLORS[loc.type] || colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{loc.name}</Text>
                      <Text style={s.meta}>{loc.type ? loc.type.toUpperCase() : "ROOM"}</Text>
                    </View>
                    <View style={s.actions}>
                      <AnimatedPressable
                        style={[s.actionBtn, { backgroundColor: colors.primary + "15" }]}
                        onPress={() => navigation.navigate("Navigation", { room: loc, campusId: loc.campusId })}
                      >
                        <Ionicons name="navigate" size={18} color={colors.primary} />
                      </AnimatedPressable>
                      {activeTab === "favorites" && (
                        <AnimatedPressable
                          style={[s.actionBtn, { backgroundColor: colors.danger + "15" }]}
                          onPress={() => removeFavorite(loc._id)}
                        >
                          <Ionicons name="heart-dislike" size={18} color={colors.danger} />
                        </AnimatedPressable>
                      )}
                    </View>
                  </AnimatedPressable>
                )}
              </Animated.View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}
