import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform, Easing, Image
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Ellipse, Circle } from "react-native-svg";
import { ThemeContext } from "../context/ThemeContext";

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

// Curve calculation parameters
function getCurveParams(dirType, w, h) {
  const startX = w / 2;
  const startY = h;
  const endY = h * 0.15; // Horizon
  
  if (dirType.includes("left")) {
    return { p0: {x: startX, y: startY}, p1: {x: startX, y: h * 0.6}, p2: {x: -w * 0.2, y: endY} };
  } else if (dirType.includes("right")) {
    return { p0: {x: startX, y: startY}, p1: {x: startX, y: h * 0.6}, p2: {x: w * 1.2, y: endY} };
  } else {
    return { p0: {x: startX, y: startY}, p1: {x: startX, y: h * 0.5}, p2: {x: startX, y: endY} };
  }
}

function getPointOnCurve(t, p0, p1, p2) {
  const x = Math.pow(1 - t, 2) * p0.x + 2 * (1 - t) * t * p1.x + Math.pow(t, 2) * p2.x;
  const y = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;
  return { x, y };
}

function getDerivativeAngle(t, p0, p1, p2) {
  const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return Math.atan2(dy, dx);
}

// Generate an SVG path for a chevron pointing along the path angle
function getChevronPath(cx, cy, angle, size) {
  const pLeft = { x: -size, y: size * 0.8 };
  const pTip = { x: 0, y: -size * 0.6 };
  const pRight = { x: size, y: size * 0.8 };
  
  const rot = angle + Math.PI / 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  
  const rotPoint = (p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos
  });

  const rl = rotPoint(pLeft);
  const rt = rotPoint(pTip);
  const rr = rotPoint(pRight);
  
  return `M ${rl.x} ${rl.y} L ${rt.x} ${rt.y} L ${rr.x} ${rr.y}`;
}

// Generate the SVG Path for the main road
function getRoadPath(p0, p1, p2) {
  return `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`;
}

