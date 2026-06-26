import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Image, RefreshControl, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { useGeofence } from "../context/GeofenceContext";
import { getSubCampaigns, SOCKET_URL } from "../api";
import { SHADOWS, RADIUS } from "../theme/designSystem";
import AnimatedPressable from "../components/AnimatedPressable";

const { width: SW } = Dimensions.get("window");

export default function CampaignDetailScreen({ route, navigation }) {
  const { campaign } = route.params;
  const { colors } = useContext(ThemeContext);
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

  const venueName = campaign.destination?.roomId?.name;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // ── Back button ──
    backBtn: {
      position: "absolute", top: Platform.OS === "ios" ? 50 : 20, left: 20,
      width: 40, height: 40, borderRadius: 20, zIndex: 10,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center", justifyContent: "center",
    },

    // ── Hero image ──
    heroImg: { width: "100%", height: 260, backgroundColor: colors.border },
    heroPlaceholder: {
      width: "100%", height: 200, backgroundColor: colors.primary + "12",
      alignItems: "center", justifyContent: "center",
    },

    // ── Content card ──
    contentCard: {
      marginTop: -24, marginHorizontal: 16,
      backgroundColor: colors.card, borderRadius: RADIUS.xl,
      padding: 24, borderWidth: 1, borderColor: colors.border,
      ...SHADOWS.md,
    },
    badge: {
      alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 6, backgroundColor: colors.primary + "15",
      marginBottom: 12,
    },
    badgeText: {
      fontSize: 11, fontWeight: "800", color: colors.primary,
      textTransform: "uppercase", letterSpacing: 0.8,
    },
    title: { fontSize: 22, fontWeight: "900", color: colors.text, marginBottom: 10 },
    desc: { fontSize: 14, color: colors.textSec, lineHeight: 22, marginBottom: 0 },

    // ── Venue section ──
    venueSection: {
      marginHorizontal: 16, marginTop: 20,
      backgroundColor: colors.card, borderRadius: RADIUS.lg,
      padding: 16, borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", alignItems: "center",
      ...SHADOWS.sm,
    },
    venueIcon: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: colors.primary + "15",
      alignItems: "center", justifyContent: "center", marginRight: 14,
    },
    venueLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
    venueName: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 2 },

    // ── Navigate button ──
    navBtnWrap: { marginHorizontal: 16, marginTop: 20 },
    navBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      backgroundColor: colors.primary, paddingVertical: 16, borderRadius: RADIUS.md,
      ...SHADOWS.primary(colors.primary),
    },
    navText: { color: "#fff", fontSize: 16, fontWeight: "800", marginLeft: 8 },

    // ── Sub-campaigns / events ──
    eventsHeader: {
      fontSize: 18, fontWeight: "800", color: colors.text,
      marginHorizontal: 20, marginTop: 28, marginBottom: 14,
    },
    subCard: {
      marginHorizontal: 16, marginBottom: 14,
      backgroundColor: colors.card, borderRadius: RADIUS.lg,
      borderWidth: 1, borderColor: colors.border,
      overflow: "hidden", ...SHADOWS.sm,
    },
    subImg: { width: "100%", height: 120, backgroundColor: colors.border },
    subBody: { padding: 16 },
    subBadge: {
      alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 3,
      borderRadius: 4, backgroundColor: colors.secondary + "15",
      marginBottom: 6,
    },
    subBadgeText: {
      fontSize: 10, fontWeight: "800", color: colors.secondary,
      textTransform: "uppercase", letterSpacing: 0.8,
    },
    subTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 },
    subDesc: { fontSize: 13, color: colors.textSec, marginBottom: 12, lineHeight: 18 },
    metaRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12, color: colors.textMuted },
    subNavBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: colors.primary, paddingVertical: 12, borderRadius: RADIUS.sm,
    },
    subNavText: { color: "#fff", fontSize: 14, fontWeight: "800" },

    emptyBox: {
      marginHorizontal: 16, padding: 32, backgroundColor: colors.card,
      borderRadius: RADIUS.lg, alignItems: "center",
      borderWidth: 1, borderColor: colors.border,
    },
  });

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Hero Poster ── */}
        <View>
          <AnimatedPressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </AnimatedPressable>
          {campaign.image ? (
            <Image
              source={{ uri: campaign.image.startsWith("http") ? campaign.image : `${SOCKET_URL}${campaign.image}` }}
              style={s.heroImg} resizeMode="cover"
            />
          ) : (
            <View style={s.heroPlaceholder}>
              <Ionicons name="megaphone" size={48} color={colors.primary} />
            </View>
          )}
        </View>

        {/* ── Description Card ── */}
        <View style={s.contentCard}>
          {campaign.category && (
            <View style={s.badge}><Text style={s.badgeText}>{campaign.category}</Text></View>
          )}
          <Text style={s.title}>{campaign.title}</Text>
          {campaign.description && <Text style={s.desc}>{campaign.description}</Text>}
        </View>

        {/* ── Venue ── */}
        {venueName && (
          <View style={s.venueSection}>
            <View style={s.venueIcon}>
              <Ionicons name="location" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.venueLabel}>Venue</Text>
              <Text style={s.venueName}>{venueName}</Text>
            </View>
            <Ionicons name="navigate-circle" size={28} color={colors.primary} />
          </View>
        )}

        {/* ── Navigate Button ── */}
        {campaign.destination?.roomId && subs.length === 0 && (
          <View style={s.navBtnWrap}>
            <AnimatedPressable
              style={s.navBtn}
              onPress={() => navigation.navigate("Navigation", {
                room: { _id: campaign.destination.roomId._id, floorId: campaign.destination.floorId?._id, name: campaign.destination.roomId.name },
                campusId: activeCampusId
              })}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={s.navText}>Navigate Here</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* ── Scheduled Events (sub-campaigns) ── */}
        {(subs.length > 0 || loading) && (
          <Text style={s.eventsHeader}>Scheduled Events</Text>
        )}

        {loading && !refreshing ? (
          <View style={{ alignItems: "center", padding: 40 }}>
            <Text style={{ color: colors.textSec }}>Loading events...</Text>
          </View>
        ) : subs.length > 0 ? (
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
                  <AnimatedPressable
                    style={s.subNavBtn}
                    onPress={() => navigation.navigate("Navigation", {
                      room: { _id: sub.destination.roomId._id, floorId: sub.destination.floorId?._id, name: sub.destination.roomId.name },
                      campusId: activeCampusId
                    })}
                  >
                    <Ionicons name="navigate" size={16} color="#fff" />
                    <Text style={s.subNavText}>Navigate to Event</Text>
                  </AnimatedPressable>
                )}
              </View>
            </View>
          ))
        ) : null}
      </ScrollView>
    </View>
  );
}
