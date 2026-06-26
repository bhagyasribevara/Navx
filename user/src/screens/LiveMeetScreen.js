import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import AnimatedPressable from '../components/AnimatedPressable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../context/ThemeContext';
import { useLiveMeet } from '../context/LiveMeetContext';
import { useGeofence } from '../context/GeofenceContext';
import { joinMeetSession, getMeetSession, endMeetSession, getGeoJSONMapData, findRouteBetweenCoords, getCachedConfigValue } from '../api';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
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

function buildLiveMeetMapHTML(centerCoords, mapboxUrl) {
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
  .room-label {
    background: transparent; border: none; box-shadow: none;
    color: #1e293b; font-weight: bold; font-size: 10px;
    text-shadow: 0 1px 2px rgba(255,255,255,0.8);
  }
</style>
</head><body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${center[0]},${center[1]}], 18);
L.tileLayer('${mapboxUrl}',{maxZoom:22}).addTo(map);
 
var geojsonLayer = null;
function styleFeature(feature) {
  var baseStyle = { weight: 2, fillOpacity: 0.3 };
  if (feature.properties.type === 'block') {
    return Object.assign(baseStyle, { color: feature.properties.color || '#64748b', fillOpacity: 0.1 });
  } else if (feature.properties.type === 'room') {
    return Object.assign(baseStyle, { color: '#64748b', fillColor: '#ffffff', weight: 1, fillOpacity: 1 });
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
      if (f.properties.category === 'parking' || (f.properties.name && f.properties.name.toLowerCase().includes('parking'))) {
        return false;
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
          l.bindTooltip(f.properties.name, { permanent: true, direction: 'center', className: 'room-label' });
        }
      }
    }
  }).addTo(map);
};

const localIconHtml = \`
  <style>
    @keyframes pulseLocal {
      0% { transform: scale(0.85); opacity: 0.8; }
      50% { transform: scale(1.4); opacity: 0.3; }
      100% { transform: scale(0.85); opacity: 0.8; }
    }
  </style>
  <div style="position:relative; width:60px; height:60px; display:flex; align-items:center; justify-content:center;">
    <div style="position:absolute; width:100%; height:100%; background:radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(99, 102, 241, 0) 65%); border-radius:50%; animation: pulseLocal 2.5s infinite;"></div>
    <div id="local-puck-inner" style="position:relative; width:26px; height:26px; background:linear-gradient(135deg, #6366f1, #4f46e5); border-radius:50%; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.6); display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,0.4);">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
        <path d="M12 2L4 20l8-4 8 4z"/>
      </svg>
    </div>
  </div>
\`;

const remoteIconHtml = \`
  <style>
    @keyframes pulseRemote {
      0% { transform: scale(0.85); opacity: 0.8; }
      50% { transform: scale(1.4); opacity: 0.3; }
      100% { transform: scale(0.85); opacity: 0.8; }
    }
  </style>
  <div style="position:relative; width:60px; height:60px; display:flex; align-items:center; justify-content:center;">
    <div style="position:absolute; width:100%; height:100%; background:radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0) 65%); border-radius:50%; animation: pulseRemote 2.5s infinite;"></div>
    <div id="remote-puck-inner" style="position:relative; width:26px; height:26px; background:linear-gradient(135deg, #10b981, #059669); border-radius:50%; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.6); display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,0.4);">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
        <circle cx="12" cy="12" r="8"/>
      </svg>
    </div>
  </div>
\`;

const localIcon = L.divIcon({ className: '', html: localIconHtml, iconSize: [60, 60], iconAnchor: [30, 30] });
const remoteIcon = L.divIcon({ className: '', html: remoteIconHtml, iconSize: [60, 60], iconAnchor: [30, 30] });

window.localMarker = null;
window.remoteMarker = null;
window.connectingLine = null;

window.updateParticipants = function(localLat, localLng, remoteLat, remoteLng) {
  var markers = [];
  if (localLat !== null && localLng !== null) {
    var localPos = [localLat, localLng];
    if (!window.localMarker) {
      window.localMarker = L.marker(localPos, {icon: localIcon, zIndexOffset: 1000}).addTo(map);
    } else {
      window.localMarker.setLatLng(localPos);
    }
    markers.push(localPos);
  } else if (window.localMarker) {
    map.removeLayer(window.localMarker);
    window.localMarker = null;
  }

  if (remoteLat !== null && remoteLng !== null) {
    var remotePos = [remoteLat, remoteLng];
    if (!window.remoteMarker) {
      window.remoteMarker = L.marker(remotePos, {icon: remoteIcon, zIndexOffset: 900}).addTo(map);
    } else {
      window.remoteMarker.setLatLng(remotePos);
    }
    markers.push(remotePos);
  } else if (window.remoteMarker) {
    map.removeLayer(window.remoteMarker);
    window.remoteMarker = null;
  }

  // Auto-adjust view to fit both participants if they are both active and no line is drawn yet
  if (markers.length === 2 && !window.connectingLineGroup) {
    var bounds = L.latLngBounds(markers);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 19 });
  } else if (markers.length === 1 && !window.connectingLineGroup) {
    map.panTo(markers[0]);
  }
};

window.updateRoutePath = function(coordsJson) {
  if (window.connectingLineGroup) {
    map.removeLayer(window.connectingLineGroup);
    window.connectingLineGroup = null;
  }
  
  if (coordsJson && coordsJson.length > 0) {
    var latlngs = coordsJson.map(function(pt) { return [pt.lat, pt.lng]; });
    
    var wideLine = L.polyline(latlngs, {
      color: '#c084fc',
      weight: 18,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round'
    });
    
    var thinLine = L.polyline(latlngs, {
      color: '#8b5cf6',
      weight: 6,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round'
    });
    
    window.connectingLineGroup = L.layerGroup([wideLine, thinLine]).addTo(map);
    
    var bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 19 });
  }
};

</script></body></html>`;
}

