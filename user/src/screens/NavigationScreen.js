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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { findRouteToRoom, findRouteToExit, getGeoJSONMapData, SOCKET_URL, getCachedConfigValue } from "../api";
import { io } from "socket.io-client";
import { PositionEngine, StepDetector } from "../positioning";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";
import AnimatedPressable from "../components/AnimatedPressable";

const { width: SW, height: SH } = Dimensions.get("window");

// 🌍 Haversine helper (matches backend formula) 🌍
const EARTH_R = 6_371_000;

// Helper to format text for better Speech pronunciation (e.g., "5-g-03" -> "5 g 0 3")
const formatSpeech = (text) => {
  if (!text) return "";
  return text.replace(/-/g, " ");
};
const toRad = d => d * Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
const AVG_STRIDE = 0.72;   // meters per step
const WALK_SPEED = 1.2;    // m/s fallback

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

const DIR_ICONS = {
  left: "arrow-back",
  right: "arrow-forward",
  straight: "arrow-up",
  stairs: "trending-up",
  elevator: "git-merge",
  arrived: "checkmark-circle",
};

async function fetchStreetRoute(lat1, lon1, lat2, lon2) {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      // OSRM returns coordinates as [longitude, latitude]
      return data.routes[0].geometry.coordinates.map(c => ({
        x: c[1],
        y: c[0],
        type: 'street'
      }));
    }
  } catch (e) {
    console.log("OSRM Error:", e);
  }
  return null;
}

