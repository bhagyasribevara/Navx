import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";
import { getCachedConfigValue } from "../api";
import { SHADOWS } from "../theme/designSystem";

const EARTH_R = 6_371_000;
const toRad = (d) => (d * Math.PI) / 180;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getClosestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { x: x1, y: y1 };

  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  return {
    x: x1 + t * dx,
    y: y1 + t * dy,
  };
}

function snapPositionToRoute(pos, path) {
  if (!pos || !path || path.length === 0) return pos;

  let closestSnapped = pos;
  let minDistance = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const startNode = path[i];
    const endNode = path[i + 1];
    if (!startNode || !endNode) continue;

    const snapped = getClosestPointOnSegment(
      pos.x,
      pos.y,
      startNode.x,
      startNode.y,
      endNode.x,
      endNode.y
    );
    const dist = haversine(pos.x, pos.y, snapped.x, snapped.y);
    if (dist < minDistance) {
      minDistance = dist;
      closestSnapped = snapped;
    }
  }

  // Snap if within 15 meters of the active path
  if (minDistance < 15) {
    return { ...pos, x: closestSnapped.x, y: closestSnapped.y };
  }
  return pos;
}

/**
 * Builds the exact 2D Mapbox map engine from NavigationScreen's 2D map mode,
 * sized and configured for the circular HUD floating mini-map.
 */
