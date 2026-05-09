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
import Svg, { Polygon as SvgPolygon, Line, Circle, Path as SvgPath } from "react-native-svg";
import { ThemeContext } from "../context/ThemeContext";
import { RADIUS } from "../theme/designSystem";

const { width: SW, height: SH } = Dimensions.get("window");

// Detect direction type from instruction text
function getDirectionType(instruction) {
  if (!instruction) return "straight";
  const lower = instruction.toLowerCase();
  if (lower.includes("sharp left")) return "sharp_left";
  if (lower.includes("left")) return "left";
  if (lower.includes("sharp right")) return "sharp_right";
  if (lower.includes("right")) return "right";
  if (lower.includes("stairs")) return "stairs";
  if (lower.includes("elevator")) return "elevator";
  if (lower.includes("arrived")) return "arrived";
  return "straight";
}

// Get icon name for direction
function getDirIcon(dirType) {
  switch (dirType) {
    case "left":
    case "sharp_left": return "return-down-back";
    case "right":
    case "sharp_right": return "return-down-forward";
    case "stairs": return "trending-up";
    case "elevator": return "git-merge";
    case "arrived": return "checkmark-circle";
    default: return "arrow-up";
  }
}

// Get direction color
function getDirColor(dirType) {
  switch (dirType) {
    case "left":
    case "sharp_left": return "#f59e0b";   // amber for left
    case "right":
    case "sharp_right": return "#3b82f6";  // blue for right
    case "stairs":
    case "elevator": return "#22c55e";      // green for floor change
    case "arrived": return "#10b981";
    default: return "#7c3aed";              // purple for straight
  }
}

// Build chevron polygon points based on direction type
function buildChevronPoints(cx, cy, scale, dirType) {
  const w = 70 * scale;
  const h = 30 * scale;
  const t = 12 * scale; // thickness

  switch (dirType) {
    case "left":
    case "sharp_left": {
      // Chevron pointing LEFT — < shape
      return `${cx + h},${cy - w} ${cx - h},${cy} ${cx + h},${cy + w} ${cx + h},${cy + w - t} ${cx - h + 14 * scale},${cy} ${cx + h},${cy - w + t}`;
    }
    case "right":
    case "sharp_right": {
      // Chevron pointing RIGHT — > shape
      return `${cx - h},${cy - w} ${cx + h},${cy} ${cx - h},${cy + w} ${cx - h},${cy + w - t} ${cx + h - 14 * scale},${cy} ${cx - h},${cy - w + t}`;
    }
    case "stairs": {
      // Chevron pointing UP-RIGHT (diagonal) for stairs
      const dx = w * 0.7;
      const dy = h * 0.7;
      return `${cx - w},${cy + h} ${cx + dx},${cy - dy - h} ${cx + w},${cy - dy} ${cx + w - t},${cy - dy} ${cx + dx - t},${cy - dy - h + 14 * scale} ${cx - w + t},${cy + h}`;
    }
    default: {
      // Chevron pointing UP — ^ shape (straight)
      return `${cx - w},${cy + h} ${cx},${cy - h} ${cx + w},${cy + h} ${cx + w - t},${cy + h} ${cx},${cy - h + 14 * scale} ${cx - w + t},${cy + h}`;
    }
  }
}

