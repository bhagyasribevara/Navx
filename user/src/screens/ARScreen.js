import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Magnetometer } from "expo-sensors";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Line, Circle } from "react-native-svg";
import { ThemeContext } from "../context/ThemeContext";
import { SHADOWS, RADIUS } from "../theme/designSystem";

const { width: SW, height: SH } = Dimensions.get("window");

export default function ARScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const { routeData, room, heading: initHeading } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [heading, setHeading] = useState(initHeading || 0);
  const [currentStep, setCurrentStep] = useState(0);

  const arrowAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sub = Magnetometer.addListener(d => {
      const h = Math.atan2(d.y, d.x) * (180 / Math.PI);
      setHeading((h + 360) % 360);
    });
    Magnetometer.setUpdateInterval(100);
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: -14, duration: 700, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1000, useNativeDriver: false }),
      ])
    ).start();
    return () => sub.remove();
  }, []);

  if (!permission?.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Ionicons name="camera" size={36} color={colors.primary} />
        </View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 8 }}>Camera Required</Text>
        <Text style={{ color: colors.textSec, textAlign: "center", fontSize: 14, paddingHorizontal: 40, lineHeight: 20 }}>
          AR navigation needs camera access to show direction overlays
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: 24, ...SHADOWS.md }}
          onPress={requestPermission}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 14 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentDir = routeData?.directions?.[currentStep];
  const remainingDist = routeData?.directions?.slice(currentStep).reduce((s, d) => s + d.distance, 0) || 0;
  const targetAngle = currentDir?.angle || 0;
  const relAngle = targetAngle - heading;

  let arrowIcon = "arrow-up";
  if (currentDir) {
    if (currentDir.instruction.includes("left")) arrowIcon = "arrow-back";
    else if (currentDir.instruction.includes("right")) arrowIcon = "arrow-forward";
    else if (currentDir.instruction.includes("stairs")) arrowIcon = "trending-up";
    else if (currentDir.instruction.includes("elevator")) arrowIcon = "git-merge";
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* AR SVG Overlay — path indicator */}
      <Svg width={SW} height={SH} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Line x1={SW / 2} y1={SH * 0.68} x2={SW / 2 + Math.sin((relAngle * Math.PI) / 180) * 110} y2={SH * 0.68 - 90}
          stroke="#6366f1" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
        <Circle cx={SW / 2 + Math.sin((relAngle * Math.PI) / 180) * 110} cy={SH * 0.68 - 90}
          r={10} fill="#6366f1" opacity={0.85} />
        <Circle cx={SW / 2} cy={SH * 0.68} r={6} fill="#fff" opacity={0.9} />
      </Svg>

      {/* Directional arrow */}
      <View style={styles.arrowContainer}>
        <Animated.View style={[styles.arrowWrap, { transform: [{ translateY: arrowAnim }] }]}>
          <Animated.View style={[styles.arrowCircle, { shadowOpacity: glowAnim }]}>
            <Ionicons name={arrowIcon} size={52} color="#fff" />
          </Animated.View>
        </Animated.View>
        {currentDir && (
          <View style={styles.instructionPill}>
            <Text style={styles.instructionText}>{currentDir.instruction}</Text>
          </View>
        )}
      </View>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.destLabel}>Navigating to</Text>
          <Text style={styles.destName}>{room?.name || "Destination"}</Text>
        </View>
        <View style={styles.compassBadge}>
          <Ionicons name="compass" size={18} color="#818cf8" />
          <Text style={styles.compassDeg}>{Math.round(heading)}°</Text>
        </View>
      </View>

      {/* Distance band (mid-screen) */}
      <View style={styles.distBand}>
        <Ionicons name="walk" size={16} color="#22c55e" />
        <Text style={styles.distText}>{Math.round(remainingDist)}m remaining</Text>
      </View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        {/* Steps row */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Ionicons name="walk" size={20} color="#6366f1" />
            <Text style={styles.metricVal}>{Math.round(remainingDist)}m</Text>
            <Text style={styles.metricLbl}>Remaining</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metric}>
            <Ionicons name="time" size={20} color="#22c55e" />
            <Text style={styles.metricVal}>{Math.ceil(remainingDist / 1.2 / 60)}'</Text>
            <Text style={styles.metricLbl}>ETA</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metric}>
            <Ionicons name="footsteps" size={20} color="#f59e0b" />
            <Text style={styles.metricVal}>{currentStep + 1}/{routeData?.directions?.length || 1}</Text>
            <Text style={styles.metricLbl}>Step</Text>
          </View>
        </View>

        {/* Prev / Next step */}
        {routeData?.directions && (
          <View style={styles.stepNav}>
            <TouchableOpacity
              style={[styles.stepBtn, { opacity: currentStep === 0 ? 0.4 : 1 }]}
              onPress={() => setCurrentStep(s => Math.max(0, s - 1))}
              disabled={currentStep === 0}
            >
              <Ionicons name="chevron-back" size={18} color="#6366f1" />
              <Text style={styles.stepBtnText}>Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapSwitch} onPress={() => navigation.goBack()}>
              <Ionicons name="map" size={16} color="#6366f1" />
              <Text style={styles.mapSwitchText}>Map View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepBtn, { opacity: currentStep >= routeData.directions.length - 1 ? 0.4 : 1 }]}
              onPress={() => setCurrentStep(s => Math.min(routeData.directions.length - 1, s + 1))}
              disabled={currentStep >= routeData.directions.length - 1}
            >
              <Text style={styles.stepBtnText}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color="#6366f1" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  arrowContainer: {
    position: "absolute",
    top: SH * 0.28, alignSelf: "center", alignItems: "center",
  },
  arrowWrap: { alignItems: "center" },
  arrowCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center",
    shadowColor: "#6366f1", shadowOffset: { width: 0, height: 0 },
    shadowRadius: 24, elevation: 12,
  },
  instructionPill: {
    marginTop: 14, backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: 99, borderWidth: 1, borderColor: "rgba(99,102,241,0.4)",
  },
  instructionText: {
    color: "#fff", fontSize: 16, fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 54 : 20,
    paddingBottom: 14, paddingHorizontal: 16,
    backgroundColor: "rgba(7,11,20,0.75)",
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
  },
  destLabel: { fontSize: 11, color: "#94a3b8" },
  destName: { fontSize: 15, color: "#fff", fontWeight: "700" },
  compassBadge: { alignItems: "center" },
  compassDeg: { fontSize: 10, color: "#818cf8", marginTop: 2 },
  distBand: {
    position: "absolute", top: SH * 0.55, alignSelf: "center",
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    gap: 6,
  },
  distText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(7,11,20,0.88)", padding: 20, paddingBottom: 36,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  metricsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 16 },
  metric: { alignItems: "center" },
  metricVal: { fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 4 },
  metricLbl: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  divider: { width: 1, backgroundColor: "#1e2d40", marginVertical: 2 },
  stepNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stepBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(99,102,241,0.12)", paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.3)",
  },
  stepBtnText: { color: "#818cf8", fontWeight: "700", fontSize: 14 },
  mapSwitch: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", backgroundColor: "rgba(99,102,241,0.18)",
    paddingVertical: 10, borderRadius: 12, gap: 6,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.35)",
  },
  mapSwitchText: { color: "#818cf8", fontWeight: "700", fontSize: 14 },
});
