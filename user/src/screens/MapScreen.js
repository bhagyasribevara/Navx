import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform, Dimensions, Animated, Easing, RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { ThemeContext } from "../context/ThemeContext";
import { useGeofence } from "../context/GeofenceContext";
import AmbientFloorDetector from "../sensors/AmbientFloorDetector";
import { PositionEngine } from "../positioning";
import { getMapData, getCampuses, getGeoJSONMapData, SOCKET_URL, getCachedConfigValue } from "../api";
import { io } from "socket.io-client";
import { SHADOWS, RADIUS, ROOM_COLORS } from "../theme/designSystem";
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';

const { height: SH, width: SW } = Dimensions.get('window');

function buildCampusMapHTML(geoJSONData, centerCoords, mapboxUrl, mapMode = '3D', initialPos = null) {
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
    position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; pointer-events: none;
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
    position: relative; width: 28px; height: 28px; background: linear-gradient(135deg, #A855F7, #6D28D9); border-radius: 50%; box-shadow: 0 4px 14px rgba(109, 40, 217, 0.6); display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.85); transition: transform 0.15s ease-out;
  }
  .floor-badge {
    position: fixed;
    top: 0;
    left: 0;
    transform: translate(-50%, -100%);
    background: rgba(15, 23, 42, 0.94);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.6);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45), 0 0 10px rgba(168, 85, 247, 0.4);
    padding: 3px 9px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    pointer-events: none;
    letter-spacing: 0.3px;
    display: none;
    align-items: center;
    gap: 3px;
    z-index: 9999;
  }
  .floor-badge::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid rgba(15, 23, 42, 0.94);
  }
  .doorplate-sign {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 50% 50%;
    pointer-events: auto;
    cursor: pointer;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border: 1px solid #f59e0b;
    border-top: 1.5px solid #fbbf24;
    color: #f8fafc;
    padding: 1px 6px;
    border-radius: 2.5px;
    font-size: 9.5px;
    font-weight: 800;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    display: none;
    white-space: nowrap;
    user-select: none;
    will-change: transform, opacity;
  }
  .doorplate-sign:active {
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    border-color: #fbbf24;
  }
</style>
</head><body><div id="map"></div><div id="user-floor-badge" class="floor-badge"></div><div id="doorplate-labels" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:9;"></div>
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
  minZoom: 0,
  maxZoom: 25, // Enable deep zooming into blocks, rooms, and stairs
  pitch: ${initialPitch},
  minPitch: 0,
  maxPitch: 75, // Clamped to prevent camera frustum clipping on deep zoom
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

  // 3D layers: visible in 3D, hidden in 2D
  var layers3D = [
    'campus-blocks',
    'campus-rooms',
    'campus-rooms-corridor',
    'campus-rooms-base',
    'campus-rooms-upper',
    'campus-rooms-partition',
    'campus-rooms-roof',
    'campus-rooms-parapet',
    'campus-rooms-door',
    '3d-buildings'
  ];
  layers3D.forEach(function(id) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', is2D ? 'none' : 'visible');
    }
  });

  // 2D layers: visible in 2D, hidden in 3D
  var layers2D = [
    'campus-2d-fill', 'campus-2d-line', 'campus-labels'
  ];
  layers2D.forEach(function(id) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', is2D ? 'visible' : 'none');
    }
  });
  if (typeof updateDoorplateSignage === 'function') updateDoorplateSignage();
};

