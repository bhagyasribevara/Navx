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
  const destDot = (destX && destY) ? `L.circleMarker([${destX},${destY}],{radius:9,color:'#fff',weight:2,fillColor:'#ef4444',fillOpacity:1}).addTo(map);` : '';

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
${initialPos ? `window.userMarker = L.circleMarker([${initialPos.x},${initialPos.y}],{radius:8,color:'#fff',weight:2,fillColor:'#4f46e5',fillOpacity:1}).addTo(map);` : ''}

window.updateUserPos = function(lat, lng) {
  if (!window.userMarker) {
    window.userMarker = L.circleMarker([lat, lng], {radius:8,color:'#fff',weight:2,fillColor:'#4f46e5',fillOpacity:1}).addTo(map);
  } else {
    window.userMarker.setLatLng([lat, lng]);
  }
};
</script></body></html>`;
}

export default function NavigationScreen({ navigation, route }) {
  const { colors, language } = useContext(ThemeContext);
  const { room, campusId: initialCampusId, mapData: initialMapData } = route.params || {};
  const [mapData, setMapData] = useState(initialMapData);
  const [campusId, setCampusId] = useState(initialCampusId || room?.campusId);
  const [routeData, setRouteData] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [error, setError] = useState(null);
  const [liveDistance, setLiveDistance] = useState(0);
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
    const floorRooms = mapData?.rooms?.filter(r => r.floorId === room?.floorId) || [];
    return buildNavMapHTML(floorRooms, routeData?.path, initialUserPosRef.current, room);
  }, [mapData, routeData, room]);

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

  // Preview route automatically when mapData and room are available
  useEffect(() => {
    if (mapData && room && locationPerm !== null && !routeData) {
      previewRoute();
    }
  }, [mapData, room, locationPerm]);

  const previewRoute = async () => {
    try {
      setError(null);
      setGpsLoading(true);
      let startNode = mapData.nodes?.[0];
      let uLat = null;
      let uLng = null;

      if (locationPerm) {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          uLat = loc.coords.latitude;
          uLng = loc.coords.longitude;
          setUserPos({ x: uLat, y: uLng, floor: room.floorId });
          
          if (mapData.nodes?.length > 0) {
            let nearest = null;
            let minDist = Infinity;
            for (let n of mapData.nodes) {
              const dx = (n.x - uLat) * 111320;
              const dy = (n.y - uLng) * 111320 * Math.cos(uLat * Math.PI / 180);
              const d = Math.sqrt(dx*dx + dy*dy);
              if (d < minDist) { minDist = d; nearest = n; }
            }
            if (nearest) startNode = nearest;
          }
        } catch (e) {
          console.warn("GPS preview error:", e);
        }
      }
      
      if (startNode) {
        const result = await findRouteToRoom({ startNodeId: startNode._id, roomId: room._id, campusId });
        
        // Ensure path always visually starts from the exact user location
        if (uLat && uLng && result.path && result.path.length > 0) {
          const firstNode = result.path[0];
          const dx = (uLat - firstNode.x) * 111320;
          const dy = (uLng - firstNode.y) * 111320 * Math.cos(uLat * Math.PI / 180);
          const distToFirst = Math.sqrt(dx*dx + dy*dy);
          
          if (distToFirst > 2) {
            result.path.unshift({
              nodeId: 'user_start',
              x: uLat,
              y: uLng,
              floorId: room.floorId || null,
              type: 'user'
            });
            result.distance += distToFirst;
            
            if (result.directions && result.directions.length > 0) {
              result.directions.unshift({
                step: 0,
                instruction: "Walk towards the starting path",
                distance: Math.round(distToFirst),
                angle: 0,
                eta: Math.round(distToFirst / 1.2)
              });
            }
          }
        }

        setRouteData(result);
        setLiveDistance(Math.round(result.distance));
        if (result.routeType === 'nearest_reachable' && result.message) {
          setRouteInfo(result.message);
        }
      }
    } catch (err) {
      setError("Could not calculate initial route preview.");
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
          { accuracy: Location.Accuracy.High, distanceInterval: 1 },
          (loc) => {
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            setUserPos({ x: lat, y: lng, floor: room?.floorId });
            
            const rData = routeDataRef.current;
            const cStep = currentStepRef.current;
            const isArrived = arrivedRef.current;

            if (rData && rData.path && !isArrived) {
              const target = rData.path[cStep];
              if (target) {
                // Approximate distance to next node + remaining path
                const dx = (lat - target.x) * 111320;
                const dy = (lng - target.y) * 111320 * Math.cos(lat * Math.PI / 180);
                const distToNextNodeMeters = Math.sqrt(dx*dx + dy*dy);
                const remainingPathMeters = rData.directions?.slice(cStep).reduce((s,d)=>s+(d.distance||0), 0) || 0;
                setLiveDistance(Math.round(distToNextNodeMeters + remainingPathMeters));
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
  }, [isNavigating, locationPerm, room]);

  useEffect(() => {
    if (routeData) {
      const progress = currentStep / Math.max(1, routeData.directions?.length - 1);
      Animated.spring(progressAnim, { toValue: progress, useNativeDriver: false, tension: 100, friction: 12 }).start();
    }
  }, [currentStep, routeData]);

  useEffect(() => {
    if (routeData && userPos && isNavigating && !arrived) {
      const target = routeData.path[currentStep];
      if (target) {
        const dx = (userPos.x - target.x) * 111320;
        const dy = (userPos.y - target.y) * 111320 * Math.cos(userPos.x * Math.PI / 180);
        const distInMeters = Math.sqrt(dx*dx + dy*dy);
        if (distInMeters < 15) {
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
  }, [userPos, currentStep, isNavigating, arrived]);

  const startNavigation = async () => {
    if (!mapData || !room) return;
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
            ? `No direct path found. Navigating to the nearest accessible point near ${room.name}. `
            : `Starting navigation to ${room.name}. `;
          Speech.speak(prefix + (routeData.directions?.[0]?.instruction || "Follow the route."));
        }
        Animated.spring(dirCardAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
      }
    } catch (err) {
      setError("Could not start navigation.");
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
          <View style={{ marginBottom: 16 }}>
            <View style={s.metricsRow}>
              <View style={s.metric}>
                <Text style={s.metricValue}>{isNavigating ? liveDistance : Math.round(routeData.distance)}m</Text>
                <Text style={s.metricLabel}>{isNavigating ? "Distance Left" : "Total Distance"}</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricValue}>{Math.max(1, Math.ceil((isNavigating ? liveDistance : routeData.distance) / 1.2 / 60))}'</Text>
                <Text style={s.metricLabel}>{isNavigating ? "Live ETA" : "Est. Time"}</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricValue}>{routeData.nodeCount || routeData.directions?.length}</Text>
                <Text style={s.metricLabel}>Steps</Text>
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
        <TouchableOpacity style={s.arToggle} onPress={() => navigation.navigate("AR", { routeData, room, heading })}>
          <Ionicons name="camera" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14, marginLeft: 8 }}>Switch to AR View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
