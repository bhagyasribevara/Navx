import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Polygon, Circle, Polyline, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { FiArrowLeft, FiPlus, FiTrash2, FiMap, FiLayers, FiSquare, FiNavigation, FiCheck, FiSettings, FiMove, FiInfo, FiCopy, FiRefreshCw, FiArrowRight, FiArrowLeftCircle, FiRepeat } from 'react-icons/fi';
import { getBlocks, createBlock, updateBlock, deleteBlock, getFloors, createFloor, deleteFloor, getRooms, createRoom, updateRoom, deleteRoom, getNodes, createNode, getPaths, createPath, deletePath, updatePath, getCampus, getAllCampusNodes, getAllCampusPaths } from '../api';

const GMRIT = [18.4665, 83.6629];
const RC = { classroom:'#3b82f6', office:'#8b5cf6', lab:'#22c55e', restroom:'#f59e0b', cafeteria:'#ef4444', library:'#06b6d4', auditorium:'#ec4899', elevator:'#6366f1', stairs:'#f97316', corridor:'#64748b', entrance:'#10b981', exit:'#ef4444', other:'#94a3b8' };
const NC = { waypoint:'#94a3b8', entrance:'#10b981', exit:'#ef4444', elevator:'#6366f1', stairs:'#f97316', room_entry:'#3b82f6', intersection:'#f59e0b', connector:'#8b5cf6' };

const STEPS = [
  { id: 0, title: 'Main Pathway', desc: 'Campus Roads & Walkways', icon: <FiNavigation/> },
  { id: 1, title: 'Block Design', desc: 'Outer Structure', icon: <FiMap/> },
  { id: 2, title: 'Floor Setup', desc: 'Level Generation', icon: <FiLayers/> },
  { id: 3, title: 'Interior Design', desc: 'Rooms & Facilities', icon: <FiSquare/> },
  { id: 4, title: 'Block Navigation', desc: 'Interior Paths & Nodes', icon: <FiNavigation/> },
];

function GeomanController({ onShapeDraw, activeMode, mapReady }) {
  const map = useMap();
  useEffect(() => {
    if (!mapReady) return;
    map.pm.addControls({ drawMarker:false, drawCircleMarker:false, drawPolyline:false, drawRectangle:false, drawPolygon:false, drawCircle:false, editMode:false, dragMode:false, cutPolygon:false, removalMode:false, position:'bottomleft' });
    
    map.on('pm:create', (e) => {
      onShapeDraw(e.layer, e.shape);
      map.removeLayer(e.layer);
    });
    return () => { map.pm.removeControls(); map.off('pm:create'); };
  }, [map, onShapeDraw, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    map.pm.disableDraw();
    if (activeMode === 'rotate') map.pm.enableGlobalRotateMode();
    else map.pm.disableGlobalRotateMode();
    
    if (activeMode === 'drawBlockRect') map.pm.enableDraw('Rectangle', { snappable: true, snapDistance: 20 });
    if (activeMode === 'drawBlockPoly') map.pm.enableDraw('Polygon', { snappable: true, snapDistance: 20 });
    if (activeMode === 'drawRoomRect') map.pm.enableDraw('Rectangle', { snappable: true, snapDistance: 15 });
    if (activeMode === 'drawRoomPoly') map.pm.enableDraw('Polygon', { snappable: true, snapDistance: 15 });
  }, [activeMode, map, mapReady]);
  return null;
}

const EditablePolygon = ({ r, isSelected, isLocked, onUpdate, onClick, drawMode }) => {
  const polyRef = useRef(null);
  const s = r.shape;
  const c = RC[r.type] || (r.isBlock ? '#64748b' : '#94a3b8');
  
  const bounds = s.points && s.points.length > 0
    ? s.points.map(p => [p.x, p.y])
    : [
      [s.x, s.y], 
      [s.x, s.y + (s.width || 0.00015)], 
      [s.x + (s.height || 0.0001), s.y + (s.width || 0.00015)], 
      [s.x + (s.height || 0.0001), s.y]
    ];

  useEffect(() => {
    const layer = polyRef.current;
    if (!layer) return;

    const handleEdit = () => {
      let pts = [];
      if (layer.getLatLngs) {
        const ll = layer.getLatLngs();
        const arr = Array.isArray(ll[0]) ? (Array.isArray(ll[0][0]) ? ll[0][0] : ll[0]) : ll;
        pts = arr.map(l => ({ x: l.lat, y: l.lng }));
      } else {
        const b = layer.getBounds();
        pts = [
          { x: b.getSouth(), y: b.getWest() },
          { x: b.getNorth(), y: b.getWest() },
          { x: b.getNorth(), y: b.getEast() },
          { x: b.getSouth(), y: b.getEast() },
        ];
      }
      onUpdate(r._id || 'temp', { points: pts, type: r.shape?.type || 'polygon' });
    };

    layer.on('pm:edit', handleEdit);
    layer.on('pm:dragend', handleEdit);
    layer.on('pm:rotateend', handleEdit);

    if (isSelected && !isLocked) {
      if (drawMode === 'rotate') {
        layer.pm.disable();
      } else {
        layer.pm.enable({ allowSelfIntersection: false, preventMarkerRemoval: true, snappable: true });
      }
    } else {
      layer.pm.disable();
    }
    
    return () => { 
      layer.off('pm:edit', handleEdit); 
      layer.off('pm:dragend', handleEdit); 
      layer.off('pm:rotateend', handleEdit); 
      layer.pm.disable(); 
    };
  }, [isSelected, isLocked, drawMode, r._id, onUpdate]);

  return (
    <Polygon ref={polyRef} positions={bounds} 
      pathOptions={{ 
        color: isSelected ? '#fff' : c, 
        fillColor: c, 
        fillOpacity: r.isBlock ? 0.1 : (isSelected ? 0.6 : 0.3), 
        weight: isSelected ? 3 : (r.isBlock ? 2 : 1.5),
        dashArray: r.isBlock ? '5, 5' : null
      }} 
      eventHandlers={{ click: (e) => { if(!isLocked) { L.DomEvent.stopPropagation(e); onClick(r); } } }}>
      {!r.isBlock && (
        <Tooltip permanent direction="center" className="room-label">
          <span style={{fontSize:10,fontWeight:700,color:'#fff',textShadow:'0 1px 2px rgba(0,0,0,0.8)'}}>{r.name}</span>
        </Tooltip>
      )}
    </Polygon>
  );
};