map.on('load', () => {
  setupMarkerLayers();

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
      var rFloorId = (f.properties.floorId || '').toString();
      if (rFloorId !== floorId.toString()) return false;
    }
    return true;
  });

  var polygonData = { type: 'FeatureCollection', features: polyFeatures };

  if (map.getSource('campus-data')) {
    map.getSource('campus-data').setData(polygonData);
  } else {
    map.addSource('campus-data', { type: 'geojson', data: polygonData });
  }

  // ── Extract Doorplate Anchors for Physical In-World Room Signage ──
  var doorplateMap = {};
  polyFeatures.forEach(function(f) {
    if (!f.properties) return;
    var props = f.properties;
    var rid = (props.roomId || props.id || props.name || '').toString();
    if (!rid) return;

    if (props.part === 'doorplate' && props.doorLng && props.doorLat) {
      doorplateMap[rid] = {
        id: rid,
        name: props.name || 'Room',
        lng: props.doorLng,
        lat: props.doorLat,
        elevation: props.doorElev !== undefined ? props.doorElev : (props.min_height || 2.36),
        ux: props.ux || 1,
        uy: props.uy || 0,
        nx: props.nx !== undefined ? props.nx : 0,
        ny: props.ny !== undefined ? props.ny : 1,
        ptA: props.ptA || [props.doorLng - 0.000004, props.doorLat],
        ptB: props.ptB || [props.doorLng + 0.000004, props.doorLat],
        floorId: props.floorId,
        level: props.level
      };
    } else if (props.type === 'room' && props.name && props.category !== 'corridor' && !doorplateMap[rid]) {
      if (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]) {
        var ring = f.geometry.coordinates[0];
        if (ring.length >= 4) {
          var p1 = ring[0], p2 = ring[1];
          var midLng = (p1[0] + p2[0]) / 2;
          var midLat = (p1[1] + p2[1]) / 2;
          var lvl = props.level !== undefined ? Number(props.level) : 0;
          var elev = (lvl * 3.5) + 2.36;
          var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
          var dlen = Math.hypot(dx, dy) || 1e-6;
          var uX = dx / dlen, uY = dy / dlen;
          doorplateMap[rid] = {
            id: rid,
            name: props.name,
            lng: midLng,
            lat: midLat,
            elevation: elev,
            ux: uX,
            uy: uY,
            nx: -uY,
            ny: uX,
            ptA: [midLng - uX * 0.000004, midLat - uY * 0.000004],
            ptB: [midLng + uX * 0.000004, midLat + uY * 0.000004],
            floorId: props.floorId,
            level: props.level
          };
        }
      }
    }
  });
  window._activeDoorplates = Object.values(doorplateMap);
  if (typeof updateDoorplateSignage === 'function') updateDoorplateSignage();

  // ── 1. FLAT 2D FILL LAYER ──
  if (!map.getLayer('campus-2d-fill')) {
    map.addLayer({
      'id': 'campus-2d-fill',
      'type': 'fill',
      'source': 'campus-data',
      'layout': { 'visibility': is2D ? 'visible' : 'none' },
      'paint': {
        'fill-color': [
          'case',
          ['==', ['get', 'type'], 'block'], '#cbd5e1',
          ['coalesce', ['get', 'color'], '#94a3b8']
        ],
        'fill-opacity': 0.35
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
        'line-color': [
          'case',
          ['==', ['get', 'type'], 'block'], '#94a3b8',
          ['coalesce', ['get', 'color'], '#64748b']
        ],
        'line-width': 1.5,
        'line-opacity': 0.7
      }
    });
  }

  // ── 5B. DIGITAL TWIN: CORRIDORS (NEUTRAL POLISHED CONCRETE WALKWAYS) ──
  if (!map.getLayer('campus-rooms-corridor')) {
    map.addLayer({
      'id': 'campus-rooms-corridor',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'part'], 'corridor']],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#cbd5e1'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 0.05],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.95
      }
    }, '3d-buildings');
  }

  // ── 5C. DIGITAL TWIN: DADO / BASEBOARD TIER (minH to minH + 0.80m) ──
  if (!map.getLayer('campus-rooms-base')) {
    map.addLayer({
      'id': 'campus-rooms-base',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'part'], 'base']],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#1e293b'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 0.80],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.95
      }
    }, '3d-buildings');
  }

  // ── 5D. DIGITAL TWIN: PLASTER WALL BODY (minH + 0.80m to minH + 2.75m) ──
  if (!map.getLayer('campus-rooms-upper')) {
    map.addLayer({
      'id': 'campus-rooms-upper',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'part'], 'body']],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#e2e8f0'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 2.75],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0.80],
        'fill-extrusion-opacity': 0.95
      }
    }, '3d-buildings');
  }

  // ── 5E. DIGITAL TWIN: 3D PARTITION DIVIDER WALLS (minH to minH + 2.92m) ──
  // Creates crisp structural divider seams between adjacent rooms
  if (!map.getLayer('campus-rooms-partition')) {
    map.addLayer({
      'id': 'campus-rooms-partition',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'part'], 'partition']],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#1e293b'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 2.92],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 1.0
      }
    }, '3d-buildings');
  }

  // ── 5F. DIGITAL TWIN: RECESSED INSET CEILING / ROOF TRAY (inset 0.18m, 2.70m -> 2.75m) ──
  // Sunken ceiling plane creating natural architectural shadow creases against perimeter walls
  if (!map.getLayer('campus-rooms-roof')) {
    map.addLayer({
      'id': 'campus-rooms-roof',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'part'], 'roof']],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#f8fafc'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 2.75],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 2.70],
        'fill-extrusion-opacity': 0.98
      }
    }, '3d-buildings');
  }

  // ── 5G. DIGITAL TWIN: RAISED PARAPET LIP & CATEGORY COPING TRIM (minH + 2.75m to minH + 2.90m) ──
  if (!map.getLayer('campus-rooms-parapet')) {
    map.addLayer({
      'id': 'campus-rooms-parapet',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'part'], 'parapet']],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#64748b'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 2.90],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 2.75],
        'fill-extrusion-opacity': 1.0
      }
    }, '3d-buildings');
  }

  // ── 5H. DIGITAL TWIN: CORRIDOR DOOR PORTALS (ILLUMINATED FRAMES & ENTRANCES) ──
  if (!map.getLayer('campus-rooms-door')) {
    map.addLayer({
      'id': 'campus-rooms-door',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['all', ['==', ['get', 'type'], 'room'], ['any', ['==', ['get', 'part'], 'door'], ['==', ['get', 'part'], 'door_frame'], ['==', ['get', 'part'], 'door_threshold'], ['==', ['get', 'part'], 'doorplate']]],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': ['coalesce', ['get', 'color'], '#f59e0b'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 2.50],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 1.0
      }
    }, '3d-buildings');
  }

  // ── 5I. 3D EXTRUSION LAYER FOR ROOMS / STAIRS (FALLBACK & STAIRCASES) ──
  if (!map.getLayer('campus-rooms')) {
    map.addLayer({
      'id': 'campus-rooms',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': [
        'any',
        ['==', ['get', 'type'], 'stairs'],
        ['all', ['==', ['get', 'type'], 'room'], ['!has', 'part']]
      ],
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

  // ── 5A. 3D EXTRUSION LAYER FOR BLOCKS (TRANSLUCENT OUTER GLASS ENVELOPE) ──
  if (!map.getLayer('campus-blocks')) {
    map.addLayer({
      'id': 'campus-blocks',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['==', ['get', 'type'], 'block'],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': '#1e293b',
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.22
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

  // ── 7. 3D DIGITAL TWIN ROOM BILLBOARD LABELS ──
  if (!map.getLayer('campus-room-labels')) {
    map.addLayer({
      'id': 'campus-room-labels',
      'type': 'symbol',
      'source': 'campus-data',
      'filter': [
        'all',
        ['==', ['get', 'type'], 'room'],
        ['==', ['get', 'part'], 'parapet'],
        ['!=', ['get', 'category'], 'corridor'],
        ['has', 'name']
      ],
      'layout': {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-max-width': 8,
        'text-anchor': 'center',
        'text-offset': [0, 0],
        'visibility': 'none' // Managed via high-precision 3D projected HTML badges to prevent ground draping
      },
      'paint': {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(15, 23, 42, 0.95)',
        'text-halo-width': 2
      }
    });
  }

  // ── 8. RAYCASTING & ROOM INTERACTION HANDLERS ──
  if (!window._roomClickAttached) {
    window._roomClickAttached = true;
    var clickLayers = ['campus-rooms-roof', 'campus-rooms-upper', 'campus-rooms-base', 'campus-rooms-parapet', 'campus-rooms'];
    clickLayers.forEach(function(lyrId) {
      if (map.getLayer(lyrId)) {
        map.on('click', lyrId, function(e) {
          if (!e.features || !e.features.length) return;
          var p = e.features[0].properties || {};
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ROOM_CLICK',
              roomId: p.roomId || p.id,
              name: p.name,
              category: p.category,
              department: p.department,
              capacity: p.capacity,
              floorId: p.floorId,
              level: p.level
            }));
          }
        });
        map.on('mouseenter', lyrId, function() {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', lyrId, function() {
          map.getCanvas().style.cursor = '';
        });
      }
    });
  }

  // Ensure visibilities match current state
  window.setMapMode(currentMapMode);
};

