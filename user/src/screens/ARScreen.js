import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform, Easing
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path, Defs, LinearGradient, Stop, RadialGradient } from "react-native-svg";
import { ThemeContext } from "../context/ThemeContext";
import { BlurView } from "expo-blur";
import ARRobotGuide from "../components/ARRobotGuide";

const AnimatedPath = Animated.createAnimatedComponent(Path);

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
  if (lower.includes("arrived") || lower.includes("destination")) return "arrived";
  return "straight";
}

function getDirIcon(dirType) {
  switch (dirType) {
    case "left":
    case "sharp_left": return "turn-left";
    case "right":
    case "sharp_right": return "turn-right";
    case "stairs": return "stairs";
    case "elevator": return "elevator-passenger";
    case "arrived": return "check-circle";
    default: return "arrow-up-thick";
  }
}

// Helper to format text for better Speech pronunciation (e.g., "5-g-03" -> "5 g 0 3")
const formatSpeech = (text) => {
  if (!text) return "";
  return text.replace(/-/g, " ");
};

function getBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const l1 = lat1 * Math.PI / 180;
  const l2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function haversineDist(lat1, lng1, lat2, lng2) {
  const dx = (lat1 - lat2) * 111320;
  const dy = (lng1 - lng2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Generate individual chevron arrow paths along the projected route ───
function generateChevronArrows(pathNodes, userLat, userLng, userHeading, w, h) {
  if (!userLat || !userLng || !pathNodes || pathNodes.length === 0) {
    // Default: straight-ahead chevrons
    const chevrons = [];
    const centerX = w / 2;
    for (let i = 0; i < 8; i++) {
      const y = h - (i * h * 0.1) - 40;
      const size = 50 - i * 3;
      const opacity = 1 - (i * 0.1);
      chevrons.push({
        path: buildChevronPath(centerX, y, 0, size),
        opacity,
        scale: 1 - i * 0.04,
        index: i,
      });
    }
    return { chevrons, mainPath: `M ${centerX} ${h} L ${centerX} ${h * 0.15}` };
  }

  const SCALE = 25;
  const startX = w / 2;
  const startY = h;

  let points = [{ x: startX, y: startY }];

  for (let i = 0; i < pathNodes.length; i++) {
    const node = pathNodes[i];
    const dist = haversineDist(userLat, userLng, node.x, node.y);
    const bearing = getBearing(userLat, userLng, node.x, node.y);
    let relAngle = (bearing - userHeading + 360) % 360;
    if (relAngle > 180) relAngle -= 360;
    const rad = relAngle * (Math.PI / 180);
    const px = startX + (dist * SCALE) * Math.sin(rad);
    const py = startY - (dist * SCALE) * Math.cos(rad);
    points.push({ x: px, y: py });
  }

  // Build main path string
  let mainPath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    mainPath += ` L ${points[i].x} ${points[i].y}`;
  }

  // Generate chevrons along the path at even intervals
  const chevrons = [];
  const CHEVRON_SPACING = 65;
  let accumulated = 0;
  let chevronIndex = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    let distAlongSeg = CHEVRON_SPACING - accumulated;

    while (distAlongSeg <= segLen && chevronIndex < 14) {
      const t = distAlongSeg / segLen;
      const cx = points[i - 1].x + dx * t;
      const cy = points[i - 1].y + dy * t;

      // Perspective: farther = smaller & more transparent
      const normDist = chevronIndex / 14;
      const size = 55 - normDist * 25;
      const opacity = 1.0 - normDist * 0.5;

      chevrons.push({
        path: buildChevronPath(cx, cy, angle, size),
        opacity,
        scale: 1 - normDist * 0.3,
        index: chevronIndex,
      });

      chevronIndex++;
      distAlongSeg += CHEVRON_SPACING;
    }

    accumulated = segLen - (distAlongSeg - CHEVRON_SPACING);
    if (accumulated < 0) accumulated = 0;
  }

  return { chevrons, mainPath };
}