// Haversine distance in meters between two geo coords
function haversineDist(lat1, lng1, lat2, lng2) {
  const dx = (lat1 - lat2) * 111320;
  const dy = (lng1 - lng2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

export default function ARScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const { routeData, room, heading: initHeading } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [heading, setHeading] = useState(initHeading || 0);
  const [currentStep, setCurrentStep] = useState(0);
  const [lastSpokenStep, setLastSpokenStep] = useState(-1);
  const [liveDistance, setLiveDistance] = useState(routeData?.distance || 0);
  const [liveStepDist, setLiveStepDist] = useState(Math.round(routeData?.directions?.[0]?.distance || 0));
  const [arrived, setArrived] = useState(false);
  const [userLatLng, setUserLatLng] = useState(null);

  const chevronAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const arrivedAnim = useRef(new Animated.Value(0)).current;

  // Refs for GPS callback (avoids stale closures)
  const currentStepRef = useRef(currentStep);
  const routeDataRef = useRef(routeData);
  const arrivedRef = useRef(arrived);

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { routeDataRef.current = routeData; }, [routeData]);
  useEffect(() => { arrivedRef.current = arrived; }, [arrived]);

  // Magnetometer + animations setup
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

  // GPS watcher — single instance, uses refs
  useEffect(() => {
    let locationWatcher;
    (async () => {
      locationWatcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0.5 },
        (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          setUserLatLng({ lat, lng });

          const rData = routeDataRef.current;
          const cStep = currentStepRef.current;
          const isArrived = arrivedRef.current;

          if (!rData || !rData.path || isArrived) return;

          const targetNode = rData.path[cStep + 1] || rData.path[cStep];
          if (!targetNode) return;

          // Distance to current target node (end of current segment)
          const distToNode = haversineDist(lat, lng, targetNode.x, targetNode.y);
          setLiveStepDist(Math.round(distToNode));

          // Sum remaining segment distances from NEXT step onward
          const remainingPathMeters = rData.directions
            ?.slice(cStep + 1)
            .reduce((sum, d) => sum + (d.distance || 0), 0) || 0;

          // Total live distance = distance to next node + remaining path after it
          const totalLive = Math.max(0, Math.round(distToNode + remainingPathMeters));
          setLiveDistance(totalLive);

          // Auto-advance step when close to the current target node
          if (distToNode < 10) {
            if (cStep < (rData.directions?.length || 1) - 1) {
              setCurrentStep(s => s + 1);
              setLiveStepDist(Math.round(rData.directions[cStep + 1]?.distance || 0));
            } else {
              // Final node reached — arrived!
              setArrived(true);
              setLiveDistance(0);
              setLiveStepDist(0);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Speech.speak("You have arrived at your destination!");
              Animated.spring(arrivedAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
            }
          }
        }
      );
    })();
    return () => { if (locationWatcher) locationWatcher.remove(); };
  }, []);

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
  const nextDir = routeData?.directions?.[currentStep + 1]; // preview of next step
  const dirType = getDirectionType(currentDir?.instruction);
  const dirIcon = getDirIcon(dirType);
  const dirColor = getDirColor(dirType);
  const dirLabel = currentDir?.instruction || "Continue straight";

  // Next direction preview
  const nextDirType = nextDir ? getDirectionType(nextDir.instruction) : null;
  const nextDirIcon = nextDir ? getDirIcon(nextDirType) : null;
  const nextDirColor = nextDir ? getDirColor(nextDirType) : null;

  // Chevron animation direction
  const chevronTranslate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: dirType === "left" || dirType === "sharp_left" ? [0, -25]
               : dirType === "right" || dirType === "sharp_right" ? [0, 25]
               : [0, -30],
  });
  const chevronTranslateY = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: dirType === "left" || dirType === "sharp_left" || dirType === "right" || dirType === "sharp_right"
      ? [0, 0] : [0, -30],
  });

  // 3 chevron positions depending on direction
  const CHEVRONS = dirType === "left" || dirType === "sharp_left" ? [
    { cx: SW * 0.45, cy: SH * 0.65, scale: 1.0, opacity: 0.9 },
    { cx: SW * 0.33, cy: SH * 0.58, scale: 0.85, opacity: 0.65 },
    { cx: SW * 0.22, cy: SH * 0.52, scale: 0.7, opacity: 0.4 },
  ] : dirType === "right" || dirType === "sharp_right" ? [
    { cx: SW * 0.55, cy: SH * 0.65, scale: 1.0, opacity: 0.9 },
    { cx: SW * 0.67, cy: SH * 0.58, scale: 0.85, opacity: 0.65 },
    { cx: SW * 0.78, cy: SH * 0.52, scale: 0.7, opacity: 0.4 },
  ] : [
    { cx: SW / 2, cy: SH * 0.75, scale: 1.0, opacity: 0.9 },
    { cx: SW / 2, cy: SH * 0.63, scale: 0.85, opacity: 0.65 },
    { cx: SW / 2, cy: SH * 0.53, scale: 0.7, opacity: 0.4 },
  ];

  const isLeftRight = dirType.includes("left") || dirType.includes("right");

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Direction-Aware Chevron Arrows Overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: isLeftRight
              ? [{ translateX: chevronTranslate }]
              : [{ translateY: chevronTranslateY }],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={SW} height={SH}>
          {CHEVRONS.map((ch, i) => {
            const points = buildChevronPoints(ch.cx, ch.cy, ch.scale, dirType);
            return (
              <SvgPolygon
                key={i}
                points={points}
                fill={dirColor}
                opacity={ch.opacity}
              />
            );
          })}
          {/* Guide line from chevrons toward the vanishing point */}
          {dirType === "straight" && (
            <Line x1={SW / 2} y1={SH * 0.48} x2={SW / 2} y2={SH * 0.35}
              stroke={dirColor} strokeWidth={2} opacity={0.3} strokeDasharray="4,4" />
          )}
          {dirType.includes("left") && (
            <Line x1={SW * 0.22} y1={SH * 0.52} x2={SW * 0.1} y2={SH * 0.45}
              stroke={dirColor} strokeWidth={2} opacity={0.3} strokeDasharray="4,4" />
          )}
          {dirType.includes("right") && (
            <Line x1={SW * 0.78} y1={SH * 0.52} x2={SW * 0.9} y2={SH * 0.45}
              stroke={dirColor} strokeWidth={2} opacity={0.3} strokeDasharray="4,4" />
          )}
        </Svg>
      </Animated.View>

      {/* Floating Direction Circle in center */}
      <Animated.View style={[styles.dirCircle, { backgroundColor: dirColor + "DD", opacity: pulseAnim }]} pointerEvents="none">
        <Ionicons name={dirIcon} size={44} color="#fff" />
      </Animated.View>

      {/* Distance badge */}
      <View style={[styles.distBadge, { backgroundColor: dirColor + "DD" }]}>
        <Ionicons name="navigate" size={14} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.distText}>{liveDistance} m</Text>
      </View>

      {/* Arrived overlay */}
      {arrived && (
        <Animated.View style={[styles.arrivedOverlay, { transform: [{ scale: arrivedAnim }], opacity: arrivedAnim }]}>
          <Ionicons name="checkmark-circle" size={56} color="#fff" />
          <Text style={styles.arrivedTitle}>You've Arrived!</Text>
          <Text style={styles.arrivedSub}>{room?.name}</Text>
        </Animated.View>
      )}

      {/* Top: Destination Card */}
      <View style={styles.topCard}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          {/* Next turn preview */}
          {nextDir && (
            <View style={[styles.nextTurnPill, { backgroundColor: nextDirColor + "30", borderColor: nextDirColor + "60" }]}>
              <Text style={[styles.nextTurnLabel, { color: nextDirColor }]}>NEXT</Text>
              <Ionicons name={nextDirIcon} size={16} color={nextDirColor} />
              <Text style={{ color: "#cbd5e1", fontSize: 11, fontWeight: "600", marginLeft: 4 }} numberOfLines={1}>
                {nextDir.instruction}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.destInfo}>
          <View style={[styles.destDot, { backgroundColor: dirColor, borderColor: dirColor + "80" }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.destName} numberOfLines={1}>{room?.name || "Destination"}</Text>
            <Text style={styles.destSub}>{room?.type || "Room"} • {liveDistance}m away</Text>
          </View>
        </View>
      </View>

      {/* Bottom: Direction Card */}
      <View style={styles.bottomCard}>
        {/* Direction instruction */}
        <View style={styles.dirRow}>
          <View style={[styles.dirIconWrap, { backgroundColor: dirColor }]}>
            <Ionicons name={dirIcon} size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dirInstruction} numberOfLines={2}>{dirLabel}</Text>
            <Text style={styles.dirDist}>
              {currentDir ? `in ${liveStepDist} m` : ""}
            </Text>
          </View>
          {/* Step counter pill */}
          <View style={[styles.stepPill, { backgroundColor: dirColor + "25", borderColor: dirColor + "50" }]}>
            <Text style={[styles.stepPillText, { color: dirColor }]}>
              {currentStep + 1}/{routeData?.directions?.length || 1}
            </Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Ionicons name="walk" size={16} color="#7c3aed" />
            <Text style={styles.metricVal}>{liveDistance} m</Text>
            <Text style={styles.metricUnit}>left</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="time" size={16} color="#22c55e" />
            <Text style={styles.metricVal}>{Math.max(1, Math.ceil(liveDistance / 1.2 / 60))}</Text>
            <Text style={styles.metricUnit}>min</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="speedometer" size={16} color="#f59e0b" />
            <Text style={styles.metricVal}>{Math.round(liveDistance / Math.max(1, (routeData?.directions?.length || 1) - currentStep))}</Text>
            <Text style={styles.metricUnit}>m/seg</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {
            backgroundColor: dirColor,
            width: `${Math.min(100, ((currentStep + 1) / Math.max(1, routeData?.directions?.length || 1)) * 100)}%`,
          }]} />
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
  // Floating direction circle
  dirCircle: {
    position: "absolute",
    top: SH * 0.32, alignSelf: "center",
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#7c3aed", shadowOpacity: 0.6, shadowRadius: 20, elevation: 12,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  // Top destination card
  topCard: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: 16,
    paddingBottom: 16, paddingHorizontal: 16,
    backgroundColor: "rgba(17,24,39,0.88)",
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  nextTurnPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1,
    maxWidth: SW * 0.55,
  },
  nextTurnLabel: {
    fontSize: 9, fontWeight: "900", letterSpacing: 1, marginRight: 6,
  },
  destInfo: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  destDot: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2,
  },
  destName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  destSub: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  // Distance badge
  distBadge: {
    position: "absolute", top: SH * 0.42, alignSelf: "center",
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 99, zIndex: 5,
  },
  distText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  // Arrived overlay
  arrivedOverlay: {
    position: "absolute", top: SH * 0.25, left: 40, right: 40,
    backgroundColor: "rgba(16,185,129,0.95)",
    borderRadius: 28, padding: 32, alignItems: "center",
    shadowColor: "#10b981", shadowOpacity: 0.6, shadowRadius: 20, elevation: 12,
    zIndex: 20,
  },
  arrivedTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 12 },
  arrivedSub: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: 6 },
  // Bottom direction card
  bottomCard: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(17,24,39,0.94)",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  dirRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  dirIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: "center", justifyContent: "center", marginRight: 14,
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  dirInstruction: { color: "#fff", fontSize: 17, fontWeight: "800", lineHeight: 22 },
  dirDist: { color: "#94a3b8", fontSize: 13, marginTop: 4 },
  stepPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1,
  },
  stepPillText: { fontSize: 12, fontWeight: "800" },
  // Progress bar
  progressTrack: {
    height: 4, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, marginBottom: 14, overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2 },
  // Metrics
  metricsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    paddingVertical: 10, marginBottom: 10,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metricItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricVal: { color: "#e2e8f0", fontSize: 14, fontWeight: "800" },
  metricUnit: { color: "#64748b", fontSize: 11, fontWeight: "600" },
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
