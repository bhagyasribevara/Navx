import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FiX, FiSave, FiLayers, FiInfo } from 'react-icons/fi';
import { updateNode, updatePath, createNode, createPath, deleteNode, deletePath } from '../api';

const generateNodePolygon = (center, radiusDeg) => {
  return [
    [center.y - radiusDeg, center.x - radiusDeg], [center.y + radiusDeg, center.x - radiusDeg],
    [center.y + radiusDeg, center.x + radiusDeg], [center.y - radiusDeg, center.x + radiusDeg],
    [center.y - radiusDeg, center.x - radiusDeg]
  ];
};

export default function Admin3DViewer({ blocks, floors, rooms, nodes, paths, campus, activeFloor, mapboxUrl, onRefresh }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [selectedEntity, setSelectedEntity] = useState(null); // { type: 'node' | 'path', data: {...} }
  const [elevationLevel, setElevationLevel] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  const [drawMode, setDrawMode] = useState('select'); // 'select' | 'addNode' | 'addPath'
  const [pathStartNode, setPathStartNode] = useState(null);
  const [targetFloorId, setTargetFloorId] = useState(activeFloor?._id || (floors[0]?._id || ''));

  const drawModeRef = useRef(drawMode);
  const pathStartNodeRef = useRef(pathStartNode);
  const targetFloorIdRef = useRef(targetFloorId);
  const selectedBlockIdRef = useRef(selectedBlockId);
  const campusRef = useRef(campus);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { pathStartNodeRef.current = pathStartNode; }, [pathStartNode]);
  useEffect(() => { targetFloorIdRef.current = targetFloorId; }, [targetFloorId]);
  useEffect(() => { selectedBlockIdRef.current = selectedBlockId; }, [selectedBlockId]);
  useEffect(() => { campusRef.current = campus; }, [campus]);

  useEffect(() => {
    if (activeFloor) setTargetFloorId(activeFloor._id);
  }, [activeFloor]);

  const getNodeLevel = (n) => {
    if (n.floorLevel !== undefined && n.floorLevel !== null) return n.floorLevel;
    if (n.floorId) {
      const fId = typeof n.floorId === 'object' ? n.floorId._id : n.floorId;
      const floor = floors.find(f => f._id === fId);
      if (floor) return floor.level;
    }
    return 0;
  };

  useEffect(() => {
    if (map.current) return; // initialize map only once
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

    // Save camera views only when altered manually by the user
    map.current.on('moveend', (e) => {
      if (e.originalEvent && map.current) {
        const currentP = map.current.getPitch();
        if (currentP > 5) {
          prevView = {
            bearing: map.current.getBearing(),
            pitch: currentP,
            zoom: map.current.getZoom()
          };
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
      // Add Mapbox Navigation Controls for easy rotation and zooming
      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      // Custom compass toggle behavior to prevent pitch resetting to 0 (flat 2D)
      setTimeout(() => {
        const compassBtn = mapContainer.current?.querySelector('.mapboxgl-ctrl-compass');
        if (compassBtn && map.current) {
          compassBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (!map.current) return;

            const currentBearing = map.current.getBearing();
            const currentPitch = map.current.getPitch();

            // If we are currently not aligned to North perspective, transition to North perspective (pitch 60)
            // so that 3D rooms & steps layouts remain visible
            if (Math.abs(currentBearing) > 0.5 || Math.abs(currentPitch - 60) > 0.5) {
              map.current.easeTo({
                bearing: 0,
                pitch: 60,
                duration: 800
              });
            } else {
              // Toggle back to the previous perspective camera angle
              map.current.easeTo({
                bearing: prevView.bearing,
                pitch: prevView.pitch,
                zoom: prevView.zoom,
                duration: 800
              });
            }
          }, true);

          // Add custom Top View button below compass in the same control group widget
          const parentGroup = compassBtn.parentNode;
          if (parentGroup) {
            const topViewBtn = document.createElement('button');
            topViewBtn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-topview';
            topViewBtn.type = 'button';
            topViewBtn.title = 'Top-down Flat 2D View';
            topViewBtn.style.display = 'flex';
            topViewBtn.style.alignItems = 'center';
            topViewBtn.style.justifyContent = 'center';
            topViewBtn.style.width = '29px';
            topViewBtn.style.height = '29px';
            topViewBtn.style.border = 'none';
            topViewBtn.style.background = 'none';
            topViewBtn.style.cursor = 'pointer';
            
            topViewBtn.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #4b5563;">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            `;
            
            topViewBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (map.current) {
                map.current.easeTo({
                  bearing: 0,
                  pitch: 0,
                  duration: 800
                });
              }
            });
            
            parentGroup.appendChild(topViewBtn);
          }
        }
      }, 100);

      // 3D Buildings from Mapbox Streets
      map.current.addLayer({
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

      renderCampusData();
    });

    // Handle clicks on map
    map.current.on('click', async (e) => {
      const mode = drawModeRef.current;
      
      // If we are adding a node, click on any empty space or floor polygon to create a node
      if (mode === 'addNode') {
        const floorId = targetFloorIdRef.current;
        if (!floorId) {
          alert('Please select a target floor in the top toolbar first!');
          return;
        }
        const latlng = e.lngLat;
        try {
          const floorsList = floors;
          const selectedFloor = floorsList.find(f => f._id === floorId);
          
          await createNode({
            floorId,
            blockId: selectedBlockIdRef.current || (selectedFloor ? selectedFloor.blockId : null),
            campusId: campusRef.current?._id,
            x: latlng.lat,
            y: latlng.lng,
            type: 'waypoint',
            label: 'Node'
          });
          
          if (onRefresh) onRefresh();
        } catch (err) {
          console.error("Failed to create node in 3D:", err);
          alert("Failed to create node.");
        }
        return;
      }

      // Query features clicked
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['nodes-layer', 'paths-layer', 'campus-polygons-layer']
      });

      if (features.length > 0) {
        const nodeFeat = features.find(f => f.layer.id === 'nodes-layer');
        const pathFeat = features.find(f => f.layer.id === 'paths-layer');
        const polyFeat = features.find(f => f.layer.id === 'campus-polygons-layer');

        if (nodeFeat) {
          const props = JSON.parse(nodeFeat.properties.rawData);
          
          if (mode === 'addPath') {
            const startNode = pathStartNodeRef.current;
            if (!startNode) {
              setPathStartNode(props);
            } else {
              if (startNode._id === props._id) {
                alert("Start and destination node cannot be the same!");
                return;
              }
              try {
                const isCrossFloor = startNode.floorId !== props.floorId;
                const assignedFloor = isCrossFloor ? null : (startNode.floorId?._id || startNode.floorId);
                
                await createPath({
                  nodeA: startNode._id,
                  nodeB: props._id,
                  floorId: assignedFloor,
                  campusId: campusRef.current?._id,
                  bidirectional: true,
                  type: isCrossFloor ? 'stairs' : 'hallway'
                });
                
                setPathStartNode(null);
                if (onRefresh) onRefresh();
              } catch (err) {
                console.error("Failed to create path in 3D:", err);
                alert("Failed to create path.");
              }
            }
          } else {
            // Select mode
            setSelectedEntity({ type: 'node', data: props });
            setElevationLevel(getNodeLevel(props));
          }
        } else if (pathFeat && mode === 'select') {
          const props = JSON.parse(pathFeat.properties.rawData);
          setSelectedEntity({ type: 'path', data: props });
        } else if (polyFeat) {
          if (polyFeat.properties.isBlock || polyFeat.properties.isRoom) {
            setSelectedBlockId(polyFeat.properties.blockId);
          }
          if (mode === 'select') {
            setSelectedEntity(null);
          }
        }
      } else {
        if (mode === 'select') {
          setSelectedEntity(null);
          setSelectedBlockId(null);
        }
        if (mode === 'addPath') {
          setPathStartNode(null);
        }
      }
    });

    // Change cursor
    map.current.on('mouseenter', 'nodes-layer', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    map.current.on('mouseleave', 'nodes-layer', () => { map.current.getCanvas().style.cursor = ''; });
    map.current.on('mouseenter', 'paths-layer', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    map.current.on('mouseleave', 'paths-layer', () => { map.current.getCanvas().style.cursor = ''; });
    map.current.on('mouseenter', 'campus-polygons-layer', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    map.current.on('mouseleave', 'campus-polygons-layer', () => { map.current.getCanvas().style.cursor = ''; });

  }, [mapboxUrl, campus]);

  // Re-render when data or selection changes
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      renderCampusData();
    }
  }, [blocks, floors, rooms, nodes, paths, selectedBlockId, selectedEntity, pathStartNode]);

  const renderCampusData = () => {
    if (!map.current) return;

    const isNodeOnSelectedFloor = (n) => {
      const nFloorId = n.floorId ? (typeof n.floorId === 'object' ? n.floorId._id : n.floorId) : null;
      if (nFloorId) {
        return nFloorId === targetFloorId;
      } else {
        const nLevel = getNodeLevel(n);
        const selectedFloorObj = floors.find(f => f._id === targetFloorId);
        const selectedLevel = selectedFloorObj ? selectedFloorObj.level : 0;
        return nLevel === selectedLevel;
      }
    };

    const blockFeatures = [];
    const roomFeatures = [];
    
    // Prepare blocks
    blocks.forEach(b => {
      if (b.shape && b.shape.points && b.shape.points.length > 0) {
        const coords = b.shape.points.map(p => [p.y, p.x]);
        coords.push([b.shape.points[0].y, b.shape.points[0].x]); // close polygon
        blockFeatures.push({
          type: 'Feature',
          properties: { 
            isBlock: true, 
            blockId: b._id, 
            color: selectedBlockId === b._id ? '#4f46e5' : (b.color || '#475569'), 
            min_height: 0, 
            height: 2 
          },
          geometry: { type: 'Polygon', coordinates: [coords] }
        });
      }
    });

    // Prepare rooms
    rooms.forEach(r => {
      if (r.shape && r.shape.points && r.shape.points.length > 0) {
        const rBlockId = (r.blockId && r.blockId._id) ? r.blockId._id : r.blockId;

        if (r.type === 'stairs' && r.stairsConfig && r.shape.points.length >= 4) {
          const pts = r.shape.points;
          const p1 = pts[0];
          const p2 = pts[1];
          const p3 = pts[2];
          const p4 = pts[3];

          // Calculate lengths of sides to determine orientation
          const len12 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
          const len23 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
          const len34 = Math.sqrt(Math.pow(p3.x - p4.x, 2) + Math.pow(p3.y - p4.y, 2));
          const len41 = Math.sqrt(Math.pow(p4.x - p1.x, 2) + Math.pow(p4.y - p1.y, 2));

          const config = r.stairsConfig;
          const N = config.stepCount || 15;
          const scale = config.stairWidthScale !== undefined ? config.stairWidthScale : 1.0;
          const direction = config.stairDirection || 'auto';
          const invert = config.invertSlope || false;

          // Determine step orientation
          let is1to3 = true;
          if (direction === 'auto') {
            is1to3 = (len23 + len41) >= (len12 + len34);
          } else if (direction === 'transverse') {
            is1to3 = false;
          } // if longitudinal, is1to3 is true

          const startFloor = floors.find(f => f._id === (config.startFloorId?._id || config.startFloorId || r.floorId?._id || r.floorId));
          const endFloor = floors.find(f => f._id === (config.endFloorId?._id || config.endFloorId));

          const floorBaseStart = startFloor ? startFloor.level * 3.5 : 0;
          const floorBaseEnd = endFloor ? endFloor.level * 3.5 : floorBaseStart + 3.5;
          const heightDiff = floorBaseEnd - floorBaseStart;

          const startPct = config.startHeightPct !== undefined ? config.startHeightPct / 100 : 0.0;
          const endPct = config.endHeightPct !== undefined ? config.endHeightPct / 100 : 1.0;

          const zStart = floorBaseStart + startPct * heightDiff;
          const zEnd = floorBaseStart + endPct * heightDiff;

          for (let i = 0; i < N; i++) {
            const tStart = i / N;
            const tEnd = (i + 1) / N;

            let c1, c2, c3, c4;

            if (is1to3) {
              // Interpolate along Side 4 (1 -> 4) and Side 2 (2 -> 3)
              const xStartLeft = p1.x + (p4.x - p1.x) * tStart;
              const yStartLeft = p1.y + (p4.y - p1.y) * tStart;
              const xStartRight = p2.x + (p3.x - p2.x) * tStart;
              const yStartRight = p2.y + (p3.y - p2.y) * tStart;

              const xEndLeft = p1.x + (p4.x - p1.x) * tEnd;
              const yEndLeft = p1.y + (p4.y - p1.y) * tEnd;
              const xEndRight = p2.x + (p3.x - p2.x) * tEnd;
              const yEndRight = p2.y + (p3.y - p2.y) * tEnd;

              // Scale coordinates towards center of the stairs
              const xStartCenter = (xStartLeft + xStartRight) / 2;
              const yStartCenter = (yStartLeft + yStartRight) / 2;
              const xEndCenter = (xEndLeft + xEndRight) / 2;
              const yEndCenter = (yEndLeft + yEndRight) / 2;

              const xSL = xStartCenter + (xStartLeft - xStartCenter) * scale;
              const ySL = yStartCenter + (yStartLeft - yStartCenter) * scale;
              const xSR = xStartCenter + (xStartRight - xStartCenter) * scale;
              const ySR = yStartCenter + (yStartRight - yStartCenter) * scale;

              const xEL = xEndCenter + (xEndLeft - xEndCenter) * scale;
              const yEL = yEndCenter + (yEndLeft - yEndCenter) * scale;
              const xER = xEndCenter + (xEndRight - xEndCenter) * scale;
              const yER = yEndCenter + (yEndRight - yEndCenter) * scale;

              c1 = [ySL, xSL];
              c2 = [ySR, xSR];
              c3 = [yER, xER];
              c4 = [yEL, xEL];
            } else {
              // Interpolate along Side 1 (1 -> 2) and Side 3 (4 -> 3)
              const xStartBottom = p1.x + (p2.x - p1.x) * tStart;
              const yStartBottom = p1.y + (p2.y - p1.y) * tStart;
              const xStartTop = p4.x + (p3.x - p4.x) * tStart;
              const yStartTop = p4.y + (p3.y - p4.y) * tStart;

              const xEndBottom = p1.x + (p2.x - p1.x) * tEnd;
              const yEndBottom = p1.y + (p2.y - p1.y) * tEnd;
              const xEndTop = p4.x + (p3.x - p4.x) * tEnd;
              const yEndTop = p4.y + (p3.y - p4.y) * tEnd;

              // Scale coordinates towards center of the stairs
              const xStartCenter = (xStartBottom + xStartTop) / 2;
              const yStartCenter = (yStartBottom + yStartTop) / 2;
              const xEndCenter = (xEndBottom + xEndTop) / 2;
              const yEndCenter = (yEndBottom + yEndTop) / 2;

              const xSB = xStartCenter + (xStartBottom - xStartCenter) * scale;
              const ySB = yStartCenter + (yStartBottom - yStartCenter) * scale;
              const xST = xStartCenter + (xStartTop - xStartCenter) * scale;
              const yST = yStartCenter + (yStartTop - yStartCenter) * scale;

              const xEB = xEndCenter + (xEndBottom - xEndCenter) * scale;
              const yEB = yEndCenter + (yEndBottom - yEndCenter) * scale;
              const xET = xEndCenter + (xEndTop - xEndCenter) * scale;
              const yET = yEndCenter + (yEndTop - yEndCenter) * scale;

              c1 = [ySB, xSB];
              c2 = [yEB, xEB];
              c3 = [yET, xET];
              c4 = [yST, xST];
            }

            const stepMinH = invert 
              ? zEnd - (i * (zEnd - zStart)) / N 
              : zStart + (i * (zEnd - zStart)) / N;
            const stepMaxH = invert 
              ? zEnd - ((i + 1) * (zEnd - zStart)) / N 
              : zStart + ((i + 1) * (zEnd - zStart)) / N;

            const hMin = Math.min(stepMinH, stepMaxH);
            const hMax = Math.max(stepMinH, stepMaxH);

            roomFeatures.push({
              type: 'Feature',
              properties: { 
                isRoom: true, 
                isStairs: true, 
                blockId: rBlockId || '', 
                color: r.color || '#f97316', 
                min_height: hMin, 
                height: hMax + 0.05 
              },
              geometry: { type: 'Polygon', coordinates: [[c1, c2, c3, c4, c1]] }
            });
          }
        } else {
          const floor = floors.find(f => f._id === (r.floorId?._id || r.floorId));
          const level = floor ? floor.level : 0;
          const minH = level * 3.5;
          const h = minH + 3.0; // Room height

          const coords = r.shape.points.map(p => [p.y, p.x]);
          coords.push([r.shape.points[0].y, r.shape.points[0].x]);

          roomFeatures.push({
            type: 'Feature',
            properties: { isRoom: true, blockId: rBlockId || '', color: r.color || '#3b82f6', min_height: minH, height: h },
            geometry: { type: 'Polygon', coordinates: [coords] }
          });
        }
      }
    });

    // Update Polygons Source
    const polySource = map.current.getSource('campus-polygons');
    const polyData = { type: 'FeatureCollection', features: [...blockFeatures, ...roomFeatures] };
    if (polySource) {
      polySource.setData(polyData);
    } else {
      map.current.addSource('campus-polygons', { type: 'geojson', data: polyData });

      // Add Flat 2D Fill Layer for 2D/Top View rendering
      map.current.addLayer({
        id: 'campus-polygons-fill',
        type: 'fill',
        source: 'campus-polygons',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': map.current.getPitch() === 0 ? 0.6 : 0.1
        }
      });

      // Add Flat 2D Outline Border Layer
      map.current.addLayer({
        id: 'campus-polygons-line',
        type: 'line',
        source: 'campus-polygons',
        paint: {
          'line-color': '#1f2937',
          'line-width': 1.5,
          'line-opacity': map.current.getPitch() === 0 ? 0.8 : 0.2
        }
      });

      // Add 3D Extrusion Layer
      map.current.addLayer({
        id: 'campus-polygons-layer',
        type: 'fill-extrusion',
        source: 'campus-polygons',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.7
        }
      }, '3d-buildings');
    }

    // Prepare Paths (Elevated/Inclined 3D Paths using fill-extrusion segments)
    const pathFeatures = [];
    paths.forEach(p => {
      const a = nodes.find(n => n._id === p.nodeA);
      const b = nodes.find(n => n._id === p.nodeB);
      if (a && b) {

        let levelA = getNodeLevel(a);
        let levelB = getNodeLevel(b);
        
        const hA = levelA * 3.5 + 0.5;
        const hB = levelB * 3.5 + 0.5;

        const dy = b.y - a.y;
        const dx = b.x - a.x;
        const length = Math.sqrt(dy * dy + dx * dx);
        if (length > 0) {
          const uy = dy / length;
          const ux = dx / length;

          const ny = -ux;
          const nx = uy;

          // Maintain a very narrow path line width to avoid cluttering the layout
          const width = 0.0000003; 
          const thickness = 0.03;
          const N = 15; // segment the path to create a smooth incline in 3D

          for (let i = 0; i < N; i++) {
            const tStart = i / N;
            const tEnd = (i + 1) / N;

            const yStart = a.y + dy * tStart;
            const xStart = a.x + dx * tStart;
            const yEnd = a.y + dy * tEnd;
            const xEnd = a.x + dx * tEnd;

            const p1 = [yStart + ny * width, xStart + nx * width];
            const p2 = [yStart - ny * width, xStart - nx * width];
            const p3 = [yEnd - ny * width, xEnd - nx * width];
            const p4 = [yEnd + ny * width, xEnd + nx * width];

            const hStart = hA + (hB - hA) * tStart;
            const hEnd = hA + (hB - hA) * tEnd;

            const minH = Math.min(hStart, hEnd);
            const maxH = Math.max(hStart, hEnd);

            pathFeatures.push({
              type: 'Feature',
              properties: {
                id: p._id,
                rawData: JSON.stringify(p),
                min_height: minH - thickness / 2,
                height: maxH + thickness / 2
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[p1, p2, p3, p4, p1]]
              }
            });
          }
        }
      }
    });

    const pathsSource = map.current.getSource('campus-paths');
    const pathsData = { type: 'FeatureCollection', features: pathFeatures };
    if (pathsSource) {
      pathsSource.setData(pathsData);
      map.current.setPaintProperty('paths-layer', 'fill-extrusion-color', [
        'case',
        ['==', ['get', 'id'], selectedEntity?.data?._id || ''],
        '#3b82f6',
        '#c084fc'
      ]);
    } else {
      map.current.addSource('campus-paths', { type: 'geojson', data: pathsData });
      map.current.addLayer({
        id: 'paths-layer',
        type: 'fill-extrusion',
        source: 'campus-paths',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['==', ['get', 'id'], selectedEntity?.data?._id || ''],
            '#3b82f6',
            '#c084fc'
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.95
        }
      }, 'campus-polygons-layer');
    }

    // Prepare Nodes (Small 3D suspended discs using fill-extrusion)
    const nodeFeatures = [];
    nodes.forEach(n => {

      const h = getNodeLevel(n) * 3.5 + 0.5;
      const isStartNode = pathStartNode?._id === n._id;
      const isSelected = selectedEntity?.data?._id === n._id;
      
      const radius = (isStartNode || isSelected) ? 0.0000018 : 0.0000012;
      const poly = generateNodePolygon(n, radius);
      
      nodeFeatures.push({
        type: 'Feature',
        properties: {
          id: n._id,
          rawData: JSON.stringify(n),
          min_height: h,
          height: h + 0.04
        },
        geometry: {
          type: 'Polygon',
          coordinates: [poly]
        }
      });
    });

    const nodesSource = map.current.getSource('campus-nodes');
    const nodesData = { type: 'FeatureCollection', features: nodeFeatures };
    if (nodesSource) {
      nodesSource.setData(nodesData);
      map.current.setPaintProperty('nodes-layer', 'fill-extrusion-color', [
        'case',
        ['==', ['get', 'id'], pathStartNode?._id || ''],
        '#eab308',
        ['==', ['get', 'id'], selectedEntity?.data?._id || ''],
        '#3b82f6',
        '#22c55e'
      ]);
    } else {
      map.current.addSource('campus-nodes', { type: 'geojson', data: nodesData });
      map.current.addLayer({
        id: 'nodes-layer',
        type: 'fill-extrusion',
        source: 'campus-nodes',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['==', ['get', 'id'], pathStartNode?._id || ''],
            '#eab308',
            ['==', ['get', 'id'], selectedEntity?.data?._id || ''],
            '#3b82f6',
            '#22c55e'
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.95
        }
      }, 'campus-polygons-layer');
    }
  };

  const handleSaveElevation = async () => {
    if (!selectedEntity || selectedEntity.type !== 'node') return;
    try {
      await updateNode(selectedEntity.data._id, { floorLevel: parseFloat(elevationLevel) });
      
      // Update local state in viewer so we see it immediately
      const nodeObj = nodes.find(n => n._id === selectedEntity.data._id);
      if (nodeObj) {
        nodeObj.floorLevel = parseFloat(elevationLevel);
        renderCampusData();
      }
      
      alert('Node elevation saved!');
    } catch (err) {
      console.error(err);
      alert('Failed to save elevation.');
    }
  };

  const handleDeleteEntity = async () => {
    if (!selectedEntity) return;
    if (!window.confirm(`Are you sure you want to delete this ${selectedEntity.type}?`)) return;
    try {
      if (selectedEntity.type === 'node') {
        await deleteNode(selectedEntity.data._id);
      } else {
        await deletePath(selectedEntity.data._id);
      }
      setSelectedEntity(null);
      alert(`${selectedEntity.type === 'node' ? 'Node' : 'Path'} deleted!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete entity.");
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* 3D Editor Toolbar Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        background: 'rgba(17,24,39,0.9)',
        backdropFilter: 'blur(10px)',
        padding: '10px 16px',
        borderRadius: '12px',
        border: '1px solid #374151',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'white'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#9ca3af' }}>3D Editor:</span>
        
        <button
          onClick={(e) => { e.preventDefault(); setDrawMode('select'); setPathStartNode(null); }}
          style={{
            background: drawMode === 'select' ? '#3b82f6' : 'rgba(255,255,255,0.08)',
            color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', transition: 'all 0.2s'
          }}
        >
          🖱️ Select
        </button>

        <button
          onClick={(e) => { e.preventDefault(); setDrawMode('addNode'); setPathStartNode(null); }}
          style={{
            background: drawMode === 'addNode' ? '#22c55e' : 'rgba(255,255,255,0.08)',
            color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', transition: 'all 0.2s'
          }}
        >
          📍 Add Node
        </button>

        <button
          onClick={(e) => { e.preventDefault(); setDrawMode('addPath'); setPathStartNode(null); }}
          style={{
            background: drawMode === 'addPath' ? '#c084fc' : 'rgba(255,255,255,0.08)',
            color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', transition: 'all 0.2s'
          }}
        >
          ⛓️ Add Path
        </button>
        
        {drawMode === 'addNode' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #4b5563', paddingLeft: '12px' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Target Floor:</span>
            <select
              value={targetFloorId}
              onChange={(e) => setTargetFloorId(e.target.value)}
              style={{ background: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}
            >
              <option value="">Select Floor</option>
              {floors.map(f => <option key={f._id} value={f._id}>{f.name} (L{f.level})</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Dynamic Path Connection Prompt */}
      {drawMode === 'addPath' && pathStartNode && (
        <div style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(234,179,8,0.95)',
          color: '#1e1b4b',
          padding: '8px 16px',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '12px',
          border: '1px solid #ca8a04',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>Connecting from: {pathStartNode.label || `Node at level ${getNodeLevel(pathStartNode)}`}. Click destination node.</span>
          <button onClick={() => setPathStartNode(null)} style={{ background: '#78350f', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
      
      {/* HUD / Overlay */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(10px)', padding: '16px', borderRadius: '12px', border: '1px solid #374151', color: 'white', maxWidth: '320px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiLayers color="#3b82f6" /> 3D Editor HUD
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
          Specify navigation nodes and paths directly in 3D. Add nodes to correct floor elevations and click start/end nodes to draw vertical stairs paths.
        </p>

        {selectedEntity ? (
          <div style={{ marginTop: '16px', background: '#1f2937', padding: '12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                Selected: {selectedEntity.type === 'node' ? 'Node' : 'Path'}
              </span>
              <button onClick={() => setSelectedEntity(null)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <FiX />
              </button>
            </div>

            {selectedEntity.type === 'node' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#9ca3af' }}>
                  Floor Level (Manual Override)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="number" 
                    value={elevationLevel} 
                    onChange={e => setElevationLevel(e.target.value)}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #4b5563', background: '#111827', color: 'white' }}
                  />
                  <button 
                    onClick={handleSaveElevation}
                    style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                    <FiSave /> Save
                  </button>
                </div>
              </div>
            )}
            {selectedEntity.type === 'path' && (
              <div style={{ fontSize: '12px', color: '#d1d5db', marginBottom: '12px' }}>
                <p>This is a connection between two nodes.</p>
                <p>If they are on different floors, the path will auto-incline in 3D!</p>
              </div>
            )}

            <button
              onClick={handleDeleteEntity}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                background: '#ef4444',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              🗑️ Delete {selectedEntity.type === 'node' ? 'Node' : 'Path'}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', border: '1px dashed #4b5563', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
            No node or path selected. Click one to edit or delete.
          </div>
        )}
      </div>
    </div>
  );
}