function buildNavigation2DMapHTML(pathPoints, initialPos, targetRoom, geoJSONData, mapboxUrl, zoomLevel = 19) {
  const center = initialPos
    ? [initialPos.x, initialPos.y]
    : pathPoints?.length
    ? [pathPoints[0].x, pathPoints[0].y]
    : [18.4665, 83.6629];

  const pathCoordinates = pathPoints
    ? pathPoints.map((p) => `[${p.y}, ${p.x}]`).join(",")
    : "";

  const destX = targetRoom?.shape?.points?.[0]?.x || targetRoom?.shape?.x;
  const destY = targetRoom?.shape?.points?.[0]?.y || targetRoom?.shape?.y;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: #f8fafc;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    #map {
      width: 100%; height: 100%;
      background: #f8fafc;
    }
    .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { display: none !important; }

    /* Exact user puck from NavigationScreen */
    .user-marker {
      position: relative;
      width: 50px; height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    @keyframes pulseGlow {
      0% { transform: scale(0.85); opacity: 0.8; }
      50% { transform: scale(1.4); opacity: 0.3; }
      100% { transform: scale(0.85); opacity: 0.8; }
    }
    .pulse {
      position: absolute;
      width: 100%; height: 100%;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, rgba(139, 92, 246, 0) 65%);
      border-radius: 50%;
      animation: pulseGlow 2.5s infinite;
    }
    .puck {
      position: relative;
      width: 24px; height: 24px;
      background: linear-gradient(135deg, #A855F7, #6D28D9);
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(109, 40, 217, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid rgba(255,255,255,0.9);
      transition: transform 0.15s ease-out;
    }

    /* Destination & POI markers from NavigationScreen */
    .dest-marker {
      width: 16px; height: 16px;
      background-color: #3b82f6;
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 5px rgba(0,0,0,0.35);
      animation: destPulse 2s infinite ease-in-out;
    }
    @keyframes destPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }

    .poi-marker {
      width: 12px; height: 12px;
      background-color: #6366f1;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  const tokenMatch = '${mapboxUrl}'.match(/access_token=([^&]+)/);
  mapboxgl.accessToken = tokenMatch ? tokenMatch[1] : 'YOUR_TOKEN_HERE';

  // Exact 2D Mapbox Map from NavigationScreen 2D mode (outdoors-v12, pitch 0, bearing 0)
  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [${center[1]}, ${center[0]}],
    zoom: ${zoomLevel},
    pitch: 0,
    bearing: 0,
    antialias: true,
    attributionControl: false,
    interactive: false
  });

  const userIconEl = document.createElement('div');
  userIconEl.className = 'user-marker';
  userIconEl.innerHTML = '<div class="pulse"></div><div id="user-puck-inner" class="puck"><svg width="13" height="13" viewBox="0 0 24 24" fill="white" style="transform: translateY(-0.5px);"><path d="M12 2L4 20l8-4 8 4z"/></svg></div>';

  window.userMarker = null;
  window.lastLng = ${center[1]};
  window.lastLat = ${center[0]};
  window.currentGeoData = ${geoJSONData ? JSON.stringify(geoJSONData) : 'null'};
  window.currentFloorId = '${targetRoom?.floorId || ''}';

  map.on('load', () => {
    // 1. Render 2D GeoJSON campus polygons & labels (exact 2D mode layers from NavigationScreen)
    if (window.currentGeoData) {
      window.renderGeoJSONLayers(window.currentGeoData, window.currentFloorId);
    }

    // 2. Exact 2D Navigation Active Route Line (nav-route-2d-line)
    ${pathCoordinates ? `
      var rawRouteCoords = [${pathCoordinates}];
      map.addSource('nav-route-2d', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: rawRouteCoords
            }
          }]
        }
      });

      // 2D Route casing/glow
      map.addLayer({
        id: 'nav-route-2d-casing',
        type: 'line',
        source: 'nav-route-2d',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#c084fc',
          'line-width': 7,
          'line-opacity': 0.5
        }
      });

      // 2D Route core line (matching #7c3aed from NavigationScreen)
      map.addLayer({
        id: 'nav-route-2d-line',
        type: 'line',
        source: 'nav-route-2d',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#7c3aed',
          'line-width': 4.5,
          'line-opacity': 0.95
        }
      });
    ` : ''}

    // 3. User Marker
    ${initialPos ? `
      window.userMarker = new mapboxgl.Marker({ element: userIconEl, pitchAlignment: 'map' })
        .setLngLat([${initialPos.y}, ${initialPos.x}])
        .addTo(map);
    ` : ''}

    // 4. Destination Marker (matching dest-marker from NavigationScreen)
    ${destX && destY ? `
      const destEl = document.createElement('div');
      destEl.className = 'dest-marker';
      window.destMarker = new mapboxgl.Marker({ element: destEl })
        .setLngLat([${destY}, ${destX}])
        .addTo(map);
    ` : ''}
  });

  // ── 2D Map Layers Rendering (Matches NavigationScreen 2D mode) ──

  window.renderGeoJSONLayers = function(data, floorId) {
    if (!map || !data || !data.features) return;

    var polyFeatures = data.features.filter(function(f) {
      if (f.properties.type === 'path' || f.properties.type === 'node') return false;
      if (f.properties.category === 'parking' || (f.properties.name && f.properties.name.toLowerCase().includes('parking'))) {
        if (f.properties.id !== '${targetRoom?._id || ''}') return false;
      }
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

    // 1. FLAT 2D FILL LAYER (from NavigationScreen)
    if (!map.getLayer('campus-2d-fill')) {
      map.addLayer({
        id: 'campus-2d-fill',
        type: 'fill',
        source: 'campus-data',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'id'], '${targetRoom?._id || ''}'], '#3b82f6',
            ['coalesce', ['get', 'color'], '#3b82f6']
          ],
          'fill-opacity': 0.55
        }
      });
    }

    // 2. CRISP 2D OUTLINE (from NavigationScreen)
    if (!map.getLayer('campus-2d-line')) {
      map.addLayer({
        id: 'campus-2d-line',
        type: 'line',
        source: 'campus-data',
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#1d4ed8'],
          'line-width': 2.0,
          'line-opacity': 0.85
        }
      });
    }

    // 3. 2D LABELS (from NavigationScreen)
    if (!map.getLayer('campus-labels')) {
      map.addLayer({
        id: 'campus-labels',
        type: 'symbol',
        source: 'campus-data',
        filter: ['has', 'name'],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 9,
          'text-anchor': 'top',
          'text-offset': [0, 0.8]
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.0
        }
      });
    }
  };

  window.updateGeoJSON = function(data, floorId) {
    window.currentGeoData = data;
    window.currentFloorId = floorId;
    if (map.isStyleLoaded()) {
      window.renderGeoJSONLayers(data, floorId);
    }
  };

  // ── Real-Time Dynamic Bridge Methods ──

  window.updateUserPos = function(lat, lng, heading) {
    window.lastLat = lat;
    window.lastLng = lng;

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

    // Smoothly follow the camera center along the user's path
    map.easeTo({
      center: [lng, lat],
      duration: 350,
      easing: function(t) { return t; }
    });
  };

  window.updateUserHeading = function(heading) {
    if (heading !== undefined && heading !== null) {
      const puck = document.getElementById('user-puck-inner');
      if (puck) {
        puck.style.transform = 'rotate(' + heading + 'deg)';
      }
    }
  };

  window.updateRoutePolyline = function(coordinates) {
    if (!map.getSource('nav-route-2d')) {
      map.addSource('nav-route-2d', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coordinates }
          }]
        }
      });
    } else {
      map.getSource('nav-route-2d').setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coordinates }
        }]
      });
    }
  };

  window.setZoomLevel = function(zoom) {
    map.easeTo({ zoom: zoom, duration: 300 });
  };

  window.recenterOnUser = function() {
    map.easeTo({
      center: [window.lastLng, window.lastLat],
      zoom: ${zoomLevel},
      duration: 500
    });
  };

  window.updatePOIMarkers = function(pois) {
    if (!pois || !pois.length) return;
    pois.forEach(p => {
      if (p.x && p.y) {
        const el = document.createElement('div');
        el.className = 'poi-marker';
        new mapboxgl.Marker({ element: el }).setLngLat([p.y, p.x]).addTo(map);
      }
    });
  };