// ─────────────────────────────────────────────────────────────────────────────
// USER POSITION & DIRECTION ARROW MARKER — Native 3D WebGL Extrusions
// Signature violet circular puck with real-time rotating white navigation arrow
// elevated directly to the floor slab height and synchronized in 3D perspective.
// ─────────────────────────────────────────────────────────────────────────────
function generateCirclePolygon(lng, lat, radiusMeters, numPoints) {
  numPoints = numPoints || 24;
  var dLat = radiusMeters / 111139;
  var dLng = radiusMeters / (111139 * Math.cos(lat * Math.PI / 180));
  var coords = [];
  for (var i = 0; i <= numPoints; i++) {
    var theta = (i / numPoints) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta)]);
  }
  return [coords];
}

function generateArrowPolygon(lng, lat, headingDeg, lengthMeters, widthMeters) {
  lengthMeters = lengthMeters || 2.2;
  widthMeters = widthMeters || 1.4;
  var rad = ((headingDeg || 0) * Math.PI) / 180;
  var forwardY = Math.cos(rad);
  var forwardX = Math.sin(rad);
  var rightX = Math.cos(rad);
  var rightY = -Math.sin(rad);

  var mToLat = 1 / 111139;
  var mToLng = 1 / (111139 * Math.cos(lat * Math.PI / 180));

  var tipDist = lengthMeters * 0.6;
  var backDist = lengthMeters * 0.4;
  var notchDist = lengthMeters * 0.15;
  var halfW = widthMeters * 0.5;

  var pTip = [lng + (forwardX * tipDist) * mToLng, lat + (forwardY * tipDist) * mToLat];
  var pRight = [lng + (-forwardX * backDist + rightX * halfW) * mToLng, lat + (-forwardY * backDist + rightY * halfW) * mToLat];
  var pNotch = [lng + (-forwardX * notchDist) * mToLng, lat + (-forwardY * notchDist) * mToLat];
  var pLeft = [lng + (-forwardX * backDist - rightX * halfW) * mToLng, lat + (-forwardY * backDist - rightY * halfW) * mToLat];

  return [[pTip, pRight, pNotch, pLeft, pTip]];
}

