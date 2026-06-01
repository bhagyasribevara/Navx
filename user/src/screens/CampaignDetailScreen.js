import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Image, RefreshControl, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { useGeofence } from "../context/GeofenceContext";
import { getSubCampaigns, SOCKET_URL } from "../api";

const { width: SW } = Dimensions.get("window");

export default function CampaignDetailScreen({ route, navigation }) {
  const { campaign } = route.params;
  const { colors, isDark } = useContext(ThemeContext);
  const { activeCampusId } = useGeofence();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSubs = useCallback(async () => {
    try {
      const data = await getSubCampaigns(campaign._id);
      setSubs(data);
    } catch (e) {
      console.warn("Failed to load sub-campaigns:", e);
    }
    setLoading(false);
  }, [campaign._id]);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSubs();
    setRefreshing(false);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { position: "relative" },
    headerImg: { width: "100%", height: 250, backgroundColor: colors.cardElevated },
    backBtn: {
      position: "absolute", top: Platform.OS === "ios" ? 50 : 20, left: 20,
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center", justifyContent: "center", zIndex: 10
    },
    headerContent: {
      padding: 24, paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.bg
    },
    badge: {
      alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 6, backgroundColor: colors.primary + "15",
      marginBottom: 10
    },
    badgeText: { fontSize: 11, fontWeight: "800", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },
    title: { fontSize: 24, fontWeight: "900", color: colors.text, marginBottom: 8 },
    desc: { fontSize: 14, color: colors.textSec, lineHeight: 22 },
    listTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginHorizontal: 24, marginTop: 24, marginBottom: 16 },
    subCard: {
      marginHorizontal: 24, marginBottom: 16,
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      overflow: "hidden"
    },
    subImg: { width: "100%", height: 120, backgroundColor: colors.cardElevated },
    subBody: { padding: 16 },
    subBadge: {
      alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 3,
      borderRadius: 4, backgroundColor: colors.secondary + "15",
      marginBottom: 6
    },
    subBadgeText: { fontSize: 10, fontWeight: "800", color: colors.secondary, textTransform: "uppercase", letterSpacing: 0.8 },
    subTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 },
    subDesc: { fontSize: 13, color: colors.textSec, marginBottom: 12, lineHeight: 18 },
    metaRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12, color: colors.textMuted },
    navBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10
    },
    navText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    emptyBox: { marginHorizontal: 24, padding: 32, backgroundColor: colors.card, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  });

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          {campaign.image && (
            <Image
              source={{ uri: campaign.image.startsWith("http") ? campaign.image : `${SOCKET_URL}${campaign.image}` }}
              style={s.headerImg} resizeMode="cover"
            />
          )}
        </View>
        <View style={s.headerContent}>
          {campaign.category && (
            <View style={s.badge}><Text style={s.badgeText}>{campaign.category}</Text></View>
          )}
          <Text style={s.title}>{campaign.title}</Text>
          {campaign.description && <Text style={s.desc}>{campaign.description}</Text>}
          
          {campaign.destination?.roomId && subs.length === 0 && (
            <TouchableOpacity 
              style={[s.navBtn, { marginTop: 16 }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate("Navigation", { 
                room: { _id: campaign.destination.roomId._id, floorId: campaign.destination.floorId?._id, name: campaign.destination.roomId.name }, 
                campusId: activeCampusId 
              })}
            >
              <Ionicons name="navigate" size={16} color="#fff" />
              <Text style={s.navText}>Navigate Here</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.listTitle}>Scheduled Events</Text>
        
        {loading && !refreshing ? (
          <View style={{ alignItems: "center", padding: 40 }}><Text style={{ color: colors.textSec }}>Loading events...</Text></View>
        ) : subs.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="calendar-outline" size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>No events found</Text>
            <Text style={{ fontSize: 13, color: colors.textSec, textAlign: "center", marginTop: 4 }}>Check back later for updates.</Text>
          </View>
        ) : (
          subs.map(sub => (
            <View key={sub._id} style={s.subCard}>
              {sub.image && (
                <Image
                  source={{ uri: sub.image.startsWith("http") ? sub.image : `${SOCKET_URL}${sub.image}` }}
                  style={s.subImg} resizeMode="cover"
                />
              )}
              <View style={s.subBody}>
                {sub.subCampaignType && (
                  <View style={s.subBadge}><Text style={s.subBadgeText}>{sub.subCampaignType}</Text></View>
                )}
                <Text style={s.subTitle}>{sub.title}</Text>
                {sub.description && <Text style={s.subDesc}>{sub.description}</Text>}
                
                <View style={s.metaRow}>
                  {sub.startDate && (
                    <View style={s.metaItem}>
                      <Ionicons name="calendar" size={12} color={colors.textMuted} />
                      <Text style={s.metaText}>{new Date(sub.startDate).toLocaleDateString()}</Text>
                    </View>
                  )}
                  {sub.destination?.roomId?.name && (
                    <View style={s.metaItem}>
                      <Ionicons name="location" size={12} color={colors.textMuted} />
                      <Text style={s.metaText}>{sub.destination.roomId.name}</Text>
                    </View>
                  )}
                </View>

                {sub.destination?.roomId && (
                  <TouchableOpacity 
                    style={s.navBtn}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate("Navigation", { 
                      room: { _id: sub.destination.roomId._id, floorId: sub.destination.floorId?._id, name: sub.destination.roomId.name }, 
                      campusId: activeCampusId 
                    })}
                  >
                    <Ionicons name="navigate" size={16} color="#fff" />
                    <Text style={s.navText}>Navigate to Event</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
