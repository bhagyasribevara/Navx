import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FiX, FiSave, FiLayers, FiInfo } from 'react-icons/fi';
import { updateNode, updatePath } from '../api';

export default function Admin3DViewer({ blocks, floors, rooms, nodes, paths, campus, mapboxUrl }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [selectedEntity, setSelectedEntity] = useState(null); // { type: 'node' | 'path', data: {...} }
  const [elevationLevel, setElevationLevel] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  const getNodeLevel = (n) => {
    if (n.floorLevel !== undefined) return n.floorLevel;
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

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: center,
      zoom: 18,
      pitch: 60,
      bearing: -17.6,
      antialias: true
    });

    map.current.on('load', () => {
      // Add Mapbox Navigation Controls for easy rotation and zooming
      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

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
    map.current.on('click', (e) => {
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['nodes-layer', 'paths-layer', 'campus-polygons-layer']
      });

      if (features.length > 0) {
        const nodeOrPath = features.find(f => f.layer.id === 'nodes-layer' || f.layer.id === 'paths-layer');
        if (nodeOrPath) {
          try {
            const props = JSON.parse(nodeOrPath.properties.rawData);
            setSelectedEntity({ type: nodeOrPath.layer.id === 'nodes-layer' ? 'node' : 'path', data: props });
            if (nodeOrPath.layer.id === 'nodes-layer') {
              setElevationLevel(getNodeLevel(props));
            }
          } catch(err) {
            console.error("Error parsing feature data", err);
          }
        } else {
          const poly = features.find(f => f.layer.id === 'campus-polygons-layer');
          if (poly) {
            if (poly.properties.isBlock || poly.properties.isRoom) {
               setSelectedBlockId(poly.properties.blockId);
            }
            setSelectedEntity(null);
          }
        }
      } else {
        setSelectedEntity(null);
        setSelectedBlockId(null);
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
  }, [blocks, floors, rooms, nodes, paths, selectedBlockId]);

  const renderCampusData = () => {
    if (!map.current) return;

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
        const floor = floors.find(f => f._id === (r.floorId?._id || r.floorId));
        const level = floor ? floor.level : 0;
        const minH = level * 3.5;
        const h = minH + 3.0; // Room height
        
        const coords = r.shape.points.map(p => [p.y, p.x]);
        coords.push([r.shape.points[0].y, r.shape.points[0].x]);
        
        const rBlockId = (r.blockId && r.blockId._id) ? r.blockId._id : r.blockId;
        
        roomFeatures.push({
          type: 'Feature',
          properties: { isRoom: true, blockId: rBlockId || '', color: r.color || '#3b82f6', min_height: minH, height: h },
          geometry: { type: 'Polygon', coordinates: [coords] }
        });
      }
    });

    // Update Polygons Source
    const polySource = map.current.getSource('campus-polygons');
    const polyData = { type: 'FeatureCollection', features: [...blockFeatures, ...roomFeatures] };
    if (polySource) {
      polySource.setData(polyData);
    } else {
      map.current.addSource('campus-polygons', { type: 'geojson', data: polyData });
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
      });
    }

    // Prepare Paths (3D Lines)
    const pathFeatures = [];
    paths.forEach(p => {
      const a = nodes.find(n => n._id === p.nodeA);
      const b = nodes.find(n => n._id === p.nodeB);
      if (a && b) {
        const aVisible = !a.blockId || a.blockId === selectedBlockId;
        const bVisible = !b.blockId || b.blockId === selectedBlockId;
        if (!aVisible || !bVisible) return;

        let levelA = getNodeLevel(a);
        let levelB = getNodeLevel(b);
        
        const hA = levelA * 3.5 + 0.5;
        const hB = levelB * 3.5 + 0.5;
        
        pathFeatures.push({
          type: 'Feature',
          properties: { rawData: JSON.stringify(p) },
          geometry: {
            type: 'LineString',
            coordinates: [
              [a.y, a.x, hA],
              [b.y, b.x, hB]
            ]
          }
        });
      }
    });

    const pathsSource = map.current.getSource('campus-paths');
    const pathsData = { type: 'FeatureCollection', features: pathFeatures };
    if (pathsSource) {
      pathsSource.setData(pathsData);
    } else {
      map.current.addSource('campus-paths', { type: 'geojson', data: pathsData });
      map.current.addLayer({
        id: 'paths-layer',
        type: 'line',
        source: 'campus-paths',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#c084fc', 'line-width': 6 }
      });
    }

    // Prepare Nodes
    const nodeFeatures = [];
    nodes.forEach(n => {
      if (n.blockId && n.blockId !== selectedBlockId) return;

      const h = getNodeLevel(n) * 3.5 + 0.5;
      
      nodeFeatures.push({
        type: 'Feature',
        properties: { rawData: JSON.stringify(n) },
        geometry: {
          type: 'Point',
          coordinates: [n.y, n.x, h]
        }
      });
    });

    const nodesSource = map.current.getSource('campus-nodes');
    const nodesData = { type: 'FeatureCollection', features: nodeFeatures };
    if (nodesSource) {
      nodesSource.setData(nodesData);
    } else {
      map.current.addSource('campus-nodes', { type: 'geojson', data: nodesData });
      map.current.addLayer({
        id: 'nodes-layer',
        type: 'circle',
        source: 'campus-nodes',
        paint: {
          'circle-radius': 6,
          'circle-color': '#22c55e',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  };

  const handleSaveElevation = async () => {
    if (!selectedEntity || selectedEntity.type !== 'node') return;
    try {
      await updateNode(selectedEntity.data._id, { floorLevel: parseInt(elevationLevel) });
      
      // Update local state in viewer so we see it immediately
      const nodeObj = nodes.find(n => n._id === selectedEntity.data._id);
      if (nodeObj) {
        nodeObj.floorLevel = parseInt(elevationLevel);
        renderCampusData();
      }
      
      alert('Node elevation saved!');
    } catch (err) {
      console.error(err);
      alert('Failed to save elevation.');
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      
      {/* HUD / Overlay */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(10px)', padding: '16px', borderRadius: '12px', border: '1px solid #374151', color: 'white', maxWidth: '320px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiLayers color="#3b82f6" /> 3D Elevation Viewer
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
          <strong>Easy Stairs Setup:</strong> Nodes are automatically placed at the correct height based on their floor. 
          To draw stairs, simply use 2D Mode to draw a path connecting a node on Floor 1 to a node on Floor 2!
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
              <div>
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
              <div style={{ fontSize: '12px', color: '#d1d5db' }}>
                <p>This is a connection between two nodes.</p>
                <p>If they are on different floors, the path will auto-incline in 3D!</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', border: '1px dashed #4b5563', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
            No node selected.
          </div>
        )}
      </div>
    </div>
  );
}
