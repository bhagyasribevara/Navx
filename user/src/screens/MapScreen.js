import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform, Dimensions, Animated, Easing, RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { ThemeContext } from "../context/ThemeContext";
import { useGeofence } from "../context/GeofenceContext";
import { getMapData, getCampuses, getGeoJSONMapData, SOCKET_URL } from "../api";
import { io } from "socket.io-client";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";
import * as Location from 'expo-location';

const { height: SH, width: SW } = Dimensions.get('window');

function buildCampusMapHTML(geoJSONData, centerCoords) {
  const center = centerCoords ? [centerCoords.x, centerCoords.y] : [18.4665, 83.6629];
  
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
  body{margin:0;padding:0;background-color:#0a0e17;}
  #map{width:100%;height:100vh;background:#0a0e17;}
  .leaflet-container { background: #0a0e17 !important; }
  .layer-label {
    background: rgba(10, 14, 23, 0.8); border: 1px solid rgba(255,255,255,0.2);
    color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;
    font-size: 11px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  }
</style>
</head><body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${center[0]},${center[1]}], 18);
L.tileLayer('${process.env.EXPO_PUBLIC_MAPBOX_URL}',{maxZoom:22}).addTo(map);

var geojsonLayer = null;
function styleFeature(feature) {
  var baseStyle = { weight: 2, fillOpacity: 0.3 };
  if (feature.properties.type === 'block') {
    return Object.assign(baseStyle, { color: feature.properties.color || '#64748b', fillOpacity: 0.15 });
  } else if (feature.properties.type === 'room') {
    return Object.assign(baseStyle, { color: '#3b82f6', weight: 1, fillOpacity: 0.2 });
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
      if (f.properties.type === 'path' || f.properties.type === 'node' || f.properties.type === 'block' || f.properties.type === 'room') return false;
      
      // Hide parking areas by default
      if (f.properties.category === 'parking' || (f.properties.name && f.properties.name.toLowerCase().includes('parking'))) {
        return false;
      }
      return true;
    },
    style: styleFeature,
    onEachFeature: function(f, l) {
      if (f.properties && f.properties.name) {
        l.bindTooltip(f.properties.name, { permanent: f.properties.type === 'map_layer', direction: 'center', className: 'layer-label' });
      }
    }
  }).addTo(map);
};

const userIconHtml = \`
  <style>
    @keyframes pulseGlow {
      0% { transform: scale(0.85); opacity: 0.8; }
      50% { transform: scale(1.4); opacity: 0.3; }
      100% { transform: scale(0.85); opacity: 0.8; }
    }
  </style>
  <div style="position:relative; width:70px; height:70px; display:flex; align-items:center; justify-content:center;">
    <div style="position:absolute; width:100%; height:100%; background:radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, rgba(139, 92, 246, 0) 65%); border-radius:50%; animation: pulseGlow 2.5s infinite;"></div>
    <div id="user-puck-inner" style="position:relative; width:30px; height:30px; background:linear-gradient(135deg, #A855F7, #6D28D9); border-radius:50%; box-shadow: 0 6px 16px rgba(109, 40, 217, 0.6); display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,0.4); transition: transform 0.2s ease-out;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="transform: translateY(-1px);">
        <path d="M12 2L4 20l8-4 8 4z"/>
      </svg>
    </div>
  </div>
\`;
const customUserIcon = L.divIcon({ className: '', html: userIconHtml, iconSize: [70, 70], iconAnchor: [35, 35] });

window.userMarker = null;

window.updateUserPos = function(lat, lng, heading) {
  if (!window.userMarker) {
    window.userMarker = L.marker([lat, lng], {icon: customUserIcon, zIndexOffset: 1000}).addTo(map);
  } else {
    window.userMarker.setLatLng([lat, lng]);
  }
  if (heading !== undefined && heading !== null) {
    const puck = document.getElementById('user-puck-inner');
    if (puck) {
      puck.style.transform = 'rotate(' + heading + 'deg)';
    }
  }
};

window.panTo = function(lat, lng) {
  map.flyTo([lat, lng], 20, { duration: 1.5 });
};

${geoJSONData ? `window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${centerCoords?.floorId || ''}');` : ''}

</script></body></html>`;
}

export default function MapScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const { activeCampusId: contextCampusId } = useGeofence();
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [campusId, setCampusId] = useState(route.params?.campusId || contextCampusId || null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [geoJSONData, setGeoJSONData] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const webViewRef = useRef(null);
  const socketRef = useRef(null);
  const panelHeightAnim = useRef(new Animated.Value(SH * 0.45)).current; // Bottom sheet height

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
    const targetHeight = (selectedFloor || selectedBlock) ? SH * 0.55 : SH * 0.45;
    Animated.timing(panelHeightAnim, {
      toValue: targetHeight,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [selectedBlock, selectedFloor]);

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
    if (selectedFloor) setSelectedFloor(null);
    else if (selectedBlock) setSelectedBlock(null);
  };

  const mapHtml = useMemo(() => {
    const center = mapData?.blocks?.[0]?.shape?.points?.[0];
    return buildCampusMapHTML(geoJSONData, center);
  }, [geoJSONData, mapData]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    mapContainer: { flex: 1 },
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
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={{ flex: 1, backgroundColor: '#0a0e17' }}
            scrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            originWhitelist={['*']}
          />
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
          {(selectedBlock || selectedFloor) ? (
            <TouchableOpacity style={s.backBtn} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={s.title}>
            {selectedFloor ? selectedFloor.name : selectedBlock ? selectedBlock.name : "Campus Directory"}
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
