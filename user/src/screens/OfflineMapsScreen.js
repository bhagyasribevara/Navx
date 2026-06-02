import React, { useState, useEffect, useContext } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeContext } from "../context/ThemeContext";
import { SHADOWS, RADIUS } from "../theme/designSystem";

export default function OfflineMapsScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [offlineCampuses, setOfflineCampuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOfflineMaps();
  }, []);

  const loadOfflineMaps = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(k => k.startsWith("navx_offline_"));
      
      const maps = [];
      for (const key of offlineKeys) {
        const dataStr = await AsyncStorage.getItem(key);
        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.campus) {
              maps.push({
                id: parsed.campus._id,
                name: parsed.campus.name,
                address: parsed.campus.address,
                size: (dataStr.length / 1024 / 1024).toFixed(2), // MB
                key
              });
            }
          } catch (e) {}
        }
      }
      setOfflineCampuses(maps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteOfflineMap = (campusId, key) => {
    Alert.alert(
      "Delete Offline Map",
      "Are you sure you want to remove this campus from your offline storage?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(key);
            setOfflineCampuses(prev => prev.filter(c => c.id !== campusId));
          }
        }
      ]
    );
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 20, paddingTop: 20,
      paddingBottom: 16, backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
      marginRight: 12
    },
    title: { fontSize: 20, fontWeight: "800", color: colors.text },
    list: { padding: 20 },
    card: {
      backgroundColor: colors.card, borderRadius: RADIUS.lg,
      padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: colors.border,
      ...SHADOWS.md
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    campusName: { fontSize: 18, fontWeight: "700", color: colors.text, flex: 1, marginRight: 10 },
    sizeBadge: {
      backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: RADIUS.sm,
    },
    sizeText: { fontSize: 12, fontWeight: "600", color: colors.textSec },
    metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    metaText: { fontSize: 13, color: colors.textMuted, marginLeft: 6 },
    actions: { flexDirection: "row", gap: 10 },
    openBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      backgroundColor: colors.primary, paddingVertical: 12, borderRadius: RADIUS.sm,
    },
    openText: { color: "#fff", fontWeight: "700", fontSize: 14, marginLeft: 6 },
    deleteBtn: {
      width: 46, height: 46, borderRadius: RADIUS.sm,
      backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "rgba(239,68,68,0.3)"
    },
    empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 20 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.textSec, textAlign: "center", lineHeight: 22 },
  });

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Offline Maps</Text>
      </View>

      <FlatList
        contentContainerStyle={s.list}
        data={offlineCampuses}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={loadOfflineMaps}
        ListEmptyComponent={() => !loading && (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="cloud-offline" size={36} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No Offline Maps</Text>
            <Text style={s.emptyText}>You haven't downloaded any campus maps yet. Connect to the internet and tap "Download" on a campus to save it for offline use.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.campusName}>{item.name}</Text>
              <View style={s.sizeBadge}>
                <Text style={s.sizeText}>{item.size} MB</Text>
              </View>
            </View>
            {item.address && (
              <View style={s.metaRow}>
                <Ionicons name="location" size={14} color={colors.textMuted} />
                <Text style={s.metaText}>{item.address}</Text>
              </View>
            )}
            <View style={s.actions}>
              <TouchableOpacity 
                style={s.openBtn}
                onPress={() => {
                  AsyncStorage.setItem('navx_active_campus', JSON.stringify({ id: item.id, name: item.name })).then(() => {
                    navigation.navigate("MainTabs", { screen: "Map", params: { campusId: item.id, offline: true } });
                  });
                }}
              >
                <Ionicons name="map" size={18} color="#fff" />
                <Text style={s.openText}>Open Map</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => deleteOfflineMap(item.id, item.key)}>
                <Ionicons name="trash" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