function setupMarkerLayers() {
  if (!map) return;
  if (!map.getSource('user-marker-source')) {
    map.addSource('user-marker-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }
  if (!map.getLayer('user-marker-glow')) {
    map.addLayer({
      'id': 'user-marker-glow',
      'type': 'fill-extrusion',
      'source': 'user-marker-source',
      'filter': ['==', ['get', 'part'], 'glow'],
      'paint': {
        'fill-extrusion-color': '#a855f7',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.35
      }
    });
  }
  if (!map.getLayer('user-marker-puck')) {
    map.addLayer({
      'id': 'user-marker-puck',
      'type': 'fill-extrusion',
      'source': 'user-marker-source',
      'filter': ['==', ['get', 'part'], 'puck'],
      'paint': {
        'fill-extrusion-color': '#7c3aed',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.95
      }
    });
  }
  if (!map.getLayer('user-marker-arrow')) {
    map.addLayer({
      'id': 'user-marker-arrow',
      'type': 'fill-extrusion',
      'source': 'user-marker-source',
      'filter': ['==', ['get', 'part'], 'arrow'],
      'paint': {
        'fill-extrusion-color': '#ffffff',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 1.0
      }
    });
  }
}

function updateBadgePosition() {
  var badge = document.getElementById('user-floor-badge');
  if (!badge || !window._lastUserPos) return;
  var fl = window._lastUserFloorLevel || 0;
  // If Ground Floor (0), hide floating badge! Only show for elevated floors (Floor 1, Floor 2, etc.)
  if (fl <= 0) {
    badge.style.display = 'none';
    return;
  }
  var lng = window._lastUserPos.lng;
  var lat = window._lastUserPos.lat;
  var effElev = window._lastUserElev !== undefined ? window._lastUserElev : (fl * 3.5 + 0.54);
  var screenPos = null;

  if (map && map.transform && map.transform.pixelMatrix && typeof mapboxgl.MercatorCoordinate !== 'undefined') {
    try {
      var coord = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], effElev + 1.2);
      var m = map.transform.pixelMatrix;
      var x = coord.x, y = coord.y, z = coord.z;
      var clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (clipW > 0) {
        screenPos = [
          (m[0] * x + m[4] * y + m[8] * z + m[12]) / clipW,
          (m[1] * x + m[5] * y + m[9] * z + m[13]) / clipW
        ];
      }
    } catch(e) {}
  }

  if (!screenPos && map) {
    var p2d = map.project([lng, lat]);
    if (p2d) {
      screenPos = [p2d.x, p2d.y - 20];
    }
  }

  if (screenPos) {
    badge.style.left = Math.round(screenPos[0]) + 'px';
    badge.style.top = Math.round(screenPos[1] - 14) + 'px';
    badge.textContent = window._lastUserFloorName || ('Floor ' + fl);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

window._activeDoorplates = [];

function updateDoorplateSignage() {
  var container = document.getElementById('doorplate-labels');
  if (!container || !map) return;
  var zoom = map.getZoom();
  // Distant View: Zoom < 17.8: completely hide room nameplates to eliminate clutter
  if (zoom < 17.8 || !window._activeDoorplates || window._activeDoorplates.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  var is2D = (currentMapMode === '2D');
  var m = map.transform && map.transform.pixelMatrix;
  var hasMercator = (typeof mapboxgl.MercatorCoordinate !== 'undefined');

  // Dynamic Visibility & Perspective LOD:
  // 17.8 to 19.0: Smooth fade-in
  // >= 19.0: Full opacity and natural distance scaling
  var baseOpacity = zoom >= 19.0 ? 1.0 : Math.max(0.05, (zoom - 17.8) / 1.2);
  var scale = Math.min(1.25, Math.max(0.60, Math.pow(1.5, zoom - 19.0)));

  // Directional Culling: calculate camera horizontal vector
  var bearingRad = (map.getBearing() * Math.PI) / 180;
  var camX = -Math.sin(bearingRad);
  var camY = -Math.cos(bearingRad);

  function projectPoint(pt, elev) {
    if (m && hasMercator && !is2D) {
      try {
        var coord = mapboxgl.MercatorCoordinate.fromLngLat([pt[0], pt[1]], elev);
        var x = coord.x, y = coord.y, z = coord.z;
        var clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
        if (clipW > 0) {
          return [
            (m[0] * x + m[4] * y + m[8] * z + m[12]) / clipW,
            (m[1] * x + m[5] * y + m[9] * z + m[13]) / clipW
          ];
        }
      } catch(e) {}
    }
    if (map.project) {
      var p2d = map.project([pt[0], pt[1]]);
      if (p2d) return [p2d.x, p2d.y];
    }
    return null;
  }

  var existingIds = {};
  for (var i = 0; i < window._activeDoorplates.length; i++) {
    var r = window._activeDoorplates[i];
    existingIds[r.id] = true;
    var el = document.getElementById('dp-lbl-' + r.id);
    if (!el) {
      el = document.createElement('div');
      el.id = 'dp-lbl-' + r.id;
      el.className = 'doorplate-sign';
      el.textContent = r.name;
      el.onclick = (function(roomObj) {
        return function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ROOM_CLICK',
              roomId: roomObj.id,
              name: roomObj.name,
              floorId: roomObj.floorId,
              level: roomObj.level
            }));
          }
        };
      })(r);
      container.appendChild(el);
    }

    // Directional Backface Culling in 3D:
    // When normal · cam > 0.15, door faces away from camera (culled)
    if (!is2D && (r.nx !== undefined && r.ny !== undefined)) {
      var dot = r.nx * camX + r.ny * camY;
      if (dot > 0.15) {
        el.style.display = 'none';
        continue;
      }
    }

    var elev = is2D ? 0.05 : (r.elevation || 2.36);
    var pA = r.ptA ? projectPoint(r.ptA, elev) : null;
    var pB = r.ptB ? projectPoint(r.ptB, elev) : null;
    var centerPos = projectPoint([r.lng, r.lat], elev);

    var screenX = 0, screenY = 0, alpha = 0;
    if (pA && pB) {
      screenX = (pA[0] + pB[0]) / 2;
      screenY = (pA[1] + pB[1]) / 2;
      var dX = pB[0] - pA[0];
      var dY = pB[1] - pA[1];
      alpha = Math.atan2(dY, dX) * 180 / Math.PI;
      if (alpha > 90) alpha -= 180;
      else if (alpha < -90) alpha += 180;
    } else if (centerPos) {
      screenX = centerPos[0];
      screenY = centerPos[1];
      alpha = 0;
    } else {
      el.style.display = 'none';
      continue;
    }

    // Viewport frustum bounds check
    if (screenX >= -80 && screenX <= window.innerWidth + 80 &&
        screenY >= -40 && screenY <= window.innerHeight + 40) {
      el.style.left = Math.round(screenX) + 'px';
      el.style.top = Math.round(screenY) + 'px';
      el.style.transform = 'translate(-50%, -50%) rotate(' + alpha.toFixed(1) + 'deg) scale(' + scale.toFixed(2) + ')';
      el.style.opacity = baseOpacity.toFixed(2);
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }

  var children = container.children;
  for (var c = children.length - 1; c >= 0; c--) {
    var child = children[c];
    var cid = child.id.replace('dp-lbl-', '');
    if (!existingIds[cid]) {
      container.removeChild(child);
    }
  }
}

