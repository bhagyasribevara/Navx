import React, {
  useState, useEffect, useRef, useContext, useCallback
} from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform, StatusBar
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Accelerometer, Magnetometer } from "expo-sensors";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { WebView } from "react-native-webview";
import { ThemeContext } from "../context/ThemeContext";
import ARRobotGuide from "../components/ARRobotGuide";
import { SHADOWS, RADIUS } from "../theme/designSystem";

const { width: SW, height: SH } = Dimensions.get("window");

const EARTH_R = 6_371_000;
const toRad = d => d * Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const WALK_SPEED = 1.2;
const AVG_STRIDE = 0.72;

function getCardinal(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

function getDirIcon(instruction = "") {
  const instr = instruction.toLowerCase();
  if (instr.includes("left")) return "arrow-back";
  if (instr.includes("right")) return "arrow-forward";
  if (instr.includes("stairs") || instr.includes("stair")) return "trending-up";
  if (instr.includes("elevator")) return "git-merge";
  if (instr.includes("floor")) return "swap-vertical";
  if (instr.includes("arrived") || instr.includes("arrive")) return "checkmark-circle";
  return "arrow-up";
}

// ─── Mini-Map HTML (Leaflet + Mapbox, same pattern as NavigationScreen) ───────
function buildMiniMapHTML(pathPoints, userPos, targetRoom) {
  const center = userPos
    ? [userPos.x, userPos.y]
    : (pathPoints?.length ? [pathPoints[0].x, pathPoints[0].y] : [18.4665, 83.6629]);

  const pathStr = pathPoints
    ? pathPoints.map(p => `[${p.x},${p.y}]`).join(",")
    : "";

  const routeLine = pathStr
    ? `
      L.polyline([${pathStr}],{color:'#818cf8',weight:5,opacity:0.35,lineCap:'round',lineJoin:'round'}).addTo(map);
      L.polyline([${pathStr}],{color:'#6366f1',weight:3,opacity:1,lineCap:'round',lineJoin:'round'}).addTo(map);
    `
    : "";

  const destX = targetRoom?.shape?.points?.[0]?.x || targetRoom?.shape?.x;
  const destY = targetRoom?.shape?.points?.[0]?.y || targetRoom?.shape?.y;
  const destDot = (destX && destY)
    ? `L.circleMarker([${destX},${destY}],{radius:7,color:'#fff',weight:2,fillColor:'#22c55e',fillOpacity:1}).addTo(map);`
    : "";

  const userMarker = userPos
    ? `window.userMarker = L.circleMarker([${userPos.x},${userPos.y}],{radius:8,color:'#fff',weight:2,fillColor:'#6366f1',fillOpacity:1,zIndexOffset:1000}).addTo(map);`
    : `window.userMarker = null;`;

  const mapboxUrl = process.env.EXPO_PUBLIC_MAPBOX_URL || "";

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
  html,body{margin:0;padding:0;background:#0a0e17;overflow:hidden;}
  #map{width:100%;height:100vh;background:#0a0e17;}
  .leaflet-container{background:#0a0e17!important;}
  .leaflet-control-zoom,.leaflet-control-attribution{display:none!important;}
</style>
</head><body><div id="map"></div>
<script>
var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${center[0]},${center[1]}],18);
L.tileLayer('${mapboxUrl}',{maxZoom:22,attribution:''}).addTo(map);
${routeLine}
${destDot}
${userMarker}

var _panDebounce = null;
window.updateUserPos = function(lat,lng,heading){
  if(!window.userMarker){
    window.userMarker = L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:2,fillColor:'#6366f1',fillOpacity:1,zIndexOffset:1000}).addTo(map);
    map.setView([lat,lng],18);
  } else {
    window.userMarker.setLatLng([lat,lng]);
  }
  // Debounced pan — only re-center every 3 seconds to avoid lag
  clearTimeout(_panDebounce);
  _panDebounce = setTimeout(function(){
    map.setView([lat,lng],18,{animate:false});
  }, 3000);
};
</script></body></html>`;
}

// ─── AR Path Canvas HTML ───────────────────────────────────────────────────────
// ONLY arrows — no lane outline, no side lines.
// Floor-anchored: path starts at screen BOTTOM, converges to vanishing point (horizon).
// Arrows flow AWAY from user (upward = toward destination).
function buildARPathHTML() {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;overflow:hidden;background:transparent;}
  canvas{position:fixed;top:0;left:0;width:100%;height:100%;background:transparent;}
</style>
</head><body>
<canvas id="c"></canvas>
<script>
var c = document.getElementById('c');
var ctx = c.getContext('2d');
var W = window.innerWidth;
var H = window.innerHeight;
c.width = W; c.height = H;

var dirType = 'straight';  // 'straight' | 'left' | 'right'
var isNearTurn = false;
var animOffset = 0;

// ── Floor perspective setup ──────────────────────────────────────────────────
// Vanishing point = horizon line (where floor meets sky)
// Floor is the BOTTOM portion of the screen
// Arrows start at the BOTTOM (near = camera feet) and go UP toward horizon
var VPX = W * 0.5;
var VPY = H * 0.40;    // horizon at 40% from top — shows enough floor
var FLOOR_Y = H;        // very bottom = camera position / user's feet

// Get floor-plane point at depth t (0=near/feet, 1=vanishing point)
function floorPoint(t) {
  // y: from FLOOR_Y (bottom) to VPY (horizon), perspective-compressed
  var depth = Math.pow(t, 0.60); // nonlinear — heavier toward near
  var y = FLOOR_Y + (VPY - FLOOR_Y) * depth;

  // x: straight center or curving for turns
  var curveX = 0;
  if (dirType === 'left')  curveX = -t * t * W * 0.52;
  if (dirType === 'right') curveX = +t * t * W * 0.52;
  var x = VPX + curveX;

  return { x: x, y: y, t: t };
}

// Travel-direction tangent at depth t (pointing AWAY from user)
function travelAngle(t) {
  var dt = 0.04;
  var a = floorPoint(t);
  var b = floorPoint(Math.min(t + dt, 0.97));
  // Vector from current to next (direction user is heading = away from user)
  return Math.atan2(b.y - a.y, b.x - a.x);
}

var ARROW_COUNT = 9;   // number of arrows visible at once

function render() {
  ctx.clearRect(0, 0, W, H);

  for (var k = 0; k < ARROW_COUNT; k++) {
    // Each arrow's depth position, animated so arrows flow from BOTTOM→UP
    // animOffset increases over time → rawT increases → y decreases (goes up) ✓
    var rawT = ((k / ARROW_COUNT) + animOffset) % 1.0;

    // Only show arrows in the floor region (t: 0.05 → 0.80)
    // Skip anything too close to the feet or too close to horizon
    if (rawT < 0.05 || rawT > 0.80) continue;

    var p = floorPoint(rawT);
    // angle: arrow tip points in direction of travel (away from user)
    // +PI/2 corrects the local coordinate so tip at (0,-h) → travel direction
    var angle = travelAngle(rawT) + Math.PI / 2;

    // Perspective scale: LARGE near bottom, tiny near horizon
    var perspScale = 1.0 - rawT * 0.72;
    var arrowH = (60 * perspScale) + 10;   // height of arrow
    var arrowW = arrowH * 0.62;            // width
    if (isNearTurn && rawT < 0.28) {
      arrowH *= 1.45; arrowW *= 1.45;     // enlarge at upcoming turn
    }

    // Opacity: full in middle band, fade at very bottom and at horizon
    var alpha;
    if      (rawT < 0.10) alpha = (rawT - 0.05) / 0.05;   // fade-in from feet
    else if (rawT > 0.65) alpha = (0.80 - rawT) / 0.15;   // fade-out to horizon
    else                  alpha = 1.0;
    alpha = Math.max(0, Math.min(1, alpha)) * 0.92;
    if (alpha <= 0.02) continue;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    // ── Draw chevron arrow ──────────────────────────────────────────────
    // Tip at local (0, -arrowH*0.55) = pointing in direction of travel
    var hw = arrowW * 0.5;
    var ht = arrowH * 0.55;  // tip above center
    var hb = arrowH * 0.26;  // base below center
    var notch = arrowH * 0.08; // inner V notch depth

    ctx.beginPath();
    ctx.moveTo(0,       -ht);         // ← tip (toward destination)
    ctx.lineTo( hw,      hb);         // bottom-right wing
    ctx.lineTo( hw*0.2,  hb - notch); // inner-right notch
    ctx.lineTo(0,        hb + notch * 0.5); // center base dip
    ctx.lineTo(-hw*0.2,  hb - notch); // inner-left notch
    ctx.lineTo(-hw,      hb);         // bottom-left wing
    ctx.closePath();

    // Color: bright cyan-blue tip → indigo base, changes at turns
    var tipC  = isNearTurn ? 'rgba(196,181,253,' : 'rgba(147,197,253,'; // purple vs sky-blue tip
    var baseC = isNearTurn ? 'rgba(99,102,241,'  : 'rgba(59,130,246,';  // indigo vs blue base

    var grad = ctx.createLinearGradient(0, -ht, 0, hb);
    grad.addColorStop(0,   tipC  + (alpha * 1.0) + ')');
    grad.addColorStop(0.55,tipC  + (alpha * 0.85)+ ')');
    grad.addColorStop(1,   baseC + (alpha * 0.55)+ ')');
    ctx.fillStyle = grad;

    // Glow
    ctx.shadowColor = isNearTurn ? '#818cf8' : '#38bdf8';
    ctx.shadowBlur  = 18 * perspScale + 3;
    ctx.fill();

    // Crisp outline
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(186,230,253,' + (alpha * 0.7) + ')';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  ctx.globalAlpha = 1.0;
  ctx.shadowBlur  = 0;
}

// Animation: offset increases → arrows move upward (away from user) ✓
function animate() {
  animOffset = (animOffset + 0.0028) % 1.0;
  render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Update direction + pitch from React Native
// pitchDeg: 0°=upright (arrows near bottom), 45°=tilted, 85°=horizontal (arrows fill view)
window.updateARPath = function(newDir, nearTurn, pitchDeg) {
  dirType    = newDir;
  isNearTurn = nearTurn == 1 || nearTurn === true;

  // Dynamically position the horizon based on real phone pitch
  // 0° → VPY at 15% (very little floor visible when looking straight ahead)
  // 30° → VPY at 35% (floor in lower 65%)
  // 60° → VPY at 58% (floor in lower half+)
  // 85° → VPY at 78% (mostly floor when looking down)
  var p = Math.max(0, Math.min(85, pitchDeg || 25));
  var horizonFrac = 0.15 + (p / 85) * 0.63;
  VPY = H * horizonFrac;
};

window.addEventListener('resize', function() {
  W = window.innerWidth; H = window.innerHeight;
  c.width = W; c.height = H;
  VPX = W * 0.5; FLOOR_Y = H;
  // Keep VPY relative on resize
  VPY = H * 0.38;
});
</script>
</body></html>`;
}

