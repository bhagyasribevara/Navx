import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polygon as SvgPolygon, Line, Circle } from "react-native-svg";
import { ThemeContext } from "../context/ThemeContext";
import { RADIUS } from "../theme/designSystem";

const { width: SW, height: SH } = Dimensions.get("window");

// Chevron arrow Y positions (3 arrows going forward on the ground)
const CHEVRONS = [
  { y: SH * 0.75, scale: 1.0, opacity: 0.9 },
  { y: SH * 0.63, scale: 0.85, opacity: 0.65 },
  { y: SH * 0.53, scale: 0.7, opacity: 0.4 },
];

export default function ARScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const { routeData, room, heading: initHeading } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [heading, setHeading] = useState(initHeading || 0);
  const [currentStep, setCurrentStep] = useState(0);
  const [lastSpokenStep, setLastSpokenStep] = useState(-1);
  const [liveDistance, setLiveDistance] = useState(routeData?.distance || 0);

  const chevronAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const sub = Magnetometer.addListener(d => {
      const h = Math.atan2(d.y, d.x) * (180 / Math.PI);
      setHeading((h + 360) % 360);
    });
    Magnetometer.setUpdateInterval(100);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    // Chevron forward animation loop
    Animated.loop(
      Animated.timing(chevronAnim, {
        toValue: 1, duration: 1500, useNativeDriver: true
      })
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.8, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    return () => sub.remove();
  }, []);

  useEffect(() => {
    let locationWatcher;
    (async () => {
      locationWatcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          
          if (routeData && routeData.path) {
            const target = routeData.path[currentStep];
            if (target) {
              const distToNextNodeMeters = Math.hypot(lat - target.x, lng - target.y) * 111320;
              const remainingPathMeters = routeData.directions?.slice(currentStep).reduce((s,d)=>s+(d.distance||0), 0) || 0;
              setLiveDistance(Math.round(distToNextNodeMeters + remainingPathMeters));
              
              // Auto-advance step if close to target node
              if (distToNextNodeMeters < 15 && currentStep < routeData.path.length - 1) {
                setCurrentStep(s => s + 1);
              }
            }
          }
        }
      );
    })();
    return () => { if (locationWatcher) locationWatcher.remove(); };
  }, [routeData, currentStep]);

  // Voice announcement when step changes
  useEffect(() => {
    if (currentStep !== lastSpokenStep && routeData?.directions?.[currentStep]) {
      const dir = routeData.directions[currentStep];
      Speech.speak(dir.instruction, { language: "en-US", rate: 0.9 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLastSpokenStep(currentStep);
    }
  }, [currentStep]);

  if (!permission?.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <View style={styles.permIcon}>
          <Ionicons name="camera" size={40} color={colors.primary} />
        </View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 8 }}>Camera Required</Text>
        <Text style={{ color: colors.textSec, textAlign: "center", fontSize: 14, paddingHorizontal: 40, lineHeight: 20 }}>
          AR navigation needs camera access to show direction overlays
        </Text>
        <TouchableOpacity style={[styles.permBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 14 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textMuted }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentDir = routeData?.directions?.[currentStep];
  const remainingMiles = (liveDistance * 0.000621371).toFixed(2);

  // Direction icon
  let dirIcon = "arrow-up";
  let dirLabel = "Continue straight";
  if (currentDir) {
    dirLabel = currentDir.instruction;
    if (currentDir.instruction.toLowerCase().includes("left")) dirIcon = "return-down-back";
    else if (currentDir.instruction.toLowerCase().includes("right")) dirIcon = "return-down-forward";
    else if (currentDir.instruction.toLowerCase().includes("stairs")) dirIcon = "trending-up";
    else if (currentDir.instruction.toLowerCase().includes("elevator")) dirIcon = "git-merge";
  }

  // Chevron shift based on direction
  const chevronShiftX = currentDir?.instruction?.toLowerCase().includes("left") ? -40
    : currentDir?.instruction?.toLowerCase().includes("right") ? 40 : 0;

  const chevronTranslateY = chevronAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, -30],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Purple Chevron Arrows Overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: chevronTranslateY }] }]} pointerEvents="none">
        <Svg width={SW} height={SH}>
          {CHEVRONS.map((ch, i) => {
            const cx = SW / 2 + chevronShiftX * ch.scale;
            const w = 70 * ch.scale;
            const h = 30 * ch.scale;
            // Chevron points — V shape pointing up
            const points = `${cx - w},${ch.y + h} ${cx},${ch.y - h} ${cx + w},${ch.y + h} ${cx + w - 12},${ch.y + h} ${cx},${ch.y - h + 14} ${cx - w + 12},${ch.y + h}`;
            return (
              <SvgPolygon
                key={i}
                points={points}
                fill="#7c3aed"
                opacity={ch.opacity}
              />
            );
          })}
          {/* Distance line */}
          <Line x1={SW / 2} y1={SH * 0.48} x2={SW / 2 + chevronShiftX * 0.5} y2={SH * 0.35}
            stroke="#7c3aed" strokeWidth={2} opacity={0.3} strokeDasharray="4,4" />
        </Svg>
      </Animated.View>

      {/* Distance badge in middle */}
      <View style={styles.distBadge}>
        <Text style={styles.distText}>{liveDistance} m</Text>
      </View>

      {/* Top: Destination Card */}
      <View style={styles.topCard}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.destInfo}>
          <View style={styles.destDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.destName} numberOfLines={1}>{room?.name || "Destination"}</Text>
            <Text style={styles.destSub}>{room?.type || "Room"}</Text>
          </View>
        </View>
      </View>

      {/* Bottom: Direction Card */}
      <View style={styles.bottomCard}>
        {/* Direction instruction */}
        <View style={styles.dirRow}>
          <View style={styles.dirIconWrap}>
            <Ionicons name={dirIcon} size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dirInstruction} numberOfLines={2}>{dirLabel}</Text>
            <Text style={styles.dirDist}>
              {currentDir ? `${Math.round(currentDir.distance)} m` : ""}
            </Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Ionicons name="location" size={16} color="#7c3aed" />
            <Text style={styles.metricVal}>{remainingMiles} Miles</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="time" size={16} color="#22c55e" />
            <Text style={styles.metricVal}>{Math.ceil(liveDistance / 1.2 / 60)} min</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="footsteps" size={16} color="#f59e0b" />
            <Text style={styles.metricVal}>{currentStep + 1}/{routeData?.directions?.length || 1}</Text>
          </View>
        </View>

        {/* Step nav + Map toggle */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.stepBtn, currentStep === 0 && { opacity: 0.4 }]}
            onPress={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}>
            <Ionicons name="chevron-back" size={20} color="#7c3aed" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.mapToggle} onPress={() => navigation.goBack()}>
            <Ionicons name="map" size={18} color="#7c3aed" />
            <Text style={styles.mapToggleText}>Map View</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stepBtn, currentStep >= (routeData?.directions?.length || 1) - 1 && { opacity: 0.4 }]}
            onPress={() => {
              const max = (routeData?.directions?.length || 1) - 1;
              setCurrentStep(s => Math.min(max, s + 1));
            }}
            disabled={currentStep >= (routeData?.directions?.length || 1) - 1}>
            <Ionicons name="chevron-forward" size={20} color="#7c3aed" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  permIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "rgba(99,102,241,0.15)",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  permBtn: {
    marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14,
  },
  // Top destination card
  topCard: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === "ios" ? 54 : 20,
    paddingBottom: 16, paddingHorizontal: 16,
    backgroundColor: "rgba(17,24,39,0.85)",
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  destInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  destDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#7c3aed", borderWidth: 2, borderColor: "#a78bfa",
  },
  destName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  destSub: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  // Distance badge
  distBadge: {
    position: "absolute", top: SH * 0.38, alignSelf: "center",
    backgroundColor: "rgba(124,58,237,0.85)",
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 99, zIndex: 5,
  },
  distText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  // Bottom direction card
  bottomCard: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(17,24,39,0.92)",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  dirRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  dirIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: "#7c3aed",
    alignItems: "center", justifyContent: "center", marginRight: 14,
    shadowColor: "#7c3aed", shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  dirInstruction: { color: "#fff", fontSize: 17, fontWeight: "800", lineHeight: 22 },
  dirDist: { color: "#94a3b8", fontSize: 13, marginTop: 4 },
  // Metrics
  metricsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    paddingVertical: 12, marginBottom: 12,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metricItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metricVal: { color: "#e2e8f0", fontSize: 13, fontWeight: "700" },
  metricDivider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.1)" },
  // Navigation row
  navRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(124,58,237,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
  },
  mapToggle: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    backgroundColor: "rgba(124,58,237,0.15)",
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
  },
  mapToggleText: { color: "#a78bfa", fontWeight: "700", fontSize: 14 },
});
