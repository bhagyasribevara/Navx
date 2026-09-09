import React, { useEffect, useRef, useContext } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Platform, Image, ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useGeofence } from "../context/GeofenceContext";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";
import AnimatedPressable from "./AnimatedPressable";

const { width: SW, height: SH } = Dimensions.get("window");
const DRAWER_WIDTH = SW * 0.78;

export default function SideDrawer({ visible, onClose, recentRooms = [], navigation }) {
  const { colors } = useContext(ThemeContext);
  const { user } = useAuth();
  const { activeCampusId, activeCampus, deactivateCampus } = useGeofence();

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true,
          tension: 65, friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0, duration: 200, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const menuItems = [
    { icon: "heart-outline", label: "Favorites", color: "#ec4899", screen: "Favorites" },
    { icon: "cloud-download-outline", label: "Offline Maps", color: "#3b82f6", screen: "OfflineMaps" },
    { icon: "settings-outline", label: "Settings", color: "#64748b", screen: "Settings" },
  ];

  const s = StyleSheet.create({
    overlay: {
      position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 200,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)",
    },
    drawer: {
      position: "absolute", top: 0, bottom: 0, left: 0,
      width: DRAWER_WIDTH, backgroundColor: colors.card,
      borderTopRightRadius: 24, borderBottomRightRadius: 24,
      ...SHADOWS.lg,
      paddingTop: Platform.OS === "ios" ? 56 : 40,
    },
    profileSection: {
      paddingHorizontal: 20, paddingBottom: 20,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    profileRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    avatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: colors.primary + "18",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: colors.primary + "35",
      marginRight: 14, overflow: "hidden",
    },
    avatarImg: { width: "100%", height: "100%" },
    profileName: { fontSize: 17, fontWeight: "800", color: colors.text },
    profileRole: {
      fontSize: 11, fontWeight: "700", color: colors.primary,
      marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5,
    },
    closeBtn: {
      position: "absolute", top: Platform.OS === "ios" ? 56 : 40, right: 16,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.border + "60",
      alignItems: "center", justifyContent: "center",
    },
    sectionTitle: {
      fontSize: 11, fontWeight: "800", color: colors.textMuted,
      textTransform: "uppercase", letterSpacing: 1.2,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
    },
    menuItem: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 20, paddingVertical: 13,
    },
    menuIconBox: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center", marginRight: 14,
    },
    menuLabel: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
    recentCard: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 20, paddingVertical: 10,
    },
    recentIcon: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: "center", justifyContent: "center", marginRight: 12,
    },
    recentName: { fontSize: 13, fontWeight: "700", color: colors.text },
    recentMeta: { fontSize: 11, color: colors.textSec, marginTop: 1 },
    exitBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      marginHorizontal: 20, marginTop: 12, marginBottom: 30,
      paddingVertical: 13, borderRadius: 14,
      backgroundColor: colors.danger + "08",
      borderWidth: 1, borderColor: colors.danger + "30",
    },
    exitText: { marginLeft: 8, color: colors.danger, fontWeight: "700", fontSize: 14 },
    venueBadge: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.primary + "12",
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 8, alignSelf: "flex-start",
    },
    venueName: { fontSize: 12, fontWeight: "700", color: colors.primary, marginLeft: 5 },
  });

  return (
    <View style={s.overlay} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Drawer Panel */}
      <Animated.View style={[s.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Profile */}
          <View style={s.profileSection}>
            <View style={s.profileRow}>
              <View style={s.avatar}>
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={s.avatarImg} />
                ) : (
                  <Ionicons name="person" size={24} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.profileName} numberOfLines={1}>
                  {user?.fullName || user?.username || "NavX User"}
                </Text>
                <Text style={s.profileRole}>
                  {user?.isGuest ? "Guest" : user?.role === "student" ? "Student" : "User"}
                </Text>
              </View>
            </View>
            {activeCampus && (
              <View style={s.venueBadge}>
                <Ionicons name="location" size={13} color={colors.primary} />
                <Text style={s.venueName} numberOfLines={1}>{activeCampus.name || "Active Campus"}</Text>
              </View>
            )}
          </View>

          {/* Quick Links */}
          <Text style={s.sectionTitle}>Menu</Text>
          {menuItems.map((item, i) => (
            <AnimatedPressable
              key={i}
              style={s.menuItem}
              onPress={() => {
                onClose();
                setTimeout(() => navigation.navigate(item.screen), 150);
              }}
            >
              <View style={[s.menuIconBox, { backgroundColor: item.color + "15" }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </AnimatedPressable>
          ))}

          {/* Recent Visits */}
          {recentRooms.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Recent Visits</Text>
              {recentRooms.slice(0, 6).map(rm => {
                const roomColor = ROOM_COLORS[rm.type] || colors.primary;
                return (
                  <AnimatedPressable
                    key={rm._id}
                    style={s.recentCard}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        navigation.navigate("Navigation", {
                          room: rm,
                          campusId: rm.campusId || activeCampusId,
                        });
                      }, 150);
                    }}
                  >
                    <View style={[s.recentIcon, { backgroundColor: roomColor + "15" }]}>
                      <Ionicons name="location" size={16} color={roomColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.recentName} numberOfLines={1}>{rm.name}</Text>
                      <Text style={s.recentMeta}>
                        {(rm.type || "room").toUpperCase()}
                        {rm.roomNumber ? ` · Room ${rm.roomNumber}` : ""}
                      </Text>
                    </View>
                    <Ionicons name="navigate-outline" size={15} color={colors.textMuted} />
                  </AnimatedPressable>
                );
              })}
            </>
          )}

          {/* Exit Campus */}
          {activeCampusId && (
            <TouchableOpacity
              style={s.exitBtn}
              onPress={() => {
                if (deactivateCampus) deactivateCampus();
                if (navigation?.setParams) {
                  navigation.setParams({ campusId: undefined });
                }
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="exit-outline" size={18} color={colors.danger} />
              <Text style={s.exitText}>Exit Campus</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <TouchableOpacity style={[s.closeBtn, { zIndex: 10 }]} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color={colors.textSec} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