map.on('render', function() {
  updateBadgePosition();
  updateDoorplateSignage();
});

window.updateUserPos = function(lat, lng, heading, elevation, floorLevel, floorName, hasValidZ) {
  window._lastUserPos = { lat: lat, lng: lng };
  if (heading !== undefined && heading !== null) window._lastUserHeading = heading;
  if (floorLevel !== undefined && floorLevel !== null) window._lastUserFloorLevel = Number(floorLevel);
  if (floorName !== undefined) window._lastUserFloorName = floorName;

  var fl = window._lastUserFloorLevel || 0;
  var h = window._lastUserHeading || 0;

  var effElev;
  if (hasValidZ && elevation !== undefined && elevation !== null && !isNaN(elevation)) {
    effElev = Number(elevation);
  } else if (fl > 0) {
    effElev = fl * 3.5 + 0.54;
  } else {
    effElev = 0.54;
  }
  window._lastUserElev = effElev;

  var baseElev = (currentMapMode === '2D') ? 0.05 : effElev + 0.08;

  setupMarkerLayers();

  if (map.getSource('user-marker-source')) {
    var glowCoords = generateCirclePolygon(lng, lat, 2.2);
    var puckCoords = generateCirclePolygon(lng, lat, 1.2);
    var arrowCoords = generateArrowPolygon(lng, lat, h, 2.0, 1.3);

    map.getSource('user-marker-source').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { part: 'glow', min_height: baseElev + 0.02, height: baseElev + 0.07 },
          geometry: { type: 'Polygon', coordinates: glowCoords }
        },
        {
          type: 'Feature',
          properties: { part: 'puck', min_height: baseElev + 0.07, height: baseElev + 0.22 },
          geometry: { type: 'Polygon', coordinates: puckCoords }
        },
        {
          type: 'Feature',
          properties: { part: 'arrow', min_height: baseElev + 0.23, height: baseElev + 0.35 },
          geometry: { type: 'Polygon', coordinates: arrowCoords }
        }
      ]
    });
  }

  updateBadgePosition();
};

