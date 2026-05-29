import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform, Easing
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Magnetometer, DeviceMotion } from "expo-sensors";
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

// ═══════════════════════════════════════════════════════
// AR PINHOLE CAMERA PROJECTION
// ═══════════════════════════════════════════════════════
const CAMERA_HEIGHT = 1.5;        // metres – phone held at eye / hand level
const H_FOV_DEG    = 60;          // horizontal field-of-view (typical phone)
const FOCAL_PX     = (SW / 2) / Math.tan((H_FOV_DEG / 2) * Math.PI / 180);
const VANISH_Y     = SH * 0.33;   // vanishing-point screen position
const MIN_Z        = 1.5;         // min forward depth (metres)
const MAX_Z        = 50;          // max render distance (tighter for accuracy)
const REF_Z        = 4;           // depth at which chevrons are "base" size
const BASE_CHEV    = 50;          // chevron px size at REF_Z
const CHEV_GAP_PX  = 65;          // pixel gap between chevrons (more spaced for clarity)
const MAX_CHEVRONS = 8;           // fewer chevrons for single-segment display

// ── Heading circular EMA (handles 0° / 360° wraparound) ──
function smoothHeadingEMA(current, target, alpha = 0.15) {
  let diff = target - current;
  if (diff > 180)  diff -= 360;
  if (diff < -180) diff += 360;
  return ((current + diff * alpha) + 360) % 360;
}

// ── Project GPS path nodes → screen coords via pinhole camera ──
function projectPathToScreen(pathNodes, userLat, userLng, userHeading) {
  if (!userLat || !userLng || !pathNodes || pathNodes.length === 0) return [];

  const hRad   = (userHeading * Math.PI) / 180;
  const cosH   = Math.cos(hRad);
  const sinH   = Math.sin(hRad);
  const cosLat = Math.cos(userLat * Math.PI / 180);

  const out = [];
  for (const node of pathNodes) {
    // GPS delta → metres
    const dLatM = (node.x - userLat) * 111320;
    const dLngM = (node.y - userLng) * 111320 * cosLat;

    // Rotate into local camera frame: z = forward along heading, x = right
    const z =  dLatM * cosH + dLngM * sinH;
    const x = -dLatM * sinH + dLngM * cosH;

    if (z < MIN_Z || z > MAX_Z) continue;                                   // depth cull

    // Pinhole projection
    const sx = SW / 2 + FOCAL_PX * x / z;
    const sy = VANISH_Y + FOCAL_PX * CAMERA_HEIGHT / z;

    if (sx < -120 || sx > SW + 120 || sy < -60 || sy > SH + 60) continue;   // frustum cull

    out.push({ screenX: sx, screenY: sy, depth: z });
  }
  return out;
}

