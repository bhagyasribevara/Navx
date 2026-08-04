import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform, Dimensions, Animated, Easing, RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { ThemeContext } from "../context/ThemeContext";
import { useGeofence } from "../context/GeofenceContext";
import { getMapData, getCampuses, getGeoJSONMapData, SOCKET_URL, getCachedConfigValue } from "../api";
import { io } from "socket.io-client";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";
import * as Location from 'expo-location';

const { height: SH, width: SW } = Dimensions.get('window');

function buildCampusMapHTML(geoJSONData, centerCoords, mapboxUrl, mapMode = '3D') {
  const center = centerCoords ? [centerCoords.x, centerCoords.y] : [18.4665, 83.6629];
  const initialPitch = mapMode === '2D' ? 0 : 60;
  const initialBearing = mapMode === '2D' ? 0 : -17.6;
  
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
</style>
</head><body><div id="map"></div>
<script>
// Extract mapbox token from the url
const tokenMatch = '${mapboxUrl}'.match(/access_token=([^&]+)/);
mapboxgl.accessToken = tokenMatch ? tokenMatch[1] : 'YOUR_TOKEN_HERE';

var initialStyle = '${mapMode}' === '2D' ? 'mapbox://styles/mapbox/outdoors-v12' : 'mapbox://styles/mapbox/dark-v11';

var map = new mapboxgl.Map({
  container: 'map',
  style: initialStyle,
  center: [${center[1]}, ${center[0]}], // [lng, lat]
  zoom: 17,
  pitch: ${initialPitch},
  bearing: ${initialBearing},
  antialias: true,
  attributionControl: false
});

var currentMapMode = '${mapMode || "3D"}';
var currentGeoData = ${geoJSONData ? JSON.stringify(geoJSONData) : 'null'};
var currentFloorId = '${centerCoords?.floorId || ""}';

window.setMapMode = function(mode) {
  if (!map) return;
  currentMapMode = mode;
  var is2D = (mode === '2D');

  if (is2D) {
    map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  } else {
    map.easeTo({ pitch: 60, bearing: -17.6, duration: 600 });
  }

  // Hide all block shapes, room polygons, steps, nodes, and custom layers in 2D mode for a pure clean Mapbox map tile view
  var customLayers = [
    'campus-2d-fill', 'campus-2d-line', 'campus-2d-paths', 'campus-2d-nodes',
    'campus-blocks', 'campus-rooms', '3d-buildings', 'campus-labels'
  ];

  customLayers.forEach(function(id) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', is2D ? 'none' : 'visible');
    }
  });
};

map.on('load', () => {
  // Add 3D buildings layer from Mapbox Streets
  if (!map.getLayer('3d-buildings')) {
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
  }

  if (currentGeoData) {
    window.renderGeoJSONLayers(currentGeoData, currentFloorId);
  }
});

window.updateGeoJSON = function(data, floorId) {
  currentGeoData = data;
  currentFloorId = floorId;
  window.renderGeoJSONLayers(data, floorId);
};

