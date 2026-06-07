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
import * as Location from "expo-location";
import { PositionEngine, StepDetector } from "../positioning";
import { ThemeContext } from "../context/ThemeContext";
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

// Helper to format text for better Speech pronunciation
const formatSpeech = (text) => {
  if (!text) return "";
  return text.replace(/-/g, " ");
};

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

function getTurnLabel(instruction = "") {
  const instr = instruction.toLowerCase();
  if (instr.includes("turn left") || instr.includes("go left")) return "Turn Left";
  if (instr.includes("turn right") || instr.includes("go right")) return "Turn Right";
  if (instr.includes("slight left")) return "Slight Left";
  if (instr.includes("slight right")) return "Slight Right";
  if (instr.includes("stairs")) return "Take Stairs";
  if (instr.includes("elevator")) return "Take Elevator";
  if (instr.includes("floor")) return "Change Floor";
  if (instr.includes("u-turn")) return "U-Turn";
  return "Go Straight";
}

function getTurnIcon(instruction = "") {
  const instr = instruction.toLowerCase();
  if (instr.includes("left")) return "↰";
  if (instr.includes("right")) return "↱";
  if (instr.includes("stairs")) return "⇡";
  if (instr.includes("elevator")) return "⇡";
  if (instr.includes("floor")) return "⇅";
  return "↑";
}

// ─── Mini-Map HTML (Leaflet + Mapbox) ──────────────────────────────────────────
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

  const mapboxUrl = process.env.EXPO_PUBLIC_MAPBOX_URL || "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA";

  const initialHeading = 0;
  const userMarkerInit = userPos
    ? `
      var initIcon = L.divIcon({ className: '', html: buildArrowIconHtml(${initialHeading}), iconSize: [50, 50], iconAnchor: [25, 25] });
      window.userMarker = L.marker([${userPos.x},${userPos.y}], {icon: initIcon, zIndexOffset: 1000}).addTo(map);
    `
    : `window.userMarker = null;`;

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
  @keyframes miniPulseGlow {
    0% { transform: scale(0.85); opacity: 0.7; }
    50% { transform: scale(1.3); opacity: 0.2; }
    100% { transform: scale(0.85); opacity: 0.7; }
  }
</style>
</head><body><div id="map"></div>
<script>
var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${center[0]},${center[1]}],18);
L.tileLayer('${mapboxUrl}',{maxZoom:22,attribution:''}).addTo(map);
${routeLine}
${destDot}

function buildArrowIconHtml(hdg) {
  var r = (hdg !== undefined && hdg !== null) ? hdg : 0;
  return '<div style="position:relative; width:50px; height:50px; display:flex; align-items:center; justify-content:center;">'
    + '<div style="position:absolute; width:100%; height:100%; background:radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(139, 92, 246, 0) 60%); border-radius:50%; animation: miniPulseGlow 2.5s infinite;"></div>'
    + '<div id="mini-user-arrow" style="position:relative; width:24px; height:24px; background:linear-gradient(135deg, #A855F7, #6D28D9); border-radius:50%; box-shadow: 0 4px 12px rgba(109, 40, 217, 0.6); display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,0.5); transform: rotate(' + r + 'deg); transition: transform 0.3s ease-out;">'
    + '<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2L4 20l8-4 8 4z"/></svg>'
    + '</div>'
    + '</div>';
}

${userMarkerInit}

window._lastHeading = 0;
window.updateUserPos = function(lat,lng,heading){
  if(!window.userMarker){
    var icon = L.divIcon({ className: '', html: buildArrowIconHtml(heading || 0), iconSize: [50, 50], iconAnchor: [25, 25] });
    window.userMarker = L.marker([lat,lng], {icon: icon, zIndexOffset: 1000}).addTo(map);
    window._lastHeading = heading || 0;
    map.setView([lat,lng],18);
  } else {
    window.userMarker.setLatLng([lat,lng]);
  }
  if (heading !== undefined && heading !== null) {
    window.updateUserHeading(heading);
  }
  map.panTo([lat,lng], {animate: false});
};

