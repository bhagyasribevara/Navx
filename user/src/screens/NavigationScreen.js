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
import BarometerService from "../sensors/BarometerService";
import SensorFusion from "../sensors/SensorFusion";
import VerticalTracker from "../navigation/VerticalTracker";
import StaircaseExtractor from "../navigation/StaircaseExtractor";
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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function buildNavMapHTML(geoJSONData, pathPoints, initialPos, targetRoom, mapboxUrl, floors, mapMode = '3D') {
  const center = initialPos ? [initialPos.x, initialPos.y] : (pathPoints?.length ? [pathPoints[0].x, pathPoints[0].y] : [18.4665, 83.6629]);
  const initialPitch = mapMode === '2D' ? 0 : 60;
  const initialBearing = mapMode === '2D' ? 0 : -17.6;

  const destX = targetRoom?.shape?.points?.[0]?.x || targetRoom?.shape?.x;
  const destY = targetRoom?.shape?.points?.[0]?.y || targetRoom?.shape?.y;

  // Build a floor level lookup map
  const floorLevelMap = {};
  if (floors && floors.length > 0) {
    floors.forEach(f => {
      const fid = (f._id || f).toString();
      floorLevelMap[fid] = f.level !== undefined ? f.level : 0;
    });
  }

  // Collect all floor IDs the route passes through
  const routeFloorIds = new Set();
  
  // First pass: extract base heights, floorIds, and levels
  const rawPathData = pathPoints ? pathPoints.map(p => {
    let level = p.floorLevel;
    const fid = p.floorId?._id?.toString() || p.floorId?.toString() || null;
    if (level === undefined && fid && floorLevelMap[fid] !== undefined) {
      level = floorLevelMap[fid];
    }
    if (level === undefined || level === null) level = 0;
    if (fid) routeFloorIds.add(fid);
    const baseH = level * 3.5 + 0.5;
    return { ...p, floorIdStr: fid, level, baseH };
  }) : [];

  // Determine active floor transitions (staircase connections) in the route
  const activeStairTransitions = []; // Array of { startFloorId, endFloorId, startLevel, endLevel }
  if (rawPathData.length > 1) {
    for (let i = 0; i < rawPathData.length - 1; i++) {
      const curr = rawPathData[i];
      const next = rawPathData[i + 1];
      const isLevelChange = curr.level !== next.level;
      const isFloorChange = curr.floorIdStr && next.floorIdStr && curr.floorIdStr !== next.floorIdStr;
      const isStairsEdge = next.segmentType === 'stairs' || next.type === 'stairs' || curr.type === 'stairs' || curr.segmentType === 'stairs';

      if (isLevelChange || isFloorChange || isStairsEdge) {
        activeStairTransitions.push({
          startFloorId: curr.floorIdStr || '',
          endFloorId: next.floorIdStr || '',
          startLevel: curr.level,
          endLevel: next.level
        });
      }
    }
  }

  const isSingleFloorRoute = (activeStairTransitions.length === 0);

  // Extract all staircase rooms from GeoJSON features for local footprint matching
  const allStairFeatures = (geoJSONData?.features || []).filter(f => f.properties?.type === 'room' && (f.properties?.category === 'stairs' || f.properties?.isStairs));

  // Second pass: smooth out stairs incline across all intermediate nodes leading up/down the flight
  const pathData = [...rawPathData];
  let pIdx = 0;
  while (pIdx < pathData.length) {
    let nextIdx = pIdx;
    while (nextIdx + 1 < pathData.length && pathData[nextIdx + 1].level === pathData[pIdx].level) {
      nextIdx++;
    }

    if (nextIdx + 1 < pathData.length && pathData[nextIdx + 1].level !== pathData[pIdx].level) {
      // Transition from level A to level B
      const transNode = pathData[nextIdx];
      const targetNode = pathData[nextIdx + 1];

      // Find matching stairs within 35 meters
      const localStairFeats = allStairFeatures.filter(sf => {
        const coords = sf.geometry?.coordinates?.[0] || [];
        if (coords.length === 0) return false;
        const c0 = coords[0]; // [lng, lat]
        const d = haversine(transNode.x, transNode.y, c0[1], c0[0]);
        return d < 35;
      });

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      localStairFeats.forEach(sf => {
        (sf.geometry?.coordinates?.[0] || []).forEach(c => {
          const lat = c[1], lng = c[0];
          if (lat < minX) minX = lat;
          if (lat > maxX) maxX = lat;
          if (lng < minY) minY = lng;
          if (lng > maxY) maxY = lng;
        });
      });

      const pad = 0.00003;
      minX -= pad; maxX += pad; minY -= pad; maxY += pad;
      const isNodeInStairBox = (n) => (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY);

      let chainStart = nextIdx;
      while (chainStart > pIdx && isNodeInStairBox(pathData[chainStart])) {
        chainStart--;
      }
      if (!isNodeInStairBox(pathData[chainStart]) && chainStart < nextIdx) {
        chainStart++;
      }

      const chainEnd = nextIdx + 1;
      const hStart = pathData[chainStart].baseH;
      const hEnd = pathData[chainEnd].baseH;

      let totalDist = 0;
      const dists = [0];
      for (let k = chainStart; k < chainEnd; k++) {
        const d = haversine(pathData[k].x, pathData[k].y, pathData[k + 1].x, pathData[k + 1].y);
        totalDist += d;
        dists.push(totalDist);
      }

      if (totalDist > 0) {
        for (let k = chainStart; k <= chainEnd; k++) {
          const frac = dists[k - chainStart] / totalDist;
          pathData[k].adjustedH = hStart + frac * (hEnd - hStart);
        }
      }
      pIdx = chainEnd;
    } else {
      pIdx++;
    }
  }

  // Generate smooth 3D route coordinates by subdividing stair inclines
  const interpolated3DCoords = [];
  if (pathData.length > 0) {
    for (let i = 0; i < pathData.length; i++) {
      const curr = pathData[i];
      const currH = curr.adjustedH !== undefined ? curr.adjustedH : curr.baseH;
      if (i === 0) {
        interpolated3DCoords.push([curr.y, curr.x, currH]);
      } else {
        const prev = pathData[i - 1];
        const prevH = prev.adjustedH !== undefined ? prev.adjustedH : prev.baseH;
        if (Math.abs(prevH - currH) > 0.05) {
          // Subdivide the stair incline into smooth steps
          const N = 8;
          for (let step = 1; step <= N; step++) {
            const t = step / N;
            const y = prev.y + t * (curr.y - prev.y);
            const x = prev.x + t * (curr.x - prev.x);
            const h = prevH + t * (currH - prevH);
            interpolated3DCoords.push([y, x, h]);
          }
        } else {
          interpolated3DCoords.push([curr.y, curr.x, currH]);
        }
      }
    }
  }

  const pathCoordinates = interpolated3DCoords.map(p => `[${p[0]}, ${p[1]}, ${p[2]}]`).join(',');
  const routeFloorIdsJSON = JSON.stringify([...routeFloorIds]);
  const activeStairTransitionsJSON = JSON.stringify(activeStairTransitions);

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

var initialStyle = '${mapMode}' === '2D' ? 'mapbox://styles/mapbox/outdoors-v12' : 'mapbox://styles/mapbox/dark-v11';

var map = new mapboxgl.Map({
  container: 'map',
  style: initialStyle,
  center: [${center[1]}, ${center[0]}], // [lng, lat]
  zoom: 19,
  minZoom: 0,
  maxZoom: 25, // Enable deep zooming into blocks, rooms, and stairs
  pitch: ${initialPitch},
  minPitch: 0,
  maxPitch: 85, // Enable full 3D pitch and tilt
  bearing: ${initialBearing},
  antialias: true,
  dragRotate: true,
  pitchWithRotate: true,
  touchPitch: true,
  touchZoomRotate: true,
  dragPan: true,
  keyboard: true,
  attributionControl: false
});

var currentMapMode = '${mapMode || "3D"}';
var currentGeoData = ${geoJSONData ? JSON.stringify(geoJSONData) : 'null'};
var currentFloorId = '${targetFloorId || ""}';
window._routeFloorIds = ${routeFloorIdsJSON || '[]'};
window._activeStairTransitions = ${activeStairTransitionsJSON || '[]'};
window._isSingleFloorRoute = ${isSingleFloorRoute ? 'true' : 'false'};

window.setMapMode = function(mode) {
  if (!map) return;
  currentMapMode = mode;
  var is2D = (mode === '2D');

  if (is2D) {
    map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  } else {
    map.easeTo({ pitch: 60, bearing: -17.6, duration: 600 });
  }

  var layers3D = ['campus-blocks', 'campus-rooms', 'campus-stairs', '3d-buildings', 'route-bg', 'route-line'];
  layers3D.forEach(function(id) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', is2D ? 'none' : 'visible');
    }
  });

  var layers2D = ['campus-2d-fill', 'campus-2d-line', 'nav-route-2d-line', 'campus-labels'];
  layers2D.forEach(function(id) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', is2D ? 'visible' : 'none');
    }
  });
};

