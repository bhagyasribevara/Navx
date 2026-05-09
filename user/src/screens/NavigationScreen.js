import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Platform, ActivityIndicator
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { Accelerometer, Magnetometer } from "expo-sensors";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { ThemeContext } from "../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { findRouteToRoom, findRouteToExit } from "../api";
import { PositionEngine, StepDetector } from "../positioning";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Haversine helper (matches backend formula) ──
const EARTH_R = 6_371_000;
const toRad = d => d * Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
const AVG_STRIDE = 0.72;   // meters per step
const WALK_SPEED = 1.2;    // m/s fallback

const DIR_ICONS = {
  left: "arrow-back",
  right: "arrow-forward",
  straight: "arrow-up",
  stairs: "trending-up",
  elevator: "git-merge",
  arrived: "checkmark-circle",
};

function buildNavMapHTML(rooms, pathPoints, initialPos, targetRoom) {
  const center = initialPos ? [initialPos.x, initialPos.y] : (pathPoints?.length ? [pathPoints[0].x, pathPoints[0].y] : [18.4665, 83.6629]);
  
  const roomGeoJSON = rooms.map(r => {
    const s = r.shape;
    if (!s) return '';
    const isSel = targetRoom?._id === r._id;
    const c = isSel ? '#ef4444' : '#64748b';
    let coords = '';
    if (s.points && s.points.length > 0) {
      coords = s.points.map(p => `[${p.x},${p.y}]`).join(',');
    } else if (s.x && s.y) {
      coords = `[${s.x},${s.y}],[${s.x},${s.y+(s.width||0.0003)}],[${s.x+(s.height||0.0002)},${s.y+(s.width||0.0003)}],[${s.x+(s.height||0.0002)},${s.y}]`;
    } else { return ''; }
    return `L.polygon([${coords}], {color:'${c}', fillColor:'${c}', fillOpacity:${isSel?0.6:0.2}, weight:${isSel?3:1}}).addTo(map);`;
  }).join('\n');

  const destX = targetRoom?.shape?.points?.[0]?.x || targetRoom?.shape?.x;
  const destY = targetRoom?.shape?.points?.[0]?.y || targetRoom?.shape?.y;
  const destDot = (destX && destY) ? `L.circleMarker([${destX},${destY}],{radius:9,color:'#fff',weight:2,fillColor:'#3b82f6',fillOpacity:1}).addTo(map);` : '';

  const pathStr = pathPoints ? pathPoints.map(p => `[${p.x},${p.y}]`).join(',') : '';
  const routeLine = pathStr ? `L.polyline([${pathStr}],{color:'#4f46e5',weight:5,opacity:0.8,dashArray:'8,8'}).addTo(map);` : '';
  
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>body{margin:0;padding:0}#map{width:100%;height:100vh}</style>
</head><body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${center[0]},${center[1]}], 19);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:22}).addTo(map);
${roomGeoJSON}
${routeLine}
${destDot}

window.userMarker = null;
${initialPos ? `window.userMarker = L.circleMarker([${initialPos.x},${initialPos.y}],{radius:8,color:'#fff',weight:2,fillColor:'#22c55e',fillOpacity:1}).addTo(map);` : ''}

