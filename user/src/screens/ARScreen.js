import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform, Easing, Image
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Ellipse, Circle } from "react-native-svg";
import { ThemeContext } from "../context/ThemeContext";
import { BlurView } from "expo-blur";

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

// Map real-world GPS coordinates to local SVG coordinates based on user heading
function getProjectedPath(pathNodes, userLat, userLng, userHeading, w, h) {
  // If we don't have enough data, draw a straight line ahead (default)
  if (!userLat || !userLng || !pathNodes || pathNodes.length === 0) {
    return { pathString: `M ${w/2} ${h} L ${w/2} ${h*0.2}`, chevrons: [] };
  }

  const SCALE = 25; // pixels per meter on the projected ground
  const startX = w / 2;
  const startY = h;

  let points = [{ x: startX, y: startY }];
  let chevrons = [];

  for (let i = 0; i < pathNodes.length; i++) {
    const node = pathNodes[i];
    const dist = haversineDist(userLat, userLng, node.x, node.y);
    const bearing = getBearing(userLat, userLng, node.x, node.y);
    
    // Convert true bearing into relative screen angle based on compass
    let relAngle = (bearing - userHeading + 360) % 360;
    
    // Normalize relative angle to -180 to +180
    if (relAngle > 180) relAngle -= 360;

    const rad = relAngle * (Math.PI / 180);
    // X goes right, Y goes up (which means decreasing Y in SVG)
    const px = startX + (dist * SCALE) * Math.sin(rad);
    const py = startY - (dist * SCALE) * Math.cos(rad);

    points.push({ x: px, y: py });
  }

  // Generate polyline
  let pathString = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathString += ` L ${points[i].x} ${points[i].y}`;
    
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    const segDist = Math.sqrt(dx*dx + dy*dy);
    const angle = Math.atan2(dy, dx);

    const numChevs = Math.floor(segDist / 60);
    for (let c = 1; c <= numChevs; c++) {
      const cx = points[i-1].x + dx * (c / (numChevs + 1));
      const cy = points[i-1].y + dy * (c / (numChevs + 1));
      chevrons.push(getChevronPath(cx, cy, angle, 45));
    }
  }

  return { pathString, chevrons };
}

function haversineDist(lat1, lng1, lat2, lng2) {
  const dx = (lat1 - lat2) * 111320;
  const dy = (lng1 - lng2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

// Custom AR HUD: Realistic 3D floating glowing signboard indicator (No Panda!)
const RealisticBabyPanda = ({ dirType, floatAnim }) => {
  const isLeft = dirType.includes("left");
  const isRight = dirType.includes("right");
  
  // Center it or align it to the side cleanly
  const posStyle = isLeft ? { left: 24 } : isRight ? { right: 24 } : { left: SW / 2 - 45 };
  
  return (
    <Animated.View style={[
      { position: 'absolute', top: SH * 0.38, zIndex: 10, alignItems: 'center' },
      posStyle,
      { transform: [{ translateY: floatAnim.interpolate({ inputRange:[0,1], outputRange:[-12, 12] }) }] }
    ]}>
      {/* High-tech Glowing Direction Circle */}
      <View style={{
         width: 90, height: 90, borderRadius: 45,
         backgroundColor: 'rgba(15, 23, 42, 0.85)',
         borderWidth: 3.5, borderColor: '#00f0ff',
         alignItems: 'center', justifyContent: 'center',
         shadowColor: '#00f0ff', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 16,
         elevation: 12,
      }}>
         <MaterialCommunityIcons 
           name={isLeft ? 'turn-left' : isRight ? 'turn-right' : 'arrow-up-thick'} 
           size={46} 
           color="#00f0ff" 
         />
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
  const [userLoc, setUserLoc] = useState(null);

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pathFade = useRef(new Animated.Value(0)).current;
  const dashOffset = useRef(new Animated.Value(0)).current;

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

    // Continuous centerline flow loop (flowing forward along path)
    Animated.loop(
      Animated.timing(dashOffset, {
        toValue: -90,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false
      })
    ).start();

    return () => sub.remove();
  }, []);

  // Entrance Slide/Fade animation when step direction changes
  useEffect(() => {
    pathFade.setValue(0);
    Animated.timing(pathFade, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  }, [currentStep]);

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
              if (nextInst) Speech.speak(formatSpeech(nextInst), { language: "en-US", rate: 0.9 });
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
  const { pathString: rPath, chevrons } = getProjectedPath(
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

      {/* Dark gradient overlay to ensure UI elements remain visible but lighter than before */}
      <View style={styles.topGradient} />

      {/* --- 3D Ground Projected Solid Road --- */}
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
        {/* REMOVED translateX transform so the oversized SVG inherently centers via alignItems: 'center' */}
        <Svg width={roadW} height={roadH}>
          {/* Outer Glow */}
          <Path d={rPath} stroke="rgba(0, 240, 255, 0.15)" strokeWidth={240} strokeLinecap="round" fill="none" />
          {/* Main Road Surface */}
          <Path d={rPath} stroke="rgba(0, 240, 255, 0.35)" strokeWidth={180} strokeLinecap="round" fill="none" />
          {/* Neon Borders */}
          <Path d={rPath} stroke="#00f0ff" strokeWidth={12} fill="none" strokeDasharray="1, 20" strokeLinecap="round" opacity={0.8} />
          
          {/* Flowing animated center arrows (using dashes) */}
          <AnimatedPath
            d={rPath}
            stroke="#ffffff"
            strokeWidth={40}
            strokeLinecap="butt"
            fill="none"
            opacity={0.9}
            strokeDasharray={[30, 80]}
            strokeDashoffset={dashOffset}
          />

          {/* Static Glowing Chevrons pointing to direction */}
          {chevrons.map((chPath, i) => (
             <Path key={i} d={chPath} stroke="#00f0ff" strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
          ))}
        </Svg>
      </Animated.View>

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

      {/* --- Next-Turn Floating Glass Card --- */}
      {!arrived && (
        <View style={styles.turnCardWrapper}>
          <BlurView intensity={80} tint="dark" style={styles.turnCard}>
            <View style={[styles.turnIconBg, { backgroundColor: "#3b82f6" }]}>
              <MaterialCommunityIcons name={dirIcon} size={42} color="#fff" />
            </View>
            <View style={styles.turnTextWrap}>
              <Text style={[styles.turnDistLabel, { color: "#3b82f6" }]}>IN {liveStepDist} METERS</Text>
              <Text style={styles.turnInstText} numberOfLines={2}>{dirLabel}</Text>
            </View>
          </BlurView>
        </View>
      )}

      {/* --- Arrived Overlay Card --- */}
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
    shadowColor: "#00f0ff", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20,
    elevation: 12, zIndex: 10,
    overflow: "hidden",
  },
  turnCard: {
    width: "100%", backgroundColor: "rgba(15, 23, 42, 0.4)",
    padding: 18,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(0, 240, 255, 0.4)",
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