function buildNavMapHTML(geoJSONData, pathPoints, initialPos, targetRoom, mapboxUrl, floors) {
  const center = initialPos ? [initialPos.x, initialPos.y] : (pathPoints?.length ? [pathPoints[0].x, pathPoints[0].y] : [18.4665, 83.6629]);
  
  const destX = targetRoom?.shape?.points?.[0]?.x || targetRoom?.shape?.x;
  const destY = targetRoom?.shape?.points?.[0]?.y || targetRoom?.shape?.y;  const pathCoordinates = pathPoints ? pathPoints.map(p => {
    let level = p.floorLevel;
    if (level === undefined && floors) {
      const f = floors.find(fl => fl._id.toString() === (p.floorId?._id || p.floorId)?.toString());
      if (f && f.level !== undefined) level = f.level;
    }
    // Base height for each floor is 3.5m. We add 0.5 to lift it slightly off the ground.
    const h = (level || 0) * 3.5 + 0.5;
    return `[${p.y}, ${p.x}, ${h}]`;
  }).join(',') : '';

  const targetFloorId = targetRoom?.floorId
    ? (typeof targetRoom.floorId === 'object' ? targetRoom.floorId._id : targetRoom.floorId)
    : '';
  
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></script>
<style>
  body{margin:0;padding:0;background-color:#0a0e17;}
  #map{width:100%;height:100vh;background:#0a0e17;}
  .mapboxgl-ctrl-logo { display: none !important; }
  .mapboxgl-popup { max-width: 200px; }
  .mapboxgl-popup-content { background: rgba(10, 14, 23, 0.8); color: white; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); font-size: 11px; font-weight: bold; }
  .mapboxgl-popup-tip { border-top-color: rgba(10, 14, 23, 0.8); }
  .room-label { color: #1e293b; font-weight: bold; font-size: 10px; text-shadow: 0 1px 2px rgba(255,255,255,0.8); }
  .target-room-label { color: #ffffff; font-weight: bold; font-size: 11px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
  .user-marker {
    position: relative; width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;
  }
  @keyframes pulseGlow {
    0% { transform: scale(0.85); opacity: 0.8; }
    50% { transform: scale(1.4); opacity: 0.3; }
    100% { transform: scale(0.85); opacity: 0.8; }
  }
  .pulse {
    position: absolute; width: 100%; height: 100%; background: radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, rgba(139, 92, 246, 0) 65%); border-radius: 50%; animation: pulseGlow 2.5s infinite;
  }
  .puck {
    position: relative; width: 30px; height: 30px; background: linear-gradient(135deg, #A855F7, #6D28D9); border-radius: 50%; box-shadow: 0 6px 16px rgba(109, 40, 217, 0.6); display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.4); transition: transform 0.2s ease-out;
  }
  .dest-marker {
    width: 18px; height: 18px; background-color: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
</style>
</head><body><div id="map"></div>
<script>
const tokenMatch = '${mapboxUrl}'.match(/access_token=([^&]+)/);
mapboxgl.accessToken = tokenMatch ? tokenMatch[1] : 'YOUR_TOKEN_HERE';

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [${center[1]}, ${center[0]}], // [lng, lat]
  zoom: 19,
  pitch: 60,
  bearing: -17.6,
  antialias: true,
  attributionControl: false
});

map.on('load', () => {
  // 3D Buildings from Mapbox Streets
  map.addLayer({
    'id': '3d-buildings',
    'source': 'composite',
    'source-layer': 'building',
    'filter': ['==', 'extrude', 'true'],
    'type': 'fill-extrusion',
    'minzoom': 15,
    'paint': {
      'fill-extrusion-color': '#1f2937',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 0.6
    }
  });

  ${geoJSONData ? `window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${targetFloorId || ''}');` : ''}

  // Draw Route Path
  ${pathCoordinates ? `
    map.addSource('route', {
      'type': 'geojson',
      'data': {
        'type': 'Feature',
        'properties': {},
        'geometry': {
          'type': 'LineString',
          'coordinates': [${pathCoordinates}]
        }
      }
    });
    map.addLayer({
      'id': 'route-bg',
      'type': 'line',
      'source': 'route',
      'layout': { 'line-join': 'round', 'line-cap': 'round' },
      'paint': { 'line-color': '#c084fc', 'line-width': 18, 'line-opacity': 0.25 }
    });
    map.addLayer({
      'id': 'route-line',
      'type': 'line',
      'source': 'route',
      'layout': { 'line-join': 'round', 'line-cap': 'round' },
      'paint': { 'line-color': '#8b5cf6', 'line-width': 6 }
    });
  ` : ''}
});

window.updateGeoJSON = function(data, floorId) {
  if (!map.isStyleLoaded()) return;

  const features = data.features.filter(f => {
    if (f.properties.type === 'path' || f.properties.type === 'node') return false;
    if (f.properties.category === 'parking' || (f.properties.name && f.properties.name.toLowerCase().includes('parking'))) {
      if (f.properties.id !== '${targetRoom?._id || ''}') return false;
    }
    if (f.properties.type === 'room' && f.properties.floorId) {
      if (floorId && f.properties.floorId !== floorId) return false;
    }
    return true;
  });
  data.features = features;

  if (map.getSource('campus-data')) {
    map.getSource('campus-data').setData(data);
  } else {
    map.addSource('campus-data', {
      type: 'geojson',
      data: data
    });

    map.addLayer({
      'id': 'campus-polygons',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'paint': {
        'fill-extrusion-color': [
          'case',
          ['==', ['get', 'id'], '${targetRoom?._id || ''}'], '#3b82f6',
          ['coalesce', ['get', 'color'], '#64748b']
        ],
        'fill-extrusion-height': [
          'case',
          ['==', ['get', 'type'], 'block'], 0.5,
          ['==', ['get', 'type'], 'room'], 3,
          2
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': [
          'case',
          ['==', ['get', 'id'], '${targetRoom?._id || ''}'], 0.8,
          0.4
        ]
      }
    });

    map.addLayer({
      'id': 'campus-labels',
      'type': 'symbol',
      'source': 'campus-data',
      'layout': {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 1]
      },
      'paint': {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(10, 14, 23, 0.8)',
        'text-halo-width': 2
      }
    });
  }
};

const userIconEl = document.createElement('div');
userIconEl.className = 'user-marker';
userIconEl.innerHTML = '<div class="pulse"></div><div id="user-puck-inner" class="puck"><svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="transform: translateY(-1px);"><path d="M12 2L4 20l8-4 8 4z"/></svg></div>';

window.userMarker = null;

${initialPos ? `
  window.userMarker = new mapboxgl.Marker({ element: userIconEl, pitchAlignment: 'map' })
    .setLngLat([${initialPos.y}, ${initialPos.x}])
    .addTo(map);
` : ''}

// Destination marker
${destX && destY ? `
  const destEl = document.createElement('div');
  destEl.className = 'dest-marker';
  new mapboxgl.Marker({ element: destEl }).setLngLat([${destY}, ${destX}]).addTo(map);
` : ''}

window.updateUserPos = function(lat, lng, heading) {
  if (!window.userMarker) {
    window.userMarker = new mapboxgl.Marker({ element: userIconEl, pitchAlignment: 'map' })
      .setLngLat([lng, lat])
      .addTo(map);
  } else {
    window.userMarker.setLngLat([lng, lat]);
  }
  if (heading !== undefined && heading !== null) {
    window.updateUserHeading(heading);
  }
  map.flyTo({ center: [lng, lat], animate: false });
};

window.updateUserHeading = function(heading) {
  if (heading !== undefined && heading !== null) {
    const puck = document.getElementById('user-puck-inner');
    if (puck) {
      puck.style.transform = 'rotate(' + heading + 'deg)';
    }
  }
};
</script></body></html>`;
}

export default function NavigationScreen({ navigation, route }) {
  const { colors, language } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { room: initialRoom, campusId: initialCampusId, mapData: initialMapData } = route.params || {};
  const [targetRoom, setTargetRoom] = useState(() => {
    if (!initialRoom) return null;
    const normFloorId = typeof initialRoom.floorId === 'object' && initialRoom.floorId !== null
      ? initialRoom.floorId._id
      : initialRoom.floorId;
    return { ...initialRoom, floorId: normFloorId };
  });
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
  const [offRoute, setOffRoute] = useState(false);

  const [locationPerm, setLocationPerm] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (route.params?.room) {
      const normFloorId = typeof route.params.room.floorId === 'object' && route.params.room.floorId !== null
        ? route.params.room.floorId._id
        : route.params.room.floorId;
      setTargetRoom({ ...route.params.room, floorId: normFloorId });
    }
  }, [route.params?.room]);

  // Floor-change tracking state
  const [currentFloor, setCurrentFloor] = useState(null);
  const [completedFloorTransitions, setCompletedFloorTransitions] = useState(0);
  const [totalFloorTransitions, setTotalFloorTransitions] = useState(0);

  const [geoJSONData, setGeoJSONData] = useState(null);
  const socketRef = useRef(null);

  const webViewRef = useRef(null);
  const posEngine = useRef(new PositionEngine()).current;
  const stepDetector = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dirCardAnim = useRef(new Animated.Value(0)).current;
  const arrivedAnim = useRef(new Animated.Value(0)).current;

  // Memoize the HTML so it DOES NOT regenerate on every GPS tick
  const initialUserPosRef = useRef(null);
  // Keep routeData in a stable ref for startNavigation to avoid stale state
  const routeDataStableRef = useRef(routeData);
  const mapboxUrl = getCachedConfigValue("EXPO_PUBLIC_MAPBOX_URL", "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA");
  
  const mapHtml = React.useMemo(() => {
    if (!geoJSONData) return "";
    return buildNavMapHTML(geoJSONData, routeData?.path, initialUserPosRef.current, targetRoom, mapboxUrl, mapData?.floors);
  }, [geoJSONData, routeData, targetRoom, mapboxUrl, mapData?.floors]);

  // Inject updated GeoJSON when it changes without reloading WebView
  useEffect(() => {
    const getFloorIdString = (floorVal) => {
      if (!floorVal) return '';
      if (typeof floorVal === 'object') return floorVal._id || '';
      return floorVal;
    };
    const targetFloorId = getFloorIdString(targetRoom?.floorId) || getFloorIdString(currentFloor) || getFloorIdString(route.params?.floorId) || getFloorIdString(mapData?.floors?.[0]?._id);
    if (geoJSONData && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateGeoJSON === 'function') {
          window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${targetFloorId || ''}');
        }
        true;
      `);
    }
  }, [geoJSONData, currentFloor, targetRoom, mapData, route.params?.floorId]);

  // Load GeoJSON and socket connection
  useEffect(() => {
    if (campusId) {
      getGeoJSONMapData(campusId).then(setGeoJSONData).catch(console.warn);

      socketRef.current = io(SOCKET_URL);
      socketRef.current.emit('join_campus', campusId);
      socketRef.current.on('map_updated', () => {
        console.log("Real-time map update received");
        getGeoJSONMapData(campusId).then(setGeoJSONData).catch(console.warn);
      });

      return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }
  }, [campusId]);

  // Push user location updates directly into the WebView via JS (with route-snapping)
  useEffect(() => {
    if (userPos && webViewRef.current) {
      const snappedPos = snapPositionToRoute(userPos, routeData?.path, currentStep);
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateUserPos === 'function') {
          window.updateUserPos(${snappedPos.x}, ${snappedPos.y}, ${posEngine.heading});
        }
        true;
      `);
    }
  }, [userPos, routeData, currentStep]);

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
  }, [mapData, targetRoom, route.params?.emergencyMode, locationPerm, routeData]);

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
      if (route.params?.userPosition && (route.params.userPosition.x !== 0 || route.params.userPosition.y !== 0)) {
        uLat = route.params.userPosition.x;
        uLng = route.params.userPosition.y;
        usedQR = true;
      } else {
        try {
          const lastScanStr = await AsyncStorage.getItem('navx_last_scan');
          if (lastScanStr) {
            const lastScan = JSON.parse(lastScanStr);
            // If scanned within the last 1 minute and coordinates are valid
            if (Date.now() - lastScan.timestamp < 60000 && (lastScan.x !== 0 || lastScan.y !== 0)) {
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
      // Capture the first user position for the initial map render
      if (!initialUserPosRef.current) {
        initialUserPosRef.current = { x: uLat, y: uLng };
      }

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
          const normFloorId = typeof result.targetExit.floorId === 'object' && result.targetExit.floorId !== null
            ? result.targetExit.floorId._id
            : result.targetExit.floorId;
          setTargetRoom({ name: result.targetExit.label || result.targetExit.name || "Emergency Exit", _id: result.targetExit._id, floorId: normFloorId });
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

        if (distToFirst > 15) {
          // If the user is far away (e.g. off-campus), try to snap to real streets using OSRM
          const streetNodes = await fetchStreetRoute(uLat, uLng, firstNode.x, firstNode.y);
          if (streetNodes && streetNodes.length > 0) {
            // Remove the exact first node if it's very close to the end of the street route to avoid looping
            streetNodes.forEach(sn => sn.floorId = targetRoom?.floorId || null);
            result.path = [...streetNodes, ...result.path];
          } else {
            // Fallback to straight line
            result.path.unshift({ nodeId: 'user_start', x: uLat, y: uLng, floorId: targetRoom?.floorId || null, type: 'user' });
          }
          
          result.distance += distToFirst;
          const segSteps = Math.max(1, Math.round(distToFirst / AVG_STRIDE));
          const segEta = Math.round(distToFirst / WALK_SPEED);
          
          if (result.directions?.length > 0) {
            result.directions.unshift({
              step: 0,
              instruction: "Head towards the campus entrance",
              distance: Math.round(distToFirst * 10) / 10,
              bearing: 0,
              eta: segEta,
              steps: segSteps,
              pathType: 'street',
            });
            result.totalSteps = (result.totalSteps || 0) + segSteps;
            result.eta = (result.eta || 0) + segEta;
          }
        } else if (distToFirst > 3) {
          // If just a few meters away, straight line is fine
          result.path.unshift({ nodeId: 'user_start', x: uLat, y: uLng, floorId: targetRoom?.floorId || null, type: 'user' });
        }
      }

      setRouteData(result);
      routeDataStableRef.current = result;
      setLiveDistance(Math.round(result.distance));
      setLiveStepDist(Math.round(result.directions?.[0]?.distance || 0));

      if (route.params?.startAR) {
        navigation.setParams({ startAR: false });
        navigation.navigate("AR", {
          routeData: result,
          room: targetRoom,
          heading: posEngine.heading || 0,
          userPos: { x: uLat, y: uLng },
          campusId
        });
      }

      // Initialize floor tracking from backend response
      setTotalFloorTransitions(result.totalFloorTransitions || 0);
      setCompletedFloorTransitions(0);
      if (result.path?.[0]?.floorId) {
        setCurrentFloor(result.path[0].floorId);
      }

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
  useEffect(() => { routeDataRef.current = routeData; routeDataStableRef.current = routeData; }, [routeData]);
  useEffect(() => { arrivedRef.current = arrived; }, [arrived]);

  // ── Voice announcement guard refs (prevent repeated announcements)
  const preTurnAnnouncedRef = useRef(-1);  // last step for which 10m pre-turn was announced
  const destReminder50Ref   = useRef(false);
  const destReminder20Ref   = useRef(false);
  const offRouteCountRef    = useRef(0);

  useEffect(() => {
    let locationWatcher;
    let accel;
    let mag;
    const accelYRef = { current: 0 };
    if (isNavigating) {
      // Step detector for dead reckoning bridging
      stepDetector.current = new StepDetector(() => posEngine.processStep(posEngine.heading));
      accel = Accelerometer.addListener(d => {
        accelYRef.current = d.y;
        stepDetector.current?.processAccelerometer(d.x, d.y, d.z);
      });
      Accelerometer.setUpdateInterval(100);
      
      mag = Magnetometer.addListener(d => {
        // Tilt-compensated compass logic
        const gY = Math.min(1, Math.abs(accelYRef.current || 0));
        const mForward = d.y * (1 - gY) + (-d.z) * gY;
        
        const h = Math.atan2(mForward, d.x) * (180 / Math.PI);
        const trueBearing = h - 90;
        const normalizedH = (trueBearing + 360) % 360;
        
        posEngine.updateHeading(normalizedH);
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            if (typeof window.updateUserHeading === 'function') {
              window.updateUserHeading(${normalizedH});
            }
            true;
          `);
        }
      });
      Magnetometer.setUpdateInterval(100);

      // GPS watch for live distance and map updates
      if (locationPerm) {
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0.5 },
          (loc) => {
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            const accuracy = loc.coords.accuracy || 15;
            
            // Feed raw GPS coordinate into our sensor fusion engine
            posEngine.processGPSUpdate(lat, lng, accuracy);
            
            const rData = routeDataRef.current;
            const cStep = currentStepRef.current;
            const isArrived = arrivedRef.current;
            
            // Fused, smoothed position coordinates
            let activeLat = posEngine.position.x;
            let activeLng = posEngine.position.y;

            if (rData && rData.path && !isArrived) {
              // Apply aggressive route snapping to internal coordinates to stabilize distances
              const snapped = snapPositionToRoute({ x: activeLat, y: activeLng }, rData.path, cStep);
              activeLat = snapped.x;
              activeLng = snapped.y;

              const prevNode = rData.path[cStep];
              const targetNode = rData.path[cStep + 1] || rData.path[cStep];
              if (targetNode && prevNode) {
                const distToNextNodeMeters = haversine(activeLat, activeLng, targetNode.x, targetNode.y);
                const distToPrevNodeMeters = haversine(activeLat, activeLng, prevNode.x, prevNode.y);
                const segmentLength = haversine(prevNode.x, prevNode.y, targetNode.x, targetNode.y);

                setLiveStepDist(Math.round(distToNextNodeMeters * 10) / 10);

                const remainingPathMeters = rData.directions?.slice(cStep + 1).reduce((s,d)=>s+(d.distance||0), 0) || 0;
                setLiveDistance(Math.max(0, Math.round((distToNextNodeMeters + remainingPathMeters) * 10) / 10));

                // ── PRE-TURN ANNOUNCEMENT at 10m before the turn
                if (voiceEnabled && distToNextNodeMeters <= 10 && preTurnAnnouncedRef.current !== cStep) {
                  const upcoming = rData.directions?.[cStep];
                  if (upcoming && (upcoming.instruction?.toLowerCase().includes('left') ||
                                   upcoming.instruction?.toLowerCase().includes('right') ||
                                   upcoming.instruction?.toLowerCase().includes('turn'))) {
                    preTurnAnnouncedRef.current = cStep;
                    Speech.speak(
                      formatSpeech(`In ${Math.round(distToNextNodeMeters)} meters, ${upcoming.instruction}`),
                      { language: 'en-US', rate: 0.9 }
                    );
                  }
                }

                // ── DESTINATION PROXIMITY REMINDERS
                const destNode = rData.path[rData.path.length - 1];
                if (destNode) {
                  const distToDest = haversine(activeLat, activeLng, destNode.x, destNode.y) +
                    (remainingPathMeters > 0 ? remainingPathMeters * 0.1 : 0);

                  if (voiceEnabled && distToDest <= 50 && !destReminder50Ref.current) {
                    destReminder50Ref.current = true;
                    Speech.speak(
                      formatSpeech(`You are approaching ${targetRoom?.name || 'your destination'}. About 50 meters away.`),
                      { language: 'en-US', rate: 0.9 }
                    );
                  }
                  if (voiceEnabled && distToDest <= 20 && !destReminder20Ref.current) {
                    destReminder20Ref.current = true;
                    Speech.speak(
                      formatSpeech(`${targetRoom?.name || 'Your destination'} is just ahead!`),
                      { language: 'en-US', rate: 0.9 }
                    );
                  }
                }

                // ── OFF-ROUTE DETECTION (tightened to 18m with Debounce)
                if (distToNextNodeMeters + distToPrevNodeMeters > segmentLength + 18) {
                  offRouteCountRef.current = (offRouteCountRef.current || 0) + 1;
                  if (offRouteCountRef.current >= 3) {
                    setOffRoute(true);
                    offRouteCountRef.current = 0; // Reset after triggering
                  }
                } else {
                  offRouteCountRef.current = 0; // Reset if user is back on track
                }
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
            const nextDir = routeData.directions[nextStep];
            setCurrentStep(nextStep);
            setLiveStepDist(Math.round(nextDir?.distance || 0));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            if (voiceEnabled && nextDir) {
              // ── FLOOR-CHANGE: Only announce if it's genuinely an INDOOR transition
              // Outdoor/street path types don't have floor changes — skip to avoid confusion
              const isOutdoorSegment =
                nextDir.pathType === 'street' ||
                nextDir.pathType === 'outdoor' ||
                (!nextDir.toFloorId && !nextDir.fromFloorId && !nextDir.to?.floorId);

              if (nextDir.isFloorChange && !isOutdoorSegment) {
                if (completedFloorTransitions < totalFloorTransitions) {
                  const transNum = nextDir.floorTransitionNumber || (completedFloorTransitions + 1);
                  const totalTrans = nextDir.totalFloorTransitions || totalFloorTransitions;
                  let floorMsg = nextDir.instruction;
                  if (totalTrans > 1) floorMsg += `. Floor change ${transNum} of ${totalTrans}`;
                  floorMsg += '.';
                  Speech.speak(formatSpeech(floorMsg), { language: 'en-US' });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  setCompletedFloorTransitions(prev => prev + 1);
                  if (nextDir.toFloorId) setCurrentFloor(nextDir.toFloorId);
                  else if (nextDir.to?.floorId) setCurrentFloor(nextDir.to.floorId);
                } else {
                  Speech.speak(`Continue. ${Math.round(nextDir.distance)} meters.`, { language: 'en-US' });
                }
              } else {
                // Normal step or outdoor floor-change → just give direction
                Speech.speak(
                  formatSpeech(`${nextDir.instruction}. ${Math.round(nextDir.distance)} meters.`),
                  { language: 'en-US' }
                );
              }
            }
          } else {
            setArrived(true);
            setIsNavigating(false);
            setLiveDistance(0);
            setLiveStepDist(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (voiceEnabled) Speech.speak(formatSpeech("You have arrived at " + (targetRoom?.name || "your destination")), { language: "en-US" });
            Animated.spring(arrivedAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
          }
        }
      }
    }
  }, [userPos, isNavigating, arrived]);

  useEffect(() => {
    if (offRoute && isNavigating && userPos) {
      console.log("[NavX] User is off route! Recalculating from new position...");
      setOffRoute(false);
      recalculateRouteFromGPS(userPos.x, userPos.y);
    }
  }, [offRoute]);

  const recalculateRouteFromGPS = async (lat, lng) => {
    try {
      setGpsLoading(true);
      let result;
      if (route.params?.emergencyMode) {
        result = await findRouteToExit({ startX: lat, startY: lng, campusId: String(campusId) });
        if (result.targetExit) {
          const normFloorId = typeof result.targetExit.floorId === 'object' && result.targetExit.floorId !== null
            ? result.targetExit.floorId._id
            : result.targetExit.floorId;
          setTargetRoom({ name: result.targetExit.label || result.targetExit.name || "Emergency Exit", _id: result.targetExit._id, floorId: normFloorId });
        }
      } else {
        result = await findRouteToRoom({ startX: lat, startY: lng, roomId: String(targetRoom?._id), campusId: String(campusId) });
      }

      if (result.path && result.path.length > 0) {
        // Just directly connect GPS to the new route without OSRM fallback to prevent dual paths
        result.path.unshift({ nodeId: 'user_start', x: lat, y: lng, floorId: targetRoom?.floorId || null, type: 'user' });
        
        setRouteData(result);
        routeDataStableRef.current = result;
        setCurrentStep(0);
        
        // Reset floor tracking for new route
        setTotalFloorTransitions(result.totalFloorTransitions || 0);
        setCompletedFloorTransitions(0);
        if (result.path?.[0]?.floorId) {
          setCurrentFloor(result.path[0].floorId);
        }

        if (voiceEnabled) {
          Speech.speak("Rerouting. Please follow the new path.", { language: "en-US", rate: 0.9 });
        }
      }
    } catch (err) {
      console.warn("Reroute error:", err);
    } finally {
      setGpsLoading(false);
    }
  };

  const startNavigation = async () => {
    if (!mapData || (!targetRoom && !route.params?.emergencyMode)) return;
    try {
      setError(null);
      setArrived(false);
      
      if (!routeDataStableRef.current) {
         // If preview failed, try again
         await previewRoute();
      }

      const activeRouteData = routeDataStableRef.current;
      if (activeRouteData) {
        setCurrentStep(0);
        setIsNavigating(true);
        // Reset floor tracking for fresh navigation
        setCompletedFloorTransitions(0);
        if (activeRouteData.path?.[0]?.floorId) {
          setCurrentFloor(activeRouteData.path[0].floorId);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (voiceEnabled) {
          let destinationName = targetRoom?.name || "your destination";
          const prefix = activeRouteData.routeType === 'nearest_reachable'
            ? `No direct path found. Navigating to the nearest accessible point near ${destinationName}. `
            : `Starting navigation to ${destinationName}. `;
          
          // Inform user about floor changes ahead
          const floorChangeNote = (activeRouteData.totalFloorTransitions || 0) > 0
            ? `This route includes ${activeRouteData.totalFloorTransitions} floor ${activeRouteData.totalFloorTransitions === 1 ? 'change' : 'changes'}. `
            : '';

          const startInstruction = activeRouteData.directions?.[0]?.instruction || "Follow the highlighted path.";
          Speech.speak(formatSpeech(prefix + floorChangeNote + startInstruction), { language: "en-US", rate: 0.9 });
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
    const instr = currentDir.instruction.toLowerCase();
    if (instr.includes("go to the") && instr.includes("floor")) return "swap-vertical";
    if (instr.includes("change floor")) return "swap-vertical";
    if (instr.includes("proceed to the stairs") || instr.includes("head to the stairs")) return "trending-up";
    if (instr.includes("proceed to the elevator") || instr.includes("head to the elevator")) return "git-merge";
    if (instr.includes("left")) return "arrow-back";
    if (instr.includes("right")) return "arrow-forward";
    if (instr.includes("stairs")) return "trending-up";
    if (instr.includes("elevator")) return "git-merge";
    return "arrow-up";
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingBottom: 14,
      paddingTop: 16,
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
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <AnimatedPressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </AnimatedPressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {targetRoom?.name || "Navigation"}
        </Text>
        <AnimatedPressable style={s.voiceBtn} onPress={() => setVoiceEnabled(!voiceEnabled)}>
          <Ionicons name={voiceEnabled ? "volume-high" : "volume-mute"} size={20} color={voiceEnabled ? colors.accent : colors.textMuted} />
        </AnimatedPressable>
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
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          startInLoadingState={true}
          onLoadEnd={() => {
            if (userPos && webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                if (typeof window.updateUserPos === 'function') {
                  window.updateUserPos(${userPos.x}, ${userPos.y}, ${posEngine.heading});
                }
                true;
              `);
            }
          }}
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
      <View style={[s.bottomPanel, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }]}>
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
          <AnimatedPressable style={s.startBtn} onPress={startNavigation} disabled={gpsLoading}>
            {gpsLoading ? <ActivityIndicator color="#fff" /> : <Ionicons name="navigate" size={20} color="#fff" />}
            <Text style={s.btnText}>{gpsLoading ? "Calculating Route..." : "Start Navigation"}</Text>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable style={[s.startBtn, s.stopBtn]} onPress={() => { setIsNavigating(false); Speech.stop(); }}>
            <Ionicons name="stop" size={20} color="#fff" />
            <Text style={s.btnText}>Stop Navigation</Text>
          </AnimatedPressable>
        )}
        <AnimatedPressable style={s.arToggle} onPress={() => navigation.navigate("AR", { routeData, room: targetRoom, heading: posEngine.heading, userPos, campusId })}>
          <Ionicons name="camera" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14, marginLeft: 8 }}>Switch to AR View</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}