window.updateUserHeading = function(heading) {
  if (heading === undefined || heading === null) return;
  window._lastUserHeading = heading;
  if (!window._lastUserPos) return;

  var lat = window._lastUserPos.lat;
  var lng = window._lastUserPos.lng;
  var fl = window._lastUserFloorLevel || 0;
  var baseElev = (currentMapMode === '2D') ? 0.05 : ((fl > 0 ? fl * 3.5 : 0) + 0.1);

  if (map.getSource('user-marker-source')) {
    var glowCoords = generateCirclePolygon(lng, lat, 2.2);
    var puckCoords = generateCirclePolygon(lng, lat, 1.2);
    var arrowCoords = generateArrowPolygon(lng, lat, heading, 2.0, 1.3);

    map.getSource('user-marker-source').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { part: 'glow', min_height: baseElev + 0.02, height: baseElev + 0.07 },
          geometry: { type: 'Polygon', coordinates: glowCoords }
        },
        {
          type: 'Feature',
          properties: { part: 'puck', min_height: baseElev + 0.07, height: baseElev + 0.22 },
          geometry: { type: 'Polygon', coordinates: puckCoords }
        },
        {
          type: 'Feature',
          properties: { part: 'arrow', min_height: baseElev + 0.23, height: baseElev + 0.35 },
          geometry: { type: 'Polygon', coordinates: arrowCoords }
        }
      ]
    });
  }
};

