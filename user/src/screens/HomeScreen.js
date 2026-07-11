import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, TextInput, Animated,
  Platform, StatusBar, Image, RefreshControl, Share
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { ThemeContext } from "../context/ThemeContext";
import { useGeofence } from "../context/GeofenceContext";
import api, { getCampuses, cachedGet, downloadCampusOffline, getRoomsByCat, getCampaigns, SOCKET_URL, createMeetSession } from "../api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SHADOWS, RADIUS, QUICK_ACTIONS, ROOM_COLORS } from "../theme/designSystem";
import WeatherWidget from "../components/WeatherWidget";
import AnimatedPressable from "../components/AnimatedPressable";
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';



const { width: SW } = Dimensions.get("window");
const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? "Good Morning" : HOUR < 17 ? "Good Afternoon" : "Good Evening";

const VENUE_CATS = {
  campus: [
    { label: "Labs", icon: "flask", color: "#22c55e", filter: "lab" },
    { label: "Classes", icon: "school", color: "#3b82f6", filter: "classroom" },
    { label: "Offices", icon: "business", color: "#8b5cf6", filter: "office" },
    { label: "Cafeteria", icon: "restaurant", color: "#ef4444", filter: "cafeteria" },
    { label: "Library", icon: "library", color: "#06b6d4", filter: "library" },
    { label: "Restrooms", icon: "water", color: "#f59e0b", filter: "restroom" },
    { label: "Parking", icon: "car", color: "#64748b", filter: "parking" },
  ],
  hospital: [
    { label: "Wards", icon: "bed", color: "#3b82f6", filter: "ward" },
    { label: "ICU", icon: "pulse", color: "#ef4444", filter: "icu" },
    { label: "Emergency", icon: "alert-circle", color: "#dc2626", filter: "emergency" },
    { label: "Pharmacy", icon: "medkit", color: "#22c55e", filter: "pharmacy" },
    { label: "Reception", icon: "information-circle", color: "#8b5cf6", filter: "reception" },
    { label: "Radiology", icon: "scan", color: "#f59e0b", filter: "radiology" },
  ],
  airport: [
    { label: "Gates", icon: "airplane", color: "#3b82f6", filter: "gate" },
    { label: "Check-in", icon: "checkmark-circle", color: "#22c55e", filter: "check_in" },
    { label: "Lounge", icon: "cafe", color: "#8b5cf6", filter: "lounge" },
    { label: "Baggage", icon: "briefcase", color: "#f59e0b", filter: "baggage_claim" },
    { label: "Security", icon: "shield-checkmark", color: "#ef4444", filter: "security" },
    { label: "Duty Free", icon: "bag-handle", color: "#ec4899", filter: "duty_free" },
  ],
  mall: [
    { label: "Stores", icon: "storefront", color: "#3b82f6", filter: "store" },
    { label: "Food Court", icon: "fast-food", color: "#ef4444", filter: "food_court" },
    { label: "Entertain", icon: "game-controller", color: "#ec4899", filter: "entertainment" },
    { label: "ATM", icon: "card", color: "#22c55e", filter: "atm" },
    { label: "Parking", icon: "car", color: "#64748b", filter: "parking" },
    { label: "Restrooms", icon: "water", color: "#f59e0b", filter: "restroom" },
  ],
  building: [
    { label: "Offices", icon: "business", color: "#8b5cf6", filter: "office" },
    { label: "Conference", icon: "people", color: "#3b82f6", filter: "conference" },
    { label: "Lobby", icon: "home", color: "#6366f1", filter: "lobby" },
    { label: "Gym", icon: "fitness", color: "#22c55e", filter: "gym" },
    { label: "Cafeteria", icon: "restaurant", color: "#ef4444", filter: "cafeteria" },
    { label: "Restrooms", icon: "water", color: "#f59e0b", filter: "restroom" },
  ],
};

const VENUE_ICONS_MAP = { campus: 'school', hospital: 'medkit', airport: 'airplane', mall: 'cart', building: 'business' };

import { useAuth } from "../context/AuthContext";
import { useLiveMeet } from "../context/LiveMeetContext";

