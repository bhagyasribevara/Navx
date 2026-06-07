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

function getClosestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { x: x1, y: y1 };

  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t)); // clamp to segment

  return {
    x: x1 + t * dx,
    y: y1 + t * dy
  };
}

function snapPositionToRoute(pos, path, currentStep) {
  if (!pos || !path || path.length === 0) return pos;
  
  const startNode = path[currentStep];
  const endNode = path[Math.min(currentStep + 1, path.length - 1)];
  if (!startNode || !endNode) return pos;

  const snapped = getClosestPointOnSegment(pos.x, pos.y, startNode.x, startNode.y, endNode.x, endNode.y);
  
  // Calculate distance between raw and snapped in meters
  const dist = haversine(pos.x, pos.y, snapped.x, snapped.y);
  if (dist < 15) { // within 15 meters
    return { ...pos, x: snapped.x, y: snapped.y };
  }
  return pos;
}

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
function buildMiniMapHTML(pathPoints, userPos, targetRoom, geoJSONData) {
  const center = userPos
    ? [userPos.x, userPos.y]
    : (pathPoints?.length ? [pathPoints[0].x, pathPoints[0].y] : [18.4665, 83.6629]);

  const pathStr = pathPoints
    ? pathPoints.map(p => `[${p.x},${p.y}]`).join(",")
    : "";

  const routeLine = pathStr
    ? `
      L.polyline([${pathStr}],{color:'#818cf8',weight:10,opacity:0.25,lineCap:'round',lineJoin:'round'}).addTo(map);
      L.polyline([${pathStr}],{color:'#6366f1',weight:4,opacity:1,lineCap:'round',lineJoin:'round'}).addTo(map);
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
  .layer-label {
    background: rgba(10, 14, 23, 0.8); border: 1px solid rgba(255,255,255,0.2);
    color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;
    font-size: 11px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  }
  .room-label {
    background: transparent; border: none; box-shadow: none;
    color: #1e293b; font-weight: bold; font-size: 10px;
    text-shadow: 0 1px 2px rgba(255,255,255,0.8);
  }
  .target-room-label {
    background: transparent; border: none; box-shadow: none;
    color: #ffffff; font-weight: bold; font-size: 11px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  }
</style>
</head><body><div id="map"></div>
<script>
var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${center[0]},${center[1]}],19);
L.tileLayer('${mapboxUrl}',{maxZoom:22,attribution:''}).addTo(map);

var geojsonLayer = null;
function styleFeature(feature) {
  var baseStyle = { weight: 2, fillOpacity: 0.3 };
  if (feature.properties.type === 'block') {
    return Object.assign(baseStyle, { color: feature.properties.color || '#64748b', fillOpacity: 0.1 });
  } else if (feature.properties.type === 'room') {
    var isTarget = feature.properties.id === '${targetRoom?._id || ''}';
    return Object.assign(baseStyle, { color: isTarget ? '#3b82f6' : '#64748b', fillColor: isTarget ? '#3b82f6' : '#ffffff', weight: isTarget ? 3 : 1, fillOpacity: isTarget ? 0.6 : 1 });
  } else if (feature.properties.type === 'path') {
    return { color: '#c084fc', weight: 4, opacity: 0.6, dashArray: '5, 5' };
  } else if (feature.properties.type === 'map_layer') {
    return Object.assign(baseStyle, { 
      color: feature.properties.color || '#ef4444', 
      fillColor: feature.properties.color || '#ef4444',
      fillOpacity: 0.4, weight: 2
    });
  }
  return baseStyle;
}

window.updateGeoJSON = function(data, floorId) {
  if (geojsonLayer) { map.removeLayer(geojsonLayer); }
  geojsonLayer = L.geoJSON(data, {
    filter: function(f) {
      if (f.properties.type === 'path' || f.properties.type === 'node') return false;
      
      // Hide parking areas unless it's the target destination
      if (f.properties.category === 'parking' || (f.properties.name && f.properties.name.toLowerCase().includes('parking'))) {
        if (f.properties.id !== '${targetRoom?._id || ''}') return false;
      }

      if (f.properties.type === 'room' && f.properties.floorId) {
        if (floorId && f.properties.floorId !== floorId) return false;
      }
      return true;
    },
    style: styleFeature,
    onEachFeature: function(f, l) {
      if (f.properties && f.properties.name) {
        if (f.properties.type === 'map_layer') {
          l.bindTooltip(f.properties.name, { permanent: true, direction: 'center', className: 'layer-label' });
        } else if (f.properties.type === 'room') {
          var isTarget = f.properties.id === '${targetRoom?._id || ''}';
          l.bindTooltip(f.properties.name, { permanent: true, direction: 'center', className: isTarget ? 'target-room-label' : 'room-label' });
        }
      }
    }
  }).addTo(map);
};

// Initialize MapLayers
${geoJSONData ? `window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${targetRoom?.floorId || ''}');` : ''}

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

// ─── AR Path Canvas HTML ───────────────────────────────────────────────────────
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
var W, H;
var dirType    = 'straight';
var isNearTurn = false;
var pitchDeg   = 20;
var bearingDiff = 0;
var animOffset = 0;

var VPX = 0;
var VPY = 0;
var FLOOR_Y = 0;

function resize() {
  W = c.width  = window.innerWidth;
  H = c.height = window.innerHeight;
  VPX = W * 0.5;
  FLOOR_Y = H;
}
resize();
window.addEventListener('resize', resize);

function floorPt(t) {
  var depth = Math.pow(t, 0.60);
  var y = FLOOR_Y + (VPY - FLOOR_Y) * depth;
  
  // Pan the vanishing point based on bearingDiff
  // 35 degrees off-center shifts the vanishing point to the edge of the screen
  var shiftedVPX = (W * 0.5) + (bearingDiff / 35) * (W * 0.5);
  
  // Base X starts at center-bottom (W*0.5) and linearly goes to shifted vanishing point
  var baseX = (W * 0.5) + (shiftedVPX - (W * 0.5)) * depth;

  // Add curve ONLY further down the path (gives a true 3D turn appearance)
  var curveX = 0;
  if (dirType === 'left')  curveX = (t < 0.25) ? 0 : -Math.pow(t - 0.25, 2) * W * 0.9;
  if (dirType === 'right') curveX = (t < 0.25) ? 0 : +Math.pow(t - 0.25, 2) * W * 0.9;
  
  return { x: baseX + curveX, y: y, t: t };
}

function travelAngle(t) {
  var a = floorPt(t);
  var b = floorPt(Math.min(t + 0.04, 0.97));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

var ARROW_COUNT = 9;

function render() {
  ctx.clearRect(0, 0, W, H);

  for (var k = 0; k < ARROW_COUNT; k++) {
    var rawT = ((k / ARROW_COUNT) + animOffset) % 1.0;
    if (rawT < 0.05 || rawT > 0.80) continue;

    var p = floorPt(rawT);
    var angle = travelAngle(rawT) + Math.PI / 2;

    var perspScale = 1.0 - rawT * 0.72;
    var arrowH = (60 * perspScale) + 10;
    var arrowW = arrowH * 0.62;
    if (isNearTurn && rawT < 0.28) {
      arrowH *= 1.45; arrowW *= 1.45;
    }

    var alpha;
    if      (rawT < 0.10) alpha = (rawT - 0.05) / 0.05;
    else if (rawT > 0.65) alpha = (0.80 - rawT) / 0.15;
    else                  alpha = 1.0;
    alpha = Math.max(0, Math.min(1, alpha)) * 0.92;
    if (alpha <= 0.02) continue;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    var hw = arrowW * 0.5;
    var ht = arrowH * 0.55;
    var hb = arrowH * 0.26;
    var notch = arrowH * 0.08;

    ctx.beginPath();
    ctx.moveTo(0,       -ht);
    ctx.lineTo( hw,      hb);
    ctx.lineTo( hw*0.2,  hb - notch);
    ctx.lineTo(0,        hb + notch * 0.5);
    ctx.lineTo(-hw*0.2,  hb - notch);
    ctx.lineTo(-hw,      hb);
    ctx.closePath();

    var tipC  = isNearTurn ? 'rgba(196,181,253,' : 'rgba(147,197,253,';
    var baseC = isNearTurn ? 'rgba(99,102,241,'  : 'rgba(59,130,246,';

    var grad = ctx.createLinearGradient(0, -ht, 0, hb);
    grad.addColorStop(0,   tipC  + (alpha * 1.0) + ')');
    grad.addColorStop(0.55,tipC  + (alpha * 0.85)+ ')');
    grad.addColorStop(1,   baseC + (alpha * 0.55)+ ')');
    ctx.fillStyle = grad;

    ctx.shadowColor = isNearTurn ? '#818cf8' : '#38bdf8';
    ctx.shadowBlur  = 18 * perspScale + 3;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(186,230,253,' + (alpha * 0.7) + ')';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }
}

function animate(ts) {
  animOffset = (animOffset + 0.0028) % 1.0;
  render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

window.updateARPath = function(newDir, nearTurn, newPitch, newBearingDiff) {
  dirType    = newDir;
  isNearTurn = nearTurn == 1 || nearTurn === true;
  pitchDeg   = Math.max(0, Math.min(85, newPitch || 20));
  bearingDiff = newBearingDiff || 0;

  // Real physical horizon calculation based on camera vertical FOV (~55-60 deg)
  // Upright phone (pitch 0) -> horizon is around center (0.55 * H)
  // Tilted 30 deg -> horizon is near top of screen (0.0 * H)
  // Tilted 60 deg -> horizon is above the screen (-0.54 * H)
  var horizonFrac = 0.55 - (pitchDeg / 55);
  VPY = H * horizonFrac;
};
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
  const [geoJSONData, setGeoJSONData] = useState(null);

  // Fetch GeoJSON data for floor plan mapping
  useEffect(() => {
    if (campusId) {
      import("../api").then(({ getGeoJSONMapData }) => {
        getGeoJSONMapData(campusId).then(setGeoJSONData).catch(console.warn);
      });
    }
  }, [campusId]);

  const [liveDistance, setLiveDistance] = useState(
    routeData ? Math.round(routeData.distance || 0) : 0
  );
  const [arrived, setArrived] = useState(false);
  const [arDirType, setArDirType] = useState("straight"); // from instruction (shape of path)
  const [bearingDiff, setBearingDiff] = useState(0);      // from GPS vs compass (panning)
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
  const posEngine = useRef(new PositionEngine()).current;
  const stepDetector = useRef(null);

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

  // ── Initialize PositionEngine with initial user position
  useEffect(() => {
    if (initialUserPos) {
      posEngine.setPositionFromQR(initialUserPos.x, initialUserPos.y, targetRoom?.floorId);
    }
  }, [initialUserPos]);

  // ── Subscribe to PositionEngine updates to update React state
  useEffect(() => {
    const unsub = posEngine.onPositionUpdate(pos => {
      setUserPos({ x: pos.x, y: pos.y, floor: pos.floor });
    });
    return unsub;
  }, []);

  // ── Sensor subscriptions: Accelerometer (tilt + pitch + steps) + Magnetometer (heading) + GPS watch
  useEffect(() => {
    // 1. Step detection setup
    stepDetector.current = new StepDetector(() => {
      posEngine.processStep(posEngine.heading);
    });

    Accelerometer.setUpdateInterval(150);
    accelSub.current = Accelerometer.addListener(({ x, y, z }) => {
      // Step detection processing
      stepDetector.current?.processAccelerometer(x, y, z);

      // Tilt level for mini-map toggle (use Y axis, not Z)
      const absY = Math.abs(y);
      let newTilt;
      if      (absY > 0.72) newTilt = 0;   // upright → AR only, mini-map hidden
      else if (absY > 0.38) newTilt = 1;   // tilting  → mini-map partially visible
      else                  newTilt = 2;   // horizontal → mini-map fully expanded

      setTiltLevel(prev => prev === newTilt ? prev : newTilt);

      // Pitch angle: how far phone is tilted from vertical
      const pitchRad = Math.atan2(Math.abs(z), absY + 0.001);
      const pitchDeg = Math.round(Math.min(85, pitchRad * 180 / Math.PI));
      setPitch(pitchDeg);
    });

    Magnetometer.setUpdateInterval(250);
    magSub.current = Magnetometer.addListener(({ x, y }) => {
      const h = Math.atan2(y, x) * (180 / Math.PI);
      const normalizedH = (h + 360) % 360;
      setHeading(normalizedH);
      posEngine.updateHeading(normalizedH);
    });

    // 2. GPS watch for live user position
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

  // ── Compute AR direction shape and bearing diff (for world-space panning)
  useEffect(() => {
    // 1. Calculate bearing difference to pan the path if user looks away
    if (userPos && routeData?.path) {
      const nextNode = routeData.path[Math.min(currentStep + 1, routeData.path.length - 1)];
      if (nextNode && nextNode.x && nextNode.y) {
        const dLon = toRad(nextNode.y - userPos.y);
        const lat1 = toRad(userPos.x), lat2 = toRad(nextNode.x);
        const bY = Math.sin(dLon) * Math.cos(lat2);
        const bX = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        const requiredBearing = ((Math.atan2(bY, bX) * 180 / Math.PI) + 360) % 360;
        let diff = ((requiredBearing - heading) + 360) % 360;
        if (diff > 180) diff -= 360; // range -180 to +180
        setBearingDiff(diff);
      }
    }

    // 2. Shape of the path is purely based on the route geometry (instruction)
    if (!currentDir) return;
    const instr = currentDir.instruction?.toLowerCase() || '';
    if      (instr.includes('left'))  setArDirType('left');
    else if (instr.includes('right')) setArDirType('right');
    else                              setArDirType('straight');
  }, [userPos, heading, currentStep, currentDir, routeData]);

  // ── Keep dirType in sync (used for bottom panel icon)
  const dirType = arDirType;

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

  // ── Sync user position & heading to mini-map WebView (with route-snapping)
  useEffect(() => {
    if (!userPos || !miniMapRef.current) return;
    const snappedPos = snapPositionToRoute(userPos, routeData?.path, currentStep);
    miniMapRef.current.injectJavaScript(`
      if (typeof window.updateUserPos === 'function') {
        window.updateUserPos(${snappedPos.x}, ${snappedPos.y}, ${heading});
      }
      true;
    `);
  }, [userPos, heading, routeData, currentStep]);

  // ── Sync GeoJSON map layer to mini-map WebView
  useEffect(() => {
    if (geoJSONData && miniMapRef.current) {
      const activeFloorId = targetRoom?.floorId || userPos?.floor;
      miniMapRef.current.injectJavaScript(`
        if (typeof window.updateGeoJSON === 'function') {
          window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${activeFloorId || ''}');
        }
        true;
      `);
    }
  }, [geoJSONData, userPos?.floor, targetRoom]);

  // ── Update AR path canvas: direction, pitch, and panning bearing
  useEffect(() => {
    if (!arPathRef.current) return;
    arPathRef.current.injectJavaScript(`
      if (typeof window.updateARPath === 'function') {
        window.updateARPath('${arDirType}', ${isNearTurn ? 1 : 0}, ${pitch}, ${bearingDiff});
      }
      true;
    `);
  }, [arDirType, isNearTurn, pitch, bearingDiff]);

  const miniMapHtml = React.useMemo(() =>
    buildMiniMapHTML(routeData?.path, initialUserPos, targetRoom, geoJSONData),
    [routeData, initialUserPos, targetRoom, geoJSONData]
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
            {nearDestination
              ? `🎯 ${targetRoom?.name || 'Destination'} is near!`
              : tiltLevel === 0
              ? "Tilt phone ↓ for mini-map  |  Look ahead for AR arrows"
              : "Hold upright for AR view"}
          </Text>
        </View>
      )}

      {/* ── ROBOT GUIDE ── */}
      {!arrived && (
        <ARRobotGuide
          dirType={dirType}
          instructionText={currentDir?.instruction || "Follow the highlighted path"}
        />
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