function ClickHandler({ onClick }) { useMapEvents({ click: e => onClick(e.latlng) }); return null; }

export default function GuidedMapBuilder() {
  const { campusId } = useParams();
  const nav = useNavigate();
  // Main pathway (campus-level) data
  const [mainNodes, setMainNodes] = useState([]);
  const [mainPaths, setMainPaths] = useState([]);
  const [mainPathStart, setMainPathStart] = useState(null);
  const [showMainPathway, setShowMainPathway] = useState(true);
  const [step, setStep] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  
  // Data State
  const [campus, setCampus] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [paths, setPaths] = useState([]);

  // Active Context
  const [activeBlock, setActiveBlock] = useState(null);
  const [activeFloor, setActiveFloor] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  
  // Builder Tools
  const [drawMode, setDrawMode] = useState('select');
  const [pathStart, setPathStart] = useState(null);
  const [saving, setSaving] = useState(false);
  // Direction picker state: { nodeA, nodeB, floorId } shown in popup
  const [pendingPath, setPendingPath] = useState(null);

  // Step 1 State: Temporary Block before DB save
  const [tempBlockShape, setTempBlockShape] = useState(null);
  const [blockForm, setBlockForm] = useState({ name: '', id: '' });
  
  // Step 2 State
  const [floorCount, setFloorCount] = useState(1);

  useEffect(() => { 
    getCampus(campusId).then(r => setCampus(r.data)).catch(() => {}); 
    loadBlocks(); 
    loadMainPathway();
  }, [campusId]);

  const loadMainPathway = async () => {
    try {
      const [n, p] = await Promise.all([
        getAllCampusNodes(campusId),
        getAllCampusPaths(campusId)
      ]);
      setMainNodes(n.data);
      setMainPaths(p.data);
    } catch(e) { console.warn('Failed to load main pathway', e); }
  };

  const loadBlocks = async () => {
    const r = await getBlocks(campusId).catch(() => ({ data: [] }));
    setBlocks(r.data);
  };
  const loadFloors = async (bid) => {
    const r = await getFloors(bid).catch(() => ({ data: [] }));
    setFloors(r.data);
    if(r.data.length && !activeFloor) setActiveFloor(r.data[0]);
  };
  const loadFloorData = async (fid) => {
    if(!fid) return;
    const [a, b, c] = await Promise.all([getRooms(fid), getNodes(fid), getPaths(fid)].map(p => p.catch(() => ({ data: [] }))));
    setRooms(a.data); setNodes(b.data); setPaths(c.data);
  };

  useEffect(() => { if (activeBlock) loadFloors(activeBlock._id); }, [activeBlock]);
  useEffect(() => { if (activeFloor) loadFloorData(activeFloor._id); }, [activeFloor]);

  // Handle map drawing shapes
  const handleShapeDraw = async (layer, shapeType) => {
    let latlngs = [];
    if (layer.getLatLngs) {
      const ll = layer.getLatLngs();
      const arr = Array.isArray(ll[0]) ? (Array.isArray(ll[0][0]) ? ll[0][0] : ll[0]) : ll;
      latlngs = arr.map(l => ({ x: l.lat, y: l.lng }));
    } else {
      const b = layer.getBounds();
      latlngs = [
        { x: b.getSouth(), y: b.getWest() },
        { x: b.getNorth(), y: b.getWest() },
        { x: b.getNorth(), y: b.getEast() },
        { x: b.getSouth(), y: b.getEast() }
      ];
    }
    const newShape = { points: latlngs, type: shapeType === 'Rectangle' ? 'rectangle' : 'polygon' };
    
    if (step === 1) {
      setTempBlockShape(newShape);
      setDrawMode('select');
    } else if (step === 3 && activeFloor) {
      try {
        const res = await createRoom({ floorId: activeFloor._id, blockId: activeBlock._id, campusId, name: `New Room`, type: 'classroom', shape: newShape });
        toast.success('Room created');
        setActiveRoom(res.data);
        loadFloorData(activeFloor._id);
        setDrawMode('select');
      } catch(e) { toast.error('Failed to create room'); }
    }
  };

  const handleMapClick = async (ll) => {
    // STEP 0: Main pathway nodes & paths
    if (step === 0) {
      if (drawMode === 'addNode') {
        try {
          await createNode({ campusId, x: ll.lat, y: ll.lng, type: 'waypoint', label: 'Main Path' });
          toast.success('Main pathway node added');
          loadMainPathway();
        } catch(e) { toast.error('Failed to add node'); }
      } else if (drawMode === 'addPath') {
        const allNodes = mainNodes;
        const nearest = allNodes.reduce((b, n) => { const d = Math.hypot(n.x-ll.lat, n.y-ll.lng); return (!b||d<b.d)?{node:n,d}:b; }, null);
        if (!nearest || nearest.d > 0.0005) return toast.warn('Click near a node');
        if (!mainPathStart) { setMainPathStart(nearest.node); toast.info('Now click the end node'); }
        else {
          // Show direction picker popup instead of auto-saving
          setPendingPath({ nodeA: mainPathStart, nodeB: nearest.node, floorId: null, context: 'main' });
          setMainPathStart(null);
        }
      }
      return;
    }
    if (step === 3 && drawMode === 'select') setActiveRoom(null);
    if (step === 4 && activeFloor) {
      if (drawMode === 'addNode') {
        await createNode({ floorId: activeFloor._id, blockId: activeBlock._id, campusId, x: ll.lat, y: ll.lng, type: 'waypoint' });
        toast.success('Node added'); loadFloorData(activeFloor._id);
      } else if (drawMode === 'addPath') {
        // Combine floor nodes + main nodes for snapping
        const allNodes = [...nodes, ...mainNodes];
        const nearest = allNodes.reduce((b, n) => { const d = Math.hypot(n.x-ll.lat, n.y-ll.lng); return (!b||d<b.d)?{node:n,d}:b; }, null);
        if (!nearest || nearest.d > 0.0005) return toast.warn('Click near a node');
        if (!pathStart) { setPathStart(nearest.node); toast.info('Click end node'); }
        else {
          setPendingPath({ nodeA: pathStart, nodeB: nearest.node, floorId: activeFloor._id, context: 'floor' });
          setPathStart(null);
        }
      }
    }
  };

  // Save path with chosen direction
  const savePendingPath = async (direction) => {
    if (!pendingPath) return;
    try {
      const bidir = direction === 'both';
      // For 'incoming', swap nodeA and nodeB so the arrow points correctly
      const nodeA = direction === 'incoming' ? pendingPath.nodeB._id : pendingPath.nodeA._id;
      const nodeB = direction === 'incoming' ? pendingPath.nodeA._id : pendingPath.nodeB._id;
      await createPath({ nodeA, nodeB, floorId: pendingPath.floorId, campusId, bidirectional: bidir });
      toast.success(`Path saved (${direction})`);
      setPendingPath(null);
      loadMainPathway();
      if (pendingPath.floorId) loadFloorData(pendingPath.floorId);
    } catch(e) { toast.error('Failed to save path'); }
  };

  // Clear all main pathway nodes and paths
  const clearAllMainPaths = async () => {
    if (!window.confirm('Delete ALL main pathway nodes and paths? This cannot be undone.')) return;
    try {
      for (const p of mainPaths) { await deletePath(p._id); }
      for (const n of mainNodes) { await import('../api').then(m => m.deleteNode(n._id)); }
      toast.success('All main pathway data cleared');
      loadMainPathway();
    } catch(e) { toast.error('Failed to clear paths'); }
  };

  // Toggle path direction (bidirectional/one-way)
  const togglePathDirection = async (pathObj) => {
    try {
      await updatePath(pathObj._id, { bidirectional: !pathObj.bidirectional });
      toast.success(pathObj.bidirectional ? 'Set to one-way' : 'Set to bidirectional');
      loadMainPathway();
      if (activeFloor) loadFloorData(activeFloor._id);
    } catch(e) { toast.error('Failed to update path'); }
  };

  // STEP 1 ACTIONS
  const saveBlock = async () => {
    if (!tempBlockShape && !activeBlock?.shape) return toast.warn('Draw shape first');
    setSaving(true);
    try {
      if (activeBlock) {
        await updateBlock(activeBlock._id, { shape: activeBlock.shape });
        toast.success('Block Updated!');
        setStep(2);
      } else {
        const res = await createBlock({ name: blockForm.name, description: 'Block Shape stored', campusId });
        setActiveBlock({ ...res.data, shape: tempBlockShape });
        toast.success('Block Locked & Saved!');
        await loadBlocks();
        setStep(2);
      }
    } catch(e) { toast.error('Failed to save block'); }
    setSaving(false);
  };
  const removeBlock = async (id) => {
    if(window.confirm('Delete this entire block?')) {
      await deleteBlock(id); toast.success('Block deleted'); setActiveBlock(null); loadBlocks();
    }
  };

  // STEP 2 ACTIONS
  const generateFloors = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < floorCount; i++) {
        await createFloor({ name: i === 0 ? 'Ground Floor' : `Floor ${i}`, level: i, blockId: activeBlock._id, campusId });
      }
      toast.success(`${floorCount} Floors Generated!`);
      await loadFloors(activeBlock._id);
    } catch(e) { toast.error('Error generating floors'); }
    setSaving(false);
  };
  const removeFloor = async (id) => {
    if(window.confirm('Delete this floor?')) {
      await deleteFloor(id); toast.success('Floor deleted'); loadFloors(activeBlock._id);
    }
  };

  // STEP 3 ACTIONS
  const updateRoomProps = async () => {
    if (!activeRoom) return;
    setSaving(true);
    try {
      await updateRoom(activeRoom._id, { name: activeRoom.name, type: activeRoom.type, shape: activeRoom.shape });
      toast.success('Room updated'); loadFloorData(activeFloor._id);
    } catch(e) { toast.error('Update failed'); }
    setSaving(false);
  };
  
  const handlePropChange = (key, val) => setActiveRoom(p => ({ ...p, [key]: val }));

  // Dynamic Styles
  const S = {
    layout: { display: 'flex', height: '100vh', backgroundColor: '#0a0e1a', color: '#f1f5f9', fontFamily: "'Inter', sans-serif", overflow: 'hidden' },
    leftSidebar: { width: '320px', backgroundColor: '#111827', borderRight: '1px solid #1e2d40', display: 'flex', flexDirection: 'column', zIndex: 10 },
    header: { padding: '24px 20px', borderBottom: '1px solid #1e2d40', background: 'linear-gradient(180deg, #161e31 0%, #111827 100%)' },
    backBtn: { background: '#1a2235', color: '#94a3b8', border: '1px solid #2a3352', padding: 8, borderRadius: 8, cursor: 'pointer', marginBottom: 16, display: 'inline-flex' },
    stepsContainer: { padding: '24px 16px', flex: 1, overflowY: 'auto' },
    stepBox: (isActive, isDone) => ({ padding: 16, borderRadius: 12, border: '2px solid', borderColor: isActive ? '#6366f1' : (isDone ? '#22c55e' : '#1e2d40'), backgroundColor: isActive ? '#6366f110' : '#1a2235', opacity: (!isActive && !isDone) ? 0.6 : 1, display: 'flex', gap: 16, marginBottom: 16, transition: 'all 0.3s' }),
    stepNum: (isActive, isDone) => ({ width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isDone ? '#22c55e' : (isActive ? '#6366f1' : '#1e2d40'), color: '#fff', fontWeight: 800 }),
    centerCanvas: { flex: 1, position: 'relative' },
    topToolbar: { position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#111827E6', backdropFilter: 'blur(10px)', border: '1px solid #1e2d40', borderRadius: 30, padding: '8px 16px', display: 'flex', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' },
    toolBtn: (active) => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, background: active ? '#6366f1' : 'transparent', color: active ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }),
    rightPanel: { width: '360px', backgroundColor: '#111827', borderLeft: '1px solid #1e2d40', display: 'flex', flexDirection: 'column', zIndex: 10 },
    panelHeader: { padding: 20, borderBottom: '1px solid #1e2d40', display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 700 },
    panelBody: { padding: 20, flex: 1, overflowY: 'auto' },
    formGroup: { marginBottom: 20 },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    input: { width: '100%', padding: '12px 14px', borderRadius: 10, background: '#0a0e1a', border: '1px solid #1e2d40', color: '#fff', fontSize: 14, outline: 'none' },
    primaryBtn: { width: '100%', padding: 14, borderRadius: 10, background: '#6366f1', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 10 },
    successBtn: { width: '100%', padding: 14, borderRadius: 10, background: '#22c55e', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 10 },
    floorTabRow: { display: 'flex', gap: 8, padding: '12px 20px', background: '#161e31', borderBottom: '1px solid #1e2d40', overflowX: 'auto' },
    floorTab: (active) => ({ padding: '6px 16px', borderRadius: 20, background: active ? '#22c55e' : '#1a2235', color: active ? '#fff' : '#94a3b8', border: '1px solid', borderColor: active ? '#22c55e' : '#1e2d40', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' })
  };

  return (
    <div style={S.layout}>
      {/* LEFT SIDEBAR: WIZARD STEPS */}
      <div style={S.leftSidebar}>
        <div style={S.header}>
          <button onClick={() => nav('/campus')} style={S.backBtn}><FiArrowLeft size={16} /></button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Map Builder</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1 }}>{campus?.name || 'Guided Setup'}</p>
        </div>
        <div style={S.stepsContainer}>
          {STEPS.map((s, i) => (
            <div key={s.id} onClick={() => s.id < step && setStep(s.id)} style={{...S.stepBox(step === s.id, step > s.id), cursor: s.id < step ? 'pointer' : 'default'}}>
              <div style={S.stepNum(step === s.id, step > s.id)}>{step > s.id ? <FiCheck/> : s.id}</div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: step===s.id?'#fff':'#94a3b8' }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER CANVAS */}
      <div style={S.centerCanvas}>
        {/* Dynamic Top Toolbar based on Mode */}
        <div style={S.topToolbar}>
          {step === 0 && (
            <>
              <button style={S.toolBtn(drawMode === 'select')} onClick={() => setDrawMode('select')}><FiMove/> Select</button>
              <button style={S.toolBtn(drawMode === 'addNode')} onClick={() => setDrawMode('addNode')}><FiMap/> Add Node</button>
              <button style={S.toolBtn(drawMode === 'addPath')} onClick={() => { setDrawMode('addPath'); setMainPathStart(null); }}><FiNavigation/> Draw Path</button>
              <div style={{ width: 1, height: 24, background: '#1e2d40' }} />
              <button style={S.toolBtn(false)} onClick={() => setShowMainPathway(!showMainPathway)}>
                {showMainPathway ? '👁 Hide' : '👁‍🗨 Show'} Main Path
              </button>
            </>
          )}
          {step === 1 && (
            <>
              <button style={S.toolBtn(drawMode === 'select')} onClick={() => setDrawMode('select')}><FiMove/> Move</button>
              <button style={S.toolBtn(drawMode === 'rotate')} onClick={() => setDrawMode('rotate')}><FiRefreshCw/> Rotate</button>
              <button style={S.toolBtn(drawMode === 'drawBlockRect')} onClick={() => setDrawMode('drawBlockRect')}><FiSquare/> Draw Outer Block</button>
            </>
          )}
          {step === 3 && (
            <>
              <button style={S.toolBtn(drawMode === 'select')} onClick={() => setDrawMode('select')}><FiMove/> Select Room</button>
              <button style={S.toolBtn(drawMode === 'rotate')} onClick={() => setDrawMode('rotate')}><FiRefreshCw/> Rotate</button>
              <button style={S.toolBtn(drawMode === 'drawRoomRect')} onClick={() => setDrawMode('drawRoomRect')}><FiSquare/> Draw Room</button>
            </>
          )}
          {step === 4 && (
            <>
              <button style={S.toolBtn(drawMode === 'select')} onClick={() => setDrawMode('select')}><FiMove/> Select</button>
              <button style={S.toolBtn(drawMode === 'addNode')} onClick={() => setDrawMode('addNode')}><FiMap/> Add Node</button>
              <button style={S.toolBtn(drawMode === 'addPath')} onClick={() => { setDrawMode('addPath'); setPathStart(null); }}><FiNavigation/> Draw Path</button>
            </>
          )}
        </div>

        {/* Floor Switcher for Steps 3 & 4 */}
        {(step === 3 || step === 4) && floors.length > 0 && (
          <div style={{ position: 'absolute', top: 80, left: 20, zIndex: 1000, background: '#111827E6', backdropFilter: 'blur(10px)', borderRadius: 12, border: '1px solid #1e2d40', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', background: '#1a2235' }}>Active Floor</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {floors.map(f => (
                <button key={f._id} onClick={() => { setActiveFloor(f); setActiveRoom(null); }} style={{ padding: '10px 16px', background: activeFloor?._id === f._id ? '#22c55e' : 'transparent', color: activeFloor?._id === f._id ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <MapContainer center={GMRIT} zoom={17} style={{width:'100%', height:'100%', zIndex:0}} zoomControl={false} maxZoom={24} whenReady={() => setMapReady(true)}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={24} />
          <GeomanController onShapeDraw={handleShapeDraw} activeMode={drawMode} mapReady={mapReady} />
          <ClickHandler onClick={handleMapClick} />

          {/* === ALWAYS VISIBLE: Main Campus Pathway Nodes & Paths === */}
          {showMainPathway && mainNodes.map(n => (
            <Circle key={n._id} center={[n.x,n.y]} radius={step === 0 ? 2 : 1.5}
              pathOptions={{color:'#f59e0b', fillColor:'#f59e0b', fillOpacity: step === 0 ? 1 : 0.5, weight: step === 0 ? 3 : 2}}
              eventHandlers={step === 0 ? { click: (e) => { L.DomEvent.stopPropagation(e); if(window.confirm('Delete this main node?')){ import('../api').then(m => m.deleteNode(n._id).then(() => loadMainPathway())); } } } : {}}
            />
          ))}
          {showMainPathway && mainPaths.map(p => {
            const a = mainNodes.find(n => n._id === p.nodeA);
            const b = mainNodes.find(n => n._id === p.nodeB);
            if (!a || !b) return null;
            const color = p.bidirectional ? '#f59e0b' : '#ef4444';
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            return (
              <React.Fragment key={p._id}>
                <Polyline positions={[[a.x,a.y],[b.x,b.y]]} pathOptions={{color, weight: step === 0 ? 4 : 2, dashArray: p.bidirectional ? null : '8,4', opacity: step === 0 ? 0.9 : 0.4}}
                  eventHandlers={step === 0 ? { click: (e) => { 
                    L.DomEvent.stopPropagation(e);
                    const action = window.prompt('Enter action:\n1 = Outgoing (→)\n2 = Incoming (←)\n3 = Both Ways (↔)\n4 = Delete Path', '3');
                    if (action === '1') updatePath(p._id, { bidirectional: false }).then(() => loadMainPathway());
                    else if (action === '2') { updatePath(p._id, { bidirectional: false, nodeA: p.nodeB, nodeB: p.nodeA }).then(() => loadMainPathway()); }
                    else if (action === '3') updatePath(p._id, { bidirectional: true }).then(() => loadMainPathway());
                    else if (action === '4') { if(window.confirm('Delete this path?')) deletePath(p._id).then(() => loadMainPathway()); }
                  } } : {}} />
                {!p.bidirectional && (
                  <Circle center={[midX, midY]} radius={0.8} pathOptions={{color:'#ef4444', fillColor:'#ef4444', fillOpacity:1, weight:1}}>
                    <Tooltip permanent direction="center" className="room-label">
                      <span style={{fontSize:9,color:'#ef4444',fontWeight:800}}>→</span>
                    </Tooltip>
                  </Circle>
                )}
                {p.bidirectional && step === 0 && (
                  <Circle center={[midX, midY]} radius={0.5} pathOptions={{color:'#f59e0b', fillColor:'#f59e0b', fillOpacity:0.6, weight:1}}>
                    <Tooltip permanent direction="center" className="room-label">
                      <span style={{fontSize:8,color:'#f59e0b',fontWeight:800}}>↔</span>
                    </Tooltip>
                  </Circle>
                )}
              </React.Fragment>
            );
          })}
          {step === 0 && mainPathStart && <Circle center={[mainPathStart.x,mainPathStart.y]} radius={3} pathOptions={{color:'#22c55e',fillOpacity:1}} />}

          {/* Render Active Block Outline */}
          {activeBlock?.shape && (
            <EditablePolygon r={{ ...activeBlock, isBlock: true }} isSelected={step === 1} isLocked={step > 1} onUpdate={(id, s) => setActiveBlock(p => ({...p, shape: s}))} onClick={()=>{}} drawMode={drawMode} />
          )}
          {step === 1 && !activeBlock && tempBlockShape && (
            <EditablePolygon r={{ _id: 'temp', shape: tempBlockShape, type: 'other', name: 'New Block' }} isSelected={true} isLocked={false} onUpdate={(_, s) => setTempBlockShape(s)} onClick={()=>{}} drawMode={drawMode} />
          )}

          {/* Render Rooms (Step 3 & 4) */}
          {(step === 3 || step === 4) && rooms.map(r => {
            const currentRoom = activeRoom?._id === r._id ? activeRoom : r;
            return <EditablePolygon key={r._id} r={currentRoom} isSelected={activeRoom?._id === r._id} isLocked={step !== 3} 
              onUpdate={(id, s) => {
                setRooms(prev => prev.map(x => x._id === id ? { ...x, shape: s } : x));
                setActiveRoom(p => p?._id === id ? { ...p, shape: s } : { ...r, shape: s });
              }} 
              onClick={(roomData) => { if (step===3) setActiveRoom(p => p?._id === roomData._id ? p : roomData); }} 
              drawMode={drawMode} />;
          })}

          {/* Render Interior Nodes & Paths (Step 4) */}
          {step === 4 && nodes.map(n => <Circle key={n._id} center={[n.x,n.y]} radius={1} pathOptions={{color:NC[n.type]||'#94a3b8',fillColor:NC[n.type]||'#94a3b8',fillOpacity:1, weight:3}} />)}
          {step === 4 && paths.map(p => {
            const a=nodes.find(n=>n._id===p.nodeA) || mainNodes.find(n=>n._id===p.nodeA);
            const b=nodes.find(n=>n._id===p.nodeB) || mainNodes.find(n=>n._id===p.nodeB);
            return a&&b?<Polyline key={p._id} positions={[[a.x,a.y],[b.x,b.y]]} pathOptions={{color:'#22c55e',weight:3,dashArray:'6,6'}} eventHandlers={{click:()=>{ if(window.confirm('Delete path?')){ deletePath(p._id); loadFloorData(activeFloor._id); } }}} /> : null;
          })}
          {step === 4 && pathStart && <Circle center={[pathStart.x,pathStart.y]} radius={3} pathOptions={{color:'#f59e0b',fillOpacity:1}} />}
        </MapContainer>
      </div>

      {/* RIGHT PANEL: CONTEXT PROPERTIES */}
      <div style={S.rightPanel}>
        <div style={S.panelHeader}>
          {step === 0 && <><FiNavigation color="#f59e0b"/> Main Campus Pathway</>}
          {step === 1 && <><FiMap color="#6366f1"/> Block Definition</>}
          {step === 2 && <><FiLayers color="#6366f1"/> Floor Generation</>}
          {step === 3 && <><FiSquare color="#6366f1"/> Interior Elements</>}
          {step === 4 && <><FiNavigation color="#6366f1"/> Route Network</>}
        </div>

        <div style={S.panelBody}>
          {/* STEP 0: Main Pathway */}
          {step === 0 && (
            <>
              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #f59e0b30', fontSize: 13, color: '#94a3b8' }}>
                <FiInfo style={{marginBottom: 8}} color="#f59e0b" size={20}/>
                <p style={{margin:0}}>Draw the <strong style={{color:'#f59e0b'}}>main campus walkway</strong> connecting all areas. Click on the map with <strong>"Add Node"</strong> to place waypoints along roads, then link them with <strong>"Draw Path"</strong>.</p>
              </div>
              
              <div style={{ padding: 16, background: '#0a0e1a', borderRadius: 12, border: '1px solid #1e2d40', marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#f1f5f9' }}>Main Pathway Stats</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#94a3b8' }}><span>Nodes:</span> <span style={{ color: '#f59e0b', fontWeight: 800 }}>{mainNodes.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}><span>Paths:</span> <span style={{ color: '#f59e0b', fontWeight: 800 }}>{mainPaths.length}</span></div>
              </div>

              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #2a3352', fontSize: 12, color: '#94a3b8' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#f1f5f9' }}><FiRepeat size={14} style={{marginRight:6}}/> Direction Toggle</h4>
                <p style={{margin:'0 0 8px'}}>Click on any <strong style={{color:'#f59e0b'}}>path line</strong> to toggle between:</p>
                <div style={{display:'flex', gap:8, marginBottom:4}}>
                  <span style={{color:'#f59e0b', fontWeight:700}}>↔</span>
                  <span>Bidirectional (two-way)</span>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <span style={{color:'#ef4444', fontWeight:700}}>→</span>
                  <span>One-way (incoming/outgoing)</span>
                </div>
              </div>

              {(mainNodes.length > 0 || mainPaths.length > 0) && (
                <button style={{...S.primaryBtn, background:'#1a2235', color:'#ef4444', border:'1px solid #ef444450', marginBottom: 10}} onClick={clearAllMainPaths}>
                  <FiTrash2 style={{marginRight:6}}/> Clear All Paths & Nodes
                </button>
              )}

              {mainNodes.length > 0 && (
                <button style={{...S.successBtn, background:'#f59e0b', marginBottom: 10}} onClick={() => { toast.success('Main pathway saved!'); setStep(1); }}>
                  Save Main Pathway & Add Blocks →
                </button>
              )}
              {mainNodes.length === 0 && (
                <button style={{...S.primaryBtn, opacity: 0.5}} disabled>
                  Add nodes to proceed
                </button>
              )}
            </>
          )}

          {/* STEP 1: Block Props */}
          {step === 1 && (
            <>
              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #2a3352', fontSize: 13, color: '#94a3b8' }}>
                <FiInfo style={{marginBottom: 8}} color="#6366f1" size={20}/>
                <p style={{margin:0}}>Draw the outer bounding box of your building on the map. The <span style={{color:'#f59e0b'}}>main pathway</span> is shown in the background for reference.</p>
              </div>
              
              {blocks.length > 0 && !activeBlock && (
                <div style={{ marginBottom: 20 }}>
                  <label style={S.label}>Existing Blocks</label>
                  {blocks.map(b => (
                    <div key={b._id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#1a2235', borderRadius: 8, marginBottom: 8, border: '1px solid #2a3352', cursor: 'pointer' }} onClick={() => { setActiveBlock(b); setTempBlockShape(null); }}>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{b.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); removeBlock(b._id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><FiTrash2/></button>
                    </div>
                  ))}
                  <button style={{...S.primaryBtn, background: '#1a2235', border: '1px solid #1e2d40'}} onClick={() => { setActiveBlock(null); setTempBlockShape(null); setBlockForm({name:'', id:''}); }}>+ Draw New Block</button>
                </div>
              )}

              {(!activeBlock && (!blocks.length || tempBlockShape)) && (
                <>
                  <div style={S.formGroup}>
                    <label style={S.label}>New Block Name</label>
                    <input style={S.input} placeholder="e.g. CSE Block" value={blockForm.name} onChange={e => setBlockForm({ ...blockForm, name: e.target.value })} />
                  </div>
                  <button style={S.successBtn} onClick={saveBlock} disabled={saving}>{saving ? 'Saving...' : 'Confirm & Lock Block Shape'}</button>
                </>
              )}

              {activeBlock && (
                <>
                  <div style={S.formGroup}>
                    <label style={S.label}>Editing Block: {activeBlock.name}</label>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...S.primaryBtn, flex: 1, background: '#1a2235', color: '#ef4444', border: '1px solid #ef444450' }} onClick={() => removeBlock(activeBlock._id)}>Delete</button>
                    <button style={{ ...S.successBtn, flex: 2 }} onClick={saveBlock} disabled={saving}>Save Shape</button>
                  </div>
                  <button style={{ ...S.primaryBtn, marginTop: 16 }} onClick={() => setStep(2)}>Proceed to Floors</button>
                </>
              )}
            </>
          )}

          {/* STEP 2: Floor Props */}
          {step === 2 && (
            <>
              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #2a3352', fontSize: 13, color: '#94a3b8' }}>
                <p style={{margin:0}}>The block shape is locked. Manage floors for <strong>{activeBlock?.name}</strong>.</p>
              </div>
              
              {floors.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <label style={S.label}>Existing Floors</label>
                  {floors.map(f => (
                    <div key={f._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#1a2235', borderRadius: 8, marginBottom: 8, border: '1px solid #2a3352' }}>
                      <span style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{f.name}</span>
                      <button onClick={() => removeFloor(f._id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><FiTrash2/></button>
                    </div>
                  ))}
                  <button style={{...S.primaryBtn, background: '#1a2235', border: '1px solid #1e2d40', marginTop: 10}} onClick={() => setStep(3)}>Proceed to Interior Design</button>
                </div>
              )}

              <div style={{ padding: 16, borderTop: '1px dashed #2a3352' }}>
                <div style={S.formGroup}>
                  <label style={S.label}>Generate New Floors</label>
                  <input type="number" style={S.input} min="1" max="20" value={floorCount} onChange={e => setFloorCount(parseInt(e.target.value))} />
                </div>
                <button style={S.successBtn} onClick={generateFloors} disabled={saving}>{saving ? 'Generating...' : `Generate ${floorCount} Floors`}</button>
              </div>
            </>
          )}

          {/* STEP 3: Room Props */}
          {step === 3 && (
            <>
              {!activeRoom ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <FiSquare size={40} style={{ opacity: 0.3, marginBottom: 16 }} />
                  <p>Select a room on the map or draw a new one to edit properties.</p>
                </div>
              ) : (
                <>
                  <div style={S.formGroup}>
                    <label style={S.label}>Room Name</label>
                    <input style={S.input} value={activeRoom.name || ''} onChange={e => handlePropChange('name', e.target.value)} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Type</label>
                    <select style={S.input} value={activeRoom.type || 'classroom'} onChange={e => handlePropChange('type', e.target.value)}>
                      {Object.keys(RC).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                    <button style={{ ...S.primaryBtn, marginTop: 0, flex: 1, background: '#1a2235', color: '#ef4444', border: '1px solid #ef444450' }} onClick={() => { if(window.confirm('Delete?')) deleteRoom(activeRoom._id).then(()=>{setActiveRoom(null);loadFloorData(activeFloor._id);}); }}>Delete</button>
                    <button style={{ ...S.successBtn, marginTop: 0, flex: 2 }} onClick={updateRoomProps} disabled={saving}>{saving ? 'Saving...' : 'Save Room'}</button>
                  </div>
                </>
              )}
              {rooms.length > 0 && (
                 <button style={{ ...S.primaryBtn, background: '#1a2235', border: '1px solid #1e2d40', marginTop: 40 }} onClick={() => setStep(4)}>Proceed to Navigation Setup</button>
              )}
            </>
          )}

          {/* STEP 4: Nav Props */}
          {step === 4 && (
            <>
              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #2a3352', fontSize: 13, color: '#94a3b8' }}>
                <p style={{margin:0}}>Rooms are locked. Add nodes and link them to create the walkable navigation graph.</p>
              </div>
              <div style={{ padding: 16, background: '#0a0e1a', borderRadius: 12, border: '1px solid #1e2d40' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#f1f5f9' }}>Graph Stats</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#94a3b8' }}><span>Nodes:</span> <span style={{ color: '#22c55e', fontWeight: 800 }}>{nodes.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}><span>Paths:</span> <span style={{ color: '#22c55e', fontWeight: 800 }}>{paths.length}</span></div>
              </div>
              <button style={{ ...S.successBtn, marginTop: 'auto' }} onClick={() => { toast.success('Building Map Published Successfully!'); nav('/campus'); }}>Finish & Publish Building</button>
            </>
          )}
        </div>
      </div>
      
      {/* Global CSS overrides */}
      <style>{`
        .leaflet-pm-toolbar { display: none !important; }
        .room-label { background: transparent !important; border: none !important; box-shadow: none !important; }
        .room-label::before { display: none !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d40; border-radius: 10px; }
      `}</style>

      {/* DIRECTION PICKER POPUP */}
      {pendingPath && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}
          onClick={() => setPendingPath(null)}>
          <div style={{ background:'#111827', border:'1px solid #1e2d40', borderRadius:20, padding:28, width:340, boxShadow:'0 20px 60px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 6px', fontSize:18, fontWeight:800, color:'#fff' }}>Choose Direction</h3>
            <p style={{ margin:'0 0 20px', fontSize:12, color:'#94a3b8' }}>Select the traffic direction for this path segment.</p>

            {/* Outgoing: A → B */}
            <button onClick={() => savePendingPath('outgoing')} style={{
              width:'100%', padding:'14px 16px', borderRadius:12, border:'2px solid #3b82f630',
              background:'#1a2235', color:'#fff', cursor:'pointer', marginBottom:10,
              display:'flex', alignItems:'center', gap:12, textAlign:'left'
            }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#3b82f620', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:20 }}>→</span>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'#3b82f6' }}>Outgoing (A → B)</div>
                <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>One-way from start to end node</div>
              </div>
            </button>

            {/* Incoming: B → A */}
            <button onClick={() => savePendingPath('incoming')} style={{
              width:'100%', padding:'14px 16px', borderRadius:12, border:'2px solid #f59e0b30',
              background:'#1a2235', color:'#fff', cursor:'pointer', marginBottom:10,
              display:'flex', alignItems:'center', gap:12, textAlign:'left'
            }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#f59e0b20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:20 }}>←</span>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'#f59e0b' }}>Incoming (B → A)</div>
                <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>One-way from end to start node</div>
              </div>
            </button>

            {/* Both: A ↔ B */}
            <button onClick={() => savePendingPath('both')} style={{
              width:'100%', padding:'14px 16px', borderRadius:12, border:'2px solid #22c55e30',
              background:'#1a2235', color:'#fff', cursor:'pointer', marginBottom:10,
              display:'flex', alignItems:'center', gap:12, textAlign:'left'
            }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#22c55e20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:20 }}>↔</span>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'#22c55e' }}>Both Ways (A ↔ B)</div>
                <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Bidirectional, two-way traffic</div>
              </div>
            </button>

            <button onClick={() => setPendingPath(null)} style={{
              width:'100%', padding:10, borderRadius:10, background:'transparent',
              color:'#64748b', border:'1px solid #1e2d40', cursor:'pointer', marginTop:6, fontWeight:600, fontSize:13
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
