import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform,
} from "react-native";
import Svg, { Rect, Circle, Line, G, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Accelerometer, Magnetometer } from "expo-sensors";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { ThemeContext } from "../context/ThemeContext";
import { findRouteToRoom } from "../api";
import { PositionEngine, StepDetector } from "../positioning";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";

const { width: SW, height: SH } = Dimensions.get("window");

const DIR_ICONS = {
  left: "arrow-back",
  right: "arrow-forward",
  straight: "arrow-up",
  stairs: "trending-up",
  elevator: "git-merge",
  arrived: "checkmark-circle",
};

export default function NavigationScreen({ navigation, route }) {
  const { colors, language } = useContext(ThemeContext);
  const { room, campusId, mapData } = route.params || {};
  const [routeData, setRouteData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [error, setError] = useState(null);

  const posEngine = useRef(new PositionEngine()).current;
  const stepDetector = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dirCardAnim = useRef(new Animated.Value(0)).current;
  const arrivedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = posEngine.onPositionUpdate(pos => {
      setUserPos({ x: pos.x, y: pos.y, floor: pos.floor });
      setHeading(pos.heading);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isNavigating) {
      stepDetector.current = new StepDetector(() => posEngine.processStep(heading));
      const accel = Accelerometer.addListener(d => stepDetector.current?.processAccelerometer(d.x, d.y, d.z));
      Accelerometer.setUpdateInterval(100);
      const mag = Magnetometer.addListener(d => {
        const h = Math.atan2(d.y, d.x) * (180 / Math.PI);
        posEngine.updateHeading((h + 360) % 360);
      });
      Magnetometer.setUpdateInterval(100);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 900, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        ])
      ).start();
      return () => { accel.remove(); mag.remove(); };
    }
  }, [isNavigating, heading]);

  useEffect(() => {
    if (routeData) {
      const progress = currentStep / Math.max(1, routeData.directions?.length - 1);
      Animated.spring(progressAnim, { toValue: progress, useNativeDriver: false, tension: 100, friction: 12 }).start();
    }
  }, [currentStep, routeData]);

  useEffect(() => {
    if (routeData && userPos && isNavigating) {
      const target = routeData.path[currentStep];
      if (target) {
        const dist = Math.hypot(userPos.x - target.x, userPos.y - target.y);
        if (dist < 20) {
          if (currentStep < routeData.path.length - 1) {
            setCurrentStep(s => s + 1);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (voiceEnabled && routeData.directions[currentStep]) {
              Speech.speak(routeData.directions[currentStep].instruction, { language: language === "te" ? "te-IN" : "en-US" });
            }
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (voiceEnabled) Speech.speak("You have arrived at your destination!");
            setIsNavigating(false);
            setArrived(true);
            Animated.spring(arrivedAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
          }
        }
      }
    }
  }, [userPos, currentStep]);

  const startNavigation = async () => {
    if (!mapData || !room) return;
    try {
      setError(null);
      const startNode = mapData.nodes?.[0];
      if (!startNode) return;
      const result = await findRouteToRoom({ startNodeId: startNode._id, roomId: room._id, campusId });
      setRouteData(result);
      setCurrentStep(0);
      setIsNavigating(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (voiceEnabled) {
        Speech.speak(`Starting navigation to ${room.name}. ${result.directions?.[0]?.instruction || "Follow the route."}`);
      }
      Animated.spring(dirCardAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
    } catch {
      setError("Could not find a route. Try QR scan first.");
    }
  };

  const currentDir = routeData?.directions?.[currentStep];
  const floorRooms = mapData?.rooms?.filter(r => r.floorId === room?.floorId) || [];

  const getDirIcon = () => {
    if (!currentDir) return "arrow-up";
    if (arrived) return "checkmark-circle";
    if (currentDir.instruction.includes("left")) return "arrow-back";
    if (currentDir.instruction.includes("right")) return "arrow-forward";
    if (currentDir.instruction.includes("stairs")) return "trending-up";
    if (currentDir.instruction.includes("elevator")) return "git-merge";
    return "arrow-up";
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingBottom: 14,
      paddingTop: Platform.OS === "ios" ? 54 : 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: RADIUS.sm,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text, marginLeft: 12 },
    voiceBtn: {
      width: 40, height: 40, borderRadius: RADIUS.sm,
      backgroundColor: voiceEnabled ? colors.accent + "18" : colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    mapArea: { flex: 1, backgroundColor: colors.mapBg || "#060d1a" },
    dirCard: {
      position: "absolute", top: 12, left: 12, right: 12,
      backgroundColor: colors.card + "F5",
      borderRadius: RADIUS.lg, padding: 16,
      borderWidth: 1.5, borderColor: colors.primary + "35",
      flexDirection: "row", alignItems: "center",
      ...SHADOWS.lg,
    },
    dirIconWrap: {
      width: 54, height: 54, borderRadius: 18,
      backgroundColor: colors.primary + "18",
      alignItems: "center", justifyContent: "center", marginRight: 14,
    },
    dirInstruction: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 2 },
    dirMeta: { fontSize: 13, color: colors.textSec },
    // Step counter pill
    stepPill: {
      backgroundColor: colors.primary, borderRadius: 99,
      paddingHorizontal: 10, paddingVertical: 3,
      alignSelf: "flex-start", marginTop: 4,
    },
    stepPillText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    // Bottom info panel
    bottomPanel: {
      backgroundColor: colors.card,
      borderTopWidth: 1, borderTopColor: colors.border,
      padding: 16, paddingBottom: 20,
    },
    metricsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 16 },
    metric: { alignItems: "center" },
    metricValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
    metricLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
    // Progress bar
    progressTrack: {
      height: 6, backgroundColor: colors.border,
      borderRadius: 3, marginBottom: 16, overflow: "hidden",
    },
    progressFill: { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
    // Action buttons
    startBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.primary, paddingVertical: 15,
      borderRadius: RADIUS.md, justifyContent: "center",
      ...SHADOWS.primary ? {} : {},
    },
    stopBtn: { backgroundColor: colors.danger },
    btnText: { color: "#fff", fontWeight: "700", fontSize: 15, marginLeft: 8 },
    arToggle: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.surface, paddingVertical: 12,
      borderRadius: RADIUS.md, justifyContent: "center",
      marginTop: 8, borderWidth: 1, borderColor: colors.border,
    },
    // Arrived overlay
    arrivedOverlay: {
      position: "absolute", top: 12, left: 12, right: 12,
      backgroundColor: colors.accent + "F0",
      borderRadius: RADIUS.lg, padding: 20, alignItems: "center",
    },
    errorBox: {
      margin: 12, backgroundColor: colors.danger + "18",
      borderRadius: RADIUS.md, padding: 12,
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: colors.danger + "30",
    },
  });

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {room?.name || "Navigation"}
        </Text>
        <TouchableOpacity style={s.voiceBtn} onPress={() => setVoiceEnabled(!voiceEnabled)}>
          <Ionicons name={voiceEnabled ? "volume-high" : "volume-mute"} size={20} color={voiceEnabled ? colors.accent : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "600", marginLeft: 8, flex: 1 }}>{error}</Text>
        </View>
      )}

      {/* Map */}
      <View style={s.mapArea}>
        <Svg width={SW} height={SH - 340} viewBox="0 0 800 600">
          {/* Grid */}
          {Array.from({ length: 40 }, (_, i) => (
            <G key={i}>
              <Line x1={i * 20} y1={0} x2={i * 20} y2={600} stroke="#0f1e33" strokeWidth={0.5} />
              <Line x1={0} y1={i * 20} x2={800} y2={i * 20} stroke="#0f1e33" strokeWidth={0.5} />
            </G>
          ))}
          {/* Rooms */}
          {floorRooms.map(r => {
            const sh = r.shape;
            const isTarget = r._id === room?._id;
            const rc = ROOM_COLORS[r.type] || "#3b82f6";
            return (
              <G key={r._id}>
                {sh.type === "circle" ? (
                  <Circle cx={sh.x + (sh.radius || 30)} cy={sh.y + (sh.radius || 30)} r={sh.radius || 30}
                    fill={isTarget ? colors.primary + "60" : rc + "22"} stroke={isTarget ? colors.primaryLight : rc} strokeWidth={isTarget ? 2.5 : 1} />
                ) : (
                  <Rect x={sh.x} y={sh.y} width={sh.width || 80} height={sh.height || 60}
                    rx={5} fill={isTarget ? colors.primary + "60" : rc + "22"} stroke={isTarget ? colors.primaryLight : rc} strokeWidth={isTarget ? 2.5 : 1} />
                )}
                <SvgText x={sh.type === "circle" ? sh.x + (sh.radius || 30) : sh.x + (sh.width || 80) / 2}
                  y={sh.type === "circle" ? sh.y + (sh.radius || 30) : sh.y + (sh.height || 60) / 2 + 4}
                  fill="#e2e8f0" fontSize={9} textAnchor="middle">{r.name}</SvgText>
              </G>
            );
          })}
          {/* Route */}
          {routeData?.path?.map((p, i) => {
            if (i === 0) return null;
            const prev = routeData.path[i - 1];
            const isPast = i <= currentStep;
            return <Line key={i} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y}
              stroke={isPast ? colors.accent : colors.primary} strokeWidth={4} strokeLinecap="round" />;
          })}
          {/* User dot */}
          {userPos && (
            <G>
              <Circle cx={userPos.x} cy={userPos.y} r={16} fill="#6366f118" />
              <Circle cx={userPos.x} cy={userPos.y} r={8} fill="#6366f1" stroke="#fff" strokeWidth={2} />
            </G>
          )}
          {/* Destination pin */}
          {room?.shape && (
            <G>
              <Circle
                cx={room.shape.type === "circle" ? room.shape.x + (room.shape.radius || 30) : room.shape.x + (room.shape.width || 80) / 2}
                cy={room.shape.y - 12}
                r={8} fill="#ef4444" stroke="#fff" strokeWidth={2}
              />
            </G>
          )}
        </Svg>

        {/* Direction card */}
        {isNavigating && currentDir && !arrived && (
          <Animated.View style={[s.dirCard, { transform: [{ translateY: dirCardAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }], opacity: dirCardAnim }]}>
            <Animated.View style={[s.dirIconWrap, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name={getDirIcon()} size={26} color={colors.primary} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={s.dirInstruction}>{currentDir.instruction}</Text>
              <Text style={s.dirMeta}>{Math.round(currentDir.distance)}m away</Text>
              <View style={s.stepPill}>
                <Text style={s.stepPillText}>Step {currentStep + 1} of {routeData.directions.length}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Arrived overlay */}
        {arrived && (
          <Animated.View style={[s.arrivedOverlay, { transform: [{ scale: arrivedAnim }], opacity: arrivedAnim }]}>
            <Ionicons name="checkmark-circle" size={40} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 8 }}>You've Arrived!</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 }}>{room?.name}</Text>
          </Animated.View>
        )}
      </View>

      {/* Bottom panel */}
      <View style={s.bottomPanel}>
        {routeData && (
          <>
            <View style={s.metricsRow}>
              <View style={s.metric}>
                <Text style={s.metricValue}>{Math.round(routeData.distance)}m</Text>
                <Text style={s.metricLabel}>Distance</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricValue}>{Math.ceil(routeData.distance / 1.2 / 60)}'</Text>
                <Text style={s.metricLabel}>ETA</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricValue}>{routeData.nodeCount || routeData.directions?.length}</Text>
                <Text style={s.metricLabel}>Steps</Text>
              </View>
            </View>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
            </View>
          </>
        )}
        {!isNavigating ? (
          <TouchableOpacity style={s.startBtn} onPress={startNavigation}>
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={s.btnText}>Start Navigation</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.startBtn, s.stopBtn]} onPress={() => { setIsNavigating(false); Speech.stop(); }}>
            <Ionicons name="stop" size={20} color="#fff" />
            <Text style={s.btnText}>Stop Navigation</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.arToggle} onPress={() => navigation.navigate("AR", { routeData, room, heading })}>
          <Ionicons name="camera" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14, marginLeft: 8 }}>Switch to AR View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