// Build a single chevron (>>>) shape SVG path at a given position and angle
function buildChevronPath(cx, cy, angle, size) {
  // Chevron points: like a "V" rotated to point along the direction
  const halfW = size * 0.4;
  const halfH = size * 0.3;

  const pts = [
    { x: -halfW, y: halfH },    // bottom-left
    { x: 0, y: -halfH },        // tip (forward)
    { x: halfW, y: halfH },     // bottom-right
  ];

  // Rotate by angle - 90deg (since angle 0 = right, but we want forward = up)
  const rot = angle - Math.PI / 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const rotated = pts.map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));

  return `M ${rotated[0].x} ${rotated[0].y} L ${rotated[1].x} ${rotated[1].y} L ${rotated[2].x} ${rotated[2].y}`;
}


// ═══════════════════════════════════════════════════════
// ANIMATED CHEVRON ARROW COMPONENT
// ═══════════════════════════════════════════════════════
const AnimatedChevronArrow = ({ pathData, delay, opacity: baseOpacity, flowAnim }) => {
  const animatedOpacity = flowAnim.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: [baseOpacity * 0.3, baseOpacity, baseOpacity * 0.8, baseOpacity * 0.3],
  });

  return (
    <AnimatedPath
      d={pathData}
      stroke="#00e5ff"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={animatedOpacity}
    />
  );
};