</script>
</body>
</html>`;
}

/**
 * FloatingMiniMap Component
 *
 * Sits at bottom-right above the bottom navigation bar.
 * Embeds the exact Mapbox 2D map engine from NavigationScreen's 2D map toggle.
 * Subscribes directly to live compass and geolocation listeners for real-time tracking
 * without triggering React re-renders of the AR camera feed.
 */
export default function FloatingMiniMap({
  routeData,
  targetRoom,
  geoJSONData,
  initialPos,
  initialHeading = 0,
  posEngine,
  bottomOffset = 100,
  rightOffset = 16,
  size = 136,
  zoomLevel = 19,
}) {
  const webViewRef = useRef(null);
  const locWatcherRef = useRef(null);
  const magSubRef = useRef(null);
  const smoothHeadingRef = useRef(initialHeading || 0);
  const userPosRef = useRef(initialPos || null);

  const mapboxUrl = getCachedConfigValue(
    "EXPO_PUBLIC_MAPBOX_URL",
    "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA"
  );

  // Memoized 2D HTML source matching NavigationScreen 2D map mode
  const miniMapHtml = useMemo(
    () =>
      buildNavigation2DMapHTML(
        routeData?.path,
        initialPos,
        targetRoom,
        geoJSONData,
        mapboxUrl,
        zoomLevel
      ),
    []
  );

  // ── 1. Direct Magnetometer / Compass Subscription ──────────────────────────
  useEffect(() => {
    Magnetometer.setUpdateInterval(100);
    magSubRef.current = Magnetometer.addListener(({ x, y }) => {
      const angle = Math.atan2(y, x) * (180 / Math.PI);
      const normalizedH = (angle + 360) % 360;

      let diff = normalizedH - smoothHeadingRef.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      if (Math.abs(diff) > 1.0) {
        smoothHeadingRef.current = (smoothHeadingRef.current + diff * 0.3 + 360) % 360;
        const h = Math.round(smoothHeadingRef.current);

        webViewRef.current?.injectJavaScript(`
          if (typeof window.updateUserHeading === 'function') {
            window.updateUserHeading(${h});
          }
          true;
        `);
      }
    });

    return () => {
      magSubRef.current?.remove();
    };
  }, []);

  // ── 2. Direct Geolocation & Positioning Listener ────────────────────────────
  const handlePositionUpdate = useCallback(
    (coords) => {
      if (!coords || !webViewRef.current) return;
      const rawPos = { x: coords.latitude || coords.x, y: coords.longitude || coords.y };
      const snapped = snapPositionToRoute(rawPos, routeData?.path);
      userPosRef.current = snapped;

      const h = Math.round(smoothHeadingRef.current);

      webViewRef.current?.injectJavaScript(`
        if (typeof window.updateUserPos === 'function') {
          window.updateUserPos(${snapped.x}, ${snapped.y}, ${h});
        }
        true;
      `);
    },
    [routeData?.path]
  );

  useEffect(() => {
    let unsubPosEngine = null;
    if (posEngine && typeof posEngine.onPositionUpdate === "function") {
      unsubPosEngine = posEngine.onPositionUpdate((pos) => {
        handlePositionUpdate({ latitude: pos.x, longitude: pos.y });
      });
    }

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 800,
        distanceInterval: 0.5,
      },
      (loc) => {
        handlePositionUpdate(loc.coords);
      }
    ).then((watcher) => {
      locWatcherRef.current = watcher;
    });

    return () => {
      if (unsubPosEngine) unsubPosEngine();
      locWatcherRef.current?.remove();
    };
  }, [posEngine, handlePositionUpdate]);

  // ── 3. Sync Route Polyline Data from Global Navigation State ─────────────────
  useEffect(() => {
    if (!webViewRef.current || !routeData?.path) return;
    const coords = routeData.path.map((p) => [p.y, p.x]);
    webViewRef.current.injectJavaScript(`
      if (typeof window.updateRoutePolyline === 'function') {
        window.updateRoutePolyline(${JSON.stringify(coords)});
      }
      true;
    `);
  }, [routeData?.path]);

  // ── 4. Sync Zoom Level from Global Navigation State ─────────────────────────
  useEffect(() => {
    if (!webViewRef.current || !zoomLevel) return;
    webViewRef.current.injectJavaScript(`
      if (typeof window.setZoomLevel === 'function') {
        window.setZoomLevel(${zoomLevel});
      }
      true;
    `);
  }, [zoomLevel]);

  // ── 5. Sync POI Markers & Destination from Global Navigation State ──────────
  useEffect(() => {
    if (!webViewRef.current) return;
    const pois = [];
    if (routeData?.poiMarkers) {
      pois.push(...routeData.poiMarkers);
    }
    if (pois.length > 0) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.updatePOIMarkers === 'function') {
          window.updatePOIMarkers(${JSON.stringify(pois)});
        }
        true;
      `);
    }
  }, [routeData?.poiMarkers]);

  // ── 6. Sync Campus GeoJSON Layer ────────────────────────────────────────────
  useEffect(() => {
    if (!webViewRef.current || !geoJSONData) return;
    const activeFloorId = targetRoom?.floorId || "";
    webViewRef.current.injectJavaScript(`
      if (typeof window.updateGeoJSON === 'function') {
        window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${activeFloorId}');
      }
      true;
    `);
  }, [geoJSONData, targetRoom?.floorId]);

  const handleRecenter = () => {
    webViewRef.current?.injectJavaScript(`
      if (typeof window.recenterOnUser === 'function') {
        window.recenterOnUser();
      }
      true;
    `);
  };

  const containerDynamicStyle = {
    bottom: bottomOffset,
    right: rightOffset,
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View style={[styles.floatingContainer, containerDynamicStyle]}>
      {/* 2D Mapbox Engine inside Circular WebView */}
      <View style={[styles.mapClipper, { borderRadius: size / 2 }]}>
        <WebView
          ref={webViewRef}
          source={{ html: miniMapHtml }}
          style={styles.webView}
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
            if (userPosRef.current && webViewRef.current) {
              const h = Math.round(smoothHeadingRef.current);
              webViewRef.current.injectJavaScript(`
                if (typeof window.updateUserPos === 'function') {
                  window.updateUserPos(${userPosRef.current.x}, ${userPosRef.current.y}, ${h});
                }
                true;
              `);
            }
          }}
        />
      </View>

      {/* Subtle border outline ring */}
      <View style={[styles.borderRingOverlay, { borderRadius: size / 2 }]} pointerEvents="none" />

      {/* Compass North Badge */}
      <View style={styles.northBadge} pointerEvents="none">
        <Text style={styles.northText}>N</Text>
      </View>

      {/* Recenter / Focus Button */}
      <TouchableOpacity
        style={styles.recenterBtn}
        onPress={handleRecenter}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="locate" size={13} color="#7c3aed" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    backgroundColor: "#ffffff",
    borderWidth: 2.5,
    borderColor: "rgba(124, 58, 237, 0.9)",
    zIndex: 35,
    ...SHADOWS.lg,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  mapClipper: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  webView: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  borderRingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.2)",
  },
  northBadge: {
    position: "absolute",
    top: 4,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
    zIndex: 40,
    ...SHADOWS.sm,
  },
  northText: {
    color: "#6d28d9",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  recenterBtn: {
    position: "absolute",
    bottom: 5,
    left: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    ...SHADOWS.sm,
  },
});
