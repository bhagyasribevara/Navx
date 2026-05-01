import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import Svg, {
  Rect,
  Circle,
  Line,
  G,
  Text as SvgText,
  Polygon,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Accelerometer, Magnetometer } from "expo-sensors";
import * as Speech from "expo-speech";
import { ThemeContext } from "../context/ThemeContext";
import { findRouteToRoom, findNearestNode } from "../api";
import { PositionEngine, StepDetector } from "../positioning";

const { width: SW, height: SH } = Dimensions.get("window");

export default function NavigationScreen({ navigation, route }) {
  const { colors, language } = useContext(ThemeContext);
  const { room, campusId, mapData } = route.params || {};
  const [routeData, setRouteData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const posEngine = useRef(new PositionEngine()).current;
  const stepDetector = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subscribe to position updates
    const unsub = posEngine.onPositionUpdate((pos) => {
      setUserPos({ x: pos.x, y: pos.y, floor: pos.floor });
      setHeading(pos.heading);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isNavigating) {
      // Start sensors
      stepDetector.current = new StepDetector(() =>
        posEngine.processStep(heading),
      );

      const accelSub = Accelerometer.addListener((data) => {
        stepDetector.current?.processAccelerometer(data.x, data.y, data.z);
      });
      Accelerometer.setUpdateInterval(100);

      const magSub = Magnetometer.addListener((data) => {
        const h = Math.atan2(data.y, data.x) * (180 / Math.PI);
        const normalized = (h + 360) % 360;
        posEngine.updateHeading(normalized);
      });
      Magnetometer.setUpdateInterval(100);

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]),
      ).start();

      return () => {
        accelSub.remove();
        magSub.remove();
      };
    }
  }, [isNavigating, heading]);

  // Check if user deviated from route
  useEffect(() => {
    if (routeData && userPos && isNavigating) {
      const currentTarget = routeData.path[currentStep];
      if (currentTarget) {
        const dist = Math.hypot(
          userPos.x - currentTarget.x,
          userPos.y - currentTarget.y,
        );
        if (dist < 20) {
          // Reached waypoint
          if (currentStep < routeData.path.length - 1) {
            setCurrentStep(currentStep + 1);
            if (voiceEnabled && routeData.directions[currentStep]) {
              Speech.speak(routeData.directions[currentStep].instruction, {
                language: language === "te" ? "te-IN" : "en-US",
              });
            }
          } else {
            // Arrived
            if (voiceEnabled)
              Speech.speak("You have arrived at your destination");
            setIsNavigating(false);
          }
        }
      }
    }
  }, [userPos, currentStep]);

  const startNavigation = async () => {
    if (!mapData || !room) return;
    try {
      // Use first node as start if no position
      const startNode = mapData.nodes?.[0];
      if (!startNode) return;

      const result = await findRouteToRoom({
        startNodeId: userPos ? undefined : startNode._id,
        roomId: room._id,
        campusId,
      });
      setRouteData(result);
      setCurrentStep(0);
      setIsNavigating(true);

      if (voiceEnabled) {
        Speech.speak(
          `Starting navigation to ${room.name}. ${result.directions?.[0]?.instruction || "Follow the route."}`,
        );
      }
    } catch (err) {
      if (voiceEnabled) Speech.speak("Could not find a route");
    }
  };

  const currentDirection = routeData?.directions?.[currentStep];
  const floorRooms =
    mapData?.rooms?.filter((r) => r.floorId === room?.floorId) || [];
  const floorNodes =
    mapData?.nodes?.filter((n) => n.floorId === room?.floorId) || [];

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      paddingTop: 50,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginLeft: 12,
      flex: 1,
    },
    mapArea: { flex: 1, backgroundColor: "#080c16" },
    directionCard: {
      position: "absolute",
      top: 12,
      left: 12,
      right: 12,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.primary + "40",
      flexDirection: "row",
      alignItems: "center",
    },
    dirIcon: {
      width: 50,
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    dirText: { fontSize: 16, fontWeight: "700", color: colors.text },
    dirDist: { fontSize: 13, color: colors.textSec, marginTop: 2 },
    bottomInfo: {
      backgroundColor: colors.card,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 12,
    },
    infoItem: { alignItems: "center" },
    infoValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
    infoLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    startBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
    },
    startBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
      marginLeft: 8,
    },
    arBtn: {
      backgroundColor: colors.surface,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      justifyContent: "center",
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>
          Navigate to {room?.name || "Destination"}
        </Text>
        <TouchableOpacity onPress={() => setVoiceEnabled(!voiceEnabled)}>
          <Ionicons
            name={voiceEnabled ? "volume-high" : "volume-mute"}
            size={22}
            color={voiceEnabled ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <View style={s.mapArea}>
        <Svg width={SW} height={SH - 320} viewBox="0 0 800 600">
          {/* Rooms */}
          {floorRooms.map((r) => {
            const sh = r.shape;
            const isTarget = r._id === room?._id;
            return (
              <G key={r._id}>
                {sh.type === "circle" ? (
                  <Circle
                    cx={sh.x + (sh.radius || 30)}
                    cy={sh.y + (sh.radius || 30)}
                    r={sh.radius || 30}
                    fill={isTarget ? "#6366f160" : "#3b82f620"}
                    stroke={isTarget ? "#818cf8" : "#3b82f6"}
                    strokeWidth={isTarget ? 3 : 1}
                  />
                ) : (
                  <Rect
                    x={sh.x}
                    y={sh.y}
                    width={sh.width || 80}
                    height={sh.height || 60}
                    rx={4}
                    fill={isTarget ? "#6366f160" : "#3b82f620"}
                    stroke={isTarget ? "#818cf8" : "#3b82f6"}
                    strokeWidth={isTarget ? 3 : 1}
                  />
                )}
                <SvgText
                  x={
                    sh.type === "circle"
                      ? sh.x + (sh.radius || 30)
                      : sh.x + (sh.width || 80) / 2
                  }
                  y={
                    sh.type === "circle"
                      ? sh.y + (sh.radius || 30)
                      : sh.y + (sh.height || 60) / 2 + 4
                  }
                  fill="#e2e8f0"
                  fontSize={9}
                  textAnchor="middle"
                >
                  {r.name}
                </SvgText>
              </G>
            );
          })}

          {/* Route path */}
          {routeData?.path?.map((p, i) => {
            if (i === 0) return null;
            const prev = routeData.path[i - 1];
            const isPast = i <= currentStep;
            return (
              <Line
                key={`rp-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={p.x}
                y2={p.y}
                stroke={isPast ? "#22c55e" : "#6366f1"}
                strokeWidth={4}
                strokeLinecap="round"
              />
            );
          })}

          {/* User dot */}
          {userPos && (
            <G>
              <Circle cx={userPos.x} cy={userPos.y} r={14} fill="#6366f120" />
              <Circle
                cx={userPos.x}
                cy={userPos.y}
                r={7}
                fill="#6366f1"
                stroke="#fff"
                strokeWidth={2}
              />
            </G>
          )}

          {/* Destination marker */}
          {room?.shape && (
            <G>
              <Circle
                cx={
                  room.shape.type === "circle"
                    ? room.shape.x + (room.shape.radius || 30)
                    : room.shape.x + (room.shape.width || 80) / 2
                }
                cy={
                  room.shape.type === "circle"
                    ? room.shape.y - 10
                    : room.shape.y - 10
                }
                r={6}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={2}
              />
            </G>
          )}
        </Svg>

        {/* Direction card */}
        {isNavigating && currentDirection && (
          <View style={s.directionCard}>
            <View style={s.dirIcon}>
              <Ionicons
                name={
                  currentDirection.instruction.includes("left")
                    ? "arrow-back"
                    : currentDirection.instruction.includes("right")
                      ? "arrow-forward"
                      : "arrow-up"
                }
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.dirText}>{currentDirection.instruction}</Text>
              <Text style={s.dirDist}>
                {currentDirection.distance}px · Step {currentStep + 1}/
                {routeData.directions.length}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={s.bottomInfo}>
        {routeData && (
          <View style={s.infoRow}>
            <View style={s.infoItem}>
              <Text style={s.infoValue}>{Math.round(routeData.distance)}m</Text>
              <Text style={s.infoLabel}>Distance</Text>
            </View>
            <View style={s.infoItem}>
              <Text style={s.infoValue}>{routeData.eta}s</Text>
              <Text style={s.infoLabel}>ETA</Text>
            </View>
            <View style={s.infoItem}>
              <Text style={s.infoValue}>{routeData.nodeCount}</Text>
              <Text style={s.infoLabel}>Waypoints</Text>
            </View>
          </View>
        )}

        {!isNavigating ? (
          <TouchableOpacity style={s.startBtn} onPress={startNavigation}>
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={s.startBtnText}>Start Navigation</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: colors.danger }]}
            onPress={() => {
              setIsNavigating(false);
              Speech.stop();
            }}
          >
            <Ionicons name="stop" size={20} color="#fff" />
            <Text style={s.startBtnText}>Stop Navigation</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.arBtn}
          onPress={() =>
            navigation.navigate("AR", { routeData, room, heading })
          }
        >
          <Ionicons name="camera" size={18} color={colors.primary} />
          <Text
            style={{ color: colors.primary, fontWeight: "600", marginLeft: 8 }}
          >
            Switch to AR View
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
