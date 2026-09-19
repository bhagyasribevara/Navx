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
import { PositionEngine, clampPointToPolygon } from "../positioning";
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<style>
  body{margin:0;padding:0;background-color:#e0f2fe;}
  #map{width:100%;height:100vh;background:#e0f2fe;}
  .mapboxgl-ctrl-logo { display: none !important; }
  .mapboxgl-popup { max-width: 200px; }
  .mapboxgl-popup-content { background: rgba(15, 23, 42, 0.9); color: white; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); font-size: 11px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .mapboxgl-popup-tip { border-top-color: rgba(15, 23, 42, 0.9); }
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
</style>
</head><body><div id="map"></div><div id="user-floor-badge" class="floor-badge"></div>
<script>
// Extract mapbox token from the url
const tokenMatch = '${mapboxUrl}'.match(/access_token=([^&]+)/);
mapboxgl.accessToken = tokenMatch ? tokenMatch[1] : 'YOUR_TOKEN_HERE';

var initialStyle = 'mapbox://styles/mapbox/outdoors-v12';

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
    if (map.getSource('mapbox-dem')) {
      map.setTerrain(null);
    }
  } else {
    map.easeTo({ pitch: 60, bearing: -17.6, duration: 600 });
    if (map.getSource('mapbox-dem')) {
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    }
  }

  // 3D layers: visible in 3D, hidden in 2D
  var layers3D = [
    'campus-blocks',
    'campus-blocks-roof-edge',
    'campus-rooms',
    'campus-rooms-corridor',
    'campus-rooms-base',
    'campus-rooms-upper',
    'campus-rooms-partition',
    'campus-rooms-roof',
    'campus-rooms-parapet',
    'campus-rooms-door',
    'doorplate-3d-text-layer',
    '3d-buildings',
    '3d-trees-canopy'
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
};

