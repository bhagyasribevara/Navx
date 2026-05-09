import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Animated, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { searchRooms, getRoomsByCat, getCampuses, cachedGet } from "../api";
import { SHADOWS, RADIUS, ROOM_COLORS, ROOM_ICONS } from "../theme/designSystem";

const CATS = [
  { label: "All", filter: null, icon: "apps" },
  { label: "Labs", filter: "lab", icon: "flask" },
  { label: "Classes", filter: "classroom", icon: "school" },
  { label: "Offices", filter: "office", icon: "business" },
  { label: "Cafeteria", filter: "cafeteria", icon: "restaurant" },
  { label: "Library", filter: "library", icon: "library" },
  { label: "Restrooms", filter: "restroom", icon: "water" },
];

const SUGGESTED = [
  "Computer Lab", "Library", "Principal Office", "Canteen", "Auditorium", "Seminar Hall",
];

import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SearchScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [campusId, setCampusId] = useState(route.params?.campusId || null);
  const [activeCat, setActiveCat] = useState(route.params?.filter || null);
  const inputRef = useRef(null);
  const listAnim = useRef(new Animated.Value(0)).current;
  const searchFocusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!campusId) {
      AsyncStorage.getItem("navx_active_campus").then(stored => {
        if (stored) {
          const parsed = JSON.parse(stored);
          setCampusId(parsed.id);
        } else {
          // Fallback if no active campus
          cachedGet("campuses", getCampuses).then(data => {
            if (data.length) setCampusId(data[0]._id);
          });
        }
      });
    }
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  useEffect(() => {
    if (!campusId) return;

    if (query.length >= 2) {
      const timer = setTimeout(() => {
        searchRooms(query, campusId).then(data => {
          const filtered = activeCat ? data.filter(r => r.type === activeCat) : data;
          setResults(filtered);
          Animated.spring(listAnim, { toValue: 1, tension: 100, friction: 12, useNativeDriver: true }).start();
        }).catch(() => setResults([]));
      }, 280);
      return () => clearTimeout(timer);
    } else if (activeCat) {
      getRoomsByCat(campusId, activeCat).then(data => {
        setResults(data);
        Animated.spring(listAnim, { toValue: 1, tension: 100, friction: 12, useNativeDriver: true }).start();
      }).catch(() => setResults([]));
    } else {
      setResults([]);
      listAnim.setValue(0);
    }
  }, [query, campusId, activeCat]);

  const handleFocus = (focused) => {
    Animated.spring(searchFocusAnim, { toValue: focused ? 1 : 0, tension: 200, friction: 10, useNativeDriver: false }).start();
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingTop: 16,
      paddingHorizontal: 16, paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    backBtn: {
      width: 40, height: 40, borderRadius: RADIUS.sm,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginRight: 12,
    },
    searchBar: {
      flex: 1, flexDirection: "row", alignItems: "center",
      backgroundColor: colors.surface, borderRadius: RADIUS.md,
      paddingHorizontal: 12, borderWidth: 1.5,
      borderColor: searchFocusAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] }),
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text, marginLeft: 8 },
    catRow: { flexDirection: "row" },
    catChip: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 99, marginRight: 8,
      borderWidth: 1.5,
    },
    catLabel: { fontSize: 13, fontWeight: "600", marginLeft: 5 },
    sectionTitle: {
      fontSize: 12, fontWeight: "700", color: colors.textMuted,
      textTransform: "uppercase", letterSpacing: 1.2,
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
    },
    resultItem: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    iconWrap: {
      width: 44, height: 44, borderRadius: RADIUS.sm,
      alignItems: "center", justifyContent: "center", marginRight: 14,
    },
    roomName: { fontSize: 15, fontWeight: "700", color: colors.text },
    roomMeta: { fontSize: 12, color: colors.textSec, marginTop: 2 },
    navChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
      backgroundColor: colors.primary + "15",
      borderWidth: 1, borderColor: colors.primary + "30",
    },
    suggestWrap: { paddingHorizontal: 20, flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 },
    suggestChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    suggestText: { fontSize: 13, color: colors.textSec, fontWeight: "600" },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyIcon: {
      width: 70, height: 70, borderRadius: 35,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 16,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    emptyText: { fontSize: 13, color: colors.textSec, marginTop: 6, textAlign: "center" },
  });

  const renderItem = ({ item, index }) => {
    const color = ROOM_COLORS[item.type] || colors.primary;
    return (
      <Animated.View style={{ opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <TouchableOpacity
          style={s.resultItem}
          onPress={() => navigation.navigate("Navigation", { room: item, campusId })}
          activeOpacity={0.8}
        >
          <View style={[s.iconWrap, { backgroundColor: color + "18" }]}>
            <Ionicons name={ROOM_ICONS[item.type] || "location"} size={22} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.roomName}>{item.name}</Text>
            <Text style={s.roomMeta}>
              {item.type}{item.roomNumber ? ` · #${item.roomNumber}` : ""}
              {item.blockId?.name ? ` · ${item.blockId.name}` : ""}
              {item.floorId?.name ? ` · ${item.floorId.name}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={s.navChip}
            onPress={() => navigation.navigate("Navigation", { room: item, campusId })}
          >
            <Ionicons name="navigate" size={16} color={colors.primary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Animated.View style={[s.searchBar]}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={s.searchInput}
              placeholder="Search rooms, labs, blocks…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onFocus={() => handleFocus(true)}
              onBlur={() => handleFocus(false)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catRow}>
          {CATS.map((c, i) => {
            const isActive = activeCat === c.filter;
            const color = isActive ? colors.primary : colors.textMuted;
            return (
              <TouchableOpacity
                key={i}
                style={[s.catChip, { borderColor: isActive ? colors.primary : colors.border, backgroundColor: isActive ? colors.primary + "15" : "transparent" }]}
                onPress={() => setActiveCat(isActive ? null : c.filter)}
              >
                <Ionicons name={c.icon} size={14} color={color} />
                <Text style={[s.catLabel, { color }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {results.length > 0 ? (
        <>
          <Text style={s.sectionTitle}>Results ({results.length})</Text>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={item => item._id}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : query.length >= 2 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Ionicons name="search-outline" size={30} color={colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>No Results Found</Text>
          <Text style={s.emptyText}>Admin will upload soon</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={s.sectionTitle}>Popular Searches</Text>
          <View style={s.suggestWrap}>
            {SUGGESTED.map((s2, i) => (
              <TouchableOpacity key={i} style={s.suggestChip} onPress={() => setQuery(s2)}>
                <Text style={s.suggestText}>{s2}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.sectionTitle}>Browse Categories</Text>
          {CATS.filter(c => c.filter).map((c, i) => (
            <TouchableOpacity
              key={i}
              style={[s.resultItem]}
              onPress={() => setActiveCat(c.filter)}
            >
              <View style={[s.iconWrap, { backgroundColor: (ROOM_COLORS[c.filter] || colors.primary) + "18" }]}>
                <Ionicons name={c.icon} size={22} color={ROOM_COLORS[c.filter] || colors.primary} />
              </View>
              <Text style={s.roomName}>{c.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
