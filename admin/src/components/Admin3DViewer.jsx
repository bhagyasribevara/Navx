import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FiX, FiLayers, FiInfo, FiChevronDown, FiChevronRight, FiEye, FiEyeOff, FiBox, FiGlobe, FiSidebar, FiHash } from 'react-icons/fi';
import { updateNode, updatePath, createNode, createPath, deleteNode, deletePath } from '../api';

const FLOOR_HEIGHT = 3.5;
const NODE_HOVER_HEIGHT = 0.5;

export default function Admin3DViewer({ blocks, floors, rooms, nodes, paths, campus, activeFloor, mapboxUrl, onRefresh }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [elevationLevel, setElevationLevel] = useState(0);

  const [drawMode, setDrawMode] = useState('select');
  const [pathStartNode, setPathStartNode] = useState(null);
  const [targetFloorId, setTargetFloorId] = useState(activeFloor?._id || (floors[0]?._id || ''));

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [activeFloorId, setActiveFloorId] = useState(null);
  const [visibleFloors, setVisibleFloors] = useState(new Set());
  const [showCampusNodes, setShowCampusNodes] = useState(true);

  const drawModeRef = useRef(drawMode);
  const pathStartNodeRef = useRef(pathStartNode);
  const targetFloorIdRef = useRef(targetFloorId);
  const activeBlockIdRef = useRef(activeBlockId);
  const campusRef = useRef(campus);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { pathStartNodeRef.current = pathStartNode; }, [pathStartNode]);
  useEffect(() => { targetFloorIdRef.current = targetFloorId; }, [targetFloorId]);
  useEffect(() => { activeBlockIdRef.current = activeBlockId; }, [activeBlockId]);
  useEffect(() => { campusRef.current = campus; }, [campus]);

  useEffect(() => {
    if (activeFloor) setTargetFloorId(activeFloor._id);
  }, [activeFloor]);

  const categorizedTree = useMemo(() => {
    const categories = {};
    blocks.forEach(b => {
      const domain = b.domain || 'Uncategorized';
      if (!categories[domain]) { categories[domain] = { name: domain, blocks: [] }; }
      const blockFloors = floors
        .filter(f => (f.blockId?._id || f.blockId) === b._id)
        .sort((a, c) => (a.level || 0) - (c.level || 0));
      const floorData = blockFloors.map(f => {
        const floorNodes = nodes.filter(n => (n.floorId?._id || n.floorId) === f._id);
        const floorPaths = paths.filter(p => (p.floorId?._id || p.floorId) === f._id);
        return { ...f, nodeCount: floorNodes.length, pathCount: floorPaths.length };
      });
      categories[domain].blocks.push({ ...b, floors: floorData });
    });
    const campusNodes = nodes.filter(n => !n.floorId);
    const campusPaths = paths.filter(p => !p.floorId);
    return { categories: Object.values(categories), campusNodeCount: campusNodes.length, campusPathCount: campusPaths.length };
  }, [blocks, floors, nodes, paths]);

  useEffect(() => {
    if (floors.length > 0 && visibleFloors.size === 0) {
      setVisibleFloors(new Set(floors.map(f => f._id)));
      const expCats = {}; categorizedTree.categories.forEach(c => { expCats[c.name] = true; });
      setExpandedCategories(expCats);
      const expBlocks = {}; blocks.forEach(b => { expBlocks[b._id] = true; });
      setExpandedBlocks(expBlocks);
    }
  }, [floors, blocks, categorizedTree.categories]);

  const getNodeLevel = (n) => {
    if (n.floorLevel !== undefined && n.floorLevel !== null) return n.floorLevel;
    if (n.floorId) {
      const fId = typeof n.floorId === 'object' ? n.floorId._id : n.floorId;
      const floor = floors.find(f => f._id === fId);
      if (floor) return floor.level;
    }
    return 0;
  };

  const isNodeVisible = useCallback((n) => {
    const fId = n.floorId?._id || n.floorId;
    if (!fId) return showCampusNodes;
    return visibleFloors.has(fId);
  }, [visibleFloors, showCampusNodes]);

  useEffect(() => {
    if (map.current) return;
    const tokenMatch = mapboxUrl.match(/access_token=([^&]+)/);
    mapboxgl.accessToken = tokenMatch ? tokenMatch[1] : 'YOUR_TOKEN_HERE';

    const center = campus?.location ? [campus.location.lng, campus.location.lat] : [83.6629, 18.4665];
    let prevView = { bearing: -17.6, pitch: 60, zoom: 18 };

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: center,
      zoom: 18,
      pitch: 60,
      bearing: -17.6,
      antialias: true
    });

    map.current.on('moveend', (e) => {
      if (e.originalEvent && map.current) {
        const currentP = map.current.getPitch();
        if (currentP > 5) {
          prevView = { bearing: map.current.getBearing(), pitch: currentP, zoom: map.current.getZoom() };
        }
      }
    });

    map.current.on('pitch', () => {
      if (!map.current) return;
      const pitch = map.current.getPitch();
      if (map.current.getLayer('campus-polygons-fill')) {
        map.current.setPaintProperty('campus-polygons-fill', 'fill-opacity', pitch === 0 ? 0.6 : 0.1);
      }
      if (map.current.getLayer('campus-polygons-line')) {
        map.current.setPaintProperty('campus-polygons-line', 'line-opacity', pitch === 0 ? 0.8 : 0.2);
      }
    });

    map.current.on('load', () => {
      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      setTimeout(() => {
        const compassBtn = mapContainer.current?.querySelector('.mapboxgl-ctrl-compass');
        if (compassBtn && map.current) {
          compassBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!map.current) return;
            const currentBearing = map.current.getBearing();
            const currentPitch = map.current.getPitch();
            if (Math.abs(currentBearing) > 0.5 || Math.abs(currentPitch - 60) > 0.5) {
              map.current.easeTo({ bearing: 0, pitch: 60, duration: 800 });
            } else {
              map.current.easeTo({ bearing: prevView.bearing, pitch: prevView.pitch, zoom: prevView.zoom, duration: 800 });
            }
          }, true);

          const parentGroup = compassBtn.parentNode;
          if (parentGroup) {
            const topViewBtn = document.createElement('button');
            topViewBtn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-topview';
            topViewBtn.type = 'button';
            topViewBtn.title = 'Top-down Flat 2D View';
            topViewBtn.style.display = 'flex'; topViewBtn.style.alignItems = 'center'; topViewBtn.style.justifyContent = 'center';
            topViewBtn.style.width = '29px'; topViewBtn.style.height = '29px'; topViewBtn.style.border = 'none'; topViewBtn.style.background = 'none'; topViewBtn.style.cursor = 'pointer';
            topViewBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #4b5563;"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`;
            topViewBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (map.current) { map.current.easeTo({ bearing: 0, pitch: 0, duration: 800 }); } });
            parentGroup.appendChild(topViewBtn);
          }
        }
      }, 100);

      map.current.addLayer({
        'id': '3d-buildings', 'source': 'composite', 'source-layer': 'building', 'filter': ['==', 'extrude', 'true'], 'type': 'fill-extrusion', 'minzoom': 15,
        'paint': { 'fill-extrusion-color': '#1f2937', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.6 }
      });

      renderCampusData();
    });

    map.current.on('click', async (e) => {
      const mode = drawModeRef.current;
      
      if (mode === 'addNode') {
        const floorId = targetFloorIdRef.current;
        if (!floorId) { alert('Please select a target floor in the toolbar first!'); return; }
        const latlng = e.lngLat;
        try {
          const selectedFloor = floors.find(f => f._id === floorId);
          const floorLevel = selectedFloor ? selectedFloor.level : 0;
          await createNode({
            floorId, blockId: activeBlockIdRef.current || (selectedFloor ? (selectedFloor.blockId?._id || selectedFloor.blockId) : null),
            campusId: campusRef.current?._id, x: latlng.lat, y: latlng.lng, type: 'waypoint', label: 'Node', floorLevel: floorLevel
          });
          if (onRefresh) onRefresh();
        } catch (err) { alert("Failed to create node."); }
        return;
      }

      const queryLayers = ['nodes-layer', 'paths-layer', 'cross-floor-paths-layer', 'campus-polygons-layer'].filter(l => map.current.getLayer(l));
      const features = map.current.queryRenderedFeatures(e.point, { layers: queryLayers });

      if (features.length > 0) {
        const nodeFeat = features.find(f => f.layer.id === 'nodes-layer');
        const pathFeat = features.find(f => f.layer.id === 'paths-layer' || f.layer.id === 'cross-floor-paths-layer');
        const polyFeat = features.find(f => f.layer.id === 'campus-polygons-layer');

        if (nodeFeat) {
          const props = JSON.parse(nodeFeat.properties.rawData);
          if (mode === 'addPath') {
            const startNode = pathStartNodeRef.current;
            if (!startNode) { setPathStartNode(props); }
            else {
              if (startNode._id === props._id) { alert("Start and destination node cannot be the same!"); return; }
              try {
                const isCrossFloor = startNode.floorId !== props.floorId;
                const assignedFloor = isCrossFloor ? null : (startNode.floorId?._id || startNode.floorId);
                await createPath({ nodeA: startNode._id, nodeB: props._id, floorId: assignedFloor, campusId: campusRef.current?._id, bidirectional: true, type: isCrossFloor ? 'stairs' : 'hallway' });
                setPathStartNode(null); if (onRefresh) onRefresh();
              } catch (err) { alert("Failed to create path."); }
            }
          } else {
            setSelectedEntity({ type: 'node', data: props }); setElevationLevel(getNodeLevel(props)); setIsSidebarOpen(true);
          }
        } else if (pathFeat && mode === 'select') {
          const props = JSON.parse(pathFeat.properties.rawData); setSelectedEntity({ type: 'path', data: props }); setIsSidebarOpen(true);
        } else if (polyFeat) {
          if (polyFeat.properties.isBlock || polyFeat.properties.isRoom) { setActiveBlockId(polyFeat.properties.blockId); }
          if (mode === 'select') setSelectedEntity(null);
        }
      } else {
        if (mode === 'select') setSelectedEntity(null);
        if (mode === 'addPath') setPathStartNode(null);
      }
    });

    map.current.on('mouseenter', 'nodes-layer', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    map.current.on('mouseleave', 'nodes-layer', () => { map.current.getCanvas().style.cursor = ''; });
    map.current.on('mouseenter', 'paths-layer', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    map.current.on('mouseleave', 'paths-layer', () => { map.current.getCanvas().style.cursor = ''; });
    map.current.on('mouseenter', 'cross-floor-paths-layer', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    map.current.on('mouseleave', 'cross-floor-paths-layer', () => { map.current.getCanvas().style.cursor = ''; });
    map.current.on('mouseenter', 'campus-polygons-layer', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    map.current.on('mouseleave', 'campus-polygons-layer', () => { map.current.getCanvas().style.cursor = ''; });

  }, [mapboxUrl, campus]);

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) { renderCampusData(); }
  }, [blocks, floors, rooms, nodes, paths, activeBlockId, activeFloorId, visibleFloors, showCampusNodes, selectedEntity, pathStartNode]);

  const generateLinePolygon = (pA, pB, widthDeg) => {
    const dx = pB.x - pA.x; const dy = pB.y - pA.y;
    const L = Math.sqrt(dx*dx + dy*dy);
    if (L === 0) return null;
    const nx = -dy/L * widthDeg; const ny = dx/L * widthDeg;
    return [[pA.y + ny, pA.x + nx], [pA.y - ny, pA.x - nx], [pB.y - ny, pB.x - nx], [pB.y + ny, pB.x + nx], [pA.y + ny, pA.x + nx]];
  };

  const generateNodePolygon = (center, radiusDeg) => {
    return [
      [center.y - radiusDeg, center.x - radiusDeg], [center.y + radiusDeg, center.x - radiusDeg],
      [center.y + radiusDeg, center.x + radiusDeg], [center.y - radiusDeg, center.x + radiusDeg],
      [center.y - radiusDeg, center.x - radiusDeg]
    ];
  };

  const renderCampusData = () => {
    if (!map.current) return;

    const blockFeatures = [];
    const roomFeatures = [];
    
    blocks.forEach(b => {
      if (b.shape && b.shape.points && b.shape.points.length > 0) {
        const coords = b.shape.points.map(p => [p.y, p.x]);
        coords.push([b.shape.points[0].y, b.shape.points[0].x]);
        const isActiveBlock = activeBlockId === b._id;
        blockFeatures.push({
          type: 'Feature',
          properties: { isBlock: true, blockId: b._id, color: isActiveBlock ? '#4f46e5' : (b.color || '#475569'), min_height: 0, height: 2, opacity: activeFloorId ? 0.3 : 0.7 },
          geometry: { type: 'Polygon', coordinates: [coords] }
        });
      }
    });

    rooms.forEach(r => {
      if (r.shape && r.shape.points && r.shape.points.length > 0) {
        const rBlockId = (r.blockId && r.blockId._id) ? r.blockId._id : r.blockId;
        const rFloorId = r.floorId?._id || r.floorId;
        
        let isFloorVisible = false;
        let isActiveFloor = activeFloorId === rFloorId;
        
        if (r.type === 'stairs') {
          const config = r.stairsConfig || {};
          const startId = config.startFloorId?._id || config.startFloorId || rFloorId;
          const endId = config.endFloorId?._id || config.endFloorId;
          if (visibleFloors.has(startId) || (endId && visibleFloors.has(endId)) || (rFloorId && visibleFloors.has(rFloorId))) {
            isFloorVisible = true;
          }
          if (activeFloorId === startId || activeFloorId === endId || activeFloorId === rFloorId) {
            isActiveFloor = true;
          }
        } else {
          isFloorVisible = rFloorId ? visibleFloors.has(rFloorId) : true;
        }

        if (!isFloorVisible) return;

        const roomOpacity = activeFloorId ? (isActiveFloor ? 0.85 : 0.12) : 0.7;

        if (r.type === 'stairs' && r.shape.points.length >= 3) {
          const config = r.stairsConfig || {};
          const startFloor = floors.find(f => f._id === (config.startFloorId?._id || config.startFloorId || rFloorId));
          const endFloor = floors.find(f => f._id === (config.endFloorId?._id || config.endFloorId));
          
          const floorBaseStart = startFloor ? startFloor.level * FLOOR_HEIGHT : 0;
          const floorBaseEnd = endFloor ? endFloor.level * FLOOR_HEIGHT : floorBaseStart + FLOOR_HEIGHT;

          if (r.shape.points.length < 4 || config.stairType === 'simple' || !config.stepCount) {
             const coords = r.shape.points.map(p => [p.y, p.x]); coords.push([r.shape.points[0].y, r.shape.points[0].x]);
             roomFeatures.push({
              type: 'Feature',
              properties: { isRoom: true, isStairs: true, blockId: rBlockId || '', color: r.color || '#f97316', min_height: floorBaseStart, height: Math.max(floorBaseStart + 0.1, floorBaseEnd), opacity: roomOpacity },
              geometry: { type: 'Polygon', coordinates: [coords] }
            });
          } else {
            const pts = r.shape.points;
            const p1 = pts[0]; const p2 = pts[1]; const p3 = pts[2]; const p4 = pts[3];
            const len12 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            const len23 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
            const len34 = Math.sqrt(Math.pow(p3.x - p4.x, 2) + Math.pow(p3.y - p4.y, 2));
            const len41 = Math.sqrt(Math.pow(p4.x - p1.x, 2) + Math.pow(p4.y - p1.y, 2));
            const N = config.stepCount || 15;
            const scale = config.stairWidthScale !== undefined ? config.stairWidthScale : 1.0;
            const direction = config.stairDirection || 'auto';
            const invert = config.invertSlope || false;
            let is1to3 = true;
            if (direction === 'auto') is1to3 = (len23 + len41) >= (len12 + len34);
            else if (direction === 'transverse') is1to3 = false;
            const heightDiff = floorBaseEnd - floorBaseStart;
            const startPct = config.startHeightPct !== undefined ? config.startHeightPct / 100 : 0.0;
            const endPct = config.endHeightPct !== undefined ? config.endHeightPct / 100 : 1.0;
            const zStart = floorBaseStart + startPct * heightDiff;
            const zEnd = floorBaseStart + endPct * heightDiff;
            for (let i = 0; i < N; i++) {
              const tStart = i / N; const tEnd = (i + 1) / N; let c1, c2, c3, c4;
              if (is1to3) {
                const xStartLeft = p1.x + (p4.x - p1.x) * tStart, yStartLeft = p1.y + (p4.y - p1.y) * tStart;
                const xStartRight = p2.x + (p3.x - p2.x) * tStart, yStartRight = p2.y + (p3.y - p2.y) * tStart;
                const xEndLeft = p1.x + (p4.x - p1.x) * tEnd, yEndLeft = p1.y + (p4.y - p1.y) * tEnd;
                const xEndRight = p2.x + (p3.x - p2.x) * tEnd, yEndRight = p2.y + (p3.y - p2.y) * tEnd;
                const xStartCenter = (xStartLeft + xStartRight) / 2, yStartCenter = (yStartLeft + yStartRight) / 2;
                const xEndCenter = (xEndLeft + xEndRight) / 2, yEndCenter = (yEndLeft + yEndRight) / 2;
                c1 = [yStartCenter + (yStartLeft - yStartCenter) * scale, xStartCenter + (xStartLeft - xStartCenter) * scale];
                c2 = [yStartCenter + (yStartRight - yStartCenter) * scale, xStartCenter + (xStartRight - xStartCenter) * scale];
                c3 = [yEndCenter + (yEndRight - yEndCenter) * scale, xEndCenter + (xEndRight - xEndCenter) * scale];
                c4 = [yEndCenter + (yEndLeft - yEndCenter) * scale, xEndCenter + (xEndLeft - xEndCenter) * scale];
              } else {
                const xStartBottom = p1.x + (p2.x - p1.x) * tStart, yStartBottom = p1.y + (p2.y - p1.y) * tStart;
                const xStartTop = p4.x + (p3.x - p4.x) * tStart, yStartTop = p4.y + (p3.y - p4.y) * tStart;
                const xEndBottom = p1.x + (p2.x - p1.x) * tEnd, yEndBottom = p1.y + (p2.y - p1.y) * tEnd;
                const xEndTop = p4.x + (p3.x - p4.x) * tEnd, yEndTop = p4.y + (p3.y - p4.y) * tEnd;
                const xStartCenter = (xStartBottom + xStartTop) / 2, yStartCenter = (yStartBottom + yStartTop) / 2;
                const xEndCenter = (xEndBottom + xEndTop) / 2, yEndCenter = (yEndBottom + yEndTop) / 2;
                c1 = [yStartCenter + (yStartBottom - yStartCenter) * scale, xStartCenter + (xStartBottom - xStartCenter) * scale];
                c2 = [yEndCenter + (yEndBottom - yEndCenter) * scale, xEndCenter + (xEndBottom - xEndCenter) * scale];
                c3 = [yEndCenter + (yEndTop - yEndCenter) * scale, xEndCenter + (xEndTop - xEndCenter) * scale];
                c4 = [yStartCenter + (yStartTop - yStartCenter) * scale, xStartCenter + (xStartTop - xStartCenter) * scale];
              }
              const stepMinH = invert ? zEnd - (i * (zEnd - zStart)) / N : zStart + (i * (zEnd - zStart)) / N;
              const stepMaxH = invert ? zEnd - ((i + 1) * (zEnd - zStart)) / N : zStart + ((i + 1) * (zEnd - zStart)) / N;
              roomFeatures.push({
                type: 'Feature',
                properties: { isRoom: true, isStairs: true, blockId: rBlockId || '', color: r.color || '#f97316', min_height: Math.min(stepMinH, stepMaxH), height: Math.max(stepMinH, stepMaxH) + 0.05, opacity: roomOpacity },
                geometry: { type: 'Polygon', coordinates: [[c1, c2, c3, c4, c1]] }
              });
            }
          }
        } else {
          const floor = floors.find(f => f._id === rFloorId);
          const minH = (floor ? floor.level : 0) * FLOOR_HEIGHT;
          const coords = r.shape.points.map(p => [p.y, p.x]); coords.push([r.shape.points[0].y, r.shape.points[0].x]);
          roomFeatures.push({
            type: 'Feature',
            properties: { isRoom: true, blockId: rBlockId || '', color: r.color || '#3b82f6', min_height: minH, height: minH + 3.0, opacity: roomOpacity },
            geometry: { type: 'Polygon', coordinates: [coords] }
          });
        }
      }
    });

    const polySource = map.current.getSource('campus-polygons');
    const polyData = { type: 'FeatureCollection', features: [...blockFeatures, ...roomFeatures] };
    if (polySource) polySource.setData(polyData);
    else {
      map.current.addSource('campus-polygons', { type: 'geojson', data: polyData });
      map.current.addLayer({ id: 'campus-polygons-fill', type: 'fill', source: 'campus-polygons', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': map.current.getPitch() === 0 ? 0.6 : 0.1 } });
      map.current.addLayer({ id: 'campus-polygons-line', type: 'line', source: 'campus-polygons', paint: { 'line-color': '#1f2937', 'line-width': 1.5, 'line-opacity': map.current.getPitch() === 0 ? 0.8 : 0.2 } });
      map.current.addLayer({
        id: 'campus-polygons-layer', type: 'fill-extrusion', source: 'campus-polygons',
        paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': ['coalesce', ['get', 'opacity'], 0.7] }
      });
    }

    const pathFeatures = [];
    const crossFloorPathFeatures = [];
    
    paths.forEach(p => {
      const a = nodes.find(n => n._id === p.nodeA);
      const b = nodes.find(n => n._id === p.nodeB);
      if (a && b) {
        const aVisible = isNodeVisible(a);
        const bVisible = isNodeVisible(b);
        const aFloorId = a.floorId?._id || a.floorId;
        const bFloorId = b.floorId?._id || b.floorId;
        const isCrossFloor = aFloorId !== bFloorId;

        const hA = getNodeLevel(a) * FLOOR_HEIGHT + NODE_HOVER_HEIGHT;
        const hB = getNodeLevel(b) * FLOOR_HEIGHT + NODE_HOVER_HEIGHT;

        const aOnActive = activeFloorId === aFloorId;
        const bOnActive = activeFloorId === bFloorId;
        const isHighlighted = !activeFloorId || aOnActive || bOnActive;
        const isSelected = selectedEntity?.data?._id === p._id;
        
        const pathColor = isSelected ? '#3b82f6' : (isCrossFloor ? '#f59e0b' : (isHighlighted ? '#c084fc' : '#4b556350'));
        
        if (isCrossFloor) {
          if (aVisible || bVisible) {
            const N = 15; // segments
            const dx = b.x - a.x; const dy = b.y - a.y;
            for (let i = 0; i < N; i++) {
              const tStart = i/N; const tEnd = (i+1)/N;
              const pStart = { x: a.x + dx*tStart, y: a.y + dy*tStart };
              const pEnd = { x: a.x + dx*tEnd, y: a.y + dy*tEnd };
              const poly = generateLinePolygon(pStart, pEnd, 0.000008);
              if (poly) {
                const zStart = hA + (hB - hA)*tStart;
                const zEnd = hA + (hB - hA)*tEnd;
                const min_h = Math.min(zStart, zEnd);
                const max_h = Math.max(zStart, zEnd);
                crossFloorPathFeatures.push({
                  type: 'Feature',
                  properties: { id: p._id, rawData: JSON.stringify(p), color: pathColor, min_height: min_h, height: max_h + 0.1 },
                  geometry: { type: 'Polygon', coordinates: [poly] }
                });
              }
            }
          }
        } else {
          if (aVisible && bVisible) {
            const poly = generateLinePolygon(a, b, 0.00001);
            if (poly) {
              pathFeatures.push({
                type: 'Feature',
                properties: { id: p._id, rawData: JSON.stringify(p), color: pathColor, min_height: hA, height: hA + 0.1 },
                geometry: { type: 'Polygon', coordinates: [poly] }
              });
            }
          }
        }
      }
    });

    const pathsSource = map.current.getSource('campus-paths');
    if (pathsSource) {
      pathsSource.setData({ type: 'FeatureCollection', features: pathFeatures });
    } else {
      map.current.addSource('campus-paths', { type: 'geojson', data: { type: 'FeatureCollection', features: pathFeatures } });
      map.current.addLayer({
        id: 'paths-layer', type: 'fill-extrusion', source: 'campus-paths',
        paint: {
          'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.9
        }
      });
    }

    const crossPathsSource = map.current.getSource('campus-cross-paths');
    if (crossPathsSource) {
      crossPathsSource.setData({ type: 'FeatureCollection', features: crossFloorPathFeatures });
    } else {
      map.current.addSource('campus-cross-paths', { type: 'geojson', data: { type: 'FeatureCollection', features: crossFloorPathFeatures } });
      map.current.addLayer({
        id: 'cross-floor-paths-layer', type: 'fill-extrusion', source: 'campus-cross-paths',
        paint: {
          'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.8
        }
      });
    }

    const nodeFeatures = [];
    nodes.forEach(n => {
      if (!isNodeVisible(n)) return;
      const h = getNodeLevel(n) * FLOOR_HEIGHT + NODE_HOVER_HEIGHT;
      const nFloorId = n.floorId?._id || n.floorId;
      const isOnActiveFloor = activeFloorId ? activeFloorId === nFloorId : true;
      const isStartNode = pathStartNode?._id === n._id;
      const isSelected = selectedEntity?.data?._id === n._id;
      
      const nodeColor = isStartNode ? '#eab308' : (isSelected ? '#3b82f6' : (isOnActiveFloor ? '#22c55e' : '#4b5563'));
      const opacity = isOnActiveFloor ? 1 : 0.4;
      const radius = (isStartNode || isSelected) ? 0.00003 : 0.00002;
      const poly = generateNodePolygon(n, radius);

      nodeFeatures.push({
        type: 'Feature',
        properties: { id: n._id, rawData: JSON.stringify(n), color: nodeColor, min_height: h, height: h + 0.3, opacity },
        geometry: { type: 'Polygon', coordinates: [poly] }
      });
    });

    const nodesSource = map.current.getSource('campus-nodes');
    if (nodesSource) {
      nodesSource.setData({ type: 'FeatureCollection', features: nodeFeatures });
    } else {
      map.current.addSource('campus-nodes', { type: 'geojson', data: { type: 'FeatureCollection', features: nodeFeatures } });
      map.current.addLayer({
        id: 'nodes-layer', type: 'fill-extrusion', source: 'campus-nodes',
        paint: {
          'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': ['coalesce', ['get', 'opacity'], 1.0]
        }
      });
    }

    const labelFeatures = [];
    const blockCentroids = {};
    blocks.forEach(b => {
      if (b.shape && b.shape.points && b.shape.points.length > 0) {
        blockCentroids[b._id] = { x: b.shape.points.reduce((s, p) => s + p.x, 0) / b.shape.points.length, y: b.shape.points.reduce((s, p) => s + p.y, 0) / b.shape.points.length };
      }
    });

    floors.forEach(f => {
      const centroid = blockCentroids[f.blockId?._id || f.blockId];
      if (!centroid || !visibleFloors.has(f._id)) return;
      labelFeatures.push({
        type: 'Feature',
        properties: { label: f.name, isActive: activeFloorId === f._id },
        geometry: { type: 'Point', coordinates: [centroid.y, centroid.x, (f.level || 0) * FLOOR_HEIGHT + 1.5] }
      });
    });

    const labelsSource = map.current.getSource('floor-labels');
    if (labelsSource) labelsSource.setData({ type: 'FeatureCollection', features: labelFeatures });
    else {
      map.current.addSource('floor-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: labelFeatures } });
      map.current.addLayer({
        id: 'floor-labels-layer', type: 'symbol', source: 'floor-labels',
        layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-anchor': 'center' },
        paint: { 'text-color': ['case', ['get', 'isActive'], '#22c55e', '#9ca3af'], 'text-halo-color': '#111827', 'text-halo-width': 2, 'text-opacity': ['case', ['get', 'isActive'], 1, 0.6] }
      });
    }
  };

  const handleSaveElevation = async () => {
    if (!selectedEntity || selectedEntity.type !== 'node') return;
    try {
      await updateNode(selectedEntity.data._id, { floorLevel: parseInt(elevationLevel) });
      const nodeObj = nodes.find(n => n._id === selectedEntity.data._id);
      if (nodeObj) { nodeObj.floorLevel = parseInt(elevationLevel); renderCampusData(); }
      alert('Node elevation saved!');
    } catch (err) { alert('Failed to save elevation.'); }
  };

  const handleDeleteEntity = async () => {
    if (!selectedEntity) return;
    if (!window.confirm(`Delete this ${selectedEntity.type}?`)) return;
    try {
      if (selectedEntity.type === 'node') await deleteNode(selectedEntity.data._id);
      else await deletePath(selectedEntity.data._id);
      setSelectedEntity(null);
      if (onRefresh) onRefresh();
    } catch (err) { alert("Failed to delete entity."); }
  };

  const toggleCategoryExpand = (catName) => { setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] })); };
  const toggleBlockExpand = (blockId) => { setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] })); };

  const toggleFloorVisibility = (floorId, e) => {
    e.stopPropagation();
    setVisibleFloors(prev => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId); else next.add(floorId);
      return next;
    });
  };

  const selectFloor = (floor, block) => {
    const fId = floor._id;
    setActiveFloorId(prev => prev === fId ? null : fId);
    setActiveBlockId(block._id);
    setTargetFloorId(fId);
    setVisibleFloors(prev => { const next = new Set(prev); next.add(fId); return next; });

    if (block.shape && block.shape.points && block.shape.points.length > 0 && map.current) {
      const cx = block.shape.points.reduce((s, p) => s + p.x, 0) / block.shape.points.length;
      const cy = block.shape.points.reduce((s, p) => s + p.y, 0) / block.shape.points.length;
      map.current.flyTo({ center: [cy, cx], zoom: 19, pitch: 55, duration: 1200 });
    }
  };

  const activeBlock = blocks.find(b => b._id === activeBlockId);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(12px)', border: '1px solid #1e2d40', borderRadius: '8px', padding: '10px 12px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
        >
          <FiSidebar /> 3D Tools
        </button>
      )}

      <div style={{ position: 'absolute', top: 12, right: isSidebarOpen ? 12 : -320, zIndex: 10, width: 300, maxHeight: 'calc(100% - 100px)', overflowY: 'auto', background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(12px)', borderRadius: 14, border: '1px solid #1e2d40', color: 'white', fontSize: 12, transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e2d40', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(10,14,26,0.95)', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiLayers color="#3b82f6" size={15} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>3D Editor</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setVisibleFloors(new Set(floors.map(f => f._id))); setActiveFloorId(null); setActiveBlockId(null); }} style={{ background: '#1f293780', color: '#9ca3af', border: '1px solid #2a3352', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Show All</button>
            <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}><FiX size={16} /></button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '6px 0' }}>
          {categorizedTree.categories.map(category => {
            const isCatExpanded = expandedCategories[category.name] !== false;
            return (
              <div key={category.name} style={{ marginBottom: 8 }}>
                <div onClick={() => toggleCategoryExpand(category.name)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', cursor: 'pointer', color: '#a5b4fc', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, background: 'linear-gradient(90deg, #312e8140 0%, transparent 100%)' }}>
                  <span style={{ transition: 'transform 0.2s', transform: isCatExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>{isCatExpanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}</span>
                  <FiHash size={12} /> {category.name}
                </div>
                {isCatExpanded && category.blocks.map(block => {
                  const isExpanded = expandedBlocks[block._id] !== false;
                  const isActiveBlock = activeBlockId === block._id;
                  return (
                    <div key={block._id} style={{ marginBottom: 2 }}>
                      <div onClick={() => toggleBlockExpand(block._id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 24px', cursor: 'pointer', background: isActiveBlock ? '#1e2d4080' : 'transparent', borderLeft: isActiveBlock ? '3px solid #4f46e5' : '3px solid transparent' }}>
                        <span style={{ color: '#6366f1', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>{isExpanded ? <FiChevronDown size={13} /> : <FiChevronRight size={13} />}</span>
                        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 12, color: isActiveBlock ? '#e0e7ff' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.name}</div></div>
                      </div>
                      {isExpanded && (
                        <div style={{ paddingLeft: 18 }}>
                          {block.floors.map(floor => {
                            const isFloorActive = activeFloorId === floor._id;
                            const isFloorVisible = visibleFloors.has(floor._id);
                            return (
                              <div key={floor._id} onClick={() => selectFloor(floor, block)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 22px', cursor: 'pointer', background: isFloorActive ? '#22c55e12' : 'transparent', borderLeft: isFloorActive ? '2px solid #22c55e' : '2px solid transparent', borderRadius: '0 6px 6px 0', opacity: isFloorVisible ? 1 : 0.35 }}>
                                <div style={{ width: 6, height: 6, borderRadius: 3, background: isFloorActive ? '#22c55e' : (isFloorVisible ? '#475569' : '#334155'), boxShadow: isFloorActive ? '0 0 8px #22c55e60' : 'none' }} />
                                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: isFloorActive ? 700 : 500, fontSize: 12, color: isFloorActive ? '#22c55e' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{floor.name} <span style={{ fontSize: 10, color: '#64748b' }}>L{floor.level || 0}</span></div></div>
                                <button onClick={(e) => toggleFloorVisibility(floor._id, e)} style={{ background: 'transparent', border: 'none', color: isFloorVisible ? '#6366f1' : '#334155', cursor: 'pointer', padding: 2 }}>{isFloorVisible ? <FiEye size={13} /> : <FiEyeOff size={13} />}</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', color: '#f59e0b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, background: 'linear-gradient(90deg, #78350f40 0%, transparent 100%)' }}><FiHash size={12} /> External / Ground</div>
            <div onClick={() => setShowCampusNodes(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 24px', cursor: 'pointer' }}>
              <FiGlobe size={13} color="#f59e0b" />
              <div style={{ flex: 1, fontWeight: 700, fontSize: 12, color: '#fcd34d' }}>Campus Pathways</div>
              <button onClick={(e) => { e.stopPropagation(); setShowCampusNodes(p => !p); }} style={{ background: 'transparent', border: 'none', color: showCampusNodes ? '#f59e0b' : '#334155', cursor: 'pointer', padding: 2 }}>{showCampusNodes ? <FiEye size={13} /> : <FiEyeOff size={13} />}</button>
            </div>
          </div>
        </div>

        {selectedEntity && (
          <div style={{ borderTop: '1px solid #1e2d40', background: '#0f172a', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><FiInfo color="#3b82f6" /> {selectedEntity.type === 'node' ? 'Node Inspector' : 'Path Inspector'}</span>
              <button onClick={() => setSelectedEntity(null)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><FiX /></button>
            </div>
            {selectedEntity.type === 'node' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#6b7280' }}>Elevation (L Level Override)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" value={elevationLevel} onChange={e => setElevationLevel(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #2a3352', background: '#0a0e1a', color: 'white', fontSize: 12 }} />
                  <button onClick={handleSaveElevation} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, padding: '0 12px', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>Save</button>
                </div>
              </div>
            )}
            {selectedEntity.type === 'path' && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                {selectedEntity.data.type === 'stairs' || selectedEntity.data.type === 'elevator' ? <p style={{ margin: 0, color: '#f59e0b', fontWeight: 600 }}>⚡ Cross-floor connection</p> : <p style={{ margin: 0 }}>Standard pathway segment.</p>}
              </div>
            )}
            <button onClick={handleDeleteEntity} style={{ width: '100%', padding: 8, borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🗑️ Delete</button>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(12px)', padding: '10px 16px', borderRadius: 12, border: '1px solid #1e2d40', display: 'flex', alignItems: 'center', gap: 10, color: 'white', flexWrap: 'wrap', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        {activeBlock && <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#4f46e520', borderRadius: 6, border: '1px solid #4f46e540', fontSize: 11, fontWeight: 700, color: '#a5b4fc' }}><FiBox size={11} /> {activeBlock.name}</div>}
        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#6b7280' }}>|</span>
        <button onClick={(e) => { e.preventDefault(); setDrawMode('select'); setPathStartNode(null); }} style={{ background: drawMode === 'select' ? '#3b82f6' : 'rgba(255,255,255,0.06)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>🖱️ Select</button>
        <button onClick={(e) => { e.preventDefault(); setDrawMode('addNode'); setPathStartNode(null); }} style={{ background: drawMode === 'addNode' ? '#22c55e' : 'rgba(255,255,255,0.06)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>📍 Add Node</button>
        <button onClick={(e) => { e.preventDefault(); setDrawMode('addPath'); setPathStartNode(null); }} style={{ background: drawMode === 'addPath' ? '#c084fc' : 'rgba(255,255,255,0.06)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>⛓️ Add Path</button>
        {drawMode === 'addNode' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid #2a3352', paddingLeft: 10 }}>
            <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>Target:</span>
            <select value={targetFloorId} onChange={(e) => {
              setTargetFloorId(e.target.value);
              const fl = floors.find(f => f._id === e.target.value);
              if (fl) { setActiveBlockId(fl.blockId?._id || fl.blockId); setActiveFloorId(fl._id); setVisibleFloors(prev => { const next = new Set(prev); next.add(fl._id); return next; }); }
            }} style={{ background: '#0a0e1a', color: 'white', border: '1px solid #2a3352', borderRadius: 6, padding: '4px 8px', fontSize: 11, maxWidth: 180 }}>
              <option value="">Select Floor</option>
              {categorizedTree.categories.map(cat => (
                <optgroup key={cat.name} label={`— ${cat.name} —`}>
                  {cat.blocks.map(block => (block.floors.map(f => <option key={f._id} value={f._id}>{block.name}: {f.name} (L{f.level || 0})</option>)))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>

      {drawMode === 'addPath' && pathStartNode && (
        <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(234,179,8,0.95)', color: '#1e1b4b', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, border: '1px solid #ca8a04', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Connecting from: {pathStartNode.label || `Node at L${getNodeLevel(pathStartNode)}`}. Click destination.</span>
          <button onClick={() => setPathStartNode(null)} style={{ background: '#78350f', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