map.on('load', () => {
  setupMarkerLayers();

  // Add 3D Terrain Digital Elevation Model (DEM) for hills and relief
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      'type': 'raster-dem',
      'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
      'tileSize': 512,
      'maxzoom': 14
    });
  }

  if (currentMapMode !== '2D') {
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  }

  // Add realistic daylight atmospheric sky and horizon fog
  map.setFog({
    'range': [-1, 12],
    'color': '#f0fdf4',
    'horizon-blend': 0.15,
    'high-color': '#38bdf8',
    'space-color': '#0284c7',
    'star-intensity': 0.0
  });

  // Add 3D buildings layer with architectural daylight tones
  if (!map.getLayer('3d-buildings')) {
    map.addLayer({
      'id': '3d-buildings',
      'source': 'composite',
      'source-layer': 'building',
      'filter': ['==', 'extrude', 'true'],
      'type': 'fill-extrusion',
      'minzoom': 15,
      'paint': {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['get', 'height'],
          0, '#f8fafc',
          15, '#e2e8f0',
          30, '#cbd5e1',
          60, '#94a3b8'
        ],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.78
      }
    });
  }

  // Add 3D trees & vegetation canopy for parks, forests, and landscaped campus grounds
  if (!map.getLayer('3d-trees-canopy')) {
    map.addLayer({
      'id': '3d-trees-canopy',
      'source': 'composite',
      'source-layer': 'landuse',
      'filter': ['in', 'class', 'park', 'wood', 'scrub', 'grass', 'pitch', 'garden', 'forest'],
      'type': 'fill-extrusion',
      'minzoom': 14,
      'paint': {
        'fill-extrusion-color': [
          'match',
          ['get', 'class'],
          'wood', '#15803d',
          'forest', '#166534',
          'park', '#22c55e',
          'garden', '#10b981',
          '#16a34a'
        ],
        'fill-extrusion-height': [
          'interpolate', ['linear'], ['zoom'],
          14, 2,
          16, 5,
          18, 8
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.72
      }
    });
  }

  ensureDoorplate3DLayer();

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

  // ── Extract Doorplate Anchors for Physical In-World Room Signage (100% Coverage Pipeline) ──
  var doorplateMap = {};

  // Pass 1: Extract official doorplate features with high-precision anchors
  polyFeatures.forEach(function(f) {
    if (!f.properties) return;
    var props = f.properties;
    if (props.part === 'doorplate' && props.doorLng && props.doorLat) {
      var rid = (props.roomId || props.id || props.name || '').toString().replace('_doorplate', '');
      if (!rid) return;
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
    }
  });

  // Pass 2: Ensure 100% room coverage — for any room missing a doorplate, procedurally compute outward corridor anchor
  polyFeatures.forEach(function(f) {
    if (!f.properties) return;
    var props = f.properties;
    if (props.type === 'room' && props.name && props.category !== 'corridor' && props.category !== 'stairs') {
      var rid = (props.roomId || props.id || props.name || '').toString()
        .replace(/_(base|body|roof|parapet|partition|door|door_frame|door_threshold|part_\d+)$/, '');
      if (!rid || doorplateMap[rid]) return;

      if (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]) {
        var ring = f.geometry.coordinates[0];
        if (ring.length >= 4) {
          var mToLatLoc = 1 / 111139;
          var mToLngLoc = 1 / (111139 * Math.cos(ring[0][1] * Math.PI / 180));

          // Compute room centroid
          var cLng = 0, cLat = 0, ptCount = ring.length - 1;
          for (var pi = 0; pi < ptCount; pi++) {
            cLng += ring[pi][0];
            cLat += ring[pi][1];
          }
          cLng /= Math.max(1, ptCount);
          cLat /= Math.max(1, ptCount);

          // Find longest edge
          var bestEdge = 0, maxLen = -1;
          for (var ei = 0; ei < ring.length - 1; ei++) {
            var edx = (ring[ei+1][0] - ring[ei][0]) / mToLngLoc;
            var edy = (ring[ei+1][1] - ring[ei][1]) / mToLatLoc;
            var elen = Math.hypot(edx, edy);
            if (elen > maxLen) {
              maxLen = elen;
              bestEdge = ei;
            }
          }

          var p1 = ring[bestEdge], p2 = ring[bestEdge+1];
          var midLng = (p1[0] + p2[0]) / 2;
          var midLat = (p1[1] + p2[1]) / 2;
          var lvl = props.level !== undefined ? Number(props.level) : 0;
          var elev = (lvl * 3.5) + 2.36;

          var dx = (p2[0] - p1[0]) / mToLngLoc;
          var dy = (p2[1] - p1[1]) / mToLatLoc;
          var len = Math.hypot(dx, dy) || 1e-6;
          var uX = dx / len, uY = dy / len;
          var nX = -uY, nY = uX;

          // Enforce outward normal relative to room centroid
          var dPlus = Math.hypot((midLng + nX * mToLngLoc) - cLng, (midLat + nY * mToLatLoc) - cLat);
          var dMinus = Math.hypot((midLng - nX * mToLngLoc) - cLng, (midLat - nY * mToLatLoc) - cLat);
          if (dPlus < dMinus) {
            nX = -nX;
            nY = -nY;
          }

          doorplateMap[rid] = {
            id: rid,
            name: props.name,
            lng: midLng,
            lat: midLat,
            elevation: elev,
            ux: uX,
            uy: uY,
            nx: nX,
            ny: nY,
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
  if (typeof updateThreeDoorplates === 'function') updateThreeDoorplates(window._activeDoorplates);

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
          ['==', ['get', 'type'], 'block'], [
            'coalesce',
            ['get', 'color'],
            [
              'match',
              ['get', 'category'],
              'academic', '#93c5fd',
              'hostel', '#c4b5fd',
              'boys_hostel', '#a5b4fc',
              'girls_hostel', '#fbcfe8',
              'library', '#a5f3fc',
              'sports', '#a7f3d0',
              'canteen', '#fde68a',
              'dining', '#fde68a',
              'admin', '#c4b5fd',
              '#93c5fd'
            ]
          ],
          ['coalesce', ['get', 'color'], '#94a3b8']
        ],
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

  // ── 5A. 3D EXTRUSION LAYER FOR BLOCKS (COLORFUL VIBRANT FACILITY ENVELOPE) ──
  if (!map.getLayer('campus-blocks')) {
    map.addLayer({
      'id': 'campus-blocks',
      'type': 'fill-extrusion',
      'source': 'campus-data',
      'filter': ['==', ['get', 'type'], 'block'],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'fill-extrusion-color': [
          'coalesce',
          ['get', 'color'],
          [
            'match',
            ['get', 'category'],
            'academic', '#3b82f6',
            'hostel', '#8b5cf6',
            'boys_hostel', '#6366f1',
            'girls_hostel', '#ec4899',
            'library', '#06b6d4',
            'sports', '#10b981',
            'canteen', '#f59e0b',
            'dining', '#f59e0b',
            'admin', '#8b5cf6',
            '#3b82f6'
          ]
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.70
      }
    }, '3d-buildings');
  }

  if (!map.getLayer('campus-blocks-roof-edge')) {
    map.addLayer({
      'id': 'campus-blocks-roof-edge',
      'type': 'line',
      'source': 'campus-data',
      'filter': ['==', ['get', 'type'], 'block'],
      'layout': { 'visibility': is2D ? 'none' : 'visible' },
      'paint': {
        'line-color': '#ffffff',
        'line-width': 2,
        'line-opacity': 0.8
      }
    });
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
        'text-color': '#0f172a',
        'text-halo-color': '#ffffff',
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
window._doorplateLayerInstance = null;
window._pendingDoorplates = null;

function createDoorplateCanvasTexture(name, isTarget) {
  var canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  var ctx = canvas.getContext('2d');

  // Background: Deep obsidian slate (#0a0f1d, or crimson #881337 for target)
  ctx.fillStyle = isTarget ? '#881337' : '#0a0f1d';
  ctx.fillRect(0, 0, 512, 128);

  // Outer illuminated border (Amber gold #f59e0b, or rose #fb7185 for target)
  ctx.strokeStyle = isTarget ? '#fb7185' : '#f59e0b';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 120);

  // Inner subtle accent frame
  ctx.strokeStyle = isTarget ? '#fda4af' : '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 492, 108);

  // High-contrast, clean, sharp typography
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;

  var text = (name || '').trim();
  var maxUsableWidth = 470;

  function getWidth(str, sz) {
    ctx.font = 'bold ' + sz + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    return ctx.measureText(str).width;
  }

  // Check if single line fits
  var singleFontSize = 46;
  while (singleFontSize > 28 && getWidth(text, singleFontSize) > maxUsableWidth) {
    singleFontSize -= 2;
  }

  if (getWidth(text, singleFontSize) <= maxUsableWidth && singleFontSize >= 30) {
    ctx.font = 'bold ' + singleFontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(text, 256, 64);
  } else {
    // Multi-line wrapping: split into two balanced lines
    var words = text.split(/\s+/);
    var line1 = '', line2 = '';
    if (words.length > 1) {
      var mid = Math.ceil(words.length / 2);
      line1 = words.slice(0, mid).join(' ');
      line2 = words.slice(mid).join(' ');
    } else {
      var splitIdx = Math.floor(text.length / 2);
      line1 = text.slice(0, splitIdx) + '-';
      line2 = text.slice(splitIdx);
    }

    var multiFontSize = 28;
    while (multiFontSize > 18 && (getWidth(line1, multiFontSize) > maxUsableWidth || getWidth(line2, multiFontSize) > maxUsableWidth)) {
      multiFontSize -= 2;
    }

    ctx.font = 'bold ' + multiFontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(line1, 256, 44);
    ctx.fillText(line2, 256, 84);
  }

  var texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

var campusCenter = [${center[1]}, ${center[0]}]; // [lng, lat]
var mToLat = 1 / 111139;
var mToLng = 1 / (111139 * Math.cos(campusCenter[1] * Math.PI / 180));

var doorplate3DLayer = {
  id: 'doorplate-3d-text-layer',
  type: 'custom',
  renderingMode: '3d',
  onAdd: function(mapInstance, gl) {
    this.map = mapInstance;
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas: mapInstance.getCanvas(),
      context: gl,
      antialias: true,
      alpha: true
    });
    this.renderer.autoClear = false;

    var origin = mapboxgl.MercatorCoordinate.fromLngLat(campusCenter, 0);
    this.anchor = {
      x: origin.x,
      y: origin.y,
      z: origin.z,
      scale: origin.meterInMercatorCoordinateUnits()
    };

    window._doorplateLayerInstance = this;
    if (window._pendingDoorplates) {
      window.updateThreeDoorplates(window._pendingDoorplates);
      window._pendingDoorplates = null;
    }
  },
  render: function(gl, matrix) {
    if (!this.renderer || !this.scene || !this.anchor) return;
    var m = new THREE.Matrix4().fromArray(matrix);
    var l = new THREE.Matrix4()
      .makeTranslation(this.anchor.x, this.anchor.y, this.anchor.z)
      .scale(new THREE.Vector3(this.anchor.scale, -this.anchor.scale, this.anchor.scale));

    this.camera.projectionMatrix = m.multiply(l);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }
};

window.updateThreeDoorplates = function(doorplates) {
  window._activeDoorplates = doorplates || [];
  var layer = window._doorplateLayerInstance;
  if (!layer || !layer.scene || !window.THREE) {
    window._pendingDoorplates = doorplates;
    return;
  }

  var scene = layer.scene;
  while (scene.children.length > 0) {
    var obj = scene.children[0];
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
    }
  }

  if (!doorplates || doorplates.length === 0) {
    if (layer.map) layer.map.triggerRepaint();
    return;
  }

  var planeGeo = new THREE.PlaneGeometry(1.15, 0.28);

  doorplates.forEach(function(dp) {
    if (!dp || !dp.name) return;
    var texture = createDoorplateCanvasTexture(dp.name, false);
    var mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
      depthTest: true,
      transparent: true
    });

    var mesh = new THREE.Mesh(planeGeo, mat);

    var posX = (dp.lng - campusCenter[0]) / mToLng;
    var posY = (dp.lat - campusCenter[1]) / mToLat;
    var posZ = dp.elevation !== undefined ? dp.elevation : 2.36;

    var nx = dp.nx !== undefined ? dp.nx : 0;
    var ny = dp.ny !== undefined ? dp.ny : -1;

    // Offset 0.075m outward in normal direction onto the front face of the black slate
    var offsetX = posX + nx * 0.075;
    var offsetY = posY + ny * 0.075;
    var offsetZ = posZ;

    // Proper rotation matrix: Col 1 [-ny, nx, 0], Col 2 [0, 0, 1], Col 3 [nx, ny, 0]
    var transformMat = new THREE.Matrix4();
    transformMat.set(
      -ny, 0, nx, offsetX,
      nx,  0, ny, offsetY,
      0,   1, 0,  offsetZ,
      0,   0, 0,  1
    );

    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(transformMat);
    scene.add(mesh);
  });

  if (layer.map) layer.map.triggerRepaint();
};

function ensureDoorplate3DLayer() {
  if (!map) return;
  if (!map.getLayer('doorplate-3d-text-layer')) {
    if (window.THREE) {
      map.addLayer(doorplate3DLayer);
      if (currentMapMode === '2D') {
        map.setLayoutProperty('doorplate-3d-text-layer', 'visibility', 'none');
      }
    } else {
      setTimeout(ensureDoorplate3DLayer, 100);
    }
  }
}

map.on('render', function() {
  updateBadgePosition();
});

function shortestAngleDiff(current, target) {
  return (((target - current + 540) % 360) - 180);
}

var _markerCurrent = {
  lat: ${initialPos ? initialPos.x : 18.4665},
  lng: ${initialPos ? initialPos.y : 83.6629},
  heading: 0,
  elev: 0.54,
  floorLevel: 0
};
var _markerTarget = {
  lat: ${initialPos ? initialPos.x : 18.4665},
  lng: ${initialPos ? initialPos.y : 83.6629},
  heading: 0,
  elev: 0.54,
  floorLevel: 0
};
var _animatingMarker = false;

function renderUserMarker(lng, lat, heading, effElev, fl) {
  if (!map) return;
  setupMarkerLayers();
  if (!map.getSource('user-marker-source')) return;

  var baseElev = (currentMapMode === '2D') ? 0.05 : effElev + 0.08;
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

  window._lastUserPos = { lat: lat, lng: lng };
  window._lastUserHeading = heading;
  window._lastUserFloorLevel = fl;
  window._lastUserElev = effElev;
  updateBadgePosition();
}

function startMarkerAnimation() {
  if (_animatingMarker) return;
  _animatingMarker = true;

  function step() {
    var posFactor = 0.24;
    var headingFactor = 0.28;
    var elevFactor = 0.22;

    var dLat = _markerTarget.lat - _markerCurrent.lat;
    var dLng = _markerTarget.lng - _markerCurrent.lng;
    var dElev = _markerTarget.elev - _markerCurrent.elev;
    var dHeading = shortestAngleDiff(_markerCurrent.heading, _markerTarget.heading);

    _markerCurrent.lat += dLat * posFactor;
    _markerCurrent.lng += dLng * posFactor;
    _markerCurrent.elev += dElev * elevFactor;
    _markerCurrent.heading = ((_markerCurrent.heading + dHeading * headingFactor) % 360 + 360) % 360;
    _markerCurrent.floorLevel = _markerTarget.floorLevel;

    renderUserMarker(_markerCurrent.lng, _markerCurrent.lat, _markerCurrent.heading, _markerCurrent.elev, _markerCurrent.floorLevel);

    var isMoving = Math.abs(dLat) > 1e-7 || Math.abs(dLng) > 1e-7 || Math.abs(dElev) > 0.01 || Math.abs(dHeading) > 0.2;
    if (isMoving) {
      requestAnimationFrame(step);
    } else {
      _markerCurrent.lat = _markerTarget.lat;
      _markerCurrent.lng = _markerTarget.lng;
      _markerCurrent.elev = _markerTarget.elev;
      _markerCurrent.heading = _markerTarget.heading;
      renderUserMarker(_markerCurrent.lng, _markerCurrent.lat, _markerCurrent.heading, _markerCurrent.elev, _markerCurrent.floorLevel);
      _animatingMarker = false;
    }
  }

  requestAnimationFrame(step);
}

window.updateUserPos = function(lat, lng, heading, elevation, floorLevel, floorName, hasValidZ) {
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return;

  var fl = (floorLevel !== undefined && floorLevel !== null) ? Number(floorLevel) : (window._lastUserFloorLevel || 0);
  if (floorName !== undefined) window._lastUserFloorName = floorName;

  var effElev;
  if (hasValidZ && elevation !== undefined && elevation !== null && !isNaN(elevation)) {
    effElev = Number(elevation);
  } else if (fl > 0) {
    effElev = fl * 3.5 + 0.54;
  } else {
    effElev = 0.54;
  }

  var h = (heading !== undefined && heading !== null && !isNaN(heading)) ? heading : (_markerTarget.heading || 0);

  _markerTarget.lat = Number(lat);
  _markerTarget.lng = Number(lng);
  _markerTarget.heading = Number(h);
  _markerTarget.elev = Number(effElev);
  _markerTarget.floorLevel = fl;

  startMarkerAnimation();
};

window.updateUserHeading = function(heading) {
  if (heading === undefined || heading === null || isNaN(heading)) return;
  _markerTarget.heading = Number(heading);
  startMarkerAnimation();
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

const DOMAIN_CONFIG = {
  'academic blocks': { icon: 'school-outline', color: '#3b82f6', label: 'Academic Blocks' },
  'academic': { icon: 'school-outline', color: '#3b82f6', label: 'Academic' },
  'boys hostels': { icon: 'bed-outline', color: '#8b5cf6', label: 'Boys Hostels' },
  'girls hostels': { icon: 'bed-outline', color: '#ec4899', label: 'Girls Hostels' },
  'hostels': { icon: 'bed-outline', color: '#a855f7', label: 'Hostels' },
  'libraries': { icon: 'library-outline', color: '#06b6d4', label: 'Libraries' },
  'library': { icon: 'library-outline', color: '#06b6d4', label: 'Library' },
  'cafeteria & dining': { icon: 'restaurant-outline', color: '#f59e0b', label: 'Cafeteria & Dining' },
  'cafeteria': { icon: 'restaurant-outline', color: '#f59e0b', label: 'Cafeteria' },
  'dining': { icon: 'restaurant-outline', color: '#f59e0b', label: 'Dining' },
  'canteen': { icon: 'restaurant-outline', color: '#f59e0b', label: 'Canteen' },
  'food': { icon: 'fast-food-outline', color: '#f59e0b', label: 'Food & Dining' },
  'sports & recreation': { icon: 'fitness-outline', color: '#10b981', label: 'Sports & Recreation' },
  'sports': { icon: 'football-outline', color: '#10b981', label: 'Sports' },
  'gym': { icon: 'fitness-outline', color: '#10b981', label: 'Gym & Fitness' },
  'main gates': { icon: 'enter-outline', color: '#14b8a6', label: 'Main Gates' },
  'gates': { icon: 'log-in-outline', color: '#14b8a6', label: 'Gates' },
  'admin': { icon: 'business-outline', color: '#6366f1', label: 'Administration' },
  'administration': { icon: 'business-outline', color: '#6366f1', label: 'Administration' },
  'departments': { icon: 'layers-outline', color: '#6366f1', label: 'Departments' },
  'labs': { icon: 'flask-outline', color: '#0284c7', label: 'Labs' },
  'auditorium': { icon: 'mic-outline', color: '#f43f5e', label: 'Auditorium' },
  'hospital': { icon: 'medkit-outline', color: '#ef4444', label: 'Health Center' },
  'medical': { icon: 'medkit-outline', color: '#ef4444', label: 'Medical' },
  'parking': { icon: 'car-outline', color: '#64748b', label: 'Parking' },
};

function getDomainConfig(domainName) {
  if (!domainName) return { icon: 'business-outline', color: '#6366f1' };
  const lower = String(domainName).toLowerCase().trim();
  if (DOMAIN_CONFIG[lower]) return DOMAIN_CONFIG[lower];
  for (const [key, val] of Object.entries(DOMAIN_CONFIG)) {
    if (lower.includes(key)) return val;
  }
  return { icon: 'business-outline', color: '#6366f1' };
}

export default function MapScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const { activeCampusId: contextCampusId, detectedFloorIndex, setCurrentFloorId } = useGeofence();
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [campusId, setCampusId] = useState(route.params?.campusId || contextCampusId || null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
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
      setSelectedCategory(null);
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
      setSelectedCategory(null);
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
      setSelectedCategory(null);
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

      let processedX = userPos.x;
      let processedY = userPos.y;

      // Indoor building footprint clamping: prevent marker from drifting outside block
      if (currentLevel > 0 && geoJSONData?.features) {
        const blockFeatures = geoJSONData.features.filter(f =>
          f.geometry?.type === 'Polygon' &&
          (f.properties?.type === 'block' || f.properties?.type === 'building')
        );
        for (const feature of blockFeatures) {
          const coords = feature.geometry?.coordinates?.[0];
          if (coords && coords.length >= 3) {
            const clamped = clampPointToPolygon(processedX, processedY, coords);
            processedX = clamped.lat;
            processedY = clamped.lng;
            break;
          }
        }
      }

      const hasValidZ = !!(userPos.hasValidElevation && userPos.z !== undefined && userPos.z !== null);
      const elev = hasValidZ
        ? userPos.z
        : (ambientAltRef.current && ambientAltRef.current !== 0 ? ambientAltRef.current : (currentLevel * 3.5 + 0.54));

      webViewRef.current.injectJavaScript(`
        if (typeof window.updateUserPos === 'function') {
          window.updateUserPos(${processedX}, ${processedY}, ${heading}, ${elev}, ${currentLevel}, '${floorName}', ${hasValidZ ? 'true' : 'false'});
        }
        true;
      `);
    }
  }, [userPos, heading, ambientFloorIndex, detectedFloorIndex, geoJSONData]);


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
    } else if (selectedCategory) {
      setSelectedCategory(null);
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
    title: { fontSize: 19, fontWeight: "800", color: colors.text, marginLeft: 12, flex: 1 },
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
    navBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700", marginLeft: 6 },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 14,
    },
    categoryBox: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 124,
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    categoryIconBox: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    categoryName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
      lineHeight: 20,
    },
    categoryFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 'auto',
    },
    categoryCount: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSec,
    },
    categorySectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textSec,
      marginBottom: 14,
      marginLeft: 2,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    categoryHeaderInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingHorizontal: 2,
    },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      gap: 6,
    },
    categoryPillText: {
      fontSize: 12,
      fontWeight: '700',
    },
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

    // ── Drill-down: If a category box is selected, show its facilities ──
    if (selectedCategory && domains[selectedCategory]) {
      const catConfig = getDomainConfig(selectedCategory);
      return (
        <View>
          <View style={s.categoryHeaderInfo}>
            <View style={[s.categoryPill, { backgroundColor: catConfig.color + '15', borderColor: catConfig.color + '35' }]}>
              <Ionicons name={catConfig.icon} size={15} color={catConfig.color} />
              <Text style={[s.categoryPillText, { color: catConfig.color }]}>
                {domains[selectedCategory].length} {domains[selectedCategory].length === 1 ? 'facility' : 'facilities'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setSelectedCategory(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>All Categories</Text>
            </TouchableOpacity>
          </View>

          {domains[selectedCategory].map(block => (
            <TouchableOpacity key={block._id} style={s.card} activeOpacity={0.7} onPress={() => handleBlockSelect(block)}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View style={[s.cardIcon, { backgroundColor: catConfig.color + '18' }]}>
                  <Ionicons name={catConfig.icon} size={20} color={catConfig.color} />
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.cardTitle}>{block.name}</Text>
                  <Text style={s.cardMeta}>Tap to zoom & browse floors</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    // ── Main Category Overview: Small Boxes Grid ──
    const domainKeys = Object.keys(domains);

    return (
      <View>
        <Text style={s.categorySectionLabel}>
          Explore by Category ({domainKeys.length})
        </Text>
        <View style={s.categoryGrid}>
          {domainKeys.map(domain => {
            const config = getDomainConfig(domain);
            const count = domains[domain].length;
            return (
              <TouchableOpacity
                key={domain}
                style={s.categoryBox}
                activeOpacity={0.75}
                onPress={() => setSelectedCategory(domain)}
              >
                <View style={[s.categoryIconBox, { backgroundColor: config.color + '18' }]}>
                  <Ionicons name={config.icon} size={22} color={config.color} />
                </View>
                <Text style={s.categoryName} numberOfLines={2}>{domain}</Text>
                <View style={s.categoryFooter}>
                  <Text style={s.categoryCount}>{count} {count === 1 ? 'place' : 'places'}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
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
              style={{ flex: 1, backgroundColor: '#e0f2fe' }}
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
          {(selectedBlock || selectedFloor || showingRestroomsMode || selectedCategory) ? (
            <TouchableOpacity style={s.backBtn} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={s.title} numberOfLines={1}>
            {showingRestroomsMode
              ? "Nearest Restrooms"
              : selectedFloor
              ? selectedFloor.name
              : selectedBlock
              ? selectedBlock.name
              : selectedCategory
              ? selectedCategory
              : "Campus Directory"}
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