function generate3DRouteFeatures(coords, width, thickness) {
  var features = [];
  for (var j = 0; j < coords.length - 1; j++) {
    var pA = coords[j];
    var pB = coords[j+1];

    var ay = pA[0], ax = pA[1], ah = pA[2];
    var by = pB[0], bx = pB[1], bh = pB[2];

    var dy = by - ay;
    var dx = bx - ax;
    var length = Math.sqrt(dy * dy + dx * dx);
    if (length === 0) continue;

    var uy = dy / length;
    var ux = dx / length;

    var ny = -ux;
    var nx = uy;

    var N = 4;
    for (var i = 0; i < N; i++) {
      var tStart = i / N;
      var tEnd = (i + 1) / N;

      var yStart = ay + dy * tStart;
      var xStart = ax + dx * tStart;
      var yEnd = ay + dy * tEnd;
      var xEnd = ax + dx * tEnd;

      var c1 = [yStart + ny * width, xStart + nx * width];
      var c2 = [yStart - ny * width, xStart - nx * width];
      var c3 = [yEnd - ny * width, xEnd - nx * width];
      var c4 = [yEnd + ny * width, xEnd + nx * width];

      var hStart = ah + (bh - ah) * tStart;
      var hEnd = ah + (bh - ah) * tEnd;

      var minH = Math.min(hStart, hEnd);
      var maxH = Math.max(hStart, hEnd);

      features.push({
        type: 'Feature',
        properties: {
          min_height: minH - thickness / 2,
          height: maxH + thickness / 2
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[c1, c2, c3, c4, c1]]
        }
      });
    }
  }
  return features;
}

