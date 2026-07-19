import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import AnimatedPressable from '../components/AnimatedPressable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../context/ThemeContext';
import { useLiveMeet } from '../context/LiveMeetContext';
import { useGeofence } from '../context/GeofenceContext';
import { joinMeetSession, getMeetSession, endMeetSession, getGeoJSONMapData, findRouteBetweenCoords, getCachedConfigValue, getMapData } from '../api';
import { useAuth } from '../context/AuthContext';
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
  
  @keyframes pulseLocal {
    0% { transform: scale(0.85); opacity: 0.8; }
    50% { transform: scale(1.4); opacity: 0.3; }
    100% { transform: scale(0.85); opacity: 0.8; }
  }
  @keyframes pulseRemote {
    0% { transform: scale(0.85); opacity: 0.8; }
    50% { transform: scale(1.4); opacity: 0.3; }
    100% { transform: scale(0.85); opacity: 0.8; }
  }

  .marker-container { position:relative; width:60px; height:60px; display:flex; align-items:center; justify-content:center; }
  .local-pulse { position:absolute; width:100%; height:100%; background:radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(99, 102, 241, 0) 65%); border-radius:50%; animation: pulseLocal 2.5s infinite; }
  .local-puck { position:relative; width:26px; height:26px; background:linear-gradient(135deg, #6366f1, #4f46e5); border-radius:50%; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.6); display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,0.4); }
  
  .remote-pulse { position:absolute; width:100%; height:100%; background:radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0) 65%); border-radius:50%; animation: pulseRemote 2.5s infinite; }
  .remote-puck { position:relative; width:26px; height:26px; background:linear-gradient(135deg, #10b981, #059669); border-radius:50%; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.6); display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,0.4); }
</style>
</head><body><div id="map"></div>
<script>
const tokenMatch = '${mapboxUrl}'.match(/access_token=([^&]+)/);
mapboxgl.accessToken = tokenMatch ? tokenMatch[1] : 'YOUR_TOKEN_HERE';

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [${center[1]}, ${center[0]}],
  zoom: 18,
  pitch: 60,
  bearing: -17.6,
  antialias: true,
  attributionControl: false
});

map.on('load', () => {
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

  // Add source for dynamic route path
  map.addSource('meet-route', {
    'type': 'geojson',
    'data': { 'type': 'FeatureCollection', 'features': [] }
  });

  map.addLayer({
    'id': 'route-bg',
    'type': 'line',
    'source': 'meet-route',
    'layout': { 'line-join': 'round', 'line-cap': 'round' },
    'paint': { 'line-color': '#c084fc', 'line-width': 18, 'line-opacity': 0.25 }
  });

  map.addLayer({
    'id': 'route-line',
    'type': 'line',
    'source': 'meet-route',
    'layout': { 'line-join': 'round', 'line-cap': 'round' },
    'paint': { 'line-color': '#8b5cf6', 'line-width': 6 }
  });
});

