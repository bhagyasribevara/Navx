import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Dimensions, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLiveMeet } from "../context/LiveMeetContext";
import { useGeofence } from "../context/GeofenceContext";
import { SHADOWS, RADIUS } from "../theme/designSystem";
import api, { getCampaigns } from "../api";

const { width: SW } = Dimensions.get("window");

export default function NotificationsScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const { user } = useAuth();
  const { activeCampusId } = useGeofence();
  const { notifications, markNotifRead, hasUnread } = useLiveMeet() || {
    notifications: [], markNotifRead: () => {}, hasUnread: false,
  };

  const [studentData, setStudentData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const isStudent = user && !user.isGuest && user.role === "student";

  const fetchData = useCallback(async () => {
    try {
      if (isStudent) {
        const res = await api.get("/student/dashboard");
        if (res.data.success) setStudentData(res.data);
      }
      if (activeCampusId) {
        const c = await getCampaigns(activeCampusId);
        setCampaigns(c || []);
      }
    } catch (e) {
      console.log("NotificationsScreen fetch:", e);
    }
  }, [isStudent, activeCampusId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleNavigateToRoom = async (roomName) => {
    if (!activeCampusId) return;
    try {
      const res = await api.get(`/rooms?campusId=${activeCampusId}`);
      const rooms = res.data;
      const target = rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
      if (target) navigation.navigate("Navigation", { room: target, campusId: activeCampusId });
    } catch (e) { console.log("Nav failed:", e); }
  };

  const markAllRead = () => {
    notifications.forEach(n => { if (n.unread) markNotifRead(n.id); });
  };

  // ── Build items ──
  const items = [];

  if (isStudent && studentData?.nextClass) {
    items.push({
      id: "next_class", type: "class",
      icon: "school-outline", iconColor: colors.primary,
      title: studentData.nextClass.subject,
      body: `Room ${studentData.nextClass.roomName} · ${studentData.nextClass.startTime} – ${studentData.nextClass.endTime}\nFaculty: ${studentData.nextClass.facultyName}`,
      badge: `Period ${studentData.nextClass.period}`,
      unread: true, isToday: true,
      action: { label: "Navigate", onPress: () => handleNavigateToRoom(studentData.nextClass.roomName) },
    });
  }

  if (isStudent && studentData?.announcements) {
    studentData.announcements.forEach((a, i) => {
      items.push({
        id: `ann_${a.id || i}`, type: "announcement",
        icon: "megaphone-outline", iconColor: "#f59e0b",
        title: a.title, body: a.message,
        badge: a.date || "Recent", unread: true, isToday: true,
      });
    });
  }

  campaigns.forEach(c => {
    items.push({
      id: `camp_${c._id}`, type: "update",
      icon: "flash-outline", iconColor: "#22c55e",
      title: c.title, body: c.description,
      badge: c.category || "Update", unread: false, isToday: false,
      onPress: () => navigation.navigate("CampaignDetail", { campaign: c }),
    });
  });

  notifications.forEach(n => {
    items.push({
      id: n.id, type: "system",
      icon: n.type === "live_meet" ? "people-outline" : "notifications-outline",
      iconColor: n.type === "live_meet" ? "#ec4899" : colors.primary,
      title: n.title, body: n.desc || n.message,
      badge: n.time, unread: n.unread, isToday: true,
      onPress: () => {
        markNotifRead(n.id);
        if (n.type === "live_meet" && n.sessionId)
          navigation.navigate("LiveMeet", { sessionId: n.sessionId });
      },
    });
  });

  const todayItems = items.filter(i => i.isToday);
  const earlierItems = items.filter(i => !i.isToday);
  const unreadCount = items.filter(i => i.unread).length;

  // ── Styles ──
  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingTop: Platform.OS === "ios" ? 56 : 44,
      paddingHorizontal: 20, paddingBottom: 14,
      backgroundColor: colors.bg,
    },
    backBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border, ...SHADOWS.sm,
    },
    headerTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
    markBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary + "10" },
    markText: { fontSize: 12, fontWeight: "700", color: colors.primary },
    sectionLabel: {
      fontSize: 12, fontWeight: "800", color: colors.textMuted,
      textTransform: "uppercase", letterSpacing: 1,
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
    },
    row: {
      flexDirection: "row", alignItems: "flex-start",
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    rowUnread: { backgroundColor: colors.primary + "05" },
    iconWrap: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: "center", justifyContent: "center", marginRight: 14, marginTop: 2,
    },
    content: { flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ef4444", marginRight: 6 },
    title: { fontSize: 14, fontWeight: "700", color: colors.text, flex: 1 },
    badge: { fontSize: 11, color: colors.textMuted, marginLeft: 8 },
    body: { fontSize: 13, color: colors.textSec, lineHeight: 19 },
    actionBtn: {
      flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
      backgroundColor: colors.primary, borderRadius: 8,
      paddingVertical: 7, paddingHorizontal: 14, marginTop: 10, gap: 5,
    },
    actionText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    empty: { alignItems: "center", paddingTop: 80 },
    emptyCircle: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: colors.primary + "10",
      alignItems: "center", justifyContent: "center", marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 },
    emptyDesc: { fontSize: 13, color: colors.textSec, textAlign: "center", maxWidth: 240, lineHeight: 20 },
  });

  const renderItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={[s.row, item.unread && s.rowUnread]}
      activeOpacity={0.6}
      onPress={item.onPress}
    >
      <View style={[s.iconWrap, { backgroundColor: item.iconColor + "12" }]}>
        <Ionicons name={item.icon} size={19} color={item.iconColor} />
      </View>
      <View style={s.content}>
        <View style={s.titleRow}>
          {item.unread && <View style={s.dot} />}
          <Text style={s.title} numberOfLines={1}>{item.title}</Text>
          <Text style={s.badge}>{item.badge}</Text>
        </View>
        <Text style={s.body} numberOfLines={3}>{item.body}</Text>
        {item.action && (
          <TouchableOpacity style={s.actionBtn} onPress={item.action.onPress} activeOpacity={0.8}>
            <Ionicons name="navigate-outline" size={13} color="#fff" />
            <Text style={s.actionText}>{item.action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                {unreadCount} unread
              </Text>
            )}
          </View>
        </View>
        {hasUnread && (
          <TouchableOpacity style={s.markBtn} onPress={markAllRead}>
            <Text style={s.markText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {items.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyCircle}>
              <Ionicons name="checkmark-done" size={28} color={colors.primary} />
            </View>
            <Text style={s.emptyTitle}>All caught up!</Text>
            <Text style={s.emptyDesc}>You have no new notifications right now.</Text>
          </View>
        ) : (
          <>
            {todayItems.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Today</Text>
                {todayItems.map(renderItem)}
              </>
            )}
            {earlierItems.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Earlier</Text>
                {earlierItems.map(renderItem)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