function haversineDist(lat1, lng1, lat2, lng2) {
  const dx = (lat1 - lat2) * 111320;
  const dy = (lng1 - lng2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

// Custom AR Avatar: Realistic 3D Baby Panda HUD with dynamic directional signboard
const RealisticBabyPanda = ({ dirType, floatAnim }) => {
  const isLeft = dirType.includes("left");
  const isRight = dirType.includes("right");
  
  // Position the panda logically depending on the next turn direction
  const posStyle = isLeft ? { left: 16 } : isRight ? { right: 16 } : { left: SW / 2 - 70 };
  
  return (
    <Animated.View style={[
      { position: 'absolute', top: SH * 0.40, zIndex: 10, flexDirection: isRight ? 'row-reverse' : 'row', alignItems: 'center' },
      posStyle,
      { transform: [{ translateY: floatAnim.interpolate({ inputRange:[0,1], outputRange:[-15, 15] }) }] }
    ]}>
      {/* Realistic 3D Panda Image Avatar Bubble */}
      <View style={{
         width: 140, height: 140, borderRadius: 70, overflow: 'hidden',
         borderWidth: 5, borderColor: '#3b82f6',
         backgroundColor: '#fff',
         shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 12,
         zIndex: 2
      }}>
         <Image source={require('../../assets/3d_baby_panda.jpg')} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
      </View>

      {/* Dynamic Direction Board extending from the Panda Avatar */}
      <View style={{
         backgroundColor: '#3b82f6', borderRadius: 24, padding: 16,
         borderWidth: 4, borderColor: '#fff',
         shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 12,
         elevation: 10,
         marginLeft: isRight ? 0 : -30,
         marginRight: isRight ? -30 : 0,
         paddingLeft: isRight ? 16 : 40,
         paddingRight: isRight ? 40 : 16,
         zIndex: 1
      }}>
         <MaterialCommunityIcons name={isLeft ? 'turn-left' : isRight ? 'turn-right' : 'arrow-up-thick'} size={60} color="#fff" />
      </View>
    </Animated.View>
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

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

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

    // Pulse animation for the ground ring
    Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
    ).start();

    return () => sub.remove();
  }, []);

  useEffect(() => {
    let locationWatcher;
    (async () => {
      locationWatcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0.5 },
        (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;

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
              if (nextInst) Speech.speak(nextInst, { language: "en-US", rate: 0.9 });
            } else {
              setArrived(true);
              setLiveDistance(0); setLiveStepDist(0);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Speech.speak("You have arrived at your destination!");
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
  
  const curveParams = getCurveParams(dirType, roadW, roadH);
  const rPath = getRoadPath(curveParams.p0, curveParams.p1, curveParams.p2);
  
  // Generate 5 chevrons spaced evenly along the bezier curve
  const chevrons = [0.15, 0.35, 0.55, 0.75, 0.9].map(t => {
    const pt = getPointOnCurve(t, curveParams.p0, curveParams.p1, curveParams.p2);
    const angle = getDerivativeAngle(t, curveParams.p0, curveParams.p1, curveParams.p2);
    return getChevronPath(pt.x, pt.y, angle, 45);
  });

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Dark gradient overlay to ensure UI elements remain visible but lighter than before */}
      <View style={styles.topGradient} />

      {/* --- 3D Ground Projected Solid Road --- */}
      <View style={styles.groundContainer} pointerEvents="none">
        {/* REMOVED translateX transform so the oversized SVG inherently centers via alignItems: 'center' */}
        <Svg width={roadW} height={roadH}>
          {/* Thick solid white outer border */}
          <Path d={rPath} stroke="#ffffff" strokeWidth={180} strokeLinecap="butt" fill="none" opacity={0.95} />
          {/* Inner solid blue painted road */}
          <Path d={rPath} stroke="#2563eb" strokeWidth={160} strokeLinecap="butt" fill="none" opacity={0.95} />
          
          {/* Solid White Directional Chevrons along the curve */}
          {chevrons.map((chPath, i) => (
             <Path key={i} d={chPath} stroke="#ffffff" strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.95} />
          ))}
        </Svg>
      </View>

      {/* Realistic AR Baby Panda HUD Guide */}
      {!arrived && <RealisticBabyPanda dirType={dirType} floatAnim={floatAnim} />}

      {/* --- Floating Destination Pin --- */}
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

      {/* --- Top Futuristic Info Bar --- */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.metricsContainer}>
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
              <Animated.View style={{ transform: [{ rotate: `-${heading}deg` }] }}>
                <Ionicons name="compass" size={16} color="#3b82f6" />
              </Animated.View>
              <Text style={[styles.metricVal, { marginLeft: 6 }]}>{Math.round(heading)}°</Text>
            </View>
          </View>
        </View>
      </View>

      {/* --- Next-Turn Floating Glass Card --- */}
      {!arrived && (
        <View style={styles.turnCard}>
          <View style={[styles.turnIconBg, { backgroundColor: "#3b82f6" }]}>
            <MaterialCommunityIcons name={dirIcon} size={42} color="#fff" />
          </View>
          <View style={styles.turnTextWrap}>
            <Text style={[styles.turnDistLabel, { color: "#3b82f6" }]}>IN {liveStepDist} METERS</Text>
            <Text style={styles.turnInstText} numberOfLines={2}>{dirLabel}</Text>
          </View>
        </View>
      )}

      {/* --- Arrived Overlay Card --- */}
      {arrived && (
        <View style={[styles.turnCard, { backgroundColor: "rgba(16, 185, 129, 0.95)", borderColor: "#10b981" }]}>
          <Ionicons name="checkmark-circle" size={48} color="#fff" />
          <View style={styles.turnTextWrap}>
            <Text style={[styles.turnInstText, { fontSize: 22 }]}>Destination Reached</Text>
            <Text style={[styles.turnDistLabel, { color: "rgba(255,255,255,0.8)", marginTop: 4 }]}>{room?.name || "Target Location"}</Text>
          </View>
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
    // The magic 3D perspective transform that lays the SVG flat on the ground!
    transform: [{ perspective: 550 }, { rotateX: '74deg' }],
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
  backBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    marginRight: 12,
  },
  metricsContainer: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  metric: { flex: 1, alignItems: "center" },
  metricLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
  metricVal: { color: "#fff", fontSize: 16, fontWeight: "900" },
  divider: { width: 1, height: "80%", backgroundColor: "rgba(255,255,255,0.2)" },

  turnCard: {
    position: "absolute", bottom: Platform.OS === "ios" ? 50 : 40, alignSelf: "center",
    width: SW * 0.92, backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 24, padding: 18,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(0, 240, 255, 0.4)",
    shadowColor: "#00f0ff", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20,
    elevation: 12, zIndex: 10,
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