window.updateGeoJSON = function(data, floorId) {
  if (!map.isStyleLoaded()) return;

  const features = data.features.filter(f => {
    if (f.properties.type === 'path' || f.properties.type === 'node') return false;
    if (f.properties.category === 'parking' || (f.properties.name && f.properties.name.toLowerCase().includes('parking'))) return false;
    if (f.properties.type === 'room' && f.properties.floorId) {
      if (floorId && f.properties.floorId !== floorId) return false;
    }
    return true;
  });
  data.features = features;

  if (map.getSource('campus-data')) {
    map.getSource('campus-data').setData(data);
  } else {
    map.addSource('campus-data', { type: 'geojson', data: data });

    map.addLayer({
      'id': 'campus-polygons',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#64748b'],
        'fill-extrusion-height': [
          'case',
          ['==', ['get', 'type'], 'block'], 15,
          ['==', ['get', 'type'], 'room'], 3,
          2
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.7
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

const localIconEl = document.createElement('div');
localIconEl.className = 'marker-container';
localIconEl.innerHTML = '<div class="local-pulse"></div><div class="local-puck"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2L4 20l8-4 8 4z"/></svg></div>';

const remoteIconEl = document.createElement('div');
remoteIconEl.className = 'marker-container';
remoteIconEl.innerHTML = '<div class="remote-pulse"></div><div class="remote-puck"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg></div>';

window.localMarker = null;
window.remoteMarker = null;
let routeLineDrawn = false;

window.updateParticipants = function(localLat, localLng, remoteLat, remoteLng) {
  var markers = [];
  var bounds = new mapboxgl.LngLatBounds();

  if (localLat !== null && localLng !== null) {
    if (!window.localMarker) {
      window.localMarker = new mapboxgl.Marker({ element: localIconEl, pitchAlignment: 'map' })
        .setLngLat([localLng, localLat])
        .addTo(map);
    } else {
      window.localMarker.setLngLat([localLng, localLat]);
    }
    markers.push([localLng, localLat]);
    bounds.extend([localLng, localLat]);
  } else if (window.localMarker) {
    window.localMarker.remove();
    window.localMarker = null;
  }

  if (remoteLat !== null && remoteLng !== null) {
    if (!window.remoteMarker) {
      window.remoteMarker = new mapboxgl.Marker({ element: remoteIconEl, pitchAlignment: 'map' })
        .setLngLat([remoteLng, remoteLat])
        .addTo(map);
    } else {
      window.remoteMarker.setLngLat([remoteLng, remoteLat]);
    }
    markers.push([remoteLng, remoteLat]);
    bounds.extend([remoteLng, remoteLat]);
  } else if (window.remoteMarker) {
    window.remoteMarker.remove();
    window.remoteMarker = null;
  }

  if (markers.length === 2 && !routeLineDrawn) {
    map.fitBounds(bounds, { padding: 80, maxZoom: 19 });
  } else if (markers.length === 1 && !routeLineDrawn) {
    map.panTo(markers[0]);
  }
};

window.updateRoutePath = function(coordsJson) {
  if (!map.isStyleLoaded()) return;

  if (coordsJson && coordsJson.length > 0) {
    var latlngs = coordsJson.map(function(pt) { return [pt.lng, pt.lat]; });
    
    if (map.getSource('meet-route')) {
      map.getSource('meet-route').setData({
        'type': 'Feature',
        'properties': {},
        'geometry': {
          'type': 'LineString',
          'coordinates': latlngs
        }
      });
      routeLineDrawn = true;
      
      var bounds = new mapboxgl.LngLatBounds();
      latlngs.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, { padding: 80, maxZoom: 19 });
    }
  } else {
    if (map.getSource('meet-route')) {
      map.getSource('meet-route').setData({ 'type': 'FeatureCollection', 'features': [] });
    }
    routeLineDrawn = false;
  }
};
</script></body></html>`;
}

export default function LiveMeetScreen({ route, navigation }) {
  const { sessionId } = route.params || {};
  const { colors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activeSession, remoteParticipant, enterMeetSession, leaveMeetSession, broadcastStatus, currentPos } = useLiveMeet();
  const { currentFloorId } = useGeofence();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geoJSONData, setGeoJSONData] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
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

  const initialCenter = useMemo(() => {
    if (initialCenterRef.current) return initialCenterRef.current;
    if (mapData?.blocks?.[0]?.shape?.points?.[0]) {
      return {
        x: mapData.blocks[0].shape.points[0].x,
        y: mapData.blocks[0].shape.points[0].y
      };
    }
    return null;
  }, [currentPos, mapData]);

  const mapboxUrl = getCachedConfigValue("EXPO_PUBLIC_MAPBOX_URL", "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA");
  const htmlSource = useMemo(() => {
    return buildLiveMeetMapHTML(initialCenter, mapboxUrl);
  }, [initialCenter, mapboxUrl]);

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
          window.updateGeoJSON(${JSON.stringify(geo)}, '${selectedFloor?._id || ''}');
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
          const activeCampusId = typeof activeSession.campusId === 'object' && activeSession.campusId !== null
            ? activeSession.campusId._id
            : activeSession.campusId;
          if (activeCampusId) {
            const [hierarchy, geojson] = await Promise.all([
              getMapData(activeCampusId),
              getGeoJSONMapData(activeCampusId)
            ]);
            setMapData(hierarchy);
            setGeoJSONData(geojson);
            if (hierarchy?.floors && hierarchy.floors.length > 0) {
              setSelectedFloor(hierarchy.floors[0]);
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
            joinerName: user?.username || 'Friend',
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
          const [hierarchy, geojson] = await Promise.all([
            getMapData(activeCampusId),
            getGeoJSONMapData(activeCampusId)
          ]);
          setMapData(hierarchy);
          setGeoJSONData(geojson);
          if (hierarchy?.floors && hierarchy.floors.length > 0) {
            setSelectedFloor(hierarchy.floors[0]);
          }
        }
        setLoading(false);

      } catch (err) {
        setError(err.response?.data?.error || 'Failed to join meet session');
        setLoading(false);
      }
    }
    init();
  }, [sessionId, user]);

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

  // Inject geojson when it loads or floor changes
  useEffect(() => {
    if (geoJSONData) {
      const floorId = selectedFloor?._id || '';
      safeInject(`
        if (typeof window.updateGeoJSON === 'function') {
          window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${floorId}');
        }
        true;
      `);
    }
  }, [geoJSONData, selectedFloor]);

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
        // Try custom indoor pathfinder only
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
        } else {
          if (active) setRoutePath([]);
        }
      } catch (err) {
        console.log("Failed to fetch custom route:", err);
        if (active) setRoutePath([]);
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

      {/* Floor Selector Widget */}
      {mapData?.floors && mapData.floors.length > 1 && (
        <View style={[s.floorSelector, { top: Math.max(insets.top, 16) + 70 }]}>
          {mapData.floors.map((floor) => {
            const isSelected = selectedFloor?._id === floor._id;
            const label = floor.name ? (floor.name.toLowerCase().includes("ground") ? "G" : floor.name.replace(/floor\s*/gi, "").replace(/level\s*/gi, "")) : "F";
            return (
              <TouchableOpacity
                key={floor._id}
                style={[
                  s.floorBtn,
                  isSelected ? { backgroundColor: colors.primary } : { backgroundColor: 'rgba(255,255,255,0.9)' }
                ]}
                onPress={() => {
                  setSelectedFloor(floor);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[s.floorBtnText, isSelected ? { color: '#ffffff' } : { color: colors.text }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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
  arText: { color: '#fff', fontWeight: '800', marginLeft: 8, fontSize: 16 },
  floorSelector: {
    position: 'absolute',
    right: 20,
    flexDirection: 'column',
    gap: 8,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 22,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  floorBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  floorBtnText: {
    fontSize: 14,
    fontWeight: '800',
  }
});
