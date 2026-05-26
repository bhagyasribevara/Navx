import React, { useState, useContext, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform, ActivityIndicator
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemeContext } from "../context/ThemeContext";
import { scanQRCode, getCampusByQR } from "../api";
import { SHADOWS, RADIUS } from "../theme/designSystem";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SW, height: SH } = Dimensions.get("window");
const FRAME = 240;

export default function QRScanScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isCampusQR, setIsCampusQR] = useState(false);

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const frameAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    animateScanLine();
  }, []);

  const animateScanLine = () => {
    scanLineAnim.setValue(0);
    Animated.loop(
      Animated.timing(scanLineAnim, { toValue: 1, duration: 2200, useNativeDriver: false })
    ).start();
  };

  const handleScan = async ({ data }) => {
    if (scanned || !scanning) return;
    setScanned(true);
    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Success frame pulse
    Animated.sequence([
      Animated.timing(frameAnim, { toValue: 1.08, duration: 150, useNativeDriver: true }),
      Animated.timing(frameAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    Animated.spring(successAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();

    try {
      if (data.startsWith("navx://campus/")) {
        const campusId = data.split("navx://campus/")[1];
        const campusData = await getCampusByQR(campusId);
        setResult(campusData);
        setIsCampusQR(true);
        setError(null);
      } else {
        const qrData = await scanQRCode(data);
        setResult(qrData);
        setIsCampusQR(false);
        setError(null);
      }
    } catch {
      setError("QR not recognized. Try another code.");
    }
  };

  const resetScan = () => {
    setScanned(false);
    setScanning(true);
    setResult(null);
    setError(null);
    successAnim.setValue(0);
    animateScanLine();
  };

  if (!permission?.granted) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Ionicons name="qr-code" size={38} color={colors.primary} />
        </View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 8 }}>Camera Required</Text>
        <Text style={{ color: colors.textSec, textAlign: "center", fontSize: 14, paddingHorizontal: 40, lineHeight: 20 }}>
          We need camera access to scan NavX QR codes placed around the building
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: 24, ...SHADOWS.md }}
          onPress={requestPermission}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 14 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME - 4] });

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Dark overlay with hole */}
      <View style={s.overlay}>
        {/* Top section */}
        <View style={{ flex: 1, backgroundColor: "rgba(7,11,20,0.75)" }} />
        {/* Middle row */}
        <View style={{ flexDirection: "row" }}>
          <View style={{ flex: 1, height: FRAME, backgroundColor: "rgba(7,11,20,0.75)" }} />
          {/* Scan frame */}
          <Animated.View style={[s.scanFrame, { transform: [{ scale: frameAnim }] }]}>
            {/* Corners */}
            <View style={[s.corner, s.tl]} /><View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} /><View style={[s.corner, s.br]} />
            {/* Scan line */}
            {!scanned && (
              <Animated.View style={[s.scanLine, { top: scanLineY }]} />
            )}
            {/* Success check */}
            {scanned && !error && (
              <Animated.View style={[s.successOverlay, { transform: [{ scale: successAnim }], opacity: successAnim }]}>
                <View style={s.successCheck}>
                  <Ionicons name="checkmark" size={40} color="#fff" />
                </View>
              </Animated.View>
            )}
          </Animated.View>
          <View style={{ flex: 1, height: FRAME, backgroundColor: "rgba(7,11,20,0.75)" }} />
        </View>
        {/* Bottom section */}
        <View style={{ flex: 1, backgroundColor: "rgba(7,11,20,0.75)" }} />
      </View>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>Scan QR Code</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Center hint */}
      <View style={s.hintWrap}>
        <Text style={s.hintText}>
          {scanned ? (error ? "❌ QR not recognized" : "✅ QR detected!") : "Point camera at a NavX QR code"}
        </Text>
      </View>

      {/* Bottom result panel */}
      <View style={s.bottomPanel}>
        {result && !error && (
          <Animated.View style={[s.resultCard, { transform: [{ translateY: successAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }], opacity: successAnim }]}>
            <View style={[s.resultIconWrap, { backgroundColor: isCampusQR ? "rgba(99,102,241,0.15)" : "rgba(34,197,94,0.15)" }]}>
              <Ionicons name={isCampusQR ? "business" : "location"} size={22} color={isCampusQR ? "#6366f1" : "#22c55e"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.resultTitle}>{isCampusQR ? result.name : (result.label || "Location Set")}</Text>
              {isCampusQR ? (
                <>
                  <Text style={s.resultMeta}>{result.address || "Campus Map Unlocked"}</Text>
                  <Text style={s.resultCoords}>Welcome to {result.name}</Text>
                </>
              ) : (
                <>
                  <Text style={s.resultMeta}>
                    {result.floorId?.name || "Floor ?"} · {result.blockId?.name || "Block ?"}
                  </Text>
                  <Text style={s.resultCoords}>
                    Position: ({result.position?.x}, {result.position?.y})
                  </Text>
                </>
              )}
            </View>
          </Animated.View>
        )}
        {error && (
          <View style={s.errorCard}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
        <View style={s.actionRow}>
          {scanned && !result && !error ? (
            <View style={{ flex: 1, alignItems: 'center', padding: 14 }}>
              <ActivityIndicator color="#6366f1" size="small" />
              <Text style={{ color: '#94a3b8', marginTop: 8, fontSize: 13 }}>Verifying QR Code...</Text>
            </View>
          ) : scanned ? (
            <>
              <TouchableOpacity style={s.rescanBtn} onPress={resetScan}>
                <Ionicons name="refresh" size={18} color="#6366f1" />
                <Text style={s.rescanText}>Scan Again</Text>
              </TouchableOpacity>
              {result && (
                <TouchableOpacity
                  style={s.navigateBtn}
                  onPress={async () => {
                    if (isCampusQR) {
                      try {
                        const previousCampusStr = await AsyncStorage.getItem('navx_active_campus');
                        if (previousCampusStr) {
                          const previousCampus = JSON.parse(previousCampusStr);
                          if (previousCampus.id !== result._id) {
                            await AsyncStorage.removeItem('navx_recent');
                          }
                        }
                        await AsyncStorage.setItem('navx_active_campus', JSON.stringify({
                          id: result._id,
                          name: result.name
                        }));
                      } catch (e) {}
                      navigation.navigate("MainTabs", { screen: "Map", params: { campusId: result._id } });
                    } else {
                      try {
                        await AsyncStorage.setItem('navx_last_scan', JSON.stringify({
                          x: result.position.x,
                          y: result.position.y,
                          floorId: result.floorId?._id,
                          timestamp: Date.now()
                        }));
                      } catch (e) {}
                      navigation.navigate("Navigation", { campusId: result.campusId || result.floorId?.campusId, userPosition: result.position, floorId: result.floorId?._id });
                    }
                  }}
                >
                  <Ionicons name={isCampusQR ? "arrow-forward" : "navigate"} size={18} color="#fff" />
                  <Text style={s.navigateBtnText}>{isCampusQR ? "Enter Campus" : "Go to Map"}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={s.infoCard}>
              <Ionicons name="information-circle" size={18} color="#6366f1" />
              <Text style={s.infoText}>QR codes are placed at entrances and key corridors to set your indoor position</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  overlay: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingTop: 20,
    paddingBottom: 12, paddingHorizontal: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
  },
  topTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#fff" },
  scanFrame: {
    width: FRAME, height: FRAME,
    position: "relative", overflow: "hidden",
  },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#6366f1", borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanLine: {
    position: "absolute", left: 4, right: 4, height: 2,
    backgroundColor: "#6366f1", borderRadius: 1,
    shadowColor: "#6366f1", shadowOpacity: 0.8, shadowRadius: 6,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.35)",
  },
  successCheck: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center",
  },
  hintWrap: {
    position: "absolute",
    top: SH / 2 + FRAME / 2 + 20,
    left: 0, right: 0, alignItems: "center",
  },
  hintText: {
    color: "#fff", fontSize: 14, fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 36,
  },
  resultCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(17,24,39,0.92)", borderRadius: 16,
    padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.3)",
  },
  resultIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(34,197,94,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  resultTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  resultMeta: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  resultCoords: { fontSize: 11, color: "#4b5563", marginTop: 2 },
  errorCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 12,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", gap: 8,
  },
  errorText: { color: "#ef4444", fontSize: 13, fontWeight: "600", flex: 1 },
  actionRow: { flexDirection: "row", gap: 10 },
  rescanBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.15)", paddingVertical: 13,
    borderRadius: 13, gap: 8,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.3)",
  },
  rescanText: { color: "#818cf8", fontWeight: "700", fontSize: 14 },
  navigateBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#6366f1", paddingVertical: 13, borderRadius: 13, gap: 8,
  },
  navigateBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  infoCard: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(17,24,39,0.85)", padding: 14, borderRadius: 14, gap: 10,
  },
  infoText: { flex: 1, color: "#94a3b8", fontSize: 13, lineHeight: 18 },
});