${initialPos ? `
  map.on('load', function() {
    setupMarkerLayers();
    window.updateUserPos(${initialPos.x}, ${initialPos.y}, 0, 0, 0, '');
  });
` : ''}

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
  const posEngine = useRef(new PositionEngine()).current;
  const panelHeightAnim = useRef(new Animated.Value(SH * 0.45)).current; // Bottom sheet height

  const ambientAltRef = useRef(0);
  const [ambientFloorIndex, setAmbientFloorIndex] = useState(0);

  // ── ALWAYS-ON: Start AmbientFloorDetector when component mounts ──
  useEffect(() => {
    AmbientFloorDetector.isAvailable().then(avail => {
      if (avail) {
        AmbientFloorDetector.start(({ floorIndex, altitudeMeters }) => {
          ambientAltRef.current = altitudeMeters;
          setAmbientFloorIndex(floorIndex);
        });
      }
    }).catch(console.warn);

    return () => AmbientFloorDetector.stop();
  }, []);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ROOM_CLICK') {
        const found = mapData?.rooms?.find(r => (r._id || r.id) === data.roomId);
        if (found) {
          navigation.navigate("Navigation", { room: found, campusId, mapData });
        }
      }
    } catch (e) {
      // ignore non-json
    }
  };

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

  // Subscribe to canonical PositionEngine position updates
  useEffect(() => {
    const unsub = posEngine.onPositionUpdate(pos => {
      setUserPos(prev => ({ ...(prev || {}), ...pos }));
      if (pos.heading) setHeading(pos.heading);
    });
    return unsub;
  }, []);

  // Request location permissions and track user location
  useEffect(() => {
    let locationSubscription = null;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 1 },
        (loc) => {
          posEngine.processGPSUpdate(loc.coords.latitude, loc.coords.longitude, loc.coords.accuracy || 15);
          setUserPos(prev => ({
            ...(prev || {}),
            ...posEngine.position,
            x: loc.coords.latitude,
            y: loc.coords.longitude
          }));
          setHeading(loc.coords.heading || 0);
        }
      );
    })();
    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  // ── Compass heading listener for dynamic arrow rotation ──
  useEffect(() => {
    Magnetometer.setUpdateInterval(100);
    const smoothH = { current: 0 };
    const magSub = Magnetometer.addListener(({ x, y }) => {
      const angle = Math.atan2(y, x) * (180 / Math.PI);
      const normalizedH = (angle + 360) % 360;

      let diff = normalizedH - smoothH.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      if (Math.abs(diff) > 1.0) {
        smoothH.current = (smoothH.current + diff * 0.3 + 360) % 360;
        const h = Math.round(smoothH.current);
        setHeading(h);

        webViewRef.current?.injectJavaScript(`
          if (typeof window.updateUserHeading === 'function') {
            window.updateUserHeading(${h});
          }
          true;
        `);
      }
    });

    return () => {
      magSub?.remove();
    };
  }, []);

  // Push user location updates directly into the WebView via JS
  useEffect(() => {
    if (userPos && webViewRef.current) {
      const currentLevel = (userPos.floorLevel != null)
        ? userPos.floorLevel
        : (ambientFloorIndex || detectedFloorIndex || 0);
      const floorName = userPos.floorLevel != null && userPos.floor
        ? (userPos.floorLevel > 0 ? `Floor ${userPos.floorLevel}` : 'Ground Floor')
        : (currentLevel > 0 ? `Floor ${currentLevel}` : '');
      const hasValidZ = !!(userPos.hasValidElevation && userPos.z !== undefined && userPos.z !== null);
      const elev = hasValidZ
        ? userPos.z
        : (ambientAltRef.current && ambientAltRef.current !== 0 ? ambientAltRef.current : (currentLevel * 3.5 + 0.54));

      webViewRef.current.injectJavaScript(`
        if (typeof window.updateUserPos === 'function') {
          window.updateUserPos(${userPos.x}, ${userPos.y}, ${heading}, ${elev}, ${currentLevel}, '${floorName}', ${hasValidZ ? 'true' : 'false'});
        }
        true;
      `);
    }
  }, [userPos, heading, ambientFloorIndex, detectedFloorIndex]);


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

  const initialUserPosRef = useRef(null);
  if (userPos && !initialUserPosRef.current) {
    initialUserPosRef.current = userPos;
  }
  const mapboxUrl = getCachedConfigValue("EXPO_PUBLIC_MAPBOX_URL", "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidmVua2F0YS1rcmlzaG5hIiwiYSI6ImNtZnYycHN0bTAzY28yanFxeG4wOXVsenAifQ.w1yd6XuvWvarYj33rP1LkA");
  const mapHtml = useMemo(() => {
    const center = mapData?.blocks?.[0]?.shape?.points?.[0];
    return buildCampusMapHTML(geoJSONData, center, mapboxUrl, mapMode, initialUserPosRef.current);
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
      const rooms = mapData?.rooms?.filter(r => 
        r.floorId === selectedFloor._id &&
        r.type !== 'corridor' &&
        !(r.name && r.name.toLowerCase().endsWith(' door') && (r.type === 'entrance' || r.type === 'other'))
      ) || [];
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
              source={{ html: mapHtml, baseUrl: '' }}
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
              onMessage={handleWebViewMessage}
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
