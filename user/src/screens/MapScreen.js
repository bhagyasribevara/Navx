import React, { useState, useEffect, useContext } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { getMapData, getCampuses } from "../api";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";

export default function MapScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [campusId, setCampusId] = useState(route.params?.campusId || null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);

  useEffect(() => {
    if (route.params?.campusId) {
      setCampusId(route.params.campusId);
      setSelectedBlock(null);
      setSelectedFloor(null);
    } else if (!campusId) {
      getCampuses().then(data => {
        if (data.length) setCampusId(data[0]._id);
        else setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [route.params?.campusId]);

  useEffect(() => {
    if (campusId) {
      setLoading(true);
      getMapData(campusId).then(data => {
        setMapData(data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [campusId]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingTop: 16,
      paddingHorizontal: 20, paddingBottom: 20,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      flexDirection: "row", alignItems: "center"
    },
    title: { fontSize: 20, fontWeight: "800", color: colors.text, marginLeft: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    list: { padding: 20 },
    card: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.card, padding: 16, borderRadius: RADIUS.md,
      marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...SHADOWS.sm
    },
    cardIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginRight: 14 },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    cardMeta: { fontSize: 13, color: colors.textSec, marginTop: 4 },
    navBadge: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm },
    navBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700", marginLeft: 6 }
  });

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSec, marginTop: 12, fontSize: 14 }}>Loading directory…</Text>
      </View>
    );
  }

  const handleBack = () => {
    if (selectedFloor) setSelectedFloor(null);
    else if (selectedBlock) setSelectedBlock(null);
    // At root block level in a tab — don't navigate away
  };

  const renderContent = () => {
    if (selectedFloor) {
      const rooms = mapData?.rooms?.filter(r => r.floorId === selectedFloor._id) || [];
      if (rooms.length === 0) return <Text style={{ textAlign: "center", color: colors.textSec, marginTop: 40 }}>No rooms found on this floor.</Text>;
      
      return rooms.map(room => (
        <TouchableOpacity key={room._id} style={s.card} activeOpacity={0.7} 
          onPress={() => navigation.navigate("Navigation", { room, campusId, mapData })}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View style={[s.cardIcon, { backgroundColor: (ROOM_COLORS[room.type] || colors.primary) + "20" }]}>
              <Ionicons name="location" size={20} color={ROOM_COLORS[room.type] || colors.primary} />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={s.cardTitle}>{room.name}</Text>
              <Text style={s.cardMeta}>{room.type.toUpperCase()}{room.roomNumber ? ` · Room ${room.roomNumber}` : ""}</Text>
            </View>
          </View>
          <View style={s.navBadge}>
            <Ionicons name="navigate" size={14} color="#fff" />
            <Text style={s.navBadgeText}>Go</Text>
          </View>
        </TouchableOpacity>
      ));
    }

    if (selectedBlock) {
      const floors = mapData?.floors?.filter(f => f.blockId === selectedBlock._id) || [];
      if (floors.length === 0) return <Text style={{ textAlign: "center", color: colors.textSec, marginTop: 40 }}>No floors found in this block.</Text>;
      
      return floors.map(floor => (
        <TouchableOpacity key={floor._id} style={s.card} activeOpacity={0.7} onPress={() => setSelectedFloor(floor)}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={s.cardIcon}>
              <Ionicons name="layers" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={s.cardTitle}>{floor.name}</Text>
              <Text style={s.cardMeta}>Select to view rooms</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ));
    }

    const blocks = mapData?.blocks || [];
    if (blocks.length === 0) return <Text style={{ textAlign: "center", color: colors.textSec, marginTop: 40 }}>No blocks found.</Text>;
    
    const domains = {};
    blocks.forEach(block => {
      const domain = block.domain || "Academic Blocks";
      if (!domains[domain]) domains[domain] = [];
      domains[domain].push(block);
    });

    return Object.keys(domains).map(domain => (
      <View key={domain} style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textSec, marginBottom: 12, marginLeft: 4, textTransform: "uppercase", letterSpacing: 1 }}>
          {domain}
        </Text>
        {domains[domain].map(block => (
          <TouchableOpacity key={block._id} style={s.card} activeOpacity={0.7} onPress={() => setSelectedBlock(block)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={s.cardIcon}>
                <Ionicons name="business" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={s.cardTitle}>{block.name}</Text>
                <Text style={s.cardMeta}>Tap to browse floors</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    ));
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        {(selectedBlock || selectedFloor) ? (
          <TouchableOpacity style={s.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={s.title}>
          {selectedFloor ? selectedFloor.name : selectedBlock ? selectedBlock.name : "Campus Directory"}
        </Text>
      </View>
      <ScrollView contentContainerStyle={s.list}>
        {renderContent()}
      </ScrollView>
    </View>
  );
}