window.updateUserHeading = function(heading) {
  if (heading !== undefined && heading !== null) {
    if (window.userMarker) {
      var el = window.userMarker.getElement();
      if (el) {
        var arrow = el.querySelector('#mini-user-arrow');
        if (arrow) {
          arrow.style.transform = 'rotate(' + heading + 'deg)';
        }
      }
    }
    window._lastHeading = heading;
  }
};
</script></body></html>`;
}

// ─── AR Path Canvas HTML — Floor-Anchored Chevron System ────────────────────────
// Renders wide, glowing chevron arrows projected onto the floor plane.
// Arrows always start from CENTER-BOTTOM of screen.
// Uses accelerometer pitch to compute a real horizon line.
// Bearing difference only shifts the distant vanishing point, not the base.
// Chevrons are horizontally squashed by perspective to appear flat on the floor.
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
var W, H;
var dirType    = 'straight';
var isNearTurn = false;
var pitchDeg   = 25;
var bearingDiff = 0;
var animOffset = 0;
var lastTime   = 0;

// Smoothed values for jitter-free rendering
var smoothPitch   = 25;
var PITCH_SMOOTH   = 0.15;

var VPY = 0;  // vanishing point Y (horizon from pitch)
var FLOOR_Y = 0;  // bottom of screen — where arrows originate
var CX = 0;   // center X — arrows ALWAYS start here

function resize() {
  var dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  c.width  = W * dpr;
  c.height = H * dpr;
  c.style.width  = W + 'px';
  c.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  CX = W * 0.5;
  FLOOR_Y = H;  // arrows start from the very bottom edge
}
resize();
window.addEventListener('resize', resize);

// Compute a point on the floor plane at depth t (0=user feet at bottom, 1=horizon)
function floorPt(t) {
  // Depth curve — more bunching near horizon for realistic perspective
  var depth = Math.pow(t, 0.52);

  // Y: linearly interpolate from screen bottom to horizon
  var y = FLOOR_Y + (VPY - FLOOR_Y) * depth;

  // X: ALWAYS starts at center (CX). NO bearing shift! 
  // Arrows must be rigidly locked to the center line.
  var baseX = CX;

  // Turn curvature — smooth curve that only kicks in after 25% depth
  // This visually shows map directions on the floor
  var curveX = 0;
  if (dirType === 'left' && t > 0.25) {
    curveX = -Math.pow((t - 0.25) * 1.3, 2.0) * W * 0.65;
  }
  if (dirType === 'right' && t > 0.25) {
    curveX = +Math.pow((t - 0.25) * 1.3, 2.0) * W * 0.65;
  }

  return { x: baseX + curveX, y: y };
}

// Get the travel direction angle at depth t
function travelAngle(t) {
  var a = floorPt(t);
  var b = floorPt(Math.min(t + 0.025, 0.98));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Lane width at depth (very wide near user, narrow at horizon)
function laneWidth(t) {
  var perspScale = 1.0 - t * 0.85;
  return Math.max(10, W * 0.45 * perspScale);
}

var CHEVRON_COUNT = 11;

function render() {
  ctx.clearRect(0, 0, W, H);

  // ── 1. GROUND PLANE GLOW — creates the "floor detected" illusion ──
  // A wide gradient from the bottom of the screen that fades upward
  ctx.save();

  // Ground surface glow (wide, centered)
  var groundGrad = ctx.createLinearGradient(CX, FLOOR_Y, CX, FLOOR_Y - H * 0.55);
  groundGrad.addColorStop(0,    'rgba(0, 100, 255, 0.18)');
  groundGrad.addColorStop(0.15, 'rgba(0, 120, 255, 0.10)');
  groundGrad.addColorStop(0.4,  'rgba(0, 140, 255, 0.04)');
  groundGrad.addColorStop(1,    'rgba(0, 160, 255, 0.0)');

  // Build the lane shape from bottom to horizon
  var leftEdge = [];
  var rightEdge = [];
  var laneSteps = 35;
  for (var i = 0; i <= laneSteps; i++) {
    var lt = (i / laneSteps) * 0.88;
    var p = floorPt(lt);
    var w = laneWidth(lt) * 0.55;
    var angle = travelAngle(lt);
    var perpX = Math.cos(angle + Math.PI / 2);
    var perpY = Math.sin(angle + Math.PI / 2);
    leftEdge.push({ x: p.x - perpX * w, y: p.y - perpY * w });
    rightEdge.push({ x: p.x + perpX * w, y: p.y + perpY * w });
  }

  // Draw filled lane
  ctx.beginPath();
  ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
  for (var i = 1; i < leftEdge.length; i++) ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
  for (var i = rightEdge.length - 1; i >= 0; i--) ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
  ctx.closePath();
  ctx.fillStyle = groundGrad;
  ctx.fill();

  // Lane edge lines (subtle)
  ctx.beginPath();
  ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
  for (var i = 1; i < leftEdge.length; i++) ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
  ctx.strokeStyle = 'rgba(0, 150, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rightEdge[0].x, rightEdge[0].y);
  for (var i = 1; i < rightEdge.length; i++) ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
  ctx.stroke();

  // Bright center line glow (makes the floor feel real)
  ctx.beginPath();
  for (var i = 0; i <= 20; i++) {
    var ct = (i / 20) * 0.7;
    var cp = floorPt(ct);
    if (i === 0) ctx.moveTo(cp.x, cp.y);
    else ctx.lineTo(cp.x, cp.y);
  }
  ctx.strokeStyle = 'rgba(0, 140, 255, 0.06)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();

  // ── 2. CHEVRON ARROWS — wide, glowing, floor-anchored with perspective squash ──
  for (var k = 0; k < CHEVRON_COUNT; k++) {
    var rawT = ((k / CHEVRON_COUNT) + animOffset) % 1.0;

    // Only render arrows in the visible depth range
    if (rawT < 0.03 || rawT > 0.85) continue;

    var p = floorPt(rawT);
    var angle = travelAngle(rawT);

    // Perspective scaling — arrows get smaller with depth
    var perspScale = 1.0 - rawT * 0.80;
    var chevW = Math.max(18, W * 0.32 * perspScale);  // Wide at bottom
    var chevH = chevW * 0.38;

    // Perspective vertical squash — makes arrows look flat on the floor
    // Near arrows (rawT close to 0) are barely squashed
    // Far arrows are heavily squashed
    var squash = 1.0 - rawT * 0.55;
    chevH *= squash;

    // Near-turn emphasis
    var turnBoost = 1.0;
    if (isNearTurn && rawT < 0.30) {
      turnBoost = 1.35;
      chevW *= 1.2;
      chevH *= 1.15;
    }

    // Alpha: fade in near bottom, fade out near horizon
    var alpha;
    if      (rawT < 0.08) alpha = rawT / 0.08;
    else if (rawT > 0.68) alpha = (0.85 - rawT) / 0.17;
    else                  alpha = 1.0;
    alpha = Math.max(0, Math.min(1, alpha)) * 0.92 * turnBoost;
    if (alpha <= 0.02) continue;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.globalAlpha = alpha;

    // ── Chevron shape ──
    var hw = chevW * 0.5;
    var tipY = -chevH * 0.5;
    var baseY = chevH * 0.5;
    var arm = chevW * 0.13;

    ctx.beginPath();
    ctx.moveTo(0, tipY);                       // tip
    ctx.lineTo(hw, baseY);                     // right outer
    ctx.lineTo(hw - arm, baseY);               // right inner
    ctx.lineTo(0, tipY + arm * 1.8);           // inner tip
    ctx.lineTo(-hw + arm, baseY);              // left inner
    ctx.lineTo(-hw, baseY);                    // left outer
    ctx.closePath();

    // Gradient fill
    var chevGrad = ctx.createLinearGradient(0, tipY, 0, baseY);
    if (isNearTurn && rawT < 0.35) {
      chevGrad.addColorStop(0,   'rgba(120, 210, 255, ' + (alpha) + ')');
      chevGrad.addColorStop(0.4, 'rgba(0, 170, 255, '   + (alpha * 0.95) + ')');
      chevGrad.addColorStop(1,   'rgba(0, 100, 255, '   + (alpha * 0.7)  + ')');
    } else {
      chevGrad.addColorStop(0,   'rgba(100, 200, 255, ' + (alpha * 0.95) + ')');
      chevGrad.addColorStop(0.4, 'rgba(0, 150, 255, '   + (alpha * 0.85) + ')');
      chevGrad.addColorStop(1,   'rgba(0, 90, 230, '    + (alpha * 0.5)  + ')');
    }
    ctx.fillStyle = chevGrad;

    // Glow bloom
    ctx.shadowColor = isNearTurn ? '#44ccff' : '#0099ff';
    ctx.shadowBlur  = (20 * perspScale + 8) * turnBoost;
    ctx.fill();

    // Edge highlight
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(160, 225, 255, ' + (alpha * 0.5) + ')';
    ctx.lineWidth = Math.max(0.5, 1.2 * perspScale);
    ctx.stroke();

    ctx.restore();
  }

  // ── 3. GROUND REFLECTION DOTS — small dots between arrows to sell floor anchoring ──
  for (var d = 0; d < 25; d++) {
    var dt = (d / 25) * 0.7 + 0.02;
    var dp = floorPt(dt);
    var dAlpha = (1.0 - dt) * 0.25;
    if (dAlpha < 0.02) continue;
    var dotR = Math.max(1, 3 * (1.0 - dt));
    ctx.beginPath();
    ctx.arc(dp.x, dp.y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 160, 255, ' + dAlpha + ')';
    ctx.fill();
  }
}

function animate(ts) {
  if (!lastTime) lastTime = ts;
  var dt = Math.min((ts - lastTime) / 1000, 0.1);  // cap dt to prevent jumps
  lastTime = ts;

  // Animate offset — chevrons flow toward user
  animOffset = (animOffset + dt * 0.20) % 1.0;

  // Smooth pitch
  smoothPitch += (pitchDeg - smoothPitch) * PITCH_SMOOTH;

  // Accurate FOV-based horizon calculation
  // Assuming a vertical Field of View (FOV) of approx 60 degrees.
  // 1 degree of tilt shifts the horizon by H / 60 pixels.
  // When phone is perfectly upright (pitch=0), the camera is looking horizontal -> horizon is at exactly H * 0.5 (center)
  // When tilted down (pitch > 0), the horizon moves UP on the screen (lower Y value)
  var fovDegrees = 55; 
  var pixelsPerDegree = H / fovDegrees;
  
  // VPY = Center - (Pitch * pixelsPerDegree)
  VPY = (H * 0.5) - (smoothPitch * pixelsPerDegree);

  // Clamp VPY slightly above screen top so we can always draw depth
  VPY = Math.max(-H * 0.5, Math.min(H * 0.8, VPY));

  render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

window.updateARPath = function(newDir, nearTurn, newPitch) {
  dirType    = newDir || 'straight';
  isNearTurn = nearTurn == 1 || nearTurn === true;
  
  // newPitch: 0 = upright. Positive = tilted down towards floor.
  pitchDeg = newPitch || 0;
};
</script>
</body></html>`;
}