// ─── Main AR Screen ────────────────────────────────────────────────────────────
export default function ARScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const {
    routeData,
    room: targetRoom,
    heading: initialHeading = 0,
    userPos: initialUserPos,
    campusId,
  } = route.params || {};

  const [permission, requestPermission] = useCameraPermissions();
  const [currentStep, setCurrentStep] = useState(0);
  const [heading, setHeading] = useState(initialHeading || 0);
  const [userPos, setUserPos] = useState(initialUserPos || null);
  const [liveDistance, setLiveDistance] = useState(
    routeData ? Math.round(routeData.distance || 0) : 0
  );
  const [arrived, setArrived] = useState(false);
  const [dirType, setDirType] = useState("straight");    // from instruction text (fallback)
  const [arDirType, setArDirType] = useState("straight"); // from GPS bearing vs compass (primary)
  const [isNearTurn, setIsNearTurn] = useState(false);
  const [distToTurn, setDistToTurn] = useState(999);
  const [nearDestination, setNearDestination] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [pitch, setPitch] = useState(25); // phone tilt pitch 0°=upright, 90°=horizontal

  // Tilt detection
  const [tiltLevel, setTiltLevel] = useState(0); // 0=upright, 1=partial, 2=full
  const miniMapHeight = useRef(new Animated.Value(0)).current;
  const destPulse = useRef(new Animated.Value(1)).current;
  const arrivedAnim = useRef(new Animated.Value(0)).current;
  const arrivedScale = useRef(new Animated.Value(0.5)).current;

  const miniMapRef = useRef(null);
  const arPathRef = useRef(null);
  const accelSub = useRef(null);
  const magSub = useRef(null);
  const locWatcher = useRef(null);

  const currentDir = routeData?.directions?.[currentStep];

  // ── Request camera permission on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  // ── Destination pulse animation
  useEffect(() => {
    if (nearDestination) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(destPulse, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(destPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [nearDestination]);

  // ── Arrived animation
  useEffect(() => {
    if (arrived) {
      Animated.parallel([
        Animated.spring(arrivedAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.spring(arrivedScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (voiceEnabled) {
        Speech.speak("You have arrived at " + (targetRoom?.name || "your destination"), { language: "en-US" });
      }
    }
  }, [arrived]);

  // ── Sensor subscriptions: Accelerometer (tilt + pitch) + Magnetometer (heading)
  useEffect(() => {
    Accelerometer.setUpdateInterval(150);
    accelSub.current = Accelerometer.addListener(({ x, y, z }) => {
      // Expo Accelerometer coordinate system:
      //   Phone held upright portrait  → y ≈ -1, z ≈ 0
      //   Phone flat on table face-up  → z ≈ -1, y ≈ 0
      //   Phone tilted toward horizontal → y decreases, |z| increases
      const absY = Math.abs(y);

      // ── Tilt level for mini-map toggle (use Y axis, not Z)
      let newTilt;
      if      (absY > 0.72) newTilt = 0;   // upright → AR only, mini-map hidden
      else if (absY > 0.38) newTilt = 1;   // tilting  → mini-map partially visible
      else                  newTilt = 2;   // horizontal → mini-map fully expanded

      setTiltLevel(prev => prev === newTilt ? prev : newTilt);

      // ── Pitch angle: how far phone is tilted from vertical
      // 0° = perfectly upright (looking straight ahead, floor at very bottom)
      // 45° = tilted toward floor (floor occupies lower half of view)
      // 90° = horizontal (camera pointing at floor)
      const pitchRad = Math.atan2(Math.abs(z), absY + 0.001);
      const pitchDeg = Math.round(Math.min(85, pitchRad * 180 / Math.PI));
      setPitch(pitchDeg);
    });

    Magnetometer.setUpdateInterval(250);
    magSub.current = Magnetometer.addListener(({ x, y }) => {
      const h = Math.atan2(y, x) * (180 / Math.PI);
      setHeading(((h + 360) % 360));
    });

    return () => {
      accelSub.current?.remove();
      magSub.current?.remove();
    };
  }, []);

  // ── Tilt → mini-map animation
  useEffect(() => {
    const targetH = tiltLevel === 0 ? 0 : tiltLevel === 1 ? SH * 0.18 : SH * 0.28;
    Animated.spring(miniMapHeight, {
      toValue: targetH,
      friction: 10,
      tension: 70,
      useNativeDriver: false,
    }).start();
    setShowMiniMap(tiltLevel > 0);
  }, [tiltLevel]);

  // ── Compute AR direction type from GPS bearing vs compass heading (primary)
  //     Falls back to instruction-text parsing if GPS not available
  useEffect(() => {
    // ── GPS bearing method (most accurate)
    if (userPos && routeData?.path) {
      const nextNode = routeData.path[Math.min(currentStep + 1, routeData.path.length - 1)];
      if (nextNode && nextNode.x && nextNode.y) {
        const dLon = toRad(nextNode.y - userPos.y);
        const lat1 = toRad(userPos.x), lat2 = toRad(nextNode.x);
        const bY = Math.sin(dLon) * Math.cos(lat2);
        const bX = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        const requiredBearing = ((Math.atan2(bY, bX) * 180 / Math.PI) + 360) % 360;
        const diff = ((requiredBearing - heading) + 360) % 360;
        // diff: 0° = go straight, 90° = turn right, 270° = turn left
        if      (diff < 30 || diff > 330)          setArDirType('straight');
        else if (diff >= 30  && diff <= 165)        setArDirType('right');
        else if (diff >= 195 && diff <= 330)        setArDirType('left');
        else                                        setArDirType('straight');
        return;
      }
    }
    // ── Fallback: parse instruction text
    if (!currentDir) return;
    const instr = currentDir.instruction?.toLowerCase() || '';
    if      (instr.includes('left'))  setArDirType('left');
    else if (instr.includes('right')) setArDirType('right');
    else                              setArDirType('straight');
  }, [userPos, heading, currentStep, currentDir, routeData]);

  // ── Keep dirType in sync (used for bottom panel icon)
  useEffect(() => {
    setDirType(arDirType);
  }, [arDirType]);

  // ── Step advancement based on user position
  useEffect(() => {
    if (!routeData || !userPos || arrived) return;

    const targetNode = routeData.path?.[currentStep + 1] || routeData.path?.[currentStep];
    if (!targetNode) return;

    const distToNode = haversine(userPos.x, userPos.y, targetNode.x, targetNode.y);
    const segLen = currentDir?.distance || 20;
    const threshold = Math.min(12, Math.max(8, segLen * 0.4));

    // Update live distance
    const remainingPath = routeData.directions?.slice(currentStep + 1)
      .reduce((s, d) => s + (d.distance || 0), 0) || 0;
    setLiveDistance(Math.max(0, Math.round(distToNode + remainingPath)));

    // Near turn warning
    setDistToTurn(distToNode);
    setIsNearTurn(distToNode < 15 && currentStep < (routeData.directions?.length || 1) - 1);

    // Check destination proximity
    const destNode = routeData.path?.[routeData.path.length - 1];
    if (destNode) {
      const distToDest = haversine(userPos.x, userPos.y, destNode.x, destNode.y);
      setNearDestination(distToDest < 30);
    }

    // Advance step
    if (distToNode < threshold) {
      if (currentStep < (routeData.directions?.length || 1) - 1) {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (voiceEnabled && routeData.directions[nextStep]) {
          Speech.speak(
            `${routeData.directions[nextStep].instruction}. ${Math.round(routeData.directions[nextStep].distance)} meters.`,
            { language: "en-US" }
          );
        }
      } else {
        setArrived(true);
      }
    }
  }, [userPos]);

  // ── Sync user position & heading to mini-map WebView
  useEffect(() => {
    if (!userPos || !miniMapRef.current) return;
    miniMapRef.current.injectJavaScript(`
      if (typeof window.updateUserPos === 'function') {
        window.updateUserPos(${userPos.x}, ${userPos.y}, ${heading});
      }
      true;
    `);
  }, [userPos, heading]);

  // ── Update AR path canvas: direction + pitch for dynamic floor horizon
  useEffect(() => {
    if (!arPathRef.current) return;
    arPathRef.current.injectJavaScript(`
      if (typeof window.updateARPath === 'function') {
        window.updateARPath('${arDirType}', ${isNearTurn ? 1 : 0}, ${pitch});
      }
      true;
    `);
  }, [arDirType, isNearTurn, pitch]);

  const miniMapHtml = React.useMemo(() =>
    buildMiniMapHTML(routeData?.path, initialUserPos, targetRoom),
    [routeData, initialUserPos, targetRoom]
  );

  const arPathHtml = React.useMemo(() =>
    buildARPathHTML(), // no args — direction updated via injectJavaScript
    []
  );

  // ── ETA computation
  const etaSeconds = routeData
    ? (routeData.directions?.slice(currentStep).reduce((s, d) => s + (d.eta || 0), 0)
      || Math.round(liveDistance / WALK_SPEED))
    : 0;
  const etaText = etaSeconds >= 60
    ? `${Math.ceil(etaSeconds / 60)}'`
    : `${etaSeconds}s`;

  // ── If no camera permission
  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <View style={[styles.permContainer, { backgroundColor: colors.bg }]}>
        <Ionicons name="camera-outline" size={64} color={colors.primary} style={{ marginBottom: 20 }} />
        <Text style={[styles.permTitle, { color: colors.text }]}>Camera Access Needed</Text>
        <Text style={[styles.permSub, { color: colors.textSec }]}>
          AR Navigation requires camera access to overlay directions on the real world.
        </Text>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permBack} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textSec, fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── CAMERA BACKGROUND ── */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* ── AR PATH CANVAS OVERLAY ── */}
      <View
        style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
        pointerEvents="none"
      >
        <WebView
          ref={arPathRef}
          source={{ html: arPathHtml }}
          style={{ flex: 1, backgroundColor: "transparent" }}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          originWhitelist={["*"]}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          mixedContentMode="always"
          allowsTransparency={true}
          backgroundColor="transparent"
          pointerEvents="none"
        />
      </View>

      {/* ── TOP INFO BAR ── */}
      <View style={styles.topBar}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.topIconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Distance */}
        <View style={styles.topMetric}>
          <Ionicons name="location" size={13} color="#93c5fd" />
          <Text style={styles.topMetricValue}>{liveDistance}m</Text>
          <Text style={styles.topMetricLabel}>Distance</Text>
        </View>

        {/* ETA */}
        <View style={styles.topMetric}>
          <Ionicons name="time-outline" size={13} color="#86efac" />
          <Text style={styles.topMetricValue}>{etaText}</Text>
          <Text style={styles.topMetricLabel}>ETA</Text>
        </View>

        {/* Compass */}
        <View style={styles.topMetric}>
          <Ionicons name="compass-outline" size={13} color="#fcd34d" />
          <Text style={styles.topMetricValue}>{getCardinal(heading)}</Text>
          <Text style={styles.topMetricLabel}>{Math.round(heading)}°</Text>
        </View>

        {/* Voice toggle */}
        <TouchableOpacity
          style={styles.topIconBtn}
          onPress={() => setVoiceEnabled(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={voiceEnabled ? "volume-high" : "volume-mute"}
            size={20}
            color={voiceEnabled ? "#86efac" : "#94a3b8"}
          />
        </TouchableOpacity>
      </View>

      {/* ── DESTINATION MARKER (near destination) ── */}
      {nearDestination && !arrived && (
        <Animated.View
          style={[styles.destMarker, { transform: [{ scale: destPulse }] }]}
          pointerEvents="none"
        >
          <View style={styles.destMarkerInner}>
            <Ionicons name="location" size={22} color="#fff" />
          </View>
          <Text style={styles.destMarkerLabel} numberOfLines={2}>
            {targetRoom?.name || "Destination"}
          </Text>
        </Animated.View>
      )}

      {/* ── ROBOT GUIDE (preserves ARRobotGuide as-is) ── */}
      {!arrived && (
        <ARRobotGuide
          dirType={dirType}
          instructionText={
            currentDir?.instruction
              ? `${currentDir.instruction}${distToTurn < 20 ? ` in ${Math.round(distToTurn)}m` : ""}`
              : (nearDestination ? "You're almost there! 🎯" : "Follow the blue path ahead!")
          }
          style={{ bottom: SH * 0.17 }}
        />
      )}

      {/* ── BOTTOM INSTRUCTION PANEL ── */}
      {!arrived && (
        <View style={styles.bottomPanel}>
          <View style={styles.bottomInner}>
            {/* Direction Icon */}
            <View style={styles.dirIconWrap}>
              <Ionicons
                name={getDirIcon(currentDir?.instruction)}
                size={26}
                color="#6366f1"
              />
            </View>
            {/* Instruction text */}
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.instrText} numberOfLines={2}>
                {currentDir?.instruction || "Follow the highlighted path"}
              </Text>
              <View style={styles.instrMeta}>
                <Text style={styles.instrDist}>
                  {Math.round(distToTurn < 999 ? distToTurn : currentDir?.distance || 0)}m ahead
                </Text>
                <View style={styles.stepPill}>
                  <Text style={styles.stepPillText}>
                    Step {currentStep + 1}/{routeData?.directions?.length || 1}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Near-turn alert stripe */}
          {isNearTurn && (
            <View style={styles.turnAlert}>
              <Ionicons name="alert-circle" size={16} color="#fcd34d" />
              <Text style={styles.turnAlertText}>
                Turn {dirType === "left" ? "Left" : "Right"} in {Math.round(distToTurn)}m
              </Text>
            </View>
          )}

          {/* Tilt hint */}
          <Text style={styles.tiltHint}>
            {tiltLevel === 0
              ? "Tilt phone ↓ to see mini-map"
              : "Hold level for AR view"}
          </Text>
        </View>
      )}

      {/* ── ARRIVED OVERLAY ── */}
      {arrived && (
        <Animated.View
          style={[
            styles.arrivedOverlay,
            { opacity: arrivedAnim, transform: [{ scale: arrivedScale }] },
          ]}
        >
          <View style={styles.arrivedBadge}>
            <Ionicons name="checkmark-circle" size={52} color="#22c55e" />
            <Text style={styles.arrivedTitle}>You've Arrived!</Text>
            <Text style={styles.arrivedSub}>{targetRoom?.name}</Text>
            <TouchableOpacity
              style={styles.arrivedBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.arrivedBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── MINI-MAP OVERLAY (tilt-triggered, slides from bottom above panel) ── */}
      <Animated.View style={[styles.miniMapContainer, { height: miniMapHeight }]}>
        <View style={styles.miniMapHandle}>
          <View style={styles.miniMapHandleBar} />
          <Text style={styles.miniMapLabel}>
            <Ionicons name="map" size={11} color="#818cf8" /> Live Route Map
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <WebView
            ref={miniMapRef}
            source={{ html: miniMapHtml }}
            style={{ flex: 1, backgroundColor: "#0a0e17" }}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={["*"]}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            mixedContentMode="always"
            allowsInlineMediaPlayback={true}
            startInLoadingState={false}
          />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },

  // Camera permission screen
  permContainer: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 32,
  },
  permTitle: { fontSize: 22, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  permSub: { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 28 },
  permBtn: {
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: RADIUS.md, marginBottom: 16,
  },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  permBack: { padding: 10 },

  // Top info bar
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 36,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(7,11,20,0.82)",
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
    ...SHADOWS.lg,
  },
  topIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  topMetric: {
    flex: 1, alignItems: "center",
  },
  topMetricValue: {
    fontSize: 16, fontWeight: "800", color: "#f1f5f9", marginTop: 2,
  },
  topMetricLabel: {
    fontSize: 9, fontWeight: "600", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.8,
  },

  // Destination marker
  destMarker: {
    position: "absolute",
    top: "28%",
    alignSelf: "center",
    alignItems: "center",
    zIndex: 20,
  },
  destMarkerInner: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#22c55e",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
    ...SHADOWS.lg,
  },
  destMarkerLabel: {
    marginTop: 6, color: "#fff", fontWeight: "800",
    fontSize: 13, textAlign: "center", maxWidth: 140,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    overflow: "hidden",
  },

  // Bottom instruction panel
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0, right: 0,
    backgroundColor: "rgba(7,11,20,0.92)",
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
    paddingTop: 16, paddingHorizontal: 16, paddingBottom: Platform.OS === "ios" ? 36 : 22,
    ...SHADOWS.lg,
  },
  bottomInner: {
    flexDirection: "row", alignItems: "center",
    marginBottom: 10,
  },
  dirIconWrap: {
    width: 52, height: 52, borderRadius: 17,
    backgroundColor: "rgba(99,102,241,0.18)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(99,102,241,0.4)",
  },
  instrText: {
    fontSize: 16, fontWeight: "800", color: "#f1f5f9", marginBottom: 4,
  },
  instrMeta: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  instrDist: {
    fontSize: 13, color: "#94a3b8", fontWeight: "600",
  },
  stepPill: {
    backgroundColor: "#6366f1", borderRadius: 99,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  stepPillText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  turnAlert: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.18)",
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(245,158,11,0.4)",
    marginBottom: 8, gap: 8,
  },
  turnAlertText: { color: "#fcd34d", fontWeight: "700", fontSize: 13 },
  tiltHint: {
    textAlign: "center", fontSize: 11, color: "#475569",
    fontWeight: "500", marginTop: 4,
  },

  // Arrived overlay
  arrivedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center",
    zIndex: 100,
  },
  arrivedBadge: {
    backgroundColor: "rgba(7,11,20,0.95)",
    borderRadius: RADIUS.xl,
    padding: 32,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(34,197,94,0.5)",
    ...SHADOWS.lg,
    minWidth: SW * 0.72,
  },
  arrivedTitle: {
    fontSize: 24, fontWeight: "800", color: "#f1f5f9", marginTop: 12,
  },
  arrivedSub: {
    fontSize: 15, color: "#94a3b8", marginTop: 6, marginBottom: 24,
    textAlign: "center",
  },
  arrivedBtn: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 36, paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  arrivedBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Mini-map
  miniMapContainer: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#0a0e17",
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    overflow: "hidden",
    borderTopWidth: 1,
    borderTopColor: "rgba(99,102,241,0.35)",
    ...SHADOWS.lg,
    zIndex: 50,
  },
  miniMapHandle: {
    paddingTop: 8, paddingBottom: 4,
    alignItems: "center",
    backgroundColor: "rgba(7,11,20,0.95)",
  },
  miniMapHandleBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#1e2d40", marginBottom: 4,
  },
  miniMapLabel: {
    fontSize: 11, color: "#818cf8", fontWeight: "700",
    letterSpacing: 0.5,
  },
});