window.updateUserPos = function(lat, lng) {
  if (!window.userMarker) {
    window.userMarker = L.circleMarker([lat, lng], {radius:8,color:'#fff',weight:2,fillColor:'#22c55e',fillOpacity:1}).addTo(map);
  } else {
    window.userMarker.setLatLng([lat, lng]);
  }
};
</script></body></html>`;
}

export default function NavigationScreen({ navigation, route }) {
  const { colors, language } = useContext(ThemeContext);
  const { room: initialRoom, campusId: initialCampusId, mapData: initialMapData } = route.params || {};
  const [targetRoom, setTargetRoom] = useState(initialRoom);
  const [mapData, setMapData] = useState(initialMapData);
  const [campusId, setCampusId] = useState(initialCampusId || initialRoom?.campusId);
  const [routeData, setRouteData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [error, setError] = useState(null);
  const [liveDistance, setLiveDistance] = useState(0);
  const [liveStepDist, setLiveStepDist] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [routeInfo, setRouteInfo] = useState(null);

  const [locationPerm, setLocationPerm] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const webViewRef = useRef(null);
  const posEngine = useRef(new PositionEngine()).current;
  const stepDetector = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dirCardAnim = useRef(new Animated.Value(0)).current;
  const arrivedAnim = useRef(new Animated.Value(0)).current;

  // Memoize the HTML so it DOES NOT regenerate on every GPS tick
  const initialUserPosRef = useRef(userPos);
  const mapHtml = React.useMemo(() => {
    const floorRooms = mapData?.rooms?.filter(r => r.floorId === targetRoom?.floorId) || [];
    return buildNavMapHTML(floorRooms, routeData?.path, initialUserPosRef.current, targetRoom);
  }, [mapData, routeData, targetRoom]);

  // Push user location updates directly into the WebView via JS
  useEffect(() => {
    if (userPos && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateUserPos === 'function') {
          window.updateUserPos(${userPos.x}, ${userPos.y});
        }
        true;
      `);
    }
  }, [userPos]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPerm(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (!mapData && campusId) {
      import('../api').then(({ getMapData }) => {
        getMapData(campusId).then(data => setMapData(data)).catch(console.warn);
      });
    }
  }, [campusId, mapData]);

  // Preview route automatically when mapData and room (or emergencyMode) are available
  useEffect(() => {
    if (mapData && (targetRoom || route.params?.emergencyMode) && locationPerm !== null && !routeData) {
      previewRoute();
    }
  }, [mapData, targetRoom, route.params?.emergencyMode, locationPerm]);

  const previewRoute = async () => {
    try {
      // Save to recent (fire-and-forget)
      if (targetRoom) {
        AsyncStorage.getItem("navx_recent").then(stored => {
          let recent = stored ? JSON.parse(stored) : [];
          recent = recent.filter(r => r._id !== targetRoom._id);
          recent.unshift(targetRoom);
          if (recent.length > 5) recent = recent.slice(0, 5);
          AsyncStorage.setItem("navx_recent", JSON.stringify(recent));
        }).catch(() => {});
      }

      setError(null);
      setGpsLoading(true);
      let uLat = null;
      let uLng = null;
      let usedQR = false;

      // Check for explicitly passed position or recent QR scan
      if (route.params?.userPosition) {
        uLat = route.params.userPosition.x;
        uLng = route.params.userPosition.y;
        usedQR = true;
      } else {
        try {
          const lastScanStr = await AsyncStorage.getItem('navx_last_scan');
          if (lastScanStr) {
            const lastScan = JSON.parse(lastScanStr);
            // If scanned within the last 1 minute
            if (Date.now() - lastScan.timestamp < 60000) {
              uLat = lastScan.x;
              uLng = lastScan.y;
              usedQR = true;
            }
          }
        } catch (e) {}
      }

      if (!usedQR) {
        // Step 1: Check location services are enabled
        const locEnabled = await Location.hasServicesEnabledAsync();
        if (!locEnabled) {
          setError("Please turn ON your Location/GPS in phone settings for accurate navigation.");
          setGpsLoading(false);
          return;
        }

        // Step 2: Get user's real GPS position with HIGHEST accuracy
        if (locationPerm) {
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.BestForNavigation,
              maximumAge: 5000,
            });
            uLat = loc.coords.latitude;
            uLng = loc.coords.longitude;
            console.log(`[NavX GPS] User at: ${uLat.toFixed(6)}, ${uLng.toFixed(6)} accuracy: ${loc.coords.accuracy}m`);
          } catch (e) {
            console.warn("GPS error:", e);
            setError("Could not get GPS location. Please enable Location and try again.");
            setGpsLoading(false);
            return;
          }
        } else {
          setError("Location permission required. Please allow location access in your phone settings.");
          setGpsLoading(false);
          return;
        }
      }

      if (usedQR) {
        posEngine.setPositionFromQR(uLat, uLng, targetRoom?.floorId);
      }
      setUserPos({ x: uLat, y: uLng, floor: targetRoom?.floorId });

      // Step 3: Send raw GPS/QR coords to the backend
      let result;
      if (route.params?.emergencyMode) {
        result = await findRouteToExit({
          startX: uLat,
          startY: uLng,
          campusId: String(campusId),
        });
        if (result.targetExit) {
          // Mock the 'room' object so the UI says "Exit"
          setTargetRoom({ name: result.targetExit.label || result.targetExit.name || "Emergency Exit", _id: result.targetExit._id, floorId: result.targetExit.floorId });
        }
      } else {
        result = await findRouteToRoom({
          startX: uLat,
          startY: uLng,
          roomId: String(targetRoom?._id),
          campusId: String(campusId),
        });
      }

      // Step 4: Prepend user's exact GPS position to the path for visual line
      if (result.path && result.path.length > 0) {
        const firstNode = result.path[0];
        const distToFirst = haversine(uLat, uLng, firstNode.x, firstNode.y);

        if (distToFirst > 3) {
          result.path.unshift({ nodeId: 'user_start', x: uLat, y: uLng, floorId: targetRoom?.floorId || null, type: 'user' });
          result.distance += distToFirst;
          const segSteps = Math.max(1, Math.round(distToFirst / AVG_STRIDE));
          const segEta = Math.round(distToFirst / WALK_SPEED);
          if (result.directions?.length > 0) {
            result.directions.unshift({
              step: 0,
              instruction: "Walk towards the nearest path",
              distance: Math.round(distToFirst * 10) / 10,
              bearing: 0,
              eta: segEta,
              steps: segSteps,
              pathType: 'hallway',
            });
            result.totalSteps = (result.totalSteps || 0) + segSteps;
            result.eta = (result.eta || 0) + segEta;
          }
        }
      }

      setRouteData(result);
      setLiveDistance(Math.round(result.distance));
      setLiveStepDist(Math.round(result.directions?.[0]?.distance || 0));
      if (result.routeType === 'nearest_reachable' && result.message) {
        setRouteInfo(result.message);
      } else if (result.routeType === 'emergency_exit') {
        setRouteInfo("Routing to the nearest emergency exit. Proceed with caution.");
      }
    } catch (err) {
      console.warn("Route error:", err);
      setError("Could not calculate route. Please check your connection and try again.");
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    const unsub = posEngine.onPositionUpdate(pos => {
      setUserPos({ x: pos.x, y: pos.y, floor: pos.floor });
      setHeading(pos.heading);
    });
    return unsub;
  }, []);

  const currentStepRef = useRef(currentStep);
  const routeDataRef = useRef(routeData);
  const arrivedRef = useRef(arrived);

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { routeDataRef.current = routeData; }, [routeData]);
  useEffect(() => { arrivedRef.current = arrived; }, [arrived]);

  useEffect(() => {
    let locationWatcher;
    let accel;
    let mag;
    if (isNavigating) {
      // Step detector for dead reckoning bridging
      stepDetector.current = new StepDetector(() => posEngine.processStep(heading));
      accel = Accelerometer.addListener(d => stepDetector.current?.processAccelerometer(d.x, d.y, d.z));
      Accelerometer.setUpdateInterval(100);
      
      mag = Magnetometer.addListener(d => {
        const h = Math.atan2(d.y, d.x) * (180 / Math.PI);
        posEngine.updateHeading((h + 360) % 360);
      });
      Magnetometer.setUpdateInterval(100);

      // GPS watch for live distance and map updates
      if (locationPerm) {
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0.5 },
          (loc) => {
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            // Only use raw GPS if we haven't calibrated with a highly accurate QR code recently
            if (!posEngine.isCalibrated) {
              setUserPos({ x: lat, y: lng, floor: targetRoom?.floorId });
            }
            
            const rData = routeDataRef.current;
            const cStep = currentStepRef.current;
            const isArrived = arrivedRef.current;
            
            // To calculate live distance, use the current active user position
            const activeLat = posEngine.isCalibrated ? posEngine.position.x : lat;
            const activeLng = posEngine.isCalibrated ? posEngine.position.y : lng;

            if (rData && rData.path && !isArrived) {
              const targetNode = rData.path[cStep + 1] || rData.path[cStep];
              if (targetNode) {
                // Haversine distance to end of current segment
                const distToNextNodeMeters = haversine(activeLat, activeLng, targetNode.x, targetNode.y);
                setLiveStepDist(Math.round(distToNextNodeMeters * 10) / 10);
                
                // Sum distances of all SUBSEQUENT segments
                const remainingPathMeters = rData.directions?.slice(cStep + 1).reduce((s,d)=>s+(d.distance||0), 0) || 0;
                
                setLiveDistance(Math.max(0, Math.round((distToNextNodeMeters + remainingPathMeters) * 10) / 10));
              }
            }
          }
        ).then(w => locationWatcher = w);
      }

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 900, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        ])
      ).start();

      return () => { 
        if (accel) accel.remove(); 
        if (mag) mag.remove(); 
        if (locationWatcher) locationWatcher.remove();
      };
    }
  }, [isNavigating, locationPerm, targetRoom]);

  useEffect(() => {
    if (routeData) {
      const progress = currentStep / Math.max(1, routeData.directions?.length - 1);
      Animated.spring(progressAnim, { toValue: progress, useNativeDriver: false, tension: 100, friction: 12 }).start();
    }
  }, [currentStep, routeData]);

  useEffect(() => {
    if (routeData && userPos && isNavigating && !arrived) {
      const targetNode = routeData.path[currentStep + 1] || routeData.path[currentStep];
      if (targetNode) {
        const distInMeters = haversine(userPos.x, userPos.y, targetNode.x, targetNode.y);
        
        // Dynamic threshold: 8m for short segments, 12m for long ones
        const segLen = routeData.directions?.[currentStep]?.distance || 20;
        const threshold = Math.min(12, Math.max(8, segLen * 0.4));
        
        if (distInMeters < threshold) {
          if (currentStep < (routeData.directions?.length || 1) - 1) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            setLiveStepDist(Math.round(routeData.directions[nextStep]?.distance || 0));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (voiceEnabled && routeData.directions[nextStep]) {
              const d = routeData.directions[nextStep];
              Speech.speak(`${d.instruction}. ${Math.round(d.distance)} meters.`, { language: "en-US" });
            }
          } else {
            setArrived(true);
            setIsNavigating(false);
            setLiveDistance(0);
            setLiveStepDist(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (voiceEnabled) Speech.speak("You have arrived at " + (targetRoom?.name || "your destination"), { language: "en-US" });
            Animated.spring(arrivedAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
          }
        }
      }
    }
  }, [userPos, isNavigating, arrived]);

  const startNavigation = async () => {
    if (!mapData || (!targetRoom && !route.params?.emergencyMode)) return;
    try {
      setError(null);
      setArrived(false);
      
      if (!routeData) {
         // If preview failed, try again
         await previewRoute();
      }

      if (routeData) {
        setCurrentStep(0);
        setIsNavigating(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (voiceEnabled) {
          const prefix = routeData.routeType === 'nearest_reachable'
            ? `No direct path found. Navigating to the nearest accessible point near ${targetRoom?.name}. `
            : `Starting navigation to ${targetRoom?.name || "Exit"}. `;
          Speech.speak(prefix + (routeData.directions?.[0]?.instruction || "Follow the route."));
        }
        Animated.spring(dirCardAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
      }
    } catch (err) {
      setError("Could not start navigation.");
    }
  };

  const currentDir = routeData?.directions?.[currentStep];
  const floorRooms = mapData?.rooms?.filter(r => r.floorId === targetRoom?.floorId) || [];

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
          {targetRoom?.name || "Navigation"}
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

      {routeInfo && (
        <View style={[s.errorBox, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '30' }]}>
          <Ionicons name="information-circle" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600", marginLeft: 8, flex: 1 }}>{routeInfo}</Text>
        </View>
      )}

      {/* Map Area */}
      <View style={s.mapArea}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          javaScriptEnabled
          scrollEnabled={false}
        />

        {/* Direction card */}
        {isNavigating && currentDir && !arrived && (
          <Animated.View style={[s.dirCard, { transform: [{ translateY: dirCardAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }], opacity: dirCardAnim }]}>
            <Animated.View style={[s.dirIconWrap, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name={getDirIcon()} size={26} color={colors.primary} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={s.dirInstruction}>{currentDir.instruction}</Text>
              <Text style={s.dirMeta}>{isNavigating ? liveStepDist : Math.round(currentDir.distance)}m away</Text>
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
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 }}>{targetRoom?.name}</Text>
          </Animated.View>
        )}
      </View>

      {/* Bottom panel */}
      <View style={s.bottomPanel}>
        {routeData && (
          <View style={{ marginBottom: 16 }}>
            <View style={s.metricsRow}>
              <View style={s.metric}>
                <Text style={s.metricValue}>{isNavigating ? Math.round(liveDistance) : Math.round(routeData.distance)}m</Text>
                <Text style={s.metricLabel}>{isNavigating ? "Distance Left" : "Total Distance"}</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricValue}>{(() => {
                  const secs = isNavigating
                    ? (routeData.directions?.slice(currentStep).reduce((s,d) => s + (d.eta||0), 0) || Math.round(liveDistance / WALK_SPEED))
                    : (routeData.eta || Math.round(routeData.distance / WALK_SPEED));
                  return secs >= 60 ? Math.ceil(secs / 60) + "'" : secs + "s";
                })()}</Text>
                <Text style={s.metricLabel}>{isNavigating ? "Live ETA" : "Est. Time"}</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricValue}>{isNavigating
                  ? (routeData.directions?.slice(currentStep).reduce((s,d) => s + (d.steps || Math.round((d.distance||0)/AVG_STRIDE)), 0) || Math.round(liveDistance / AVG_STRIDE))
                  : (routeData.totalSteps || Math.round(routeData.distance / AVG_STRIDE))
                }</Text>
                <Text style={s.metricLabel}>Steps Count</Text>
              </View>
            </View>
            {isNavigating && (
              <View style={s.progressTrack}>
                <Animated.View style={[s.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
              </View>
            )}
          </View>
        )}
        {!isNavigating ? (
          <TouchableOpacity style={s.startBtn} onPress={startNavigation} disabled={gpsLoading}>
            {gpsLoading ? <ActivityIndicator color="#fff" /> : <Ionicons name="navigate" size={20} color="#fff" />}
            <Text style={s.btnText}>{gpsLoading ? "Calculating Route..." : "Start Navigation"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.startBtn, s.stopBtn]} onPress={() => { setIsNavigating(false); Speech.stop(); }}>
            <Ionicons name="stop" size={20} color="#fff" />
            <Text style={s.btnText}>Stop Navigation</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.arToggle} onPress={() => navigation.navigate("AR", { routeData, room: targetRoom, heading })}>
          <Ionicons name="camera" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14, marginLeft: 8 }}>Switch to AR View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