window.renderGeoJSONLayers = function(data, floorId) {
  if (!map || !data || !data.features) return;

  var is2D = (currentMapMode === '2D');

  // Filter polygon features
  var polyFeatures = data.features.filter(function(f) {
    if (f.properties.type === 'path' || f.properties.type === 'node') return false;
    if (f.properties.category === 'parking' || (f.properties.name && f.properties.name.toLowerCase().includes('parking'))) return false;
    if (f.properties.type === 'room') {
      if (!floorId) return false;
      if (f.properties.floorId !== floorId) return false;
    }
    return true;
  });

  var polygonData = { type: 'FeatureCollection', features: polyFeatures };

  if (map.getSource('campus-data')) {
    map.getSource('campus-data').setData(polygonData);
  } else {
    map.addSource('campus-data', { type: 'geojson', data: polygonData });
  }

  // ── 1. FLAT 2D FILL LAYER ──
  if (!map.getLayer('campus-2d-fill')) {
    map.addLayer({
      'id': 'campus-2d-fill',
      'type': 'fill',
      'source': 'campus-data',
      'layout': { 'visibility': is2D ? 'visible' : 'none' },
      'paint': {
        'fill-color': ['coalesce', ['get', 'color'], '#3b82f6'],
        'fill-opacity': 0.55
      }
    });
  }

  // ── 2. CRISP 2D POLYGON OUTLINE ──
  if (!map.getLayer('campus-2d-line')) {
    map.addLayer({
      'id': 'campus-2d-line',
      'type': 'line',
      'source': 'campus-data',
      'layout': { 'visibility': is2D ? 'visible' : 'none' },
      'paint': {
        'line-color': ['coalesce', ['get', 'color'], '#1d4ed8'],
        'line-width': 2.5,
        'line-opacity': 0.85
      }
    });
  }

  // ── 5B. 3D EXTRUSION LAYER FOR ROOMS (OPAQUE, DRAW FIRST) ──
  if (!map.getLayer('campus-rooms')) {
    map.addLayer({
      'id': 'campus-rooms',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['!=', ['get', 'type'], 'block'],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': [
          'case',
          ['==', ['get', 'type'], 'stairs'], ['coalesce', ['get', 'color'], '#f97316'],
          '#ffffff'
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 3],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.9
      }
    }, '3d-buildings');
  }

  // ── 5A. 3D EXTRUSION LAYER FOR BLOCKS (TRANSLUCENT, DRAW AFTER ROOMS) ──
  if (!map.getLayer('campus-blocks')) {
    map.addLayer({
      'id': 'campus-blocks',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['==', ['get', 'type'], 'block'],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#64748b'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 2],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.2
      }
    }, '3d-buildings');
  }

  // ── 6. LABELS FOR BLOCKS ──
  if (!map.getLayer('campus-labels')) {
    map.addLayer({
      'id': 'campus-labels',
      'type': 'symbol',
      'source': 'campus-data',
      'filter': ['!=', ['get', 'type'], 'room'],
      'layout': {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 1]
      },
      'paint': {
        'text-color': is2D ? '#0f172a' : '#ffffff',
        'text-halo-color': is2D ? '#ffffff' : 'rgba(10, 14, 23, 0.8)',
        'text-halo-width': 2.5
      }
    });
  }

  // Ensure visibilities match current state
  window.setMapMode(currentMapMode);
};

const userIconEl = document.createElement('div');
userIconEl.className = 'user-marker';
userIconEl.innerHTML = '<div class="pulse"></div><div id="user-puck-inner" class="puck"><svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="transform: translateY(-1px);"><path d="M12 2L4 20l8-4 8 4z"/></svg></div>';

window.userMarker = null;

window.updateUserPos = function(lat, lng, heading) {
  if (!window.userMarker) {
    window.userMarker = new mapboxgl.Marker({ element: userIconEl, pitchAlignment: 'map' })
      .setLngLat([lng, lat])
      .addTo(map);
  } else {
    window.userMarker.setLngLat([lng, lat]);
  }
  if (heading !== undefined && heading !== null) {
    const puck = document.getElementById('user-puck-inner');
    if (puck) {
      puck.style.transform = 'rotate(' + heading + 'deg)';
    }
  }
};

