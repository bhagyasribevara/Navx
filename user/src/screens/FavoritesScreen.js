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
    
    // Fetch real recent history
    AsyncStorage.getItem("navx_recent").then(stored => {
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecents(parsed);
        Animated.stagger(60, parsed.map((_, i) =>
          Animated.spring(itemAnims[i], { toValue: 1, tension: 120, friction: 10, useNativeDriver: true })
        )).start();
      }
    });
  }, []);

  const loadRecents = async () => {
    const stored = await AsyncStorage.getItem("navx_recent").catch(() => null);
    if (stored) {
      const parsed = JSON.parse(stored);
      setRecents(parsed);
      Animated.stagger(60, parsed.map((_, i) =>
        Animated.spring(itemAnims[i], { toValue: 1, tension: 120, friction: 10, useNativeDriver: true })
      )).start();
    } else {
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
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingTop: 16,
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
    statLbl: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  });

  const data = activeTab === "favorites" ? favorites : recents;

  return (
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
            <Animated.View key={loc._id || loc.id || i} style={{
              opacity: itemAnims[i],
              transform: [
                { translateX: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }
              ],
            }}>
              <AnimatedPressable
                style={s.card}
                onPress={() => navigation.navigate("Navigation", { room: loc, campusId: loc.campusId })}
              >
                <View style={[s.iconWrap, { backgroundColor: (ROOM_COLORS[loc.type] || colors.primary) + "20" }]}>
                  <Ionicons name="location" size={24} color={ROOM_COLORS[loc.type] || colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{loc.name}</Text>
                  <Text style={s.meta}>{loc.type.toUpperCase()}</Text>
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
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