// ── Full AR overlay data: chevrons + SVG mainPath string ──
function generateARPath(pathNodes, userLat, userLng, userHeading) {
  const projected = projectPathToScreen(pathNodes, userLat, userLng, userHeading);

  // ── fallback: straight-ahead when no projected points ──
  if (projected.length < 2) {
    const chevrons = [];
    const cx = SW / 2;
    for (let i = 0; i < 8; i++) {
      const fakeZ = 3 + i * 6;
      const sy    = VANISH_Y + FOCAL_PX * CAMERA_HEIGHT / fakeZ;
      const size  = BASE_CHEV * (REF_Z / fakeZ);
      chevrons.push({
        path: buildChevronPath(cx, sy, -Math.PI / 2, Math.max(size, 8)),
        opacity: Math.max(0.2, 1 - i * 0.09),
        scale: 1,
        index: i,
      });
    }
    return { chevrons, mainPath: `M ${cx} ${SH} L ${cx} ${VANISH_Y}` };
  }

  // ── SVG main-path string ──
  let mainPath = `M ${projected[0].screenX} ${projected[0].screenY}`;
  for (let i = 1; i < projected.length; i++) {
    mainPath += ` L ${projected[i].screenX} ${projected[i].screenY}`;
  }

  // ── chevrons at even pixel intervals along the projected path ──
  const chevrons = [];
  let accumulated = 0;
  let idx = 0;

  for (let i = 1; i < projected.length && idx < MAX_CHEVRONS; i++) {
    const p0 = projected[i - 1];
    const p1 = projected[i];
    const dx = p1.screenX - p0.screenX;
    const dy = p1.screenY - p0.screenY;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    const angle  = Math.atan2(dy, dx);

    let cursor = CHEV_GAP_PX - accumulated;

    while (cursor <= segLen && idx < MAX_CHEVRONS) {
      const t     = cursor / segLen;
      const cx    = p0.screenX + dx * t;
      const cy    = p0.screenY + dy * t;
      const depth = p0.depth + (p1.depth - p0.depth) * t;

      // Perspective-correct sizing: close = large, far = small
      const size    = BASE_CHEV * (REF_Z / Math.max(depth, MIN_Z));
      const opacity = Math.max(0.15, 1.0 - depth / MAX_Z);

      chevrons.push({
        path: buildChevronPath(cx, cy, angle, Math.max(size, 8)),
        opacity,
        scale: 1,
        index: idx,
      });

      idx++;
      cursor += CHEV_GAP_PX;
    }

    accumulated = segLen - (cursor - CHEV_GAP_PX);
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

  // Rotate to point along the screen-space path direction
  const rot = angle + Math.PI / 2;
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
  const smoothedHeadingRef = useRef(initHeading || 0);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [liveDistance, setLiveDistance] = useState(routeData?.distance || 0);
  const [liveStepDist, setLiveStepDist] = useState(Math.round(routeData?.directions?.[0]?.distance || 0));
  const [arrived, setArrived] = useState(false);
  const [userLoc, setUserLoc] = useState(null);

  // Phone orientation & off-course detection
  const [isPhoneUpright, setIsPhoneUpright] = useState(true);
  const isPhoneUprightRef = useRef(true);

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pathFade = useRef(new Animated.Value(0)).current;
  const dashOffset = useRef(new Animated.Value(0)).current;
  const turnIndicatorAnim = useRef(new Animated.Value(0)).current;
  const turnPulseAnim = useRef(new Animated.Value(1)).current;

  // Chevron flow animations — staggered wave
  const NUM_CHEVRONS = 8;
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
    // Subscribe to Magnetometer for real-time live compass (with EMA smoothing)
    const sub = Magnetometer.addListener(d => {
      const rawH = (Math.atan2(d.y, d.x) * (180 / Math.PI) + 360) % 360;
      const smooth = smoothHeadingEMA(smoothedHeadingRef.current, rawH, 0.15);
      smoothedHeadingRef.current = smooth;
      setHeading(smooth);
    });
    Magnetometer.setUpdateInterval(50);

    // Subscribe to DeviceMotion for phone pitch (vertical hold detection)
    DeviceMotion.setUpdateInterval(200);
    const motionSub = DeviceMotion.addListener(({ rotation }) => {
      if (rotation) {
        // beta = pitch in radians. ~π/2 (90°) = phone held vertical (upright)
        const pitchDeg = Math.abs(rotation.beta * (180 / Math.PI));
        const upright = pitchDeg > 45 && pitchDeg < 135;
        isPhoneUprightRef.current = upright;
        setIsPhoneUpright(upright);
      }
    });

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

    // Turn indicator pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(turnPulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(turnPulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    return () => {
      sub.remove();
      motionSub.remove();
    };
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
  
  // ── Limit path to ONLY the current segment (next first path) ──
  // Each direction[i] maps to path[i] → path[i+1], so for the current step
  // we only need the nodes from currentStep to currentStep+1 (one segment).
  // We include a small look-ahead buffer of +1 extra node for smooth visuals.
  const pathLen = routeData?.path?.length || 0;
  const segmentEnd = Math.min(currentStep + 2, pathLen); // current node + next node
  const upcomingNodes = routeData?.path?.slice(currentStep, segmentEnd) || [];

  // ── Off-course detection ──
  // Compare user's compass heading to the bearing toward the next path node
  const nextNode = routeData?.path?.[currentStep + 1] || routeData?.path?.[currentStep];
  let offCourseAngle = 0;
  let isOffCourse = false;
  let turnDirection = null; // 'left', 'right', or 'uturn'

  if (userLoc && nextNode && !arrived) {
    const bearingToNext = getBearing(userLoc.lat, userLoc.lng, nextNode.x, nextNode.y);
    // Signed angle difference: negative = need to turn left, positive = need to turn right
    offCourseAngle = ((bearingToNext - heading) + 540) % 360 - 180;
    isOffCourse = Math.abs(offCourseAngle) > 60;

    if (isOffCourse) {
      if (Math.abs(offCourseAngle) > 150) {
        turnDirection = 'uturn';
      } else if (offCourseAngle < -60) {
        turnDirection = 'left';
      } else {
        turnDirection = 'right';
      }
    }
  }

  // Only generate AR path when phone is upright AND user is on-course
  const showARPath = isPhoneUpright && !isOffCourse && !arrived;

  const { chevrons, mainPath } = generateARPath(
    showARPath ? upcomingNodes : [],
    userLoc?.lat,
    userLoc?.lng,
    heading
  );

  // Turn indicator icon & label
  const getTurnIndicatorInfo = () => {
    if (!turnDirection) return { icon: 'arrow-up-thick', label: 'Continue' };
    switch (turnDirection) {
      case 'left':
        return { icon: 'rotate-left', label: 'Turn Left to Path' };
      case 'right':
        return { icon: 'rotate-right', label: 'Turn Right to Path' };
      case 'uturn':
        return { icon: 'backup-restore', label: 'Turn Around' };
      default:
        return { icon: 'arrow-up-thick', label: 'Continue' };
    }
  };
  const turnInfo = getTurnIndicatorInfo();

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Dark gradient overlay for UI visibility */}
      <View style={styles.topGradient} />

      {/* ─── AR Ground-Projected Path (only when upright & on-course) ─── */}
      {showARPath && (
        <Animated.View style={[styles.arOverlay, { opacity: pathFade }]} pointerEvents="none">
          <Svg width={SW} height={SH}>
            <Defs>
              {/* Path glow gradient */}
              <LinearGradient id="pathGlow" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#00e5ff" stopOpacity="0.3" />
                <Stop offset="1" stopColor="#00e5ff" stopOpacity="0.05" />
              </LinearGradient>
            </Defs>

            {/* Soft outer glow */}
            <Path d={mainPath} stroke="rgba(0, 229, 255, 0.05)" strokeWidth={50} strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* Road surface */}
            <Path d={mainPath} stroke="rgba(0, 229, 255, 0.12)" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* Edge highlight */}
            <Path d={mainPath} stroke="rgba(0, 229, 255, 0.3)" strokeWidth={2} fill="none" strokeDasharray="2,24" strokeLinecap="round" />

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

            {/* Flowing center dashes */}
            <AnimatedPath
              d={mainPath}
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinecap="butt"
              fill="none"
              opacity={0.18}
              strokeDasharray={[10, 36]}
              strokeDashoffset={dashOffset}
            />
          </Svg>
        </Animated.View>
      )}

      {/* ─── OFF-COURSE: Turn Direction Indicator ─── */}
      {isOffCourse && isPhoneUpright && !arrived && (
        <View style={styles.turnOverlay} pointerEvents="none">
          <Animated.View style={[
            styles.turnIndicatorCard,
            { transform: [{ scale: turnPulseAnim }] }
          ]}>
            {/* Glowing ring behind icon */}
            <View style={styles.turnGlowRing}>
              <View style={styles.turnIconCircle}>
                <MaterialCommunityIcons
                  name={turnInfo.icon}
                  size={64}
                  color="#fff"
                />
              </View>
            </View>
            <Text style={styles.turnLabelText}>{turnInfo.label}</Text>
            <Text style={styles.turnSubText}>
              {Math.abs(Math.round(offCourseAngle))}° off course
            </Text>
          </Animated.View>
        </View>
      )}

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
  
  arOverlay: {
    position: 'absolute', top: 0, left: 0, width: SW, height: SH,
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

  // Off-course turn direction overlay
  turnOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  turnIndicatorCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 40,
    borderRadius: 30,
    backgroundColor: 'rgba(10, 16, 30, 0.85)',
    borderWidth: 2,
    borderColor: 'rgba(255, 165, 0, 0.6)',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  turnGlowRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 165, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 165, 0, 0.3)',
  },
  turnIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 140, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  turnLabelText: {
    color: '#ffa500',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  turnSubText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.5,
  },

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