// ─── Main AR Screen ─────────────────────────────────────────────────────────────
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
  const [arDirType, setArDirType] = useState("straight");
  const [bearingDiff, setBearingDiff] = useState(0);
  const [isNearTurn, setIsNearTurn] = useState(false);
  const [distToTurn, setDistToTurn] = useState(999);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [pitch, setPitch] = useState(25);

  // Tilt detection for auto mini-map (0=upright/AR, 1=partial, 2=horizontal/map)
  const [tiltLevel, setTiltLevel] = useState(0);

  const arrivedAnim = useRef(new Animated.Value(0)).current;
  const arrivedScale = useRef(new Animated.Value(0.5)).current;
  const dirCardAnim = useRef(new Animated.Value(0)).current;
  const miniMapHeight = useRef(new Animated.Value(0)).current;

  const miniMapRef = useRef(null);
  const arPathRef = useRef(null);
  const accelSub = useRef(null);
  const magSub = useRef(null);
  const locWatcher = useRef(null);
  const posEngine = useRef(new PositionEngine()).current;
  const stepDetector = useRef(null);

  // Smooth heading ref to avoid jitter
  const smoothHeadingRef = useRef(initialHeading || 0);

  const currentDir = routeData?.directions?.[currentStep];

  // ── Request camera permission on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  // ── Animate direction card on step change
  useEffect(() => {
    if (currentDir && !arrived) {
      dirCardAnim.setValue(0);
      Animated.spring(dirCardAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }
  }, [currentStep, arrived]);

  // ── Arrived animation
  useEffect(() => {
    if (arrived) {
      Animated.parallel([
        Animated.spring(arrivedAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.spring(arrivedScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (voiceEnabled) {
        Speech.speak(formatSpeech("You have arrived at " + (targetRoom?.name || "your destination")), { language: "en-US" });
      }
    }
  }, [arrived]);

  // ── Initialize PositionEngine with initial user position
  useEffect(() => {
    if (initialUserPos) {
      posEngine.setPositionFromQR(initialUserPos.x, initialUserPos.y, targetRoom?.floorId);
    }
  }, [initialUserPos]);

  // ── Subscribe to PositionEngine updates
  useEffect(() => {
    const unsub = posEngine.onPositionUpdate(pos => {
      setUserPos({ x: pos.x, y: pos.y, floor: pos.floor });
    });
    return unsub;
  }, []);

  // ── Sensor subscriptions
  useEffect(() => {
    // Step detection
    stepDetector.current = new StepDetector(() => {
      posEngine.processStep(posEngine.heading);
    });

    Accelerometer.setUpdateInterval(100);
    accelSub.current = Accelerometer.addListener(({ x, y, z }) => {
      // Step detection
      stepDetector.current?.processAccelerometer(x, y, z);

      // Pitch calculation for AR Horizon.
      // Phone vertical (y ~ -1, z ~ 0) -> pitch = 0 (looking straight ahead)
      // Phone flat on table screen up (y ~ 0, z ~ -1 or 1) -> pitch = 90 (looking down)
      // We want pitch in degrees.
      const pitchRad = Math.atan2(Math.abs(z), Math.abs(y) + 0.001);
      const pitchDegCalc = pitchRad * (180 / Math.PI);
      setPitch(pitchDegCalc);

      // Tilt level for auto mini-map (uses Y axis to detect phone orientation)
      // |y| > 0.72 → phone is upright → AR mode, hide mini-map
      // |y| > 0.38 → phone tilting → partial mini-map
      // |y| < 0.38 → phone horizontal → full mini-map
      const absY = Math.abs(y);
      let newTilt;
      if      (absY > 0.72) newTilt = 0;   // upright → AR only
      else if (absY > 0.38) newTilt = 1;   // tilting → partial map
      else                  newTilt = 2;   // horizontal → full map
      setTiltLevel(prev => prev === newTilt ? prev : newTilt);
    });

    Magnetometer.setUpdateInterval(200);
    magSub.current = Magnetometer.addListener(({ x, y }) => {
      const h = Math.atan2(y, x) * (180 / Math.PI);
      const normalizedH = (h + 360) % 360;

      // Smooth heading to reduce jitter
      let diff = normalizedH - smoothHeadingRef.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) > 1.5) {
        smoothHeadingRef.current = (smoothHeadingRef.current + diff * 0.25 + 360) % 360;
      }
      setHeading(smoothHeadingRef.current);
      posEngine.updateHeading(smoothHeadingRef.current);
    });

    // GPS watch
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0.5 },
      (loc) => {
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        posEngine.processGPSUpdate(lat, lng);
      }
    ).then(w => {
      locWatcher.current = w;
    });

    return () => {
      accelSub.current?.remove();
      magSub.current?.remove();
      if (locWatcher.current) {
        locWatcher.current.remove();
      }
    };
  }, []);

  // ── Tilt-based auto mini-map + manual toggle
  useEffect(() => {
    // Auto-show based on tilt: upright=0, partial=18%, full=28%
    const autoHeight = tiltLevel === 0 ? 0 : tiltLevel === 1 ? SH * 0.18 : SH * 0.28;
    // Manual toggle overrides: if user explicitly toggled, respect that
    const targetH = showMiniMap ? Math.max(SH * 0.25, autoHeight) : autoHeight;
    Animated.spring(miniMapHeight, {
      toValue: targetH,
      friction: 10,
      tension: 70,
      useNativeDriver: false,
    }).start();
  }, [tiltLevel, showMiniMap]);

  // ── Compute AR direction shape
  useEffect(() => {
    // Direction type from instruction
    if (!currentDir) return;
    const instr = currentDir.instruction?.toLowerCase() || '';
    if      (instr.includes('left'))  setArDirType('left');
    else if (instr.includes('right')) setArDirType('right');
    else                              setArDirType('straight');
  }, [currentStep, currentDir, routeData]);

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

    // Near turn detection
    setDistToTurn(distToNode);
    setIsNearTurn(distToNode < 15 && currentStep < (routeData.directions?.length || 1) - 1);

    // Advance step
    if (distToNode < threshold) {
      if (currentStep < (routeData.directions?.length || 1) - 1) {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (voiceEnabled && routeData.directions[nextStep]) {
          Speech.speak(
            formatSpeech(`${routeData.directions[nextStep].instruction}. ${Math.round(routeData.directions[nextStep].distance)} meters.`),
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
    // Update mini-map whenever it's visible (tilt-based or manual toggle)
    if (tiltLevel > 0 || showMiniMap) {
      miniMapRef.current.injectJavaScript(`
        if (typeof window.updateUserPos === 'function') {
          window.updateUserPos(${userPos.x}, ${userPos.y}, ${heading});
        }
        true;
      `);
    }
  }, [userPos, heading, tiltLevel, showMiniMap]);

  // ── Update AR path canvas
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
    buildARPathHTML(),
    []
  );

  // ── ETA computation
  const etaSeconds = routeData
    ? (routeData.directions?.slice(currentStep).reduce((s, d) => s + (d.eta || 0), 0)
      || Math.round(liveDistance / WALK_SPEED))
    : 0;
  const etaText = etaSeconds >= 60
    ? `${Math.ceil(etaSeconds / 60)} min`
    : `${etaSeconds}s`;

  // Distance text for the current step
  const stepDist = Math.round(distToTurn < 999 ? distToTurn : currentDir?.distance || 0);

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

      {/* ── TOP DIRECTION CARD (Glassmorphic — matching reference) ── */}
      {!arrived && currentDir && (
        <Animated.View
          style={[
            styles.dirCard,
            {
              transform: [{
                translateY: dirCardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 0],
                }),
              }],
              opacity: dirCardAnim,
            },
          ]}
        >
          {/* Turn icon circle */}
          <View style={[
            styles.dirIconCircle,
            isNearTurn && { borderColor: 'rgba(68, 187, 255, 0.8)', backgroundColor: 'rgba(0, 120, 255, 0.25)' }
          ]}>
            <Text style={styles.dirIconText}>{getTurnIcon(currentDir?.instruction)}</Text>
          </View>
          {/* Instruction text */}
          <View style={styles.dirCardContent}>
            <Text style={styles.dirCardTitle} numberOfLines={1}>
              {getTurnLabel(currentDir?.instruction)}
            </Text>
            <Text style={styles.dirCardSubtitle}>
              In {stepDist} m
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── FLOATING ACTION BUTTONS (right side) ── */}
      <View style={styles.fabColumn}>
        {/* Voice toggle */}
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => setVoiceEnabled(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={voiceEnabled ? "volume-high" : "volume-mute"}
            size={20}
            color={voiceEnabled ? "#4ade80" : "#64748b"}
          />
        </TouchableOpacity>

        {/* Mini-map toggle */}
        <TouchableOpacity
          style={[styles.fabBtn, (showMiniMap || tiltLevel > 0) && styles.fabBtnActive]}
          onPress={() => setShowMiniMap(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="map" size={20} color={(showMiniMap || tiltLevel > 0) ? "#818cf8" : "#94a3b8"} />
        </TouchableOpacity>
      </View>

      {/* ── TILT HINT ── */}
      {!arrived && tiltLevel === 0 && !showMiniMap && (
        <View style={styles.tiltHint}>
          <Text style={styles.tiltHintText}>Tilt phone ↓ for mini-map</Text>
        </View>
      )}

      {/* ── NEAR-TURN ALERT ── */}
      {isNearTurn && !arrived && (
        <View style={styles.turnAlertBanner}>
          <Ionicons name="alert-circle" size={18} color="#fcd34d" />
          <Text style={styles.turnAlertText}>
            {getTurnLabel(currentDir?.instruction)} in {Math.round(distToTurn)}m
          </Text>
        </View>
      )}

      {/* ── BOTTOM BAR (Distance + Exit — matching reference) ── */}
      {!arrived && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarLeft}>
            <Text style={styles.bottomBarDistance}>{liveDistance} m</Text>
            <Text style={styles.bottomBarLabel}>to your destination</Text>
          </View>
          <TouchableOpacity
            style={styles.exitBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.exitBtnText}>Exit</Text>
          </TouchableOpacity>
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

      {/* ── MINI-MAP OVERLAY (toggle-controlled) ── */}
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
            onLoadEnd={() => {
              if (userPos && miniMapRef.current) {
                miniMapRef.current.injectJavaScript(`
                  if (typeof window.updateUserPos === 'function') {
                    window.updateUserPos(${userPos.x}, ${userPos.y}, ${heading});
                  }
                  true;
                `);
              }
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
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

  // ── TOP DIRECTION CARD (glassmorphic, matching reference image) ──
  dirCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 58 : 40,
    left: 16,
    right: 80, // leave room for FABs
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(100, 160, 255, 0.2)",
    ...SHADOWS.lg,
  },
  dirIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(0, 100, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0, 140, 255, 0.4)",
    marginRight: 14,
  },
  dirIconText: {
    fontSize: 26,
    color: "#60a5fa",
  },
  dirCardContent: {
    flex: 1,
  },
  dirCardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 2,
  },
  dirCardSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
  },

  // ── FLOATING ACTION BUTTONS ──
  fabColumn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 42,
    right: 14,
    gap: 10,
  },
  fabBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    ...SHADOWS.md,
  },
  fabBtnActive: {
    borderColor: "rgba(99, 102, 241, 0.5)",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },

  // ── NEAR-TURN ALERT BANNER ──
  turnAlertBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 128 : 110,
    left: 16,
    right: 80,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    gap: 8,
  },
  turnAlertText: {
    color: "#fcd34d",
    fontWeight: "700",
    fontSize: 13,
  },

  // ── BOTTOM BAR (distance + exit, matching reference) ──
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(100, 160, 255, 0.15)",
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 22,
    ...SHADOWS.lg,
  },
  bottomBarLeft: {
    flex: 1,
  },
  bottomBarDistance: {
    fontSize: 28,
    fontWeight: "900",
    color: "#f1f5f9",
    letterSpacing: -0.5,
  },
  bottomBarLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
    marginTop: 2,
    fontStyle: "italic",
  },
  exitBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  exitBtnText: {
    color: "#f1f5f9",
    fontWeight: "700",
    fontSize: 15,
  },

  // ── TILT HINT ──
  tiltHint: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 90 : 76,
    alignSelf: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tiltHintText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "500",
  },

  // ── ARRIVED OVERLAY ──
  arrivedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
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

  // ── MINI-MAP ──
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
