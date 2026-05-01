import React, { useState, useContext, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";

const MOCK_FAVORITES = [
  { id: "f1", name: "Computer Lab 3", type: "lab", floor: "Floor 2", block: "Block A", icon: "flask", color: "#22c55e" },
  { id: "f2", name: "Main Library", type: "library", floor: "Floor 1", block: "Block B", icon: "library", color: "#06b6d4" },
  { id: "f3", name: "Principal Office", type: "office", floor: "Floor 3", block: "Block C", icon: "business", color: "#8b5cf6" },
  { id: "f4", name: "Canteen", type: "cafeteria", floor: "Ground Floor", block: "Block D", icon: "restaurant", color: "#ef4444" },
  { id: "f5", name: "Seminar Hall", type: "auditorium", floor: "Floor 2", block: "Block A", icon: "megaphone", color: "#ec4899" },
];

const MOCK_RECENTS = [
  { id: "r1", name: "CS301 Classroom", type: "classroom", floor: "Floor 3", block: "Block B", icon: "school", color: "#3b82f6" },
  { id: "r2", name: "Boys Restroom", type: "restroom", floor: "Floor 1", block: "Block A", icon: "water", color: "#f59e0b" },
  { id: "r3", name: "Elevator B", type: "elevator", floor: "Floor 2", block: "Block B", icon: "arrow-up", color: "#6366f1" },
];

export default function FavoritesScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [favorites, setFavorites] = useState(MOCK_FAVORITES);
  const [activeTab, setActiveTab] = useState("favorites");
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef([...MOCK_FAVORITES, ...MOCK_RECENTS].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.stagger(60, itemAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true })
    )).start();
  }, []);

  const removeFavorite = (id) => {
    Alert.alert("Remove Favorite", "Remove this location from favorites?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setFavorites(f => f.filter(x => x._id !== id)) },
    ]);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingTop: Platform.OS === "ios" ? 56 : 16,
      paddingHorizontal: 20, paddingBottom: 20,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
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
      backgroundColor: colors.card, borderRadius: RADIUS.lg,
      padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", alignItems: "center",
      ...SHADOWS.sm,
    },
    iconWrap: {
      width: 50, height: 50, borderRadius: 16,
      alignItems: "center", justifyContent: "center", marginRight: 14,
    },
    name: { fontSize: 15, fontWeight: "700", color: colors.text },
    meta: { fontSize: 12, color: colors.textSec, marginTop: 3 },
    actions: { flexDirection: "row", gap: 6, marginLeft: 8 },
    actionBtn: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
    },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 16,
    },
    emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.textSec, textAlign: "center", lineHeight: 20 },
    statsRow: {
      flexDirection: "row", gap: 10, marginHorizontal: 20, marginTop: 16, marginBottom: 4,
    },
    statCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: RADIUS.md,
      padding: 14, alignItems: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    statVal: { fontSize: 22, fontWeight: "800", color: colors.primary },
    statLbl: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  });

  const data = activeTab === "favorites" ? favorites : MOCK_RECENTS;

  return (
    <View style={s.container}>
      <Animated.View style={[s.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
        <View style={s.headerRow}>
          <TouchableOpacity style={{ marginRight: 14 }} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.title}>Saved Places</Text>
          <TouchableOpacity style={s.addBtn}>
            <Ionicons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, { borderColor: activeTab === "favorites" ? colors.primary : colors.border, backgroundColor: activeTab === "favorites" ? colors.primary + "15" : "transparent" }]}
            onPress={() => setActiveTab("favorites")}
          >
            <Text style={[s.tabText, { color: activeTab === "favorites" ? colors.primary : colors.textMuted }]}>
              ⭐ Favorites
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, { borderColor: activeTab === "recent" ? colors.primary : colors.border, backgroundColor: activeTab === "recent" ? colors.primary + "15" : "transparent" }]}
            onPress={() => setActiveTab("recent")}
          >
            <Text style={[s.tabText, { color: activeTab === "recent" ? colors.primary : colors.textMuted }]}>
              🕐 Recent
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statVal}>{favorites.length}</Text>
          <Text style={s.statLbl}>Saved Places</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statVal}>{MOCK_RECENTS.length}</Text>
          <Text style={s.statLbl}>Recent Visits</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: colors.accent }]}>5</Text>
          <Text style={s.statLbl}>This Week</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
        {data.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="heart-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No Saved Places</Text>
            <Text style={s.emptyText}>Tap the ❤️ icon on any{"\n"}room to save it here.</Text>
          </View>
        ) : (
          data.map((loc, i) => (
            <Animated.View key={loc.id} style={{
              opacity: itemAnims[i],
              transform: [
                { translateX: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }
              ],
            }}>
              <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate("Map")}
                activeOpacity={0.85}
              >
                <View style={[s.iconWrap, { backgroundColor: loc.color + "20" }]}>
                  <Ionicons name={loc.icon} size={24} color={loc.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{loc.name}</Text>
                  <Text style={s.meta}>{loc.floor} · {loc.block}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: loc.color + "18" }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: loc.color }}>
                        {loc.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.primary + "15" }]}
                    onPress={() => navigation.navigate("Map")}
                  >
                    <Ionicons name="navigate" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  {activeTab === "favorites" && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.danger + "15" }]}
                      onPress={() => removeFavorite(loc.id)}
                    >
                      <Ionicons name="heart-dislike" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
