import React, { useState, useContext, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform, ActivityIndicator, Image, ScrollView
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { ThemeContext } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGeofence } from "../context/GeofenceContext";
import { scanQRCode, verifyCampusGeofence } from "../api";
import { SHADOWS, RADIUS } from "../theme/designSystem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AnimatedPressable from "../components/AnimatedPressable";
import { LinearGradient } from "expo-linear-gradient";

const { width: SW, height: SH } = Dimensions.get("window");
const FRAME = 230;

// Fallback high-quality campus image matching the mockup reference image
const FALLBACK_CAMPUS_IMAGE = "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=600&auto=format&fit=crop";

export default function QRScanScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { activateCampus } = useGeofence();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isCampusQR, setIsCampusQR] = useState(false);
  const [geofenceDenied, setGeofenceDenied] = useState(null);

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const frameAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loopAnimRef = useRef(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    animateScanLine();
    return () => {
      if (loopAnimRef.current) loopAnimRef.current.stop();
    };
  }, []);

  const animateScanLine = () => {
    scanLineAnim.setValue(0);
    loopAnimRef.current = Animated.loop(
      Animated.timing(scanLineAnim, { toValue: 1, duration: 2200, useNativeDriver: false })
    );
    loopAnimRef.current.start();
  };

  const handleScan = async ({ data }) => {
    if (scanned || !scanning) return;
    setScanned(true);
    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.timing(frameAnim, { toValue: 1.06, duration: 150, useNativeDriver: true }),
      Animated.timing(frameAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    Animated.spring(successAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();

    try {
      const trimmedData = data.trim();
      const lowerData = trimmedData.toLowerCase();
      if (lowerData.startsWith("navx://campus/")) {
        const prefixLength = "navx://campus/".length;
        const campusId = trimmedData.substring(prefixLength).trim();

        let userLat = null, userLng = null;
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setError("Location permission is required to verify campus access.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
          }
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeout: 10000,
          });
          userLat = loc.coords.latitude;
          userLng = loc.coords.longitude;
        } catch (locErr) {
          setError("Unable to determine your location. Please enable GPS.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        const verifyResult = await verifyCampusGeofence(campusId, userLat, userLng);
        if (verifyResult.authorized) {
          setResult(verifyResult.campus);
          setIsCampusQR(true);
          setGeofenceDenied(null);
          setError(null);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setGeofenceDenied({
            distance: verifyResult.distance,
            radius: verifyResult.radius,
            campusName: verifyResult.campusName,
            message: verifyResult.message,
          });
          setResult(null);
          setIsCampusQR(true);
          setError(null);
        }
      } else {
        const qrData = await scanQRCode(encodeURIComponent(trimmedData));
        setResult(qrData);
        setIsCampusQR(false);
        setGeofenceDenied(null);
        setError(null);
      }
    } catch (err) {
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        setError("Server timeout. Please try again.");
      } else if (err?.response?.status === 404) {
        setError("QR code not recognized.");
      } else {
        setError("Scan error. Please try again.");
      }
    }
  };

  const resetScan = () => {
    setScanned(false);
    setScanning(true);
    setResult(null);
    setError(null);
    setGeofenceDenied(null);
    successAnim.setValue(0);
    animateScanLine();
  };

  if (!permission?.granted) {
    return (
      <View style={[s.center, { backgroundColor: '#0F172A' }]}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Ionicons name="qr-code" size={38} color="#8B5CF6" />
        </View>
        <Text style={{ color: "#FFF", fontSize: 20, fontWeight: "800", marginBottom: 8 }}>Camera Required</Text>
        <Text style={{ color: "#94A3B8", textAlign: "center", fontSize: 14, paddingHorizontal: 40, lineHeight: 20 }}>
          We need camera access to scan NavX QR codes placed around the campus
        </Text>
        <AnimatedPressable
          style={{ backgroundColor: "#7C3AED", paddingHorizontal: 32, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: 24, ...SHADOWS.md }}
          onPress={requestPermission}
        >
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>Grant Permission</Text>
        </AnimatedPressable>
      </View>
    );
  }

  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME - 4] });

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
      {/* Background Camera Feed */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Dark Ambient Overlay */}
      <View style={s.darkOverlay} />

      <ScrollView contentContainerStyle={[s.scrollContent, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 24) }]} showsVerticalScrollIndicator={false}>
        
        {/* Top Header Bar */}
        <View style={s.topHeaderBar}>
          <TouchableOpacity style={s.circleHeaderBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={s.brandTitle}>Nav<Text style={{ color: '#7C3AED' }}>X</Text></Text>
            <Text style={s.brandSubtitle}>Smart Campus Navigation</Text>
          </View>

          <TouchableOpacity style={s.circleHeaderBtn} onPress={toggleTheme} activeOpacity={0.8}>
            <Ionicons name={isDark ? "sunny" : "moon"} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Main Translucent Glass Scanner Card */}
        <View style={s.scannerCard}>
          <Text style={s.scannerTitle}>Scan QR Code</Text>
          <Text style={s.scannerSubtitle}>Align the QR code within the frame</Text>

          {/* Viewfinder Frame */}
          <Animated.View style={[s.viewfinderFrame, { transform: [{ scale: frameAnim }] }]}>
            {/* Glowing Violet Frame Corners */}
            <View style={[s.frameCorner, s.cornerTL]} />
            <View style={[s.frameCorner, s.cornerTR]} />
            <View style={[s.frameCorner, s.cornerBL]} />
            <View style={[s.frameCorner, s.cornerBR]} />

            {/* Horizontal Glowing Scanning Beam Line */}
            {!scanned && (
              <Animated.View style={[s.scanBeam, { top: scanLineY }]}>
                <LinearGradient
                  colors={['rgba(168,85,247,0)', '#A855F7', 'rgba(168,85,247,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}

            {/* Success Overlay */}
            {scanned && !error && !geofenceDenied && (
              <Animated.View style={[s.successBadgeOverlay, { transform: [{ scale: successAnim }], opacity: successAnim }]}>
                <View style={s.successCheckCircle}>
                  <Ionicons name="checkmark" size={38} color="#FFF" />
                </View>
              </Animated.View>
            )}
          </Animated.View>

          {/* Status Capsule Badge */}
          <View style={s.statusPill}>
            <Ionicons 
              name={scanned ? (error ? "alert-circle" : "checkmark-circle") : "scan-circle"} 
              size={18} 
              color={scanned ? (error ? "#EF4444" : "#22C55E") : "#8B5CF6"} 
              style={{ marginRight: 6 }} 
            />
            <Text style={s.statusPillText}>
              {scanned 
                ? (error ? "QR Not Recognized" : "Saved to MongoDB Atlas — ready to use")
                : "Point camera at a NavX Campus QR"}
            </Text>
          </View>


        </View>

        {/* Bottom Card: "Campus Detected" */}
        {result && (
          <Animated.View style={[s.campusCard, { opacity: successAnim }]}>
            {/* Header Row */}
            <View style={s.campusCardHeader}>
              <View style={s.campusIconWrap}>
                <Ionicons name="city" size={18} color="#8B5CF6" />
              </View>
              <Text style={s.campusCardTitle}>
                Campus Detected <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              </Text>
              <TouchableOpacity 
                style={s.viewDetailsBtn} 
                onPress={() => navigation.navigate("MainTabs", { screen: "Home", params: { campusId: result._id } })}
                activeOpacity={0.8}
              >
                <Text style={s.viewDetailsText}>View Details ›</Text>
              </TouchableOpacity>
            </View>

            {/* Campus Info & Image Row */}
            <View style={s.campusInfoRow}>
              {/* Campus Photo Image (Uploaded by Admin!) */}
              <Image 
                source={{ uri: result.image || FALLBACK_CAMPUS_IMAGE }} 
                style={s.campusImageThumbnail}
                resizeMode="cover"
              />

              <View style={{ flex: 1 }}>
                <Text style={s.campusNameText}>{result.name || result.campusName || "GMRIT"}</Text>
                <Text style={s.campusDescText} numberOfLines={1}>
                  {result.description || result.address || "GMR Institute of Technology"}
                </Text>
                
                <View style={s.metaItemRow}>
                  <Ionicons name="location-outline" size={13} color="#94A3B8" />
                  <Text style={s.metaItemText}>{result.address || "Rajam, Andhra Pradesh"}</Text>
                </View>

                <View style={s.metaStatsRow}>
                  <View style={s.metaStatItem}>
                    <Ionicons name="layers-outline" size={13} color="#94A3B8" />
                    <Text style={s.metaStatText}>Floors: {result.floors || 6}</Text>
                  </View>
                  <View style={s.metaStatItem}>
                    <Ionicons name="door-open-outline" size={13} color="#94A3B8" />
                    <Text style={s.metaStatText}>Rooms: {result.rooms || 142}</Text>
                  </View>
                </View>
              </View>
            </View>


          </Animated.View>
        )}

      </ScrollView>


    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070B14" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7, 11, 20, 0.78)" },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: "center",
  },

  /* Top Header Bar */
  topHeaderBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  circleHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },

  /* Scanner Card */
  scannerCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 28,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 16,
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 2,
  },
  scannerSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
    marginBottom: 16,
  },
  viewfinderFrame: {
    width: FRAME,
    height: FRAME,
    borderRadius: 20,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.4)",
    marginBottom: 16,
  },
  frameCorner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#8B5CF6",
    borderWidth: 3.5,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },
  scanBeam: {
    position: "absolute",
    left: 0, right: 0,
    height: 4,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  successBadgeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(34, 197, 94, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  successCheckCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Status Pill */
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 16,
  },
  statusPillText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },

  /* Action Buttons */
  primaryActionBtn: {
    width: "100%",
    height: 50,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGradientFill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryActionRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Campus Detected Card */
  campusCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 80,
  },
  campusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  campusIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  campusCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    flex: 1,
  },
  viewDetailsBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewDetailsText: {
    color: "#8B5CF6",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Campus Info Row */
  campusInfoRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 10,
    borderRadius: 16,
  },
  campusImageThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#1E293B",
  },
  campusNameText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  campusDescText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    marginBottom: 6,
  },
  metaItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  metaItemText: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  metaStatsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metaStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaStatText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },

  /* Quick Nav Grid */
  quickNavGrid: {
    flexDirection: "row",
    gap: 8,
  },
  quickNavBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  quickNavBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8B5CF6",
  },

  /* Bottom Floating Tab Bar */
  bottomTabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "space-around",
  },
  tabItem: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  tabItemActive: {
    backgroundColor: "rgba(124, 58, 237, 0.25)",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
  },
  tabText: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "600",
  },
  tabTextActive: {
    fontSize: 11,
    color: "#FFFFFF",
    marginTop: 2,
    fontWeight: "800",
  },
});