export default function HomeScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const { user } = useAuth();
  const { activeCampusId, deactivateCampus } = useGeofence();
  const { enterMeetSession, showMeetModal, setShowMeetModal } = useLiveMeet() || {};

  const [studentData, setStudentData] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  const fetchStudentDashboard = useCallback(async () => {
    if (user && !user.isGuest) {
      setLoadingStudent(true);
      try {
        const res = await api.get("/student/dashboard");
        if (res.data.success) {
          setStudentData(res.data);
        }
      } catch (e) {
        console.log("Failed to fetch student dashboard:", e);
      } finally {
        setLoadingStudent(false);
      }
    }
  }, [user]);

  const handleNavigateToRoom = async (roomName) => {
    if (!activeCampusId) {
      alert("You must be on campus to use navigation features.");
      return;
    }
    try {
      const res = await api.get(`/rooms?campusId=${activeCampusId}`);
      const rooms = res.data;
      const targetRoom = rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
      if (targetRoom) {
        navigation.navigate("Navigation", { room: targetRoom, campusId: activeCampusId });
      } else {
        alert(`Room ${roomName} not found on the campus map.`);
      }
    } catch (e) {
      alert("Failed to initiate navigation.");
    }
  };
  const [campuses, setCampuses] = useState([]);
  const [recentRooms, setRecentRooms] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingCampus, setDownloadingCampus] = useState(false);
  const [downloadedStatus, setDownloadedStatus] = useState({});
  const [meetDuration, setMeetDuration] = useState('30');
  const [creatingMeet, setCreatingMeet] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [joiningMeet, setJoiningMeet] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(QUICK_ACTIONS.map(() => new Animated.Value(0))).current;

  useFocusEffect(useCallback(() => {
    Animated.stagger(70, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 130, friction: 9 })
    )).start();
    // Load real recent rooms
    AsyncStorage.getItem("navx_recent").then(stored => {
      if (stored) setRecentRooms(JSON.parse(stored));
      else setRecentRooms([]);
    }).catch(() => { });
    return () => cardAnims.forEach(a => a.setValue(0));
  }, [activeCampusId]));

  const fetchData = useCallback(async (force = false) => {
    try {
      // If force refresh, bypass cache by calling API directly
      const campusData = force
        ? await getCampuses()
        : await cachedGet("campuses", getCampuses);
      setCampuses(campusData);
      // Also clear and refresh the campuses cache entry
      if (force) {
        try {
          await AsyncStorage.setItem(
            "campuses",
            JSON.stringify({ data: campusData, timestamp: Date.now() })
          );
        } catch {}
      }
    } catch (e) {
      console.log("Failed to fetch campuses:", e);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Force fresh campus data
      await fetchData(true);
      await fetchStudentDashboard();
      // Force fresh campaigns if campus is active
      if (activeCampusId) {
        try {
          const fresh = await getCampaigns(activeCampusId);
          setCampaigns(fresh || []);
        } catch (e) {
          console.log("Failed to refresh campaigns:", e);
        }
      }
      // Refresh recent rooms from AsyncStorage
      try {
        const stored = await AsyncStorage.getItem("navx_recent");
        setRecentRooms(stored ? JSON.parse(stored) : []);
      } catch {}
    } finally {
      setRefreshing(false);
    }
  }, [activeCampusId, fetchData, fetchStudentDashboard]);

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    fetchData(false)
      .then(() => fetchStudentDashboard())
      .finally(() => setLoading(false));
  }, [fetchStudentDashboard]);

  useEffect(() => {
    if (activeCampusId) {
      AsyncStorage.getItem(`navx_offline_${activeCampusId}`).then(res => {
        if (res) setDownloadedStatus(prev => ({ ...prev, [activeCampusId]: true }));
      }).catch(() => { });

      getCampaigns(activeCampusId)
        .then(d => setCampaigns(d || []))
        .catch(e => console.log('Failed to fetch campaigns', e));
    } else {
      setCampaigns([]);
    }
  }, [activeCampusId]);

  useEffect(() => {
    if (user?.isGuest && !activeCampusId) {
      console.log("Redirecting guest to QR Scan screen");
      navigation.navigate("QRScan");
    }
  }, [user?.isGuest, activeCampusId, navigation]);

  const [showNotifs, setShowNotifs] = useState(false);
  const { notifications, markNotifRead, hasUnread } = useLiveMeet() || { notifications: [], markNotifRead: () => {}, hasUnread: false };

    const s = StyleSheet.create({
      container: { flex: 1, backgroundColor: 'transparent' },
      header: {
        paddingTop: Platform.OS === 'ios' ? 8 : 22,
        paddingHorizontal: 20, paddingBottom: 8,
        backgroundColor: "transparent",
      },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    greetingText: { fontSize: 13, color: colors.textSec, fontWeight: "600" },
    appName: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
    appAccent: { color: colors.primary },
    avatar: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: colors.primary + "18",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: colors.primary + "35",
    },
    notifDot: {
      position: "absolute", top: 1, right: 1,
      width: 11, height: 11, borderRadius: 6,
      backgroundColor: "#ef4444",
      borderWidth: 2, borderColor: colors.card,
    },
    searchRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 99, paddingHorizontal: 16,
      borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.12)",
      ...SHADOWS.sm,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text, marginLeft: 8 },
    qrBtn: {
      width: 36, height: 36, borderRadius: RADIUS.sm,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    },
    section: { paddingHorizontal: 20, marginTop: 14 },
    secRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    secTitle: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
    seeAll: { fontSize: 13, fontWeight: "600", color: colors.primary },
    quickRow: { flexDirection: "row", justifyContent: "space-between" },
    quickCard: {
      width: (SW - 56) / 4, alignItems: "center",
      backgroundColor: colors.card, paddingVertical: 14, paddingHorizontal: 4,
      borderRadius: 18, borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.08)",
      ...SHADOWS.sm,
    },
    quickIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    quickLabel: { fontSize: 11, fontWeight: "700", color: colors.textSec, textAlign: "center" },
    banner: {
      marginHorizontal: 20, marginTop: 22, borderRadius: 20, overflow: "hidden",
      ...SHADOWS.lg,
    },
    bannerInner: { padding: 20 },
    bannerBadge: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 99,
      paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 10,
    },
    bannerBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff", marginLeft: 4, letterSpacing: 0.5 },
    bannerTitle: { fontSize: 21, fontWeight: "800", color: "#fff", marginBottom: 4 },
    bannerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 14 },
    bannerBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: "#fff", paddingHorizontal: 16,
      paddingVertical: 9, borderRadius: 99, alignSelf: "flex-start",
      ...SHADOWS.sm,
    },
    bannerBtnText: { fontSize: 13, fontWeight: "700", color: "#4f46e5", marginLeft: 6 },
    catChip: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card,
      paddingHorizontal: 14, paddingVertical: 9,
      borderRadius: 99, marginRight: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    catLabel: { fontSize: 13, fontWeight: "600", color: colors.textSec, marginLeft: 6 },
    recentCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card, borderRadius: 16,
      padding: 12, marginBottom: 10,
      borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.25)", ...SHADOWS.sm,
    },
    recentIcon: { width: 40, height: 40, borderRadius: 99, alignItems: "center", justifyContent: "center", marginRight: 12 },
    recentName: { fontSize: 15, fontWeight: "700", color: colors.text },
    recentMeta: { fontSize: 12, color: colors.textSec, marginTop: 2 },
    navBadge: {
      width: 36, height: 36, borderRadius: 99,
      backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center",
    },
    campusCard: {
      backgroundColor: colors.card, borderRadius: 20,
      overflow: "hidden", marginBottom: 12,
      borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.25)", ...SHADOWS.md,
    },
    campusBar: { height: 4 },
    campusBody: { padding: 16 },
    campusName: { fontSize: 17, fontWeight: "800", color: colors.text },
    campusDesc: { fontSize: 13, color: colors.textSec, marginTop: 4, lineHeight: 18 },
    campusAddr: { flexDirection: "row", alignItems: "center", marginTop: 8 },
    campusActions: { marginTop: 14 },
    mapBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.primary, paddingVertical: 12,
      borderRadius: 99, justifyContent: "center",
      ...SHADOWS.primary(),
    },
    arBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.primary + "18", paddingHorizontal: 14,
      paddingVertical: 11, borderRadius: 99,
      borderWidth: 1, borderColor: colors.primary + "35",
    },
    empty: { alignItems: "center", paddingVertical: 36 },
    emptyIcon: {
      width: 70, height: 70, borderRadius: 35,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 6 },
    emptyText: { fontSize: 13, color: colors.textSec, textAlign: "center", lineHeight: 20 },
    campaignCard: {
      width: 230, height: 240, backgroundColor: colors.card,
      borderRadius: RADIUS.md, marginRight: 14,
      borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.25)", ...SHADOWS.sm, overflow: 'hidden'
    },
    campaignImg: { width: '100%', height: 90 },
    campaignImgPlaceholder: { width: '100%', height: 90, alignItems: 'center', justifyContent: 'center' },
    campaignContent: { flex: 1, padding: 10, justifyContent: 'space-between' },
    campaignInfo: { flex: 1 },
    campaignTitle: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 2 },
    campaignDesc: { fontSize: 12, color: colors.textSec, lineHeight: 16, marginBottom: 4 },
    campaignBadge: {
      alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2,
      borderRadius: 4,
      marginBottom: 4
    },
    campaignBadgeText: { fontSize: 9, fontWeight: "800", color: colors.primary, textTransform: 'uppercase' },
    campaignNavBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary, paddingVertical: 7, borderRadius: RADIUS.xs,
    },
    campaignNavText: { color: '#fff', fontSize: 12, fontWeight: "700", marginLeft: 4 }
  });

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="navigate" size={30} color={colors.primary} />
          </View>
        </Animated.View>
        <Text style={{ color: colors.textSec, marginTop: 18, fontSize: 15, fontWeight: "600" }}>Loading NavX…</Text>
      </View>
    );
  }

  // ── QR Gate: Block entire app until user scans a valid campus QR ──
  // Wait until campuses are loaded if we have an active ID but it's not in the list yet
  const campusLoaded = campuses.length > 0;
  const isGuestOrNoCampus = !activeCampusId || (campusLoaded && !campuses.find(c => c._id === activeCampusId));
  if (isGuestOrNoCampus && user?.isGuest) {
    return (
      <ScrollView 
        style={s.container} 
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, paddingVertical: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pulsing NavX logo */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 28 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 32,
            backgroundColor: colors.primary + "20",
            alignItems: "center", justifyContent: "center",
            borderWidth: 2, borderColor: colors.primary + "35",
          }}>
            <Ionicons name="qr-code" size={48} color={colors.primary} />
          </View>
        </Animated.View>

        <Text style={{ fontSize: 26, fontWeight: "900", color: colors.text, marginBottom: 10, letterSpacing: -0.5 }}>
          Nav<Text style={{ color: colors.primary }}>X</Text>
        </Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 10, textAlign: "center" }}>
          Scan Entrance QR to Begin
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSec, textAlign: "center", lineHeight: 21, marginBottom: 36 }}>
          Walk up to the venue entrance and scan the NavX QR code to unlock the campus map, navigation, and all indoor services.
        </Text>

        {/* Steps */}
        {[
          { icon: "walk", step: "1", label: "Go to the venue entrance" },
          { icon: "qr-code-outline", step: "2", label: "Find the NavX QR code on the board" },
          { icon: "navigate", step: "3", label: "Scan to unlock campus navigation" },
        ].map(item => (
          <View key={item.step} style={{
            flexDirection: "row", alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: colors.border,
            marginBottom: 10, width: "100%",
          }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: colors.primary + "18",
              alignItems: "center", justifyContent: "center", marginRight: 14,
            }}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.primary, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>Step {item.step}</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{item.label}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={{
            marginTop: 12, backgroundColor: colors.primary,
            paddingHorizontal: 32, paddingVertical: 16,
            borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 10,
            width: "100%", justifyContent: "center",
            shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
          }}
          onPress={() => navigation.navigate("QRScan")}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Scan QR Code</Text>
        </TouchableOpacity>

        <Text style={{ marginTop: 18, fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
          🔒  Access is restricted to the physical venue only
        </Text>
      </ScrollView>
    );
  }

  const GRAD_BARS = [["#6366f1", "#4f46e5"], ["#22c55e", "#16a34a"], ["#3b82f6", "#2563eb"]];

  const handleCreateMeet = async () => {
    if (!activeCampusId) return;
    setCreatingMeet(true);
    try {
      // 1. Request location permissions first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert("Location permission is required to create a Live Meet session.");
        setCreatingMeet(false);
        return;
      }

      // 2. Robust location fetching with timeout and fallback
      let loc = null;
      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 8000
        });
      } catch (err) {
        console.log('[handleCreateMeet] getCurrentPositionAsync failed, trying last known position:', err);
        try {
          loc = await Location.getLastKnownPositionAsync({});
        } catch (err2) {
          console.log('[handleCreateMeet] getLastKnownPositionAsync failed:', err2);
        }
      }

      if (!loc || !loc.coords) {
        alert("Unable to retrieve your current location. Please ensure GPS/location services are enabled on your device.");
        setCreatingMeet(false);
        return;
      }
      
      // Get persistent device ID
      let deviceId = await AsyncStorage.getItem('navx_device_id');
      if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('navx_device_id', deviceId);
      }
      
      const res = await createMeetSession({
        campusId: activeCampusId,
        creatorDevice: deviceId,
        creatorName: user?.username || 'Host',
        creatorLocation: { lat: loc.coords.latitude, lng: loc.coords.longitude },
        durationMinutes: parseInt(meetDuration)
      });

      if (!res || !res.sessionId) {
        throw new Error("Invalid response received from server.");
      }

      const url = `navx://meet/${res.sessionId}`;
      
      if (enterMeetSession) {
        await enterMeetSession({
          ...res,
          campusId: activeCampusId,
          creatorDevice: deviceId,
          creatorName: user?.username || 'Host',
          creatorLocation: { lat: loc.coords.latitude, lng: loc.coords.longitude }
        }, 'creator');
      }

      await Share.share({
        message: url,
        url: url,
      });
      setShowMeetModal(false);
    } catch (e) {
      console.log('Error creating meet:', e);
      alert("Failed to create meet session: " + (e.message || "Unknown error"));
    } finally {
      setCreatingMeet(false);
    }
  };

  const handleJoinMeetLink = async () => {
    if (!inviteInput.trim()) return;
    setJoiningMeet(true);
    try {
      let sessionId = inviteInput.trim();
      
      // Parse out sessionId if full url is pasted
      if (sessionId.includes('meet/')) {
        const parts = sessionId.split('meet/');
        if (parts.length > 1) {
          sessionId = parts[1].split(/[?#]/)[0];
        }
      }
      
      if (!sessionId) {
        alert("Invalid invite link or code");
        return;
      }
      
      setShowMeetModal(false);
      setInviteInput('');
      navigation.navigate("LiveMeet", { sessionId });
    } catch (e) {
      console.log("Error joining meet:", e);
    } finally {
      setJoiningMeet(false);
    }
  };

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
      <ScrollView
        style={s.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
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
        {/* Header */}
        <Animated.View style={[s.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.greetingText}>{GREETING} 👋</Text>
              <Text style={s.appName}>Nav<Text style={s.appAccent}>X</Text></Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <WeatherWidget />
              <AnimatedPressable style={[s.avatar, { width: 42, height: 42 }]} onPress={() => setShowNotifs(true)}>
                <Ionicons name="notifications" size={20} color={colors.primary} />
                {hasUnread && <View style={s.notifDot} />}
              </AnimatedPressable>
              <AnimatedPressable style={[s.avatar, { width: 42, height: 42 }]} onPress={() => navigation.navigate("Settings")}>
                <Ionicons name="person" size={20} color={colors.primary} />
              </AnimatedPressable>
            </View>
          </View>
          <View style={s.searchRow}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search rooms, labs, blocks…"
              placeholderTextColor={colors.textMuted}
              onFocus={() => navigation.navigate("Search")}
            />
          </View>
        </Animated.View>

        {/* Student ERP Dashboard Section */}
        {user && !user.isGuest && studentData && (
          <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
            
            {/* Student Welcome / Profile Card */}
            <LinearGradient
              colors={['#4f46e5', '#312e81']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 18, borderRadius: 20, ...SHADOWS.md, marginBottom: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22 }}>🎓</Text>
                  </View>
                  <View>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{studentData.student?.username || user?.username}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                      Roll No: {studentData.student?.rollNumber} · {studentData.student?.department} Sem {studentData.student?.semester}
                    </Text>
                  </View>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{studentData.student?.academicStatus || 'Good Standing'}</Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 14 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' }}>OVERALL ATTENDANCE</Text>
                  <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '800', marginTop: 4 }}>{studentData.student?.attendancePercent}%</Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' }}>FEE STATUS</Text>
                  <Text style={{ color: studentData.student?.feeStatus?.includes('Pending') ? '#ef4444' : '#10b981', fontSize: 18, fontWeight: '800', marginTop: 4 }}>
                    {studentData.student?.feeStatus || 'Paid'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Next Class Widget */}
            {studentData.nextClass && (
              <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, ...SHADOWS.sm, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>Next Class</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.primary + '15' }}>
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>Period {studentData.nextClass.period}</Text>
                  </View>
                </View>
                
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 10 }}>{studentData.nextClass.subject}</Text>
                <Text style={{ color: colors.textSec, fontSize: 12, marginTop: 4 }}>
                  📍 Room {studentData.nextClass.roomName} · 🕰️ {studentData.nextClass.startTime} - {studentData.nextClass.endTime}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Faculty: {studentData.nextClass.facultyName}</Text>

                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                    marginTop: 14,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6
                  }}
                  onPress={() => handleNavigateToRoom(studentData.nextClass.roomName)}
                >
                  <Ionicons name="navigate-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Navigate →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Today's Timetable Widget */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 }}>Today's Timetable</Text>
              {studentData.todayTimetable && studentData.todayTimetable.length > 0 ? (
                studentData.todayTimetable.map((slot, idx) => (
                  <View
                    key={slot._id || idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.card,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      marginBottom: 8
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>P{slot.period}</Text>
                      </View>
                      <View>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{slot.subject}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{slot.startTime} · Room {slot.roomName}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => handleNavigateToRoom(slot.roomName)}
                    >
                      <Ionicons name="navigate" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.textSec, fontSize: 13 }}>No classes scheduled today.</Text>
              )}
            </View>

            {/* Announcements Section */}
            {studentData.announcements && studentData.announcements.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 }}>Announcements</Text>
                {studentData.announcements.map((ann, idx) => (
                  <View key={ann.id || idx} style={{ backgroundColor: colors.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>📢 {ann.title}</Text>
                    <Text style={{ color: colors.textSec, fontSize: 12, marginTop: 4, lineHeight: 18 }}>{ann.message}</Text>
                  </View>
                ))}
              </View>
            )}

          </View>
        )}

        {/* Quick Actions */}
        <View style={s.section}>
          <View style={s.secRow}>
            <Text style={s.secTitle}>Quick Actions</Text>
          </View>
          <View style={s.quickRow}>
            {QUICK_ACTIONS.map((a, i) => (
              <Animated.View key={i} style={{
                opacity: cardAnims[i],
                transform: [
                  { scale: cardAnims[i] },
                  { translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }
                ],
              }}>
                <AnimatedPressable 
                  style={[s.quickCard, { borderColor: a.color + '22', shadowColor: a.color }]} 
                  onPress={() => a.screen === 'MeetModal' ? setShowMeetModal(true) : navigation.navigate(a.screen)}
                >
                  <View style={[s.quickIcon, { backgroundColor: a.bg }]}>
                    <Ionicons name={a.icon} size={24} color={a.color} />
                  </View>
                  <Text style={s.quickLabel}>{a.label}</Text>
                </AnimatedPressable>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* 🔥 Active Updates */}
        {activeCampusId && campaigns.length > 0 && (
          <View style={s.section}>
            <View style={s.secRow}>
              <View>
                <Text style={s.secTitle}>Active Updates</Text>
                <Text style={{ fontSize: 13, color: colors.textSec, marginTop: 2 }}>Latest announcements, events, and services</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {campaigns.map(c => (
                <AnimatedPressable key={c._id} style={s.campaignCard} onPress={() => navigation.navigate('CampaignDetail', { campaign: c })}>
                  {c.image ? (
                    <Image source={{ uri: c.image.startsWith('http') ? c.image : `${SOCKET_URL}${c.image}` }} style={s.campaignImg} resizeMode="cover" />
                  ) : (
                    <LinearGradient
                      colors={[colors.primary + '35', colors.primary + '10']}
                      style={s.campaignImgPlaceholder}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="megaphone-outline" size={32} color={colors.primary} />
                    </LinearGradient>
                  )}
                  <View style={s.campaignContent}>
                    <View style={s.campaignInfo}>
                      <View style={[s.campaignBadge, { backgroundColor: c.category ? (colors.primary + "15") : "transparent" }]}>
                        <Text style={s.campaignBadgeText}>{c.category || "UPDATE"}</Text>
                      </View>
                      <Text style={s.campaignTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={s.campaignDesc} numberOfLines={2}>{c.description}</Text>
                    </View>
                    <AnimatedPressable 
                      style={s.campaignNavBtn}
                      onPress={() => navigation.navigate('CampaignDetail', { campaign: c })}
                    >
                      <Ionicons name="navigate" size={15} color="#fff" />
                      <Text style={s.campaignNavText}>Navigate Here</Text>
                    </AnimatedPressable>
                  </View>
                </AnimatedPressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Banner */}
        <AnimatedPressable style={s.banner} onPress={() => navigation.navigate("Map", { campusId: activeCampusId })}>
          <LinearGradient
            colors={[colors.secondary || '#d946ef', colors.primary || '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.bannerInner}
          >
            <View style={{ position: "absolute", right: 20, top: 10, opacity: 0.15 }}>
              <Ionicons name="map" size={90} color="#fff" />
            </View>
            <View style={s.bannerBadge}>
              <Ionicons name="flash" size={10} color="#fff" />
              <Text style={s.bannerBadgeText}>LIVE TRACKING</Text>
            </View>
            <Text style={s.bannerTitle}>Interactive Floor Map</Text>
            <Text style={s.bannerSub}>Explore with real-time indoor positioning</Text>
            <AnimatedPressable style={s.bannerBtn} onPress={() => navigation.navigate("Map", { campusId: activeCampusId })}>
              <Ionicons name="map" size={16} color={colors.secondary || "#8b5cf6"} />
              <Text style={s.bannerBtnText}>Open Map</Text>
            </AnimatedPressable>
          </LinearGradient>
        </AnimatedPressable>

        {/* Categories */}
        <View style={{ marginTop: 22 }}>
          <View style={[s.secRow, { paddingHorizontal: 20 }]}>
            <Text style={s.secTitle}>Browse by Category</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {(VENUE_CATS[campuses.find(c => c._id === activeCampusId)?.venueType] || VENUE_CATS.campus).map((c, i) => (
              <AnimatedPressable key={i} style={s.catChip} onPress={async () => {
                if (c.filter === 'parking' && activeCampusId) {
                  try {
                    const rooms = await getRoomsByCat(activeCampusId, 'parking');
                    if (rooms && rooms.length > 0) {
                      let closest = rooms[0];
                      const storedScan = await AsyncStorage.getItem('navx_last_scan');
                      if (storedScan) {
                        const pos = JSON.parse(storedScan);
                        let minD = Infinity;
                        rooms.forEach(r => {
                          let d = Math.hypot((r.shape?.x || 0) - pos.x, (r.shape?.y || 0) - pos.y);
                          if (r.floorId !== pos.floorId) d += 1000;
                          if (d < minD) { minD = d; closest = r; }
                        });
                      }
                      navigation.navigate("Navigation", { room: closest, campusId: closest.campusId || activeCampusId });
                      return;
                    }
                  } catch (e) { }
                }
                navigation.navigate("Search", { filter: c.filter });
              }}>
                <Ionicons name={c.icon} size={16} color={c.color} />
                <Text style={s.catLabel}>{c.label}</Text>
              </AnimatedPressable>
            ))}
          </ScrollView>
        </View>

        {/* Recently Visited */}
        {activeCampusId && recentRooms.length > 0 && (
          <View style={s.section}>
            <View style={s.secRow}>
              <Text style={s.secTitle}>Recently Visited</Text>
            </View>
            {recentRooms.map(rm => {
              const roomColor = ROOM_COLORS[rm.type] || colors.primary;
              return (
                <AnimatedPressable key={rm._id} style={s.recentCard} onPress={() => navigation.navigate("Navigation", { room: rm, campusId: rm.campusId })}>
                  <View style={[s.recentIcon, { backgroundColor: roomColor + "20" }]}>
                    <Ionicons name="location" size={22} color={roomColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentName}>{rm.name}</Text>
                    <Text style={s.recentMeta}>{(rm.type || "room").toUpperCase()}{rm.roomNumber ? ` · Room ${rm.roomNumber}` : ""}</Text>
                  </View>
                  <View style={s.navBadge}>
                    <Ionicons name="navigate" size={18} color={colors.primary} />
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        )}

        {/* Your Venue */}
        <View style={s.section}>
          <View style={s.secRow}>
            <Text style={s.secTitle}>Your Venue</Text>
            <Ionicons name={VENUE_ICONS_MAP[campuses.find(c => c._id === activeCampusId)?.venueType] || "business-outline"} size={18} color={colors.textMuted} />
          </View>
          {campuses.filter(c => c._id === activeCampusId).map((campus, i) => {
            const g = GRAD_BARS[i % GRAD_BARS.length];
            return (
              <AnimatedPressable key={campus._id} style={s.campusCard} onPress={() => navigation.navigate("Map", { campusId: campus._id, campusName: campus.name })}>
                <View style={[s.campusBar, { backgroundColor: colors.secondary || g[0] }]} />
                <View style={s.campusBody}>
                  <Text style={s.campusName}>{campus.name}</Text>
                  <Text style={s.campusDesc}>{campus.description || "Tap to explore campus map"}</Text>
                  {campus.address && (
                    <View style={s.campusAddr}>
                      <Ionicons name="location" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 4 }}>{campus.address}</Text>
                    </View>
                  )}
                  <View style={s.campusActions}>
                    <AnimatedPressable style={s.mapBtn} onPress={() => navigation.navigate("Map", { campusId: campus._id })}>
                      <Ionicons name="map" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, marginLeft: 6 }}>Explore Map</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        {activeCampusId && (
          <TouchableOpacity 
            style={{ marginHorizontal: 20, marginTop: 30, marginBottom: 10, padding: 14, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.danger, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => {
              if (deactivateCampus) deactivateCampus();
            }}
          >
            <Ionicons name="exit-outline" size={18} color={colors.danger} />
            <Text style={{ marginLeft: 8, color: colors.danger, fontWeight: '700', fontSize: 14 }}>Exit Campus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Notifications Panel ──────────────────────────────── */}
      {showNotifs && (
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 100 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={() => setShowNotifs(false)} />
          <Animated.View style={{ position: "absolute", top: Platform.OS === "ios" ? 100 : 70, right: 20, width: SW * 0.85, backgroundColor: colors.card, borderRadius: RADIUS.lg, ...SHADOWS.lg, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifs(false)}>
                <Ionicons name="close" size={20} color={colors.textSec} />
              </TouchableOpacity>
            </View>
            {notifications.map(n => (
              <TouchableOpacity 
                key={n.id} 
                onPress={() => {
                  markNotifRead(n.id);
                  if (n.type === 'live_meet' && n.sessionId) {
                    setShowNotifs(false);
                    navigation.navigate("LiveMeet", { sessionId: n.sessionId });
                  }
                }}
                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {n.unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" }} />}
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{n.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: "auto" }}>{n.time}</Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSec, lineHeight: 18 }}>{n.desc || n.message}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      )}

      {/* ── Live Meet Modal ──────────────────────────────── */}
      {showMeetModal && (
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={() => setShowMeetModal(false)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, ...SHADOWS.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Meet Someone</Text>
              <TouchableOpacity onPress={() => setShowMeetModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <Text style={{ fontSize: 14, color: colors.textSec, marginBottom: 20 }}>
              Share your live location. Your friend will be guided step-by-step to exactly where you are inside the campus.
            </Text>

            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Session Expiry (Minutes)</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {['15', '30', '60'].map(m => (
                <TouchableOpacity 
                  key={m} 
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: meetDuration === m ? colors.primary : colors.border, alignItems: 'center', backgroundColor: meetDuration === m ? colors.primary + '10' : colors.card }}
                  onPress={() => setMeetDuration(m)}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: meetDuration === m ? colors.primary : colors.textSec }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
              onPress={handleCreateMeet}
              disabled={creatingMeet}
            >
              {creatingMeet ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="share-social" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 }}>Create & Share Link</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 20 }} />

            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 }}>Been Invited?</Text>
            <Text style={{ fontSize: 13, color: colors.textSec, marginBottom: 12 }}>
              Paste the invite link or session ID below to join the live tracking.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bg,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: colors.border,
                paddingHorizontal: 12,
                height: 48,
              }}>
                <Ionicons name="link" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 8 }}
                  placeholder="Paste navx://meet/... or code"
                  placeholderTextColor={colors.textMuted}
                  value={inviteInput}
                  onChangeText={setInviteInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {inviteInput.length > 0 && (
                  <TouchableOpacity onPress={() => setInviteInput('')}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              
              <TouchableOpacity
                style={{
                  backgroundColor: inviteInput.trim() ? colors.primary : colors.border,
                  height: 48,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                disabled={!inviteInput.trim() || joiningMeet}
                onPress={handleJoinMeetLink}
              >
                {joiningMeet ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: inviteInput.trim() ? '#fff' : colors.textMuted, fontSize: 14, fontWeight: '800' }}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