map.on('load', () => {
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

window.updateGeoJSON = function(data, floorId, activeFloorId, activeStairTransitions, isSingleFloorRoute) {
  currentGeoData = data;
  currentFloorId = floorId;
  if (activeStairTransitions !== undefined) window._activeStairTransitions = activeStairTransitions;
  if (isSingleFloorRoute !== undefined) window._isSingleFloorRoute = isSingleFloorRoute;
  window.renderGeoJSONLayers(data, floorId, activeFloorId);
};

window.renderGeoJSONLayers = function(data, floorId, activeFloorId) {
  if (!map || !data || !data.features) return;

  var is2D = (currentMapMode === '2D');
  var singleFloorNav = window._isSingleFloorRoute;
  var stairTransitions = window._activeStairTransitions || [];

  var polyFeatures = data.features.filter(function(f) {
    if (f.properties.type === 'path' || f.properties.type === 'node') return false;
    if (f.properties.category === 'parking' || (f.properties.name && f.properties.name.toLowerCase().includes('parking'))) {
      if (f.properties.id !== '${targetRoom?._id || ''}') return false;
    }

    if (f.properties.type === 'room') {
      var isStairs = (f.properties.category === 'stairs' || f.properties.isStairs === true);

      if (isStairs) {
        // 1. If navigation is on a single floor (e.g. Ground to Ground), HIDE ALL STAIRCASES
        if (singleFloorNav || stairTransitions.length === 0) {
          return false;
        }

        // 2. If multi-floor navigation, ONLY render the staircase connecting the floors in activeStairTransitions
        var sFloorId = (f.properties.startFloorId || f.properties.floorId || '').toString();
        var eFloorId = (f.properties.endFloorId || '').toString();
        var fMinH = f.properties.min_height !== undefined ? f.properties.min_height : 0;
        var fMaxH = f.properties.height !== undefined ? f.properties.height : 3.5;

        var matchesTransition = stairTransitions.some(function(tr) {
          var trStart = (tr.startFloorId || '').toString();
          var trEnd = (tr.endFloorId || '').toString();
          var minLevel = Math.min(tr.startLevel || 0, tr.endLevel || 0);
          var maxLevel = Math.max(tr.startLevel || 0, tr.endLevel || 0);

          // Strictly bound elevation range within this transition (e.g. Ground -> 1F is [0m, 3.5m])
          var minAllowedH = minLevel * 3.5 - 0.2;
          var maxAllowedH = maxLevel * 3.5 + 0.2;
          if (fMinH > maxAllowedH || fMaxH < minAllowedH) {
            return false;
          }

          // Direct floor ID match
          if (trStart && trEnd && sFloorId && eFloorId) {
            return (sFloorId === trStart && eFloorId === trEnd) || (sFloorId === trEnd && eFloorId === trStart);
          }

          // Height match if floor IDs are not fully tagged
          return (fMinH >= minAllowedH && fMaxH <= maxAllowedH && maxLevel > minLevel);
        });

        return matchesTransition;
      } else {
        // Regular rooms: show ONLY rooms on the active target floor (destination floor)
        // to prevent stacking ground floor and 1st floor rooms together in the 3D block
        if (!floorId) return false;
        var rFloorId = (f.properties.floorId || '').toString();
        return (rFloorId === floorId.toString());
      }
    }
    return true;
  });

  var polygonData = { type: 'FeatureCollection', features: polyFeatures };

  if (map.getSource('campus-data')) {
    map.getSource('campus-data').setData(polygonData);
  } else {
    map.addSource('campus-data', { type: 'geojson', data: polygonData });
  }

  // Draw 2D & 3D Navigation Route line if coordinates exist
  ${pathCoordinates ? `
    var rawRouteCoords = [${pathCoordinates}];
    var nav2DCoords = rawRouteCoords.map(function(c) { return [c[0], c[1]]; });
    var route2DGeoJSON = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: nav2DCoords } }]
    };

    if (map.getSource('nav-route-2d')) {
      map.getSource('nav-route-2d').setData(route2DGeoJSON);
    } else {
      map.addSource('nav-route-2d', { type: 'geojson', data: route2DGeoJSON });
    }

    var mainFeatures = generate3DRouteFeatures(rawRouteCoords, 0.000004, 0.04);
    var bgFeatures = generate3DRouteFeatures(rawRouteCoords, 0.000006, 0.06);

    if (map.getSource('route')) {
      map.getSource('route').setData({ type: 'FeatureCollection', features: mainFeatures });
    } else {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: mainFeatures } });
    }

    if (map.getSource('route-bg-source')) {
      map.getSource('route-bg-source').setData({ type: 'FeatureCollection', features: bgFeatures });
    } else {
      map.addSource('route-bg-source', { type: 'geojson', data: { type: 'FeatureCollection', features: bgFeatures } });
    }
  ` : ''}

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

  // ── 2. CRISP 2D OUTLINE ──
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
  // ── 3. 2D NAVIGATION ACTIVE ROUTE LINE ──
  ${pathCoordinates ? `
    if (!map.getLayer('nav-route-2d-line')) {
      map.addLayer({
        'id': 'nav-route-2d-line',
        'type': 'line',
        'source': 'nav-route-2d',
        'layout': { 'visibility': is2D ? 'visible' : 'none' },
        'paint': {
          'line-color': '#7c3aed',
          'line-width': 6,
          'line-opacity': 0.95
        }
      });
    }
  ` : ''}

  // ── 6B. 3D EXTRUSION LAYER FOR ROOMS (OPAQUE, DRAW FIRST) ──
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
          ['coalesce', ['get', 'color'], '#ffffff']
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 3],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.85
      }
    }, '3d-buildings');
  }

  // ── 6A. 3D EXTRUSION LAYER FOR BLOCKS (TRANSLUCENT, DRAW AFTER ROOMS) ──
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

  // ── 8. 3D ROUTE RIBBONS ──
  ${pathCoordinates ? `
    if (!map.getLayer('route-bg')) {
      map.addLayer({
        'id': 'route-bg',
        'type': 'fill-extrusion',
        'source': 'route-bg-source',
        'layout': { 'visibility': is2D ? 'none' : 'visible' },
        'paint': {
          'fill-extrusion-color': '#6d28d9',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6
        }
      });
    }
    if (!map.getLayer('route-line')) {
      map.addLayer({
        'id': 'route-line',
        'type': 'fill-extrusion',
        'source': 'route',
        'layout': { 'visibility': is2D ? 'none' : 'visible' },
        'paint': {
          'fill-extrusion-color': '#4c1d95',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 1.0
        }
      });
    }
  ` : ''}

  // ── 9. LABELS ──
  if (!map.getLayer('campus-labels')) {
    map.addLayer({
      'id': 'campus-labels',
      'type': 'symbol',
      'source': 'campus-data',
      'filter': ['has', 'name'],
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

  // Ensure visibilities match current mode
  window.setMapMode(currentMapMode);
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

window.updateUserPos = function(lat, lng, heading, elevation) {
  var elev = elevation || 0;
  if (!window.userMarker) {
    window.userMarker = new mapboxgl.Marker({ element: userIconEl, pitchAlignment: 'map' })
      .setLngLat([lng, lat])
      .addTo(map);
  } else {
    window.userMarker.setLngLat([lng, lat]);
  }
  if (currentMapMode === '3D' && elev > 0) {
    var pixelOffset = elev * -8;
    userIconEl.style.transform = 'translateY(' + pixelOffset + 'px)';
  } else {
    userIconEl.style.transform = '';
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
  const [mapMode, setMapMode] = useState('3D');

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

  // Vertical navigation tracking
  const verticalTrackerRef = useRef(new VerticalTracker());
  const sensorFusionRef = useRef(new SensorFusion());
  const staircaseConnectorsRef = useRef([]);
  const [verticalMovementState, setVerticalMovementState] = useState(null);

  // Extract staircase connectors whenever route or map floors change
  useEffect(() => {
    if (routeData && routeData.path && mapData?.floors) {
      const connectors = StaircaseExtractor.extract(
        routeData.path,
        mapData.floors,
        routeData.staircaseMetadata || []
      );
      staircaseConnectorsRef.current = connectors;
    }
  }, [routeData, mapData]);

  const mapHtml = React.useMemo(() => {
    const geoDataToUse = geoJSONData || { type: 'FeatureCollection', features: [] };
    return buildNavMapHTML(geoDataToUse, routeData?.path, initialUserPosRef.current, targetRoom, mapboxUrl, mapData?.floors, mapMode);
  }, [geoJSONData, routeData, targetRoom, mapboxUrl, mapData?.floors, mapMode]);

  // Inject updated GeoJSON when it changes without reloading WebView
  useEffect(() => {
    const getFloorIdString = (floorVal) => {
      if (!floorVal) return '';
      if (typeof floorVal === 'object') return floorVal._id || '';
      return floorVal;
    };
    const targetFloorId = getFloorIdString(targetRoom?.floorId) || getFloorIdString(currentFloor) || getFloorIdString(route.params?.floorId) || getFloorIdString(mapData?.floors?.[0]?._id);
    const currentFloorId = getFloorIdString(currentFloor);

    // Compute active stair transitions from current routeData
    const floorLevelMap = {};
    if (mapData?.floors && mapData.floors.length > 0) {
      mapData.floors.forEach(f => {
        const fid = (f._id || f).toString();
        floorLevelMap[fid] = f.level !== undefined ? f.level : 0;
      });
    }

    const activeStairs = [];
    if (routeData?.path && routeData.path.length > 1) {
      for (let i = 0; i < routeData.path.length - 1; i++) {
        const curr = routeData.path[i];
        const next = routeData.path[i + 1];
        const currFid = curr.floorId?._id?.toString() || curr.floorId?.toString() || '';
        const nextFid = next.floorId?._id?.toString() || next.floorId?.toString() || '';
        const currLevel = curr.floorLevel !== undefined && curr.floorLevel !== null ? curr.floorLevel : (floorLevelMap[currFid] ?? 0);
        const nextLevel = next.floorLevel !== undefined && next.floorLevel !== null ? next.floorLevel : (floorLevelMap[nextFid] ?? 0);
        const isStairsEdge = next.segmentType === 'stairs' || next.type === 'stairs' || curr.type === 'stairs' || curr.segmentType === 'stairs';

        if (currLevel !== nextLevel || (currFid && nextFid && currFid !== nextFid) || isStairsEdge) {
          activeStairs.push({
            startFloorId: currFid,
            endFloorId: nextFid,
            startLevel: currLevel,
            endLevel: nextLevel
          });
        }
      }
    }
    const isSingleFloor = (activeStairs.length === 0);

    if (geoJSONData && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateGeoJSON === 'function') {
          window.updateGeoJSON(${JSON.stringify(geoJSONData)}, '${targetFloorId || ''}', '${currentFloorId || ''}', ${JSON.stringify(activeStairs)}, ${isSingleFloor ? 'true' : 'false'});
        }
        true;
      `);
    }
  }, [geoJSONData, currentFloor, targetRoom, mapData, route.params?.floorId, routeData]);

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

  // Push user location updates directly into the WebView via JS (with route-snapping and elevation)
  useEffect(() => {
    if (userPos && webViewRef.current) {
      const snappedPos = snapPositionToRoute(userPos, routeData?.path, currentStep);
      const elev = posEngine.position.z || 0;
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateUserPos === 'function') {
          window.updateUserPos(${snappedPos.x}, ${snappedPos.y}, ${posEngine.heading}, ${elev});
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
        }).catch(() => { });
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
        } catch (e) { }
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
            streetNodes.forEach(sn => sn.floorId = firstNode.floorId || null);
            result.path = [...streetNodes, ...result.path];
          } else {
            // Fallback to straight line
            result.path.unshift({ nodeId: 'user_start', x: uLat, y: uLng, floorId: firstNode.floorId || null, type: 'user' });
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
          result.path.unshift({ nodeId: 'user_start', x: uLat, y: uLng, floorId: firstNode.floorId || null, type: 'user' });
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
  const destReminder50Ref = useRef(false);
  const destReminder20Ref = useRef(false);
  const offRouteCountRef = useRef(0);

  useEffect(() => {
    let locationWatcher;
    let accel;
    let mag;
    const accelYRef = { current: 0 };
    if (isNavigating) {
      // 1. Start barometer service if available on device
      BarometerService.isAvailable().then(avail => {
        if (avail) {
          BarometerService.start(data => {
            sensorFusionRef.current.processBarometer(data.pressure, data.relativeAltitude);
            const trend = BarometerService.getPressureTrend();
            sensorFusionRef.current.setPressureTrend(trend);
          });
        }
      }).catch(console.warn);

      // 2. Step detector for dead reckoning bridging & vertical staircase progress
      stepDetector.current = new StepDetector(() => {
        posEngine.processStep(posEngine.heading);
        sensorFusionRef.current.onStep();
        const fusion = sensorFusionRef.current.getMovementState();
        setVerticalMovementState(fusion.state);

        if (verticalTrackerRef.current.state.isActive) {
          verticalTrackerRef.current.onStep(fusion);
          const vertPos = verticalTrackerRef.current.getPosition();
          if (vertPos) {
            posEngine.updateVerticalPosition(vertPos.z, vertPos.floorId);
            posEngine.position.x = vertPos.x;
            posEngine.position.y = vertPos.y;
            setUserPos({ ...posEngine.position });
          }
        }
      });

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

                const remainingPathMeters = rData.directions?.slice(cStep + 1).reduce((s, d) => s + (d.distance || 0), 0) || 0;
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
        BarometerService.stop();
        verticalTrackerRef.current.deactivate();
        sensorFusionRef.current.reset();
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

  // ── Staircase Vertical Navigation Activation / Deactivation
  useEffect(() => {
    if (!isNavigating || !routeData) return;
    const connectors = staircaseConnectorsRef.current || [];
    const activeConnector = connectors.find(
      c => currentStep >= c.startNodeIndex && currentStep <= c.endNodeIndex
    );

    if (activeConnector) {
      if (!verticalTrackerRef.current.state.isActive) {
        console.log("[NavX] Activating VerticalTracker for staircase:", activeConnector.direction);
        verticalTrackerRef.current.activate(activeConnector);
        sensorFusionRef.current.setStaircaseContext(true, activeConnector.direction);

        verticalTrackerRef.current.onFloorReached = (newFloorId) => {
          console.log("[NavX] Floor reached via vertical tracking:", newFloorId);
          if (newFloorId) {
            setCurrentFloor(newFloorId);
            posEngine.setFloor(newFloorId);
          }
        };
      }
    } else {
      if (verticalTrackerRef.current.state.isActive) {
        console.log("[NavX] Deactivating VerticalTracker - exited staircase");
        verticalTrackerRef.current.deactivate();
        sensorFusionRef.current.setStaircaseContext(false);
      }
    }
  }, [currentStep, isNavigating, routeData]);

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

        {/* 2D / 3D Map Mode Toggle Pill */}
        <View style={[s.mapModeToggleContainer, isNavigating && currentDir && !arrived ? { top: 114 } : { top: 16 }]}>
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
                    ? (routeData.directions?.slice(currentStep).reduce((s, d) => s + (d.eta || 0), 0) || Math.round(liveDistance / WALK_SPEED))
                    : (routeData.eta || Math.round(routeData.distance / WALK_SPEED));
                  return secs >= 60 ? Math.ceil(secs / 60) + "'" : secs + "s";
                })()}</Text>
                <Text style={s.metricLabel}>{isNavigating ? "Live ETA" : "Est. Time"}</Text>
              </View>
              <View style={s.metric}>
                <Text style={s.metricValue}>{isNavigating
                  ? (routeData.directions?.slice(currentStep).reduce((s, d) => s + (d.steps || Math.round((d.distance || 0) / AVG_STRIDE)), 0) || Math.round(liveDistance / AVG_STRIDE))
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