window.panTo = function(lat, lng) {
  var currentPitch = map ? map.getPitch() : 60;
  map.flyTo({ center: [lng, lat], zoom: 19, duration: 1500, pitch: currentPitch });
};
</script></body></html>`;
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const { activeCampusId: contextCampusId, detectedFloorIndex, setCurrentFloorId } = useGeofence();
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [campusId, setCampusId] = useState(route.params?.campusId || contextCampusId || null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [showingRestroomsMode, setShowingRestroomsMode] = useState(route.params?.showRestrooms || false);
  const [geoJSONData, setGeoJSONData] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [mapMode, setMapMode] = useState('3D');

  const webViewRef = useRef(null);
  const socketRef = useRef(null);
  const panelHeightAnim = useRef(new Animated.Value(SH * 0.45)).current; // Bottom sheet height

  const toggleMapMode = (mode) => {
    if (mode === mapMode) return;
    setMapMode(mode);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.setMapMode === 'function') {
          window.setMapMode('${mode}');
        }
        true;
      `);
    }
  };

  useEffect(() => {
    if (route.params?.campusId) {
      setCampusId(route.params.campusId);
      setSelectedBlock(null);
      setSelectedFloor(null);
    } else if (contextCampusId) {
      setCampusId(contextCampusId);
    } else {
      // No QR scanned — do NOT auto-load any campus. Show the gate.
      setLoading(false);
    }
  }, [route.params?.campusId, contextCampusId]);

  useEffect(() => {
    if (route.params?.showRestrooms) {
      setShowingRestroomsMode(true);
      setSelectedBlock(null);
      setSelectedFloor(null);
      navigation.setParams({ showRestrooms: undefined });
    }
  }, [route.params?.showRestrooms]);

  useEffect(() => {
    if (campusId) {
      setLoading(true);
      Promise.all([
        getMapData(campusId),
        getGeoJSONMapData(campusId)
      ]).then(([hierarchy, geojson]) => {
        setMapData(hierarchy);
        setGeoJSONData(geojson);
        setLoading(false);
      }).catch(() => setLoading(false));

      socketRef.current = io(SOCKET_URL);
      socketRef.current.emit('join_campus', campusId);
      socketRef.current.on('map_updated', () => {
        getGeoJSONMapData(campusId).then(setGeoJSONData).catch(console.warn);
      });

      return () => { if (socketRef.current) socketRef.current.disconnect(); };
    } else {
      setMapData(null);
      setGeoJSONData(null);
      setLoading(false);
    }
  }, [campusId]);

  // Auto-detect floor based on altitude changes
  useEffect(() => {
    if (mapData && mapData.floors && mapData.floors.length > 0 && selectedBlock) {
      const blockFloors = mapData.floors.filter(f => f.blockId === selectedBlock._id);
      if (blockFloors.length > 0) {
        const targetFloor = blockFloors[Math.min(detectedFloorIndex, blockFloors.length - 1)];
        if (selectedFloor?._id !== targetFloor._id) {
          setSelectedFloor(targetFloor);
        }
      }
    }
  }, [detectedFloorIndex, mapData, selectedBlock]);

  // Sync selectedFloor with global GeofenceContext for LiveMeet
  useEffect(() => {
    if (setCurrentFloorId) {
      setCurrentFloorId(selectedFloor?._id || null);
    }
  }, [selectedFloor, setCurrentFloorId]);

  useEffect(() => {
    if (mapData) {
      if (route.params?.floorId) {
        const targetFloor = mapData.floors?.find(f => f._id === route.params.floorId);
        if (targetFloor) {
          setSelectedFloor(targetFloor);
          const parentBlock = mapData.blocks?.find(b => b._id === targetFloor.blockId);
          if (parentBlock) {
            setSelectedBlock(parentBlock);
            if (parentBlock.shape?.points?.[0]) {
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(`
                  if (typeof window.panTo === 'function') {
                    window.panTo(${parentBlock.shape.points[0].x}, ${parentBlock.shape.points[0].y});
                  }
                  true;
                `);
              }, 500);
            }
          }
        }
      } else if (route.params?.blockId) {
        const targetBlock = mapData.blocks?.find(b => b._id === route.params.blockId);
        if (targetBlock) {
          setSelectedBlock(targetBlock);
          if (targetBlock.shape?.points?.[0]) {
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(`
                if (typeof window.panTo === 'function') {
                  window.panTo(${targetBlock.shape.points[0].x}, ${targetBlock.shape.points[0].y});
                }
                true;
              `);
            }, 500);
          }
        }
      }
    }
  }, [mapData, route.params?.floorId, route.params?.blockId]);

  const onRefresh = async () => {
    if (!campusId) return;
    setRefreshing(true);
    try {
      const [hierarchy, geojson] = await Promise.all([
        getMapData(campusId),
        getGeoJSONMapData(campusId),
      ]);
      setMapData(hierarchy);
      setGeoJSONData(geojson);
      // Reset selections so directory reflects fresh data
      setSelectedBlock(null);
      setSelectedFloor(null);
    } catch (e) {
      console.log("Map refresh failed:", e);
    } finally {
      setRefreshing(false);
    }
  };

  // Inject GeoJSON when it changes or when floor changes
  useEffect(() => {
    if (geoJSONData && webViewRef.current) {
      const floorId = selectedFloor?._id || '';
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateGeoJSON === 'function') {
          window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${floorId}');
        }
        true;
      `);
    }
  }, [geoJSONData, selectedFloor]);

  // Request location permissions and track user location
  useEffect(() => {
    let locationSubscription = null;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 1 },
        (loc) => {
          setUserPos({ x: loc.coords.latitude, y: loc.coords.longitude });
          setHeading(loc.coords.heading || 0);
        }
      );
    })();
    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  // Push user location updates directly into the WebView via JS
  useEffect(() => {
    if (userPos && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateUserPos === 'function') {
          window.updateUserPos(${userPos.x}, ${userPos.y}, ${heading});
        }
        true;
      `);
    }
  }, [userPos, heading]);


  // Animate panel height based on state
  useEffect(() => {
    const targetHeight = (selectedFloor || selectedBlock || showingRestroomsMode) ? SH * 0.55 : SH * 0.45;
    Animated.timing(panelHeightAnim, {
      toValue: targetHeight,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [selectedBlock, selectedFloor, showingRestroomsMode]);

  const handleBlockSelect = (block) => {
    setSelectedBlock(block);
    if (block.shape?.points?.[0]) {
      // Pan map to block
      webViewRef.current?.injectJavaScript(`
        if (typeof window.panTo === 'function') {
          window.panTo(${block.shape.points[0].x}, ${block.shape.points[0].y});
        }
        true;
      `);
    }
  };

  const handleBack = () => {
    if (showingRestroomsMode) {
      setShowingRestroomsMode(false);
    } else if (selectedFloor) {
      setSelectedFloor(null);
    } else if (selectedBlock) {
      setSelectedBlock(null);
    }
  };

  const mapboxUrl = getCachedConfigValue("EXPO_PUBLIC_MAPBOX_URL", "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA");
  const mapHtml = useMemo(() => {
    const center = mapData?.blocks?.[0]?.shape?.points?.[0];
    return buildCampusMapHTML(geoJSONData, center, mapboxUrl, mapMode);
  }, [geoJSONData, mapData, mapboxUrl, mapMode]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    mapContainer: { flex: 1 },
    mapModeToggleContainer: {
      position: 'absolute',
      top: 16,
      right: 16,
      flexDirection: 'row',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      borderRadius: 20,
      padding: 3,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
      elevation: 8,
      zIndex: 10,
    },
    mapModeBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
    },
    mapModeBtnActive: {
      backgroundColor: colors.primary,
    },
    mapModeText: {
      color: '#94a3b8',
      fontSize: 12,
      fontWeight: '700',
    },
    mapModeTextActive: {
      color: '#ffffff',
    },
    bottomSheet: {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      backgroundColor: colors.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      ...SHADOWS.lg,
      shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.3, shadowRadius: 10,
      elevation: 20,
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border
    },
    dragHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center', position: 'absolute', top: 8
    },
    title: { fontSize: 20, fontWeight: "800", color: colors.text, marginLeft: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    list: { padding: 20, paddingBottom: 100 },
    card: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.surface, padding: 16, borderRadius: RADIUS.md,
      marginBottom: 12, borderWidth: 1, borderColor: colors.border
    },
    cardIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginRight: 14 },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    cardMeta: { fontSize: 13, color: colors.textSec, marginTop: 4 },
    navBadge: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm },
    navBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700", marginLeft: 6 }
  });

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSec, marginTop: 12, fontSize: 14 }}>Loading map data…</Text>
      </View>
    );
  }

  // QR Gate — no campus unlocked
  if (!campusId) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }]}>
        <View style={{
          width: 88, height: 88, borderRadius: 28,
          backgroundColor: colors.primary + "18",
          alignItems: "center", justifyContent: "center", marginBottom: 24,
          borderWidth: 2, borderColor: colors.primary + "30",
        }}>
          <Ionicons name="map-outline" size={42} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 8, textAlign: "center" }}>
          No Campus Unlocked
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSec, textAlign: "center", lineHeight: 21, marginBottom: 28 }}>
          Scan the NavX QR code at the venue entrance to unlock the interactive campus map and navigation.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 14,
            borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 8,
            shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5,
          }}
          onPress={() => navigation.navigate("QRScan")}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Scan QR Code</Text>
        </TouchableOpacity>
        <Text style={{ marginTop: 16, fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
          🔒  Access is restricted to the physical venue
        </Text>
      </View>
    );
  }

  const renderContent = () => {
    if (showingRestroomsMode) {
      const restrooms = mapData?.rooms?.filter(r => 
        r.type === 'restroom' || 
        (r.name && (
          r.name.toLowerCase().includes('restroom') || 
          r.name.toLowerCase().includes('washroom') ||
          r.name.toLowerCase().includes('toilet')
        ))
      ) || [];
      
      const sortedRestrooms = [...restrooms].map(r => {
        const rx = r.shape?.x || r.x || (r.shape?.points?.[0]?.x);
        const ry = r.shape?.y || r.y || (r.shape?.points?.[0]?.y);
        const dist = (userPos && rx && ry) ? getHaversineDistance(userPos.x, userPos.y, rx, ry) : null;
        return { ...r, distance: dist };
      }).sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });

      if (sortedRestrooms.length === 0) {
        return <Text style={{ textAlign: "center", color: colors.textSec, marginTop: 40 }}>No restrooms found.</Text>;
      }

      return sortedRestrooms.map(room => {
        const floorObj = typeof room.floorId === 'object' ? room.floorId : mapData?.floors?.find(f => f._id === room.floorId);
        const floorName = floorObj?.name || "";
        
        return (
          <TouchableOpacity key={room._id} style={s.card} activeOpacity={0.7} 
            onPress={() => navigation.navigate("Navigation", { room, campusId, mapData })}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={[s.cardIcon, { backgroundColor: (ROOM_COLORS[room.type] || colors.primary) + "20" }]}>
                <Ionicons name="water" size={20} color={ROOM_COLORS[room.type] || colors.primary} />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.cardTitle}>{room.name}</Text>
                <Text style={s.cardMeta}>
                  {room.distance !== null ? `${Math.round(room.distance)}m away` : "Calculating distance..."} 
                  {floorName ? ` · ${floorName}` : ""}
                </Text>
              </View>
            </View>
            <View style={s.navBadge}>
              <Ionicons name="navigate" size={14} color="#fff" />
              <Text style={s.navBadgeText}>Go</Text>
            </View>
          </TouchableOpacity>
        );
      });
    }

    if (selectedFloor) {
      const rooms = mapData?.rooms?.filter(r => r.floorId === selectedFloor._id) || [];
      if (rooms.length === 0) return <Text style={{ textAlign: "center", color: colors.textSec, marginTop: 40 }}>No rooms found on this floor.</Text>;
      
      return rooms.map(room => (
        <TouchableOpacity key={room._id} style={s.card} activeOpacity={0.7} 
          onPress={() => navigation.navigate("Navigation", { room, campusId, mapData })}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View style={[s.cardIcon, { backgroundColor: (ROOM_COLORS[room.type] || colors.primary) + "20" }]}>
              <Ionicons name="location" size={20} color={ROOM_COLORS[room.type] || colors.primary} />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={s.cardTitle}>{room.name}</Text>
              <Text style={s.cardMeta}>{room.type.toUpperCase()}{room.roomNumber ? ` · Room ${room.roomNumber}` : ""}</Text>
            </View>
          </View>
          <View style={s.navBadge}>
            <Ionicons name="navigate" size={14} color="#fff" />
            <Text style={s.navBadgeText}>Go</Text>
          </View>
        </TouchableOpacity>
      ));
    }

    if (selectedBlock) {
      const floors = mapData?.floors?.filter(f => f.blockId === selectedBlock._id) || [];
      if (floors.length === 0) return <Text style={{ textAlign: "center", color: colors.textSec, marginTop: 40 }}>No floors found in this block.</Text>;
      
      return floors.map(floor => (
        <TouchableOpacity key={floor._id} style={s.card} activeOpacity={0.7} onPress={() => setSelectedFloor(floor)}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={s.cardIcon}>
              <Ionicons name="layers" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={s.cardTitle}>{floor.name}</Text>
              <Text style={s.cardMeta}>Select to view rooms on map</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ));
    }

    const blocks = mapData?.blocks || [];
    if (blocks.length === 0) return <Text style={{ textAlign: "center", color: colors.textSec, marginTop: 40 }}>No blocks found.</Text>;
    
    const domains = {};
    blocks.forEach(block => {
      const domain = block.domain || "Academic Blocks";
      if (!domains[domain]) domains[domain] = [];
      domains[domain].push(block);
    });

    return Object.keys(domains).map(domain => (
      <View key={domain} style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textSec, marginBottom: 12, marginLeft: 4, textTransform: "uppercase", letterSpacing: 1 }}>
          {domain}
        </Text>
        {domains[domain].map(block => (
          <TouchableOpacity key={block._id} style={s.card} activeOpacity={0.7} onPress={() => handleBlockSelect(block)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={s.cardIcon}>
                <Ionicons name="business" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={s.cardTitle}>{block.name}</Text>
                <Text style={s.cardMeta}>Tap to zoom & browse floors</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    ));
  };

  return (
    <View style={s.container}>
      {/* 🗺 FULL SCREEN MAP */}
      <View style={s.mapContainer}>
        {geoJSONData ? (
          <>
            <WebView
              ref={webViewRef}
              source={{ html: mapHtml }}
              style={{ flex: 1, backgroundColor: '#0a0e17' }}
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
            />
            {/* 2D / 3D Map Mode Toggle Pill */}
            <View style={s.mapModeToggleContainer}>
              <TouchableOpacity
                style={[s.mapModeBtn, mapMode === '2D' && s.mapModeBtnActive]}
                onPress={() => toggleMapMode('2D')}
                activeOpacity={0.8}
              >
                <Text style={[s.mapModeText, mapMode === '2D' && s.mapModeTextActive]}>2D</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.mapModeBtn, mapMode === '3D' && s.mapModeBtnActive]}
                onPress={() => toggleMapMode('3D')}
                activeOpacity={0.8}
              >
                <Text style={[s.mapModeText, mapMode === '3D' && s.mapModeTextActive]}>3D</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
            <Ionicons name="map-outline" size={60} color={colors.textMuted} style={{ marginBottom: 16 }} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>No Venue Found</Text>
            <Text style={{ color: colors.textSec, fontSize: 14, textAlign: 'center', marginHorizontal: 30 }}>
              You are currently outside any active campus. Scan a QR code to view a map.
            </Text>
          </View>
        )}
      </View>

      {/* 📑 FLOATING BOTTOM SHEET DIRECTORY */}
      <Animated.View style={[s.bottomSheet, { height: panelHeightAnim }]}>
        <View style={s.dragHandle} />
        <View style={s.sheetHeader}>
          {(selectedBlock || selectedFloor || showingRestroomsMode) ? (
            <TouchableOpacity style={s.backBtn} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={s.title}>
            {showingRestroomsMode ? "Nearest Restrooms" : selectedFloor ? selectedFloor.name : selectedBlock ? selectedBlock.name : "Campus Directory"}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
              title="Pull to refresh map…"
              titleColor={colors.textSec}
            />
          }
        >
          {renderContent()}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