export default function LiveMeetScreen({ route, navigation }) {
  const { sessionId } = route.params || {};
  const { colors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { activeSession, remoteParticipant, enterMeetSession, leaveMeetSession, broadcastStatus, currentPos } = useLiveMeet();
  const { currentFloorId } = useGeofence();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geoJSONData, setGeoJSONData] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const webViewRef = useRef(null);
  const initialCenterRef = useRef(null);
  const webViewReady = useRef(false);

  // Keep refs for latest values so handleWebViewLoad doesn't use stale closures
  const currentPosRef = useRef(currentPos);
  const remoteParticipantRef = useRef(remoteParticipant);
  const geoJSONDataRef = useRef(geoJSONData);
  const routePathRef = useRef(routePath);
  currentPosRef.current = currentPos;
  remoteParticipantRef.current = remoteParticipant;
  geoJSONDataRef.current = geoJSONData;
  routePathRef.current = routePath;

  if (currentPos && !initialCenterRef.current) {
    initialCenterRef.current = { x: currentPos.x, y: currentPos.y };
  }

  const mapboxUrl = getCachedConfigValue("EXPO_PUBLIC_MAPBOX_URL", "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA");
  const htmlSource = useMemo(() => {
    return buildLiveMeetMapHTML(initialCenterRef.current, mapboxUrl);
  }, [mapboxUrl]);

  // Safe injection helper — only calls injectJavaScript when WebView is loaded
  const safeInject = (js) => {
    if (webViewReady.current && webViewRef.current) {
      webViewRef.current.injectJavaScript(js);
    }
  };

  const handleWebViewLoad = () => {
    webViewReady.current = true;

    // Read from refs to get the LATEST values (not stale closure values)
    const cp = currentPosRef.current;
    const rp = remoteParticipantRef.current;
    const geo = geoJSONDataRef.current;
    const rp2 = routePathRef.current;

    const localLat = cp?.x ?? null;
    const localLng = cp?.y ?? null;
    const remoteLat = rp?.location?.lat ?? null;
    const remoteLng = rp?.location?.lng ?? null;

    console.log('[LiveMeet] WebView loaded. Injecting initial state:', { localLat, localLng, remoteLat, remoteLng, hasGeoJSON: !!geo, routePoints: rp2?.length });

    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateParticipants === 'function') {
          window.updateParticipants(${localLat}, ${localLng}, ${remoteLat}, ${remoteLng});
        }
        if (typeof window.updateGeoJSON === 'function' && ${geo ? 'true' : 'false'}) {
          window.updateGeoJSON(${JSON.stringify(geo)}, '${currentFloorId || ''}');
        }
        if (typeof window.updateRoutePath === 'function') {
          window.updateRoutePath(${JSON.stringify(rp2 || [])});
        }
        true;
      `);
    }
  };

  const distance = currentPos && remoteParticipant?.location
    ? getHaversineDistance(
        currentPos.x,
        currentPos.y,
        remoteParticipant.location.lat,
        remoteParticipant.location.lng
      )
    : null;

  useEffect(() => {
    async function init() {
      try {
        if (!sessionId) {
          setError('Invalid Meet Link');
          return;
        }

        if (activeSession && activeSession.sessionId === sessionId) {
          // Already in this session
          if (!geoJSONData) {
            const activeCampusId = typeof activeSession.campusId === 'object' && activeSession.campusId !== null
              ? activeSession.campusId._id
              : activeSession.campusId;
            if (activeCampusId) {
              const geojson = await getGeoJSONMapData(activeCampusId);
              setGeoJSONData(geojson);
            }
          }
          setLoading(false);
          return;
        }

        // Fetch session data
        const sessionData = await getMeetSession(sessionId);
        
        // Get persistent device ID
        let deviceId = await AsyncStorage.getItem('navx_device_id');
        if (!deviceId) {
          deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
          await AsyncStorage.setItem('navx_device_id', deviceId);
        }
        
        let role = 'joiner';
        if (sessionData.creatorDevice === deviceId) {
          role = 'creator';
        }

        let activeSessionData = sessionData;
        if (role === 'joiner') {
          // 1. Request foreground location permissions
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setError('Location permission is required to join the Live Meet.');
            setLoading(false);
            return;
          }

          // 2. Fetch location with timeout and fallback
          let loc = null;
          try {
            loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeout: 8000
            });
          } catch (err) {
            console.log('[LiveMeetScreen] getCurrentPositionAsync failed, trying last known:', err);
            try {
              loc = await Location.getLastKnownPositionAsync({});
            } catch (err2) {
              console.log('[LiveMeetScreen] getLastKnownPositionAsync failed:', err2);
            }
          }

          if (!loc || !loc.coords) {
            setError('Unable to retrieve your current location. Please ensure location services are enabled on your device.');
            setLoading(false);
            return;
          }

          // Join the session via API
          const joinResult = await joinMeetSession(sessionId, {
            joinerDevice: deviceId,
            joinerName: 'Friend',
            joinerLocation: { lat: loc.coords.latitude, lng: loc.coords.longitude }
          });
          if (joinResult && joinResult.session) {
            activeSessionData = joinResult.session;
          }
        }

        await enterMeetSession(activeSessionData, role);
        const activeCampusId = typeof sessionData.campusId === 'object' && sessionData.campusId !== null
          ? sessionData.campusId._id
          : sessionData.campusId;
        if (activeCampusId) {
          const geojson = await getGeoJSONMapData(activeCampusId);
          setGeoJSONData(geojson);
        }
        setLoading(false);

      } catch (err) {
        setError(err.response?.data?.error || 'Failed to join meet session');
        setLoading(false);
      }
    }
    init();
  }, [sessionId]);

  const wasConnected = useRef(false);
  useEffect(() => {
    if (remoteParticipant) {
      wasConnected.current = true;
    } else if (wasConnected.current && !remoteParticipant) {
      // Remote participant was connected, but now they are null (left/disconnected)
      alert("The other participant has left the meet session.");
      leaveMeetSession();
      navigation.goBack();
    }
  }, [remoteParticipant]);

  useEffect(() => {
    if (distance !== null && distance < 10 && activeSession?.status !== 'arrived') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      broadcastStatus('arrived');
    }
  }, [distance]);

  // Sync positions to WebView map
  useEffect(() => {
    if (!webViewReady.current) return; // Don't inject before WebView is loaded

    const localLat = currentPos?.x ?? null;
    const localLng = currentPos?.y ?? null;
    const remoteLat = remoteParticipant?.location?.lat ?? null;
    const remoteLng = remoteParticipant?.location?.lng ?? null;

    console.log('[LiveMeet] Syncing positions:', { localLat, localLng, remoteLat, remoteLng });

    safeInject(`
      if (typeof window.updateParticipants === 'function') {
        window.updateParticipants(${localLat}, ${localLng}, ${remoteLat}, ${remoteLng});
      }
      true;
    `);
  }, [currentPos, remoteParticipant]);

  // Inject geojson when it loads
  useEffect(() => {
    if (geoJSONData) {
      safeInject(`
        if (typeof window.updateGeoJSON === 'function') {
          window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${currentFloorId || ''}');
        }
        true;
      `);
    }
  }, [geoJSONData, currentFloorId]);

  // Dynamic path routing strictly following campus pathways
  useEffect(() => {
    if (!currentPos || !remoteParticipant?.location) return;

    const activeCampusId = typeof activeSession?.campusId === 'object' && activeSession?.campusId !== null
      ? activeSession.campusId._id
      : (activeSession?.campusId || activeSession?.campusId);

    if (!activeCampusId) return;

    let active = true;

    async function fetchRoute() {
      try {
        // Try indoor pathfinder first
        const res = await findRouteBetweenCoords({
          startX: currentPos.x,
          startY: currentPos.y,
          endX: remoteParticipant.location.lat,
          endY: remoteParticipant.location.lng,
          campusId: activeCampusId
        });
        if (active && res && res.path && res.path.length > 0) {
          const coords = res.path.map(n => ({ lat: n.x, lng: n.y }));
          setRoutePath(coords);
          return;
        }
      } catch (err) {
        console.log("Failed to fetch indoor route:", err);
      }

      // Fallback to outdoor OSRM routing
      if (active) {
        console.log("Attempting OSRM fallback routing...");
        try {
          const url = `https://router.project-osrm.org/route/v1/foot/${remoteParticipant.location.lng},${remoteParticipant.location.lat};${currentPos.y},${currentPos.x}?overview=full&geometries=geojson`;
          const response = await fetch(url);
          const data = await response.json();
          if (active && data && data.routes && data.routes.length > 0) {
            const rawCoords = data.routes[0].geometry.coordinates; // [lng, lat]
            const osrmCoords = rawCoords.map(c => ({ lat: c[1], lng: c[0] }));
            setRoutePath(osrmCoords);
            return;
          }
        } catch (e) {
          console.log("OSRM fallback routing failed:", e);
        }
      }

      // Fallback to a straight line linking their two actual coordinates
      if (active) {
        setRoutePath([
          { lat: currentPos.x, lng: currentPos.y },
          { lat: remoteParticipant.location.lat, lng: remoteParticipant.location.lng }
        ]);
      }
    }

    const timer = setTimeout(fetchRoute, 1000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentPos?.x, currentPos?.y, remoteParticipant?.location?.lat, remoteParticipant?.location?.lng]);

  // Inject route path when it updates
  useEffect(() => {
    safeInject(`
      if (typeof window.updateRoutePath === 'function') {
        window.updateRoutePath(${JSON.stringify(routePath)});
      }
      true;
    `);
  }, [routePath]);

  if (loading || !currentPos) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>Joining Meet Session...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Ionicons name="warning" size={48} color={colors.danger} />
        <Text style={{ color: colors.text, marginTop: 10, fontWeight: '700' }}>{error}</Text>
        <AnimatedPressable style={s.btn} onPress={() => navigation.goBack()}>
          <Text style={s.btnText}>Go Back</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* WebView Map Layer */}
      <View style={StyleSheet.absoluteFill}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlSource }}
          style={{ flex: 1, backgroundColor: '#0a0e17' }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoad={handleWebViewLoad}
        />
      </View>

      {/* Header */}
      <View style={[s.header, { top: Math.max(insets.top, 16) }]}>
        <AnimatedPressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </AnimatedPressable>
        <Text style={s.title}>Live Meet</Text>
        <AnimatedPressable onPress={async () => {
            await endMeetSession(sessionId, 'cancelled');
            leaveMeetSession();
            navigation.goBack();
        }}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>End</Text>
        </AnimatedPressable>
      </View>

      {/* AR Button Trigger */}
      {distance !== null && distance < 30 && (
        <AnimatedPressable 
          style={[s.arBtn, { bottom: (insets.bottom > 0 ? insets.bottom + 10 : 20) + 140 }]}
          onPress={() => navigation.navigate('ARMeet')}
        >
          <Ionicons name="scan" size={24} color="#fff" />
          <Text style={s.arText}>AR Friend Finder</Text>
        </AnimatedPressable>
      )}

      {/* Progress Bottom Sheet */}
      {!loading && (
        <View style={[s.bottomSheet, { backgroundColor: colors.card, bottom: insets.bottom > 0 ? insets.bottom + 10 : 20 }]}>
        <Text style={[s.sheetTitle, { color: colors.text }]}>
          Meeting {remoteParticipant?.name || 'Participant'}
        </Text>
        
        {remoteParticipant?.status === 'arrived' ? (
          <View style={s.arrivedBox}>
            <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 8 }}>You've successfully met!</Text>
          </View>
        ) : (
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>DISTANCE</Text>
              <Text style={[s.statValue, { color: colors.text }]}>
                {distance !== null ? `${Math.round(distance)}m` : 'Calc...'}
              </Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statLabel}>ETA</Text>
              <Text style={[s.statValue, { color: colors.text }]}>
                {distance !== null ? `${Math.ceil(distance / 1.4 / 60)} min` : '--'}
              </Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statLabel}>STATUS</Text>
              <Text style={[s.statValue, { color: colors.primary, fontSize: 14 }]}>Walking</Text>
            </View>
          </View>
        )}
      </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: {
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
    zIndex: 10
  },
  title: { fontSize: 16, fontWeight: '800' },
  backBtn: { padding: 4 },
  btn: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 20 },
  btnText: { color: '#fff', fontWeight: '700' },
  bottomSheet: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15, elevation: 8,
    zIndex: 10
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  arrivedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(22,163,74,0.1)', borderRadius: 12 },
  arBtn: {
    position: 'absolute', bottom: 180, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30,
    shadowColor: '#4f46e5', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
    zIndex: 10
  },
  arText: { color: '#fff', fontWeight: '800', marginLeft: 8, fontSize: 16 }
});