export default function ARScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const { routeData, room, heading: initHeading } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [heading, setHeading] = useState(initHeading || 0);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [liveDistance, setLiveDistance] = useState(routeData?.distance || 0);
  const [liveStepDist, setLiveStepDist] = useState(Math.round(routeData?.directions?.[0]?.distance || 0));
  const [arrived, setArrived] = useState(false);
  const [userLoc, setUserLoc] = useState(null);

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pathFade = useRef(new Animated.Value(0)).current;
  const dashOffset = useRef(new Animated.Value(0)).current;

  // Chevron flow animations — staggered wave
  const NUM_CHEVRONS = 14;
  const chevronAnims = useRef(
    Array.from({ length: NUM_CHEVRONS }, () => new Animated.Value(0))
  ).current;

  // Refs for tracking current state inside callbacks
  const currentStepRef = useRef(currentStep);
  const routeDataRef = useRef(routeData);
  const arrivedRef = useRef(arrived);

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { routeDataRef.current = routeData; }, [routeData]);
  useEffect(() => { arrivedRef.current = arrived; }, [arrived]);

  useEffect(() => {
    // Subscribe to Magnetometer for real-time live compass
    const sub = Magnetometer.addListener(d => {
      const h = Math.atan2(d.y, d.x) * (180 / Math.PI);
      setHeading((h + 360) % 360);
    });
    Magnetometer.setUpdateInterval(50);

    // Hover animation for the destination pin
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    // Pulse animation for ground ring
    Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
    ).start();

    // Continuous centerline flow loop
    Animated.loop(
      Animated.timing(dashOffset, {
        toValue: -90,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false
      })
    ).start();

    // Staggered chevron wave animation
    const startChevronWave = () => {
      const animations = chevronAnims.map((anim, i) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(i * 120),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: false,
            }),
          ])
        );
      });
      Animated.parallel(animations).start();
    };
    startChevronWave();

    return () => sub.remove();
  }, []);

  // Entrance animation when step changes
  useEffect(() => {
    pathFade.setValue(0);
    Animated.timing(pathFade, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  }, [currentStep]);

  // GPS location watcher
  useEffect(() => {
    let locationWatcher;
    (async () => {
      locationWatcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0.5 },
        (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          setUserLoc({ lat, lng });

          const rData = routeDataRef.current;
          const cStep = currentStepRef.current;
          const isArrived = arrivedRef.current;

          if (!rData || !rData.path || isArrived) return;

          const targetNode = rData.path[cStep + 1] || rData.path[cStep];
          if (!targetNode) return;

          const distToNode = haversineDist(lat, lng, targetNode.x, targetNode.y);
          setLiveStepDist(Math.round(distToNode));

          const remainingPathMeters = rData.directions
            ?.slice(cStep + 1)
            .reduce((sum, d) => sum + (d.distance || 0), 0) || 0;

          setLiveDistance(Math.max(0, Math.round(distToNode + remainingPathMeters)));

          // Step advancement logic
          if (distToNode < 8) {
            if (cStep < (rData.directions?.length || 1) - 1) {
              setCurrentStep(s => s + 1);
              setLiveStepDist(Math.round(rData.directions[cStep + 1]?.distance || 0));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const nextInst = rData.directions[cStep + 1]?.instruction;
              // Speech is handled by ARRobotGuide component via instructionText prop
            } else {
              setArrived(true);
              setLiveDistance(0); setLiveStepDist(0);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Speech.speak(formatSpeech("You have arrived at your destination!"), { language: "en-US" });
            }
          }
        }
      );
    })();
    return () => { if (locationWatcher) locationWatcher.remove(); };
  }, []);

  if (!permission?.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Ionicons name="camera" size={60} color={colors.primary} />
        <Text style={styles.permText}>AR Navigation requires Camera Access</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textSec }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentDir = routeData?.directions?.[currentStep];
  const dirType = getDirectionType(currentDir?.instruction);
  const dirIcon = getDirIcon(dirType);
  const dirLabel = currentDir?.instruction || "Proceed on the highlighted path";
  
  // Road dimensions
  const roadW = SW * 1.5;
  const roadH = SH * 0.85;
  
  // Calculate true real-world projected path based on upcoming coordinates
  const upcomingNodes = routeData?.path?.slice(currentStep) || [];
  const { chevrons, mainPath } = generateChevronArrows(
    upcomingNodes, 
    userLoc?.lat, 
    userLoc?.lng, 
    heading, 
    roadW, 
    roadH
  );

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Dark gradient overlay for UI visibility */}
      <View style={styles.topGradient} />

      {/* ─── 3D Ground Projected Path with Animated Chevron Arrows ─── */}
      <Animated.View style={[
        styles.groundContainer,
        {
          opacity: pathFade,
          transform: [
            { perspective: 800 },
            { rotateX: '82deg' },
            { translateY: pathFade.interpolate({ inputRange: [0, 1], outputRange: [200, 50] }) }
          ]
        }
      ]} pointerEvents="none">
        <Svg width={roadW} height={roadH}>
          <Defs>
            {/* Path glow gradient */}
            <LinearGradient id="pathGlow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#00e5ff" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#00e5ff" stopOpacity="0.05" />
            </LinearGradient>
            <RadialGradient id="chevGlow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#00e5ff" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#00e5ff" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Outer soft glow under path */}
          <Path d={mainPath} stroke="rgba(0, 229, 255, 0.08)" strokeWidth={260} strokeLinecap="round" fill="none" />
          
          {/* Main road surface — subtle translucent */}
          <Path d={mainPath} stroke="rgba(0, 229, 255, 0.18)" strokeWidth={180} strokeLinecap="round" fill="none" />

          {/* Edge glow lines */}
          <Path d={mainPath} stroke="rgba(0, 229, 255, 0.45)" strokeWidth={4} fill="none" strokeDasharray="2, 30" strokeLinecap="round" />

          {/* ═══ ANIMATED CHEVRON ARROWS ═══ */}
          {chevrons.map((chev, i) => (
            <AnimatedChevronArrow
              key={i}
              pathData={chev.path}
              delay={i * 120}
              opacity={chev.opacity}
              flowAnim={chevronAnims[Math.min(i, chevronAnims.length - 1)]}
            />
          ))}

          {/* Inner flowing dashes (animated) */}
          <AnimatedPath
            d={mainPath}
            stroke="#ffffff"
            strokeWidth={3}
            strokeLinecap="butt"
            fill="none"
            opacity={0.25}
            strokeDasharray={[15, 45]}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      </Animated.View>

      {/* ─── Realistic Robot Guide ─── */}
      {!arrived && <ARRobotGuide dirType={dirType} instructionText={dirLabel} />}

      {/* ─── Floating Destination Pin ─── */}
      {arrived ? (
        <Animated.View style={[styles.destMarker, { transform: [{ translateY: floatAnim.interpolate({ inputRange:[0,1], outputRange:[-15, 15] }) }] }]}>
          <Ionicons name="checkmark-circle" size={90} color="#10b981" />
          <View style={styles.pinShadow} />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.destMarker, { transform: [{ translateY: floatAnim.interpolate({ inputRange:[0,1], outputRange:[-15, 15] }) }] }]}>
          <Ionicons name="location-sharp" size={90} color="#ef4444" />
          <View style={styles.pinShadow} />
        </Animated.View>
      )}

      {/* ─── Top Futuristic Info Bar ─── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtnWrapper} onPress={() => navigation.goBack()}>
          <BlurView intensity={80} tint="dark" style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </BlurView>
        </TouchableOpacity>
        
        <BlurView intensity={80} tint="dark" style={styles.metricsContainer}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>DISTANCE</Text>
            <Text style={styles.metricVal}>{liveDistance} m</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>ETA</Text>
            <Text style={styles.metricVal}>{Math.ceil(liveDistance/1.2/60)} min</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.metric, { flex: 1.2 }]}>
            <Text style={styles.metricLabel}>COMPASS</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              <View style={{ transform: [{ rotate: `${-heading}deg` }] }}>
                <Ionicons name="compass" size={16} color="#3b82f6" />
              </View>
              <Text style={[styles.metricVal, { marginLeft: 6 }]}>{Math.round(heading)}°</Text>
            </View>
          </View>
        </BlurView>
      </View>

      {/* ─── Next-Turn Floating Glass Card ─── */}
      {!arrived && (
        <View style={styles.turnCardWrapper}>
          <BlurView intensity={80} tint="dark" style={styles.turnCard}>
            <View style={[styles.turnIconBg, { backgroundColor: "#3b82f6" }]}>
              <MaterialCommunityIcons name={dirIcon} size={42} color="#fff" />
            </View>
            <View style={styles.turnTextWrap}>
              <Text style={[styles.turnDistLabel, { color: "#00e5ff" }]}>IN {liveStepDist} METERS</Text>
              <Text style={styles.turnInstText} numberOfLines={2}>{dirLabel}</Text>
            </View>
          </BlurView>
        </View>
      )}

      {/* ─── Arrived Overlay Card ─── */}
      {arrived && (
        <View style={styles.turnCardWrapper}>
          <BlurView intensity={90} tint="dark" style={[styles.turnCard, { borderColor: "#10b981" }]}>
            <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            <View style={styles.turnTextWrap}>
              <Text style={[styles.turnInstText, { fontSize: 22 }]}>Destination Reached</Text>
              <Text style={[styles.turnDistLabel, { color: "rgba(255,255,255,0.8)", marginTop: 4 }]}>{room?.name || "Target Location"}</Text>
            </View>
          </BlurView>
        </View>
      )}
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  permText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 30, textAlign: "center" },
  permBtn: { backgroundColor: "#06b6d4", paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12 },
  permBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  
  topGradient: {
    position: "absolute", top: 0, left: 0, right: 0, height: 160,
    backgroundColor: "rgba(0,0,0,0.3)", 
  },
  
  groundContainer: {
    position: 'absolute', bottom: -SH * 0.15, left: 0, width: SW, height: SH * 0.85,
    alignItems: 'center', justifyContent: 'flex-end',
    zIndex: 1,
  },

  destMarker: {
    position: 'absolute', top: SH * 0.32, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10,
    elevation: 10,
  },
  pinShadow: {
    position: 'absolute', width: 24, height: 8, borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    bottom: -4, transform: [{ scaleX: 1.5 }],
  },

  topBar: {
    position: "absolute", top: Platform.OS === "ios" ? 50 : 40, left: 16, right: 16,
    flexDirection: "row", alignItems: "center",
    zIndex: 10,
  },
  backBtnWrapper: {
    marginRight: 12,
    borderRadius: 23,
    overflow: "hidden",
  },
  backBtn: {
    width: 46, height: 46,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  metricsContainer: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  metric: { flex: 1, alignItems: "center" },
  metricLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
  metricVal: { color: "#fff", fontSize: 16, fontWeight: "900" },
  divider: { width: 1, height: "80%", backgroundColor: "rgba(255,255,255,0.2)" },

  turnCardWrapper: {
    position: "absolute", bottom: Platform.OS === "ios" ? 50 : 40, alignSelf: "center",
    width: SW * 0.92,
    borderRadius: 24,
    shadowColor: "#00e5ff", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20,
    elevation: 12, zIndex: 10,
    overflow: "hidden",
  },
  turnCard: {
    width: "100%", backgroundColor: "rgba(15, 23, 42, 0.4)",
    padding: 18,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(0, 229, 255, 0.4)",
  },
  turnIconBg: {
    width: 68, height: 68, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6,
  },
  turnTextWrap: { flex: 1, marginLeft: 18 },
  turnDistLabel: { fontSize: 13, fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
  turnInstText: { color: "#fff", fontSize: 21, fontWeight: "800", lineHeight: 28 },
});
