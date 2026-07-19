import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Polygon, Circle, Polyline, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { FiArrowLeft, FiPlus, FiTrash2, FiMap, FiLayers, FiSquare, FiNavigation, FiCheck, FiSettings, FiMove, FiInfo, FiCopy, FiRefreshCw, FiArrowRight, FiArrowLeftCircle, FiRepeat, FiMousePointer, FiUploadCloud, FiCrosshair, FiEdit2 } from 'react-icons/fi';
import { getBlocks, createBlock, updateBlock, deleteBlock, getFloors, createFloor, deleteFloor, getRooms, createRoom, updateRoom, deleteRoom, deleteStairsFromFloor, restoreStairsToFloor, getExcludedFloors, getNodes, createNode, getPaths, createPath, deletePath, updatePath, getCampus, updateCampus, getAllCampusNodes, getAllCampusPaths, getMapLayers, createMapLayer, updateMapLayer, deleteMapLayer, publishMap } from '../api';
import Admin3DViewer from '../components/Admin3DViewer';

const GMRIT = [18.4665, 83.6629];
const RC = {
  // Campus
  classroom: '#3b82f6', office: '#8b5cf6', lab: '#22c55e', restroom: '#f59e0b', cafeteria: '#ef4444', library: '#06b6d4', auditorium: '#ec4899', elevator: '#6366f1', stairs: '#f97316', corridor: '#64748b', entrance: '#10b981', exit: '#ef4444', bus_stop: '#14b8a6', other: '#94a3b8',
  // Hospital
  ward: '#3b82f6', icu: '#ef4444', ot: '#dc2626', pharmacy: '#22c55e', reception: '#8b5cf6', emergency: '#ef4444', radiology: '#f59e0b', pathology: '#06b6d4', blood_bank: '#dc2626', consultation: '#6366f1', waiting_area: '#94a3b8', nursing_station: '#ec4899',
  // Airport
  gate: '#3b82f6', terminal: '#6366f1', check_in: '#22c55e', security: '#ef4444', lounge: '#8b5cf6', baggage_claim: '#f59e0b', immigration: '#f97316', duty_free: '#ec4899', boarding: '#06b6d4', customs: '#64748b',
  // Mall
  store: '#3b82f6', food_court: '#ef4444', anchor_store: '#6366f1', kiosk: '#f59e0b', parking: '#64748b', entertainment: '#ec4899', atm: '#22c55e', customer_service: '#8b5cf6', fitting_room: '#94a3b8',
  // Building
  conference: '#3b82f6', server_room: '#ef4444', lobby: '#6366f1', mail_room: '#f59e0b', gym: '#22c55e', rooftop: '#06b6d4', storage: '#64748b', utility: '#94a3b8', break_room: '#ec4899', reception_desk: '#8b5cf6'
};
const NC = { waypoint: '#94a3b8', entrance: '#10b981', exit: '#ef4444', elevator: '#6366f1', stairs: '#f97316', room_entry: '#3b82f6', intersection: '#f59e0b', connector: '#8b5cf6' };

// Venue-specific room types
const VENUE_ROOM_TYPES = {
  campus: ['classroom', 'office', 'lab', 'restroom', 'cafeteria', 'library', 'auditorium', 'elevator', 'stairs', 'corridor', 'entrance', 'exit', 'parking', 'bus_stop', 'other'],
  hospital: ['ward', 'icu', 'ot', 'pharmacy', 'reception', 'emergency', 'radiology', 'pathology', 'blood_bank', 'consultation', 'waiting_area', 'nursing_station', 'elevator', 'stairs', 'restroom', 'cafeteria', 'entrance', 'exit', 'corridor', 'other'],
  airport: ['gate', 'terminal', 'check_in', 'security', 'lounge', 'baggage_claim', 'immigration', 'duty_free', 'boarding', 'customs', 'restroom', 'cafeteria', 'elevator', 'stairs', 'entrance', 'exit', 'corridor', 'other'],
  mall: ['store', 'food_court', 'anchor_store', 'kiosk', 'parking', 'entertainment', 'atm', 'customer_service', 'fitting_room', 'restroom', 'elevator', 'stairs', 'entrance', 'exit', 'corridor', 'other'],
  building: ['office', 'conference', 'server_room', 'lobby', 'mail_room', 'gym', 'rooftop', 'storage', 'utility', 'break_room', 'reception_desk', 'restroom', 'cafeteria', 'elevator', 'stairs', 'entrance', 'exit', 'corridor', 'other'],
  other: Object.keys(RC)
};

// Venue-specific block domain categories (comprehensive real-world sections)
const VENUE_DOMAINS = {
  campus: [
    'Academic Blocks', 'Administrative Block', 'Boys Hostels', 'Girls Hostels',
    'Faculty Quarters', 'Main Gates', 'Libraries', 'Cafeteria & Dining',
    'Sports & Recreation', 'Auditorium & Convention', 'Workshop & Labs',
    'Research Center', 'Placement Cell', 'Health Center', 'Bank & ATM',
    'Transport Hub', 'Bus Stop', 'Parking Area', 'Gardens & Open Areas', 'Other Facilities'
  ],
  hospital: [
    'Main Building', 'OPD Block (Out-Patient)', 'IPD Block (In-Patient)',
    'Emergency & Trauma Wing', 'ICU & Critical Care', 'Surgical Block (OT)',
    'Maternity & Gynecology Wing', 'Pediatrics Wing', 'Orthopedic Wing',
    'Cardiology Wing', 'Neurology Wing', 'Oncology Wing', 'ENT Department',
    'Eye (Ophthalmology) Dept', 'Dental Wing', 'Dermatology Wing',
    'Radiology & Imaging Center', 'Pathology & Lab Block', 'Blood Bank',
    'Pharmacy Block', 'Physiotherapy & Rehab', 'Dialysis Center',
    'Mortuary & Forensic', 'Administrative Block', 'Billing & Insurance',
    'Canteen & Cafeteria', 'Ambulance Bay', 'Medical Store',
    'Staff Quarters', 'Visitors Lounge', 'Parking Area',
    'Waste Management', 'Power & Utilities', 'Other'
  ],
  airport: [
    'Domestic Terminal', 'International Terminal', 'Terminal 1', 'Terminal 2',
    'Terminal 3', 'VIP Terminal', 'Cargo Terminal', 'General Aviation Terminal',
    'Departure Hall', 'Arrival Hall', 'Transit Area',
    'Check-in Zone', 'Security & Screening', 'Immigration & Passport Control',
    'Customs Area', 'Baggage Handling Area', 'Duty Free Zone',
    'Food Court & Restaurants', 'Airline Lounges', 'Business Center',
    'Control Tower (ATC)', 'Hangar Area', 'Runway & Taxiway',
    'Fuel Farm', 'Maintenance & Engineering', 'Fire Station',
    'Multi-Level Parking', 'Bus & Taxi Stand', 'Metro / Rail Link',
    'Airport Hotel', 'Medical Center', 'Prayer Room & Chapel',
    'Administrative Block', 'Police & Security Office', 'Lost & Found', 'Other'
  ],
  mall: [
    'Anchor Store Zone', 'Fashion & Apparel Wing', 'Electronics & Gadgets Wing',
    'Jewelry & Accessories Wing', 'Home & Living Wing', 'Beauty & Cosmetics',
    'Kids & Toys Zone', 'Supermarket / Hypermarket', 'Food Court',
    'Fine Dining Floor', 'Café & Bakery Zone', 'Entertainment Zone',
    'Multiplex / Cinema', 'Gaming Arcade', 'Bowling & Sports',
    'Fitness & Gym', 'Spa & Salon', 'Event Plaza / Atrium',
    'Admin & Management Office', 'Customer Service Center', 'ATM & Banking',
    'Basement Parking 1', 'Basement Parking 2', 'Rooftop Parking',
    'Loading & Service Area', 'Housekeeping & Utility', 'Security Office', 'Other'
  ],
  building: [
    'Main Lobby & Reception', 'East Wing', 'West Wing', 'North Wing', 'South Wing',
    'Executive Floor', 'Conference & Meeting Zone', 'Co-Working Space',
    'IT & Server Room', 'Finance Department', 'HR Department',
    'Marketing Department', 'Sales Department', 'Legal Department',
    'R&D / Innovation Lab', 'Training Center', 'Board Room Floor',
    'Cafeteria & Break Room', 'Gym & Wellness', 'Rooftop / Terrace',
    'Parking Level B1', 'Parking Level B2', 'Parking Level B3',
    'Mail Room & Dispatch', 'Storage & Archives', 'Maintenance & Utility',
    'Security & Reception', 'Visitor Lounge', 'Medical Room', 'Other'
  ],
  other: [
    'Section A', 'Section B', 'Section C', 'Section D',
    'Main Building', 'Annex Building', 'Parking Area',
    'Administrative Zone', 'Public Area', 'Restricted Zone', 'Other'
  ]
};

const STEPS = [
  { id: 0, title: 'Main Pathway', desc: 'Campus Roads & Walkways', icon: <FiNavigation /> },
  { id: 1, title: 'Block Design', desc: 'Outer Structure', icon: <FiMap /> },
  { id: 2, title: 'Floor Setup', desc: 'Level Generation', icon: <FiLayers /> },
  { id: 3, title: 'Interior Design', desc: 'Rooms & Facilities', icon: <FiSquare /> },
  { id: 4, title: 'Block Navigation', desc: 'Interior Paths & Nodes', icon: <FiNavigation /> },
  { id: 5, title: 'Custom Zones', desc: 'Colored Overlay Layers', icon: <FiMap /> },
];

function GeomanController({ onShapeDraw, activeMode }) {
  const map = useMap();
  const onShapeDrawRef = useRef(onShapeDraw);
  useEffect(() => {
    onShapeDrawRef.current = onShapeDraw;
  }, [onShapeDraw]);

  useEffect(() => {
    if (!map) return;
    map.pm.addControls({ drawMarker:false, drawCircleMarker:false, drawPolyline:false, drawRectangle:false, drawPolygon:false, drawCircle:false, editMode:false, dragMode:false, cutPolygon:false, removalMode:false, position:'bottomleft' });

    map.on('pm:create', (e) => {
      onShapeDrawRef.current(e.layer, e.shape);
      map.removeLayer(e.layer);
    });
    return () => { map.pm.removeControls(); map.off('pm:create'); };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    map.pm.disableDraw();

    if (activeMode === 'rotate') map.pm.enableGlobalRotateMode();
    else map.pm.disableGlobalRotateMode();

    if (activeMode === 'drag') map.pm.enableGlobalDragMode();
    else map.pm.disableGlobalDragMode();

    if (activeMode === 'drawBlockRect') map.pm.enableDraw('Rectangle', { snappable: true, snapDistance: 20 });
    if (activeMode === 'drawBlockPoly') map.pm.enableDraw('Polygon', { snappable: true, snapDistance: 20 });
    if (activeMode === 'drawRoomRect') map.pm.enableDraw('Rectangle', { snappable: true, snapDistance: 15 });
    if (activeMode === 'drawRoomPoly') map.pm.enableDraw('Polygon', { snappable: true, snapDistance: 15 });
    if (activeMode === 'drawRadius') map.pm.enableDraw('Circle', { snappable: false });
  }, [activeMode, map]);
  return null;
}

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, 18);
    }
  }, []); // Only center map once on load
  return null;
}

const EditablePolygon = ({ r, isSelected, isLocked, onUpdate, onClick, activeMode }) => {
  const polyRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  const s = r.shape || { points: [] };
  const c = r.color || r.shape?.fill || RC[r.type] || (r.isBlock ? '#64748b' : '#94a3b8');

  // NEVER pass inline array to positions prop directly.
  const initialBounds = useRef(
    s.points && s.points.length > 0
      ? s.points.map(p => [p.x, p.y])
      : []
  );

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Main Geoman Management Effect
  useEffect(() => {
    const layer = polyRef.current;
    if (!layer) return;

    const handleEdit = () => {
      let pts = [];
      if (layer.getLatLngs) {
        const ll = layer.getLatLngs();
        const arr = Array.isArray(ll[0]) ? (Array.isArray(ll[0][0]) ? ll[0][0] : ll[0]) : ll;
        pts = arr.map(l => ({ x: l.lat, y: l.lng }));
      }
      onUpdateRef.current(r._id || 'temp', { points: pts, type: r.shape?.type || 'polygon' });
    };

    // Attach listeners
    layer.on('pm:markerdragend', handleEdit);
    layer.on('pm:dragend', handleEdit);
    layer.on('pm:rotateend', handleEdit);
    layer.on('pm:cut', handleEdit);

    // Determine if Geoman edit mode should be active
    const shouldBeEnabled = isSelected && !isLocked && (!activeMode || activeMode === 'select');

    if (shouldBeEnabled) {
      layer.pm.enable({
        allowSelfIntersection: false,
        preventMarkerRemoval: true,
        snappable: true,
        draggable: true // Re-enable draggable so user can drag in Select mode
      });
    } else {
      layer.pm.disable();
    }

    return () => {
      layer.off('pm:markerdragend', handleEdit);
      layer.off('pm:dragend', handleEdit);
      layer.off('pm:rotateend', handleEdit);
      layer.off('pm:cut', handleEdit);
      layer.pm.disable();
    };
  }, [isSelected, isLocked, activeMode]); // Run when selection/mode changes

  // Sync positions from external changes (Undo/Redo)
  useEffect(() => {
    const layer = polyRef.current;
    if (!layer || !s.points || s.points.length === 0) return;

    const ll = layer.getLatLngs();
    if (!ll || ll.length === 0) return;

    const arr = Array.isArray(ll[0]) ? (Array.isArray(ll[0][0]) ? ll[0][0] : ll[0]) : ll;
    if (arr.length > 0 && s.points.length > 0) {
      const dist = Math.hypot(arr[0].lat - s.points[0].x, arr[0].lng - s.points[0].y);
      if (dist > 0.00001) { // Significant external change
        const wasEnabled = layer.pm.enabled();
        if (wasEnabled) layer.pm.disable();
        layer.setLatLngs(s.points.map(p => [p.x, p.y]));
        if (wasEnabled) {
          layer.pm.enable({ allowSelfIntersection: false, preventMarkerRemoval: true, snappable: true, draggable: true });
        }
      }
    }
  }, [s.points]); // Run when shape updates

  // Memoize pathOptions to prevent react-leaflet from calling setStyle on every re-render
  const pathOpts = React.useMemo(() => ({
    color: isSelected ? '#fff' : c,
    fillColor: c,
    fillOpacity: r.isBlock ? 0.1 : (isSelected ? 0.6 : 0.3),
    weight: isSelected ? 3 : (r.isBlock ? 2 : 1.5),
    dashArray: r.isBlock ? '5, 5' : null
  }), [isSelected, c, r.isBlock]);

  // Memoize event handlers to prevent react-leaflet re-binds which can disrupt Geoman
  const rRef = useRef(r);
  const onClickRef = useRef(onClick);
  useEffect(() => {
    rRef.current = r;
    onClickRef.current = onClick;
  }, [r, onClick]);

  const eventHandlers = React.useMemo(() => ({
    click: (e) => {
      if (!isLocked) {
        L.DomEvent.stopPropagation(e);
        onClickRef.current(rRef.current);
      }
    }
  }), [isLocked]); // ONLY recreate if isLocked changes!

  if (!initialBounds.current || initialBounds.current.length === 0) return null;

  return (
    <Polygon ref={polyRef} positions={initialBounds.current}
      pathOptions={pathOpts}
      eventHandlers={eventHandlers}>
      {r.name && (
        <Tooltip permanent direction="center" className={r.isBlock ? "block-label" : "room-label"}>
          <span style={{ 
            fontSize: r.isBlock ? 12 : 10, 
            fontWeight: 800, 
            color: r.isBlock ? '#818cf8' : '#fff', 
            textShadow: r.isBlock ? '0 1px 3px rgba(0,0,0,0.9)' : '0 1px 2px rgba(0,0,0,0.8)' 
          }}>{r.name}</span>
        </Tooltip>
      )}
    </Polygon>
  );
};

const EditableNode = ({ n, stepMode, onUpdate, onDelete, isMain }) => {
  const ref = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
  }, [onUpdate, onDelete]);

  useEffect(() => {
    const layer = ref.current;
    if (!layer) return;

    const handleDragEnd = () => {
      const ll = layer.getLatLng();
      onUpdateRef.current(n._id, { x: ll.lat, y: ll.lng });
    };

    layer.on('pm:dragend', handleDragEnd);

    if (stepMode === 0 || stepMode === 4) {
      layer.pm.enable();
    } else {
      layer.pm.disable();
    }

    return () => {
      layer.off('pm:dragend', handleDragEnd);
      layer.pm.disable();
    };
  }, [n._id, stepMode]);

  return (
    <Circle ref={ref} center={[n.x, n.y]} radius={stepMode === 0 ? 2 : 1}
      pathOptions={{ color: isMain ? '#f59e0b' : (NC[n.type] || '#94a3b8'), fillColor: isMain ? '#f59e0b' : (NC[n.type] || '#94a3b8'), fillOpacity: isMain ? 1 : 0.8, weight: isMain ? 3 : 2 }}
      eventHandlers={{
        click: (e) => {
          if (stepMode !== 0 && stepMode !== 4) return;
          L.DomEvent.stopPropagation(e);
          const act = window.prompt(`Node options:\n1 = Delete Node\n2 = Change Type (Current: ${n.type || 'waypoint'})`, '1');
          if (act === '1') {
            if (window.confirm('Delete this node?')) onDeleteRef.current(n._id);
          } else if (act === '2') {
            const newType = window.prompt(`Enter new type (waypoint, entrance, exit, elevator, stairs, room_entry, intersection, connector):`, n.type || 'waypoint');
            if (newType) onUpdateRef.current(n._id, { type: newType });
          }
        }
      }}
    />
  );
};

const EditablePath = ({ p, a, b, stepMode, onUpdate, onDelete }) => {
  const color = p.bidirectional ? '#f59e0b' : '#ef4444';
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  return (
    <React.Fragment>
      <Polyline positions={[[a.x, a.y], [b.x, b.y]]} pathOptions={{ color, weight: stepMode === 0 ? 4 : 3, dashArray: p.bidirectional ? null : (stepMode === 0 ? '8,4' : '6,6'), opacity: stepMode === 0 ? 0.9 : 0.8 }}
        eventHandlers={{
          click: (e) => {
            if (stepMode !== 0 && stepMode !== 4) return;
            L.DomEvent.stopPropagation(e);
            const action = window.prompt('Path options:\n1 = Outgoing (→)\n2 = Incoming (←)\n3 = Both Ways (↔)\n4 = Delete Path', p.bidirectional ? '3' : '1');
            if (action === '1') onUpdate(p._id, { bidirectional: false, nodeA: a._id, nodeB: b._id });
            else if (action === '2') onUpdate(p._id, { bidirectional: false, nodeA: b._id, nodeB: a._id });
            else if (action === '3') onUpdate(p._id, { bidirectional: true });
            else if (action === '4') { if (window.confirm('Delete this path?')) onDelete(p._id); }
          }
        }}
      />
      {!p.bidirectional && (
        <Circle center={[midX, midY]} radius={0.8} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1, weight: 1 }}>
          <Tooltip permanent direction="center" className="room-label"><span style={{ fontSize: 9, color: '#ef4444', fontWeight: 800 }}>→</span></Tooltip>
        </Circle>
      )}
      {p.bidirectional && (
        <Circle center={[midX, midY]} radius={0.5} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.6, weight: 1 }}>
          <Tooltip permanent direction="center" className="room-label"><span style={{ fontSize: 8, color: '#f59e0b', fontWeight: 800 }}>↔</span></Tooltip>
        </Circle>
      )}
    </React.Fragment>
  );
};

function ClickHandler({ onClick }) { useMapEvents({ click: e => onClick(e.latlng) }); return null; }

export default function GuidedMapBuilder() {
  const { campusId } = useParams();
  const nav = useNavigate();
  
  // Auto-Save State (Phase 9)
  const [isBlockDirty, setIsBlockDirty] = useState(false);
  const [isRoomDirty, setIsRoomDirty] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState(null);

  // Security authorization validation (Phase 12)
  const savedAdmin = localStorage.getItem('navx_admin');
  const parsedAdmin = savedAdmin ? JSON.parse(savedAdmin) : null;
  const loggedAdminCampusId = parsedAdmin?.campusId?._id || parsedAdmin?.campusId;
  const isAuthorized = !parsedAdmin || parsedAdmin.role === 'SuperAdmin' || !loggedAdminCampusId || loggedAdminCampusId === campusId;

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
  const [mapLayers, setMapLayers] = useState([]);

  // Active Context
  const [activeBlock, setActiveBlock] = useState(null);
  const [activeFloor, setActiveFloor] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [activeLayer, setActiveLayer] = useState(null);

  // Builder Tools
  const [drawMode, setDrawMode] = useState('select');
  const [pathStart, setPathStart] = useState(null);
  const [saving, setSaving] = useState(false);
  // Direction picker state: { nodeA, nodeB, floorId } shown in popup
  const [pendingPath, setPendingPath] = useState(null);

  // Step 1 State: Temporary Block before DB save
  const [tempBlockShape, setTempBlockShape] = useState(null);
  const venueType = campus?.venueType || 'campus';
  const [blockForm, setBlockForm] = useState({ name: '', domain: (VENUE_DOMAINS[venueType] || VENUE_DOMAINS.campus)[0], id: '' });

  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState(null);

  // Step 2 State
  const [floorCount, setFloorCount] = useState(1);

  // Per-floor stairs management state
  const [stairsFloorPanel, setStairsFloorPanel] = useState(false);
  const [excludedFloorsMap, setExcludedFloorsMap] = useState({});
  const [stairsLoading, setStairsLoading] = useState(false);
  
  // 3D Admin Viewer State
  const [is3DMode, setIs3DMode] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;
    getCampus(campusId).then(r => setCampus(r.data)).catch(() => { });
    loadBlocks();
    loadMainPathway();
  }, [campusId, isAuthorized]);

  // Periodic Auto-Save hook (Phase 9)
  useEffect(() => {
    if (!isAuthorized) return;
    const autoSaveTimer = setInterval(async () => {
      if (isBlockDirty && activeBlock) {
        try {
          await updateBlock(activeBlock._id, { 
            shape: activeBlock.shape, 
            domain: blockForm.domain, 
            name: blockForm.name 
          });
          setIsBlockDirty(false);
          setLastAutoSaved(new Date().toLocaleTimeString());
          loadBlocks();
        } catch (e) {
          console.warn('Auto-save block failed:', e);
        }
      }

      if (isRoomDirty && activeRoom && activeFloor) {
        try {
          await updateRoom(activeRoom._id, { 
            name: activeRoom.name, 
            type: activeRoom.type, 
            shape: activeRoom.shape 
          });
          setIsRoomDirty(false);
          setLastAutoSaved(new Date().toLocaleTimeString());
          loadFloorData(activeFloor._id);
        } catch (e) {
          console.warn('Auto-save room failed:', e);
        }
      }
    }, 5000);

    return () => clearInterval(autoSaveTimer);
  }, [isBlockDirty, isRoomDirty, activeBlock, activeRoom, blockForm, activeFloor, isAuthorized]);

  useEffect(() => {
    const handleMapRefresh = async (e) => {
      await loadBlocks();
      
      const { blockId, floorId } = e.detail || {};
      
      if (blockId && (!activeBlock || activeBlock._id !== blockId)) {
        // Find the block in the latest loaded blocks? We don't have them easily accessible as loadBlocks sets state.
        // Let's just set the activeBlock state directly with the ID if we can, or rely on the user to switch manually if it's too complex.
        // Actually, let's look up the block in `blocks` state.
        setBlocks(prevBlocks => {
          const targetBlock = prevBlocks.find(b => b._id === blockId);
          if (targetBlock) {
            setActiveBlock(targetBlock);
          }
          return prevBlocks;
        });
      }

      if (floorId) {
        // We might not have the floor object loaded yet if we just switched blocks.
        // We can just fetch the floor directly or loadFloorData for that floorId.
        await loadFloorData(floorId);
        // Also update activeFloor if possible
        setFloors(prevFloors => {
          const targetFloor = prevFloors.find(f => f._id === floorId);
          if (targetFloor) setActiveFloor(targetFloor);
          return prevFloors;
        });
      } else if (activeFloor) {
        await loadFloorData(activeFloor._id);
      }
    };
    window.addEventListener('navx-map-refresh', handleMapRefresh);
    return () => window.removeEventListener('navx-map-refresh', handleMapRefresh);
  }, [activeFloor, activeBlock]);

  const [allNodes, setAllNodes] = useState([]);

  const loadMainPathway = async () => {
    try {
      const [n, p, all, ml] = await Promise.all([
        getAllCampusNodes(campusId),
        getAllCampusPaths(campusId),
        import('../api').then(m => m.default.get(`/nodes?campusId=${campusId}`)),
        getMapLayers(campusId)
      ]);
      setMainNodes(n.data);
      setMainPaths(p.data);
      setAllNodes(all.data || []);
      setMapLayers(ml.data || []);
    } catch (e) { console.warn('Failed to load main pathway', e); }
  };

  const loadBlocks = async () => {
    const r = await getBlocks(campusId).catch(() => ({ data: [] }));
    setBlocks(r.data);
  };
  const loadFloors = async (bid) => {
    const r = await getFloors(bid, campusId).catch(() => ({ data: [] }));
    setFloors(r.data);
    if (r.data.length && !activeFloor) setActiveFloor(r.data[0]);
  };
  const loadFloorData = async (fid) => {
    if (!fid) return;
    const [a, b, c] = await Promise.all([getRooms(fid, activeBlock?._id), getNodes(fid, activeBlock?._id), getPaths(fid)].map(p => p.catch(() => ({ data: [] }))));
    setRooms(a.data); setNodes(b.data); setPaths(c.data);
  };

  useEffect(() => { if (activeBlock) loadFloors(activeBlock._id); }, [activeBlock]);
  useEffect(() => { if (activeFloor) loadFloorData(activeFloor._id); }, [activeFloor]);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const pushUndo = (action) => {
    setUndoStack(prev => [...prev, action]);
    setRedoStack([]);
  };

  // handleUndo / handleRedo kept for button clicks (toolbar)
  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, action]);

    try {
      if (action.type === 'PASTE_BLOCK' || action.type === 'DUPLICATE_BLOCK') {
        await deleteBlock(action.id);
        if (activeBlock?._id === action.id) setActiveBlock(null);
        await loadBlocks();
        toast.info('Undo: Removed Block');
      } else if (action.type === 'PASTE_ROOM' || action.type === 'DUPLICATE_ROOM') {
        await deleteRoom(action.id);
        if (activeRoom?._id === action.id) setActiveRoom(null);
        if (activeFloor) await loadFloorData(activeFloor._id);
        toast.info('Undo: Removed Room');
      }
    } catch (err) { toast.error('Undo failed'); }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, action]);

    try {
      if (action.type === 'PASTE_BLOCK' || action.type === 'DUPLICATE_BLOCK') {
        const res = await createBlock(action.blockData);
        await updateBlock(res.data._id, { shape: action.blockData.shape });
        action.id = res.data._id;
        await loadBlocks();
        toast.info('Redo: Restored Block');
      } else if (action.type === 'PASTE_ROOM' || action.type === 'DUPLICATE_ROOM') {
        const res = await createRoom(action.roomData);
        action.id = res.data._id;
        if (activeFloor) await loadFloorData(activeFloor._id);
        toast.info('Redo: Restored Room');
      }
    } catch (err) { toast.error('Redo failed'); }
  };

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────
  // IMPORTANT: undo/redo logic is inlined here (not calling handleUndo/handleRedo)
  // because those functions close over stale state when captured inside a useEffect.
  // Inlining them lets the closure directly read the current undoStack/redoStack values.
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Don't trigger if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // ── Escape: cancel active draw mode ──────────────────────────────
      if (e.key === 'Escape') {
        setDrawMode('select');
        setMainPathStart(null);
        setPathStart(null);
        setPendingPath(null);
        return;
      }

      // ── Delete / Backspace: remove selected item ──────────────────────
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (step === 1 && activeBlock) {
          if (window.confirm(`Delete block "${activeBlock.name}"?`)) {
            await deleteBlock(activeBlock._id);
            toast.success('Block deleted');
            setActiveBlock(null);
            await loadBlocks();
          }
        } else if (step === 3 && activeRoom) {
          if (window.confirm(`Delete room "${activeRoom.name}"?`)) {
            await deleteRoom(activeRoom._id);
            toast.success('Room deleted');
            setActiveRoom(null);
            if (activeFloor) await loadFloorData(activeFloor._id);
          }
        }
        return;
      }

      if (!isCtrl) return;

      // ── Ctrl+Z: Undo (inline — reads fresh undoStack) ────────────────
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length === 0) { toast.warn('Nothing to undo'); return; }
        const action = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, action]);
        try {
          if (action.type === 'PASTE_BLOCK' || action.type === 'DUPLICATE_BLOCK') {
            await deleteBlock(action.id);
            if (activeBlock?._id === action.id) setActiveBlock(null);
            await loadBlocks();
            toast.info('Undo: Removed Block');
          } else if (action.type === 'PASTE_ROOM' || action.type === 'DUPLICATE_ROOM') {
            await deleteRoom(action.id);
            if (activeRoom?._id === action.id) setActiveRoom(null);
            if (activeFloor) await loadFloorData(activeFloor._id);
            toast.info('Undo: Removed Room');
          }
        } catch (err) { toast.error('Undo failed'); }
        return;
      }

      // ── Ctrl+Y or Ctrl+Shift+Z: Redo (inline — reads fresh redoStack) ─
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        if (redoStack.length === 0) { toast.warn('Nothing to redo'); return; }
        const action = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, action]);
        try {
          if (action.type === 'PASTE_BLOCK' || action.type === 'DUPLICATE_BLOCK') {
            const res = await createBlock(action.blockData);
            await updateBlock(res.data._id, { shape: action.blockData.shape });
            action.id = res.data._id;
            await loadBlocks();
            toast.info('Redo: Restored Block');
          } else if (action.type === 'PASTE_ROOM' || action.type === 'DUPLICATE_ROOM') {
            const res = await createRoom(action.roomData);
            action.id = res.data._id;
            if (activeFloor) await loadFloorData(activeFloor._id);
            toast.info('Redo: Restored Room');
          }
        } catch (err) { toast.error('Redo failed'); }
        return;
      }

      // ── Ctrl+C: Copy ──────────────────────────────────────────────────
      if (key === 'c') {
        e.preventDefault();
        if (step === 1 && activeBlock) {
          setClipboard({ type: 'block', data: activeBlock });
          toast.info('📋 Block copied');
        } else if (step === 3 && activeRoom) {
          setClipboard({ type: 'room', data: activeRoom });
          toast.info('📋 Room copied');
        } else {
          toast.warn('Select a block (Step 1) or room (Step 3) first');
        }
        return;
      }

      // ── Ctrl+V: Paste ─────────────────────────────────────────────────
      if (key === 'v') {
        e.preventDefault();
        if (!clipboard) { toast.warn('Nothing in clipboard — use Ctrl+C first'); return; }

        if (step === 1 && clipboard.type === 'block') {
          const offset = 0.0001;
          const newShape = { ...clipboard.data.shape };
          if (newShape.points) {
            newShape.points = newShape.points.map(p => ({ x: p.x + offset, y: p.y - offset }));
          }
          try {
            setSaving(true);
            const blockData = { name: `${clipboard.data.name} (Copy)`, description: clipboard.data.description, campusId, shape: newShape };
            const res = await createBlock(blockData);
            await updateBlock(res.data._id, { shape: newShape });
            toast.success('Block pasted');
            pushUndo({ type: 'PASTE_BLOCK', id: res.data._id, blockData });
            await loadBlocks();
            setActiveBlock({ ...res.data, shape: newShape });
          } catch (err) { toast.error('Failed to paste block'); }
          setSaving(false);
        } else if (step === 3 && clipboard.type === 'room' && activeFloor) {
          const offset = 0.00005;
          const newShape = { ...clipboard.data.shape };
          if (newShape.points) {
            newShape.points = newShape.points.map(p => ({ x: p.x + offset, y: p.y - offset }));
          }
          try {
            setSaving(true);
            const roomData = { floorId: activeFloor._id, blockId: activeBlock._id, campusId, name: `${clipboard.data.name} (Copy)`, type: clipboard.data.type, shape: newShape };
            const res = await createRoom(roomData);
            toast.success('Room pasted');
            pushUndo({ type: 'PASTE_ROOM', id: res.data._id, roomData });
            await loadFloorData(activeFloor._id);
            setActiveRoom(res.data);
          } catch (err) { toast.error('Failed to paste room'); }
          setSaving(false);
        } else {
          toast.warn('Wrong step or clipboard type mismatch');
        }
        return;
      }

      // ── Ctrl+Shift+D: Duplicate (Ctrl+D is reserved by browser for bookmarks) ──
      if (key === 'd' && e.shiftKey) {
        e.preventDefault();
        if (step === 1 && activeBlock) {
          const offset = 0.0001;
          const newShape = { ...activeBlock.shape };
          if (newShape.points) {
            newShape.points = newShape.points.map(p => ({ x: p.x + offset, y: p.y - offset }));
          }
          try {
            setSaving(true);
            const blockData = { name: `${activeBlock.name} (Copy)`, description: activeBlock.description, campusId, shape: newShape };
            const res = await createBlock(blockData);
            await updateBlock(res.data._id, { shape: newShape });
            toast.success('Block duplicated');
            pushUndo({ type: 'DUPLICATE_BLOCK', id: res.data._id, blockData });
            await loadBlocks();
            setActiveBlock({ ...res.data, shape: newShape });
          } catch (err) { toast.error('Failed to duplicate block'); }
          setSaving(false);
        } else if (step === 3 && activeRoom && activeFloor) {
          const offset = 0.00005;
          const newShape = { ...activeRoom.shape };
          if (newShape.points) {
            newShape.points = newShape.points.map(p => ({ x: p.x + offset, y: p.y - offset }));
          }
          try {
            setSaving(true);
            const roomData = { floorId: activeFloor._id, blockId: activeBlock._id, campusId, name: `${activeRoom.name} (Copy)`, type: activeRoom.type, shape: newShape };
            const res = await createRoom(roomData);
            toast.success('Room duplicated');
            pushUndo({ type: 'DUPLICATE_ROOM', id: res.data._id, roomData });
            await loadFloorData(activeFloor._id);
            setActiveRoom(res.data);
          } catch (err) { toast.error('Failed to duplicate room'); }
          setSaving(false);
        } else {
          toast.warn('Select a block (Step 1) or room (Step 3) to duplicate');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, activeBlock, activeRoom, clipboard, activeFloor, campusId, undoStack, redoStack]);

  // Handle map drawing shapes
  const handleShapeDraw = async (layer, shapeType) => {
    if (step === 0 && shapeType === 'Circle') {
      const center = layer.getLatLng();
      const radius = layer.getRadius(); // in meters
      try {
        await updateCampus(campusId, { location: { lat: center.lat, lng: center.lng }, radius });
        setCampus(prev => ({ ...prev, location: { lat: center.lat, lng: center.lng }, radius }));
        toast.success('Campus boundary updated successfully!');
      } catch (err) {
        toast.error('Failed to update campus boundary');
      }
      setDrawMode('select');
      return;
    }

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
      } catch (e) { toast.error('Failed to create room'); }
    } else if (step === 5) {
      setTempBlockShape(newShape);
      setActiveLayer(null);
      setDrawMode('select');
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
        } catch (e) { toast.error('Failed to add node'); }
      } else if (drawMode === 'addPath') {
        const allNodes = mainNodes;
        const nearest = allNodes.reduce((b, n) => { const d = Math.hypot(n.x - ll.lat, n.y - ll.lng); return (!b || d < b.d) ? { node: n, d } : b; }, null);
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
        const nearest = allNodes.reduce((b, n) => { const d = Math.hypot(n.x - ll.lat, n.y - ll.lng); return (!b || d < b.d) ? { node: n, d } : b; }, null);
        if (!nearest || nearest.d > 0.0005) return toast.warn('Click near a node');
        if (!pathStart) { setPathStart(nearest.node); toast.info('Click end node'); }
        else {
          const isCrossFloor = pathStart.floorId && nearest.node.floorId && pathStart.floorId !== nearest.node.floorId;
          const assignedFloorId = isCrossFloor ? null : activeFloor._id;
          setPendingPath({ nodeA: pathStart, nodeB: nearest.node, floorId: assignedFloorId, context: 'floor', isCrossFloor });
          setPathStart(null);
        }
      }
    }
  };

  // Save path with chosen direction
  const savePendingPath = async (direction, customType = null) => {
    if (!pendingPath) return;
    try {
      const bidir = direction === 'both';
      // For 'incoming', swap nodeA and nodeB so the arrow points correctly
      const nodeA = direction === 'incoming' ? pendingPath.nodeB._id : pendingPath.nodeA._id;
      const nodeB = direction === 'incoming' ? pendingPath.nodeA._id : pendingPath.nodeB._id;
      const type = pendingPath.isCrossFloor ? (customType || 'stairs') : 'hallway';
      await createPath({ nodeA, nodeB, floorId: pendingPath.floorId, campusId, bidirectional: bidir, type });
      toast.success(`Path saved (${direction})`);
      setPendingPath(null);
      loadMainPathway();
      if (pendingPath.floorId) loadFloorData(pendingPath.floorId);
    } catch (e) { toast.error('Failed to save path'); }
  };

  // Clear all main pathway nodes and paths
  const clearAllMainPaths = async () => {
    if (!window.confirm('Delete ALL main pathway nodes and paths? This cannot be undone.')) return;
    try {
      for (const p of mainPaths) { await deletePath(p._id); }
      for (const n of mainNodes) { await import('../api').then(m => m.deleteNode(n._id)); }
      toast.success('All main pathway data cleared');
      loadMainPathway();
    } catch (e) { toast.error('Failed to clear paths'); }
  };

  // Toggle path direction (bidirectional/one-way)
  const togglePathDirection = async (pathObj) => {
    try {
      await updatePath(pathObj._id, { bidirectional: !pathObj.bidirectional });
      toast.success(pathObj.bidirectional ? 'Set to one-way' : 'Set to bidirectional');
      loadMainPathway();
      if (activeFloor) loadFloorData(activeFloor._id);
    } catch (e) { toast.error('Failed to update path'); }
  };

  // STEP 1 ACTIONS
  const saveBlock = async () => {
    if (!tempBlockShape && !activeBlock?.shape) return toast.warn('Draw shape first');
    setSaving(true);
    try {
      if (activeBlock) {
        await updateBlock(activeBlock._id, { shape: activeBlock.shape, domain: blockForm.domain, name: blockForm.name });
        toast.success('Block Updated!');
        setIsBlockDirty(false);
        setStep(2);
      } else {
        const res = await createBlock({ name: blockForm.name, description: 'Block Shape stored', domain: blockForm.domain, campusId, shape: tempBlockShape });
        setActiveBlock({ ...res.data, shape: tempBlockShape });
        toast.success('Block Locked & Saved!');
        setIsBlockDirty(false);
        await loadBlocks();
        setStep(2);
      }
    } catch (e) { toast.error('Failed to save block'); }
    setSaving(false);
  };
  const removeBlock = async (id) => {
    if (window.confirm('Delete this entire block?')) {
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
    } catch (e) { toast.error('Error generating floors'); }
    setSaving(false);
  };
  const removeFloor = async (id) => {
    if (window.confirm('Delete this floor?')) {
      await deleteFloor(id); toast.success('Floor deleted'); loadFloors(activeBlock._id);
    }
  };

  // STEP 3 ACTIONS
  const updateRoomProps = async () => {
    if (!activeRoom) return;
    setSaving(true);
    try {
      const updateData = { 
        name: activeRoom.name, 
        type: activeRoom.type, 
        shape: activeRoom.shape 
      };
      if (activeRoom.type === 'stairs' && activeRoom.stairsConfig) {
        updateData.stairsConfig = activeRoom.stairsConfig;
      }
      await updateRoom(activeRoom._id, updateData);
      toast.success('Room updated'); 
      setIsRoomDirty(false);
      loadFloorData(activeFloor._id);
    } catch (e) { toast.error('Update failed'); }
    setSaving(false);
  };

  const handlePropChange = (key, val) => setActiveRoom(p => ({ ...p, [key]: val }));

  const handleStairsConfigChange = (key, val) => {
    setActiveRoom(p => {
      const updated = {
        ...p,
        stairsConfig: {
          ...(p.stairsConfig || {
            startFloorId: p.floorId?._id || p.floorId,
            endFloorId: '',
            stepCount: 15,
            stairWidth: 2.0,
            stairType: 'straight'
          }),
          [key]: val
        }
      };
      setRooms(prev => prev.map(r => r._id === p._id ? updated : r));
      return updated;
    });
  };

  // Load excluded floors when a stairs/elevator room is selected
  const loadExcludedFloors = async (roomId) => {
    try {
      const res = await getExcludedFloors(roomId);
      const excIds = (res.data.excludedFloors || []).map(f => f._id || f);
      setExcludedFloorsMap(prev => ({ ...prev, [roomId]: excIds }));
    } catch (e) { console.warn('Failed to load excluded floors', e); }
  };

  // Handle per-floor stairs delete/restore
  const handleStairsFloorToggle = async (roomId, floorId, isCurrentlyExcluded) => {
    setStairsLoading(true);
    try {
      if (isCurrentlyExcluded) {
        await restoreStairsToFloor(roomId, floorId);
        toast.success('Stairs restored to this floor');
      } else {
        await deleteStairsFromFloor(roomId, floorId);
        toast.success('Stairs removed from this floor');
      }
      await loadExcludedFloors(roomId);
      if (activeFloor) await loadFloorData(activeFloor._id);
    } catch (e) { toast.error('Failed to update stairs visibility'); }
    setStairsLoading(false);
  };

  // Auto-load excluded floors when a stairs/elevator room is selected
  useEffect(() => {
    if (activeRoom && ['stairs', 'elevator'].includes(activeRoom.type)) {
      loadExcludedFloors(activeRoom._id);
      setStairsFloorPanel(true);
    } else {
      setStairsFloorPanel(false);
    }
  }, [activeRoom?._id, activeRoom?.type]);

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
  const handleModeChange = (mode) => {
    setDrawMode(mode);
    if (mode === 'drag') toast.info('Drag Mode: Map panning is disabled. Drag the shapes to move them.');
    if (mode === 'rotate') toast.info('Rotate Mode: Drag the shape edges to rotate. Map panning is disabled.');
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
            <div key={s.id} onClick={() => setStep(s.id)} style={{ ...S.stepBox(step === s.id, step > s.id), cursor: 'pointer' }}>
              <div style={S.stepNum(step === s.id, step > s.id)}>{step > s.id ? <FiCheck /> : s.id}</div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: step === s.id ? '#fff' : '#94a3b8' }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{s.desc}</p>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: '#1a2235', border: '1px solid #1e2d40', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h4 style={{ margin: '0', fontSize: 13, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiLayers size={14} color="#3b82f6" /> View Mode
            </h4>
            <button 
              onClick={() => setIs3DMode(!is3DMode)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, 
                background: is3DMode ? '#3b82f6' : '#111827', 
                color: '#fff', fontWeight: 600, border: '1px solid', borderColor: is3DMode ? '#3b82f6' : '#2a3352', 
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s'
              }}
            >
              <FiMap /> {is3DMode ? 'Switch to 2D Mode' : 'Switch to 3D Mode'}
            </button>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b', textAlign: 'center' }}>
              {is3DMode ? '3D mode is active. You can view elevations and draw inclined stairs.' : 'Switch to 3D to visualize floors and connect them.'}
            </p>
          </div>

          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: '#1a2235', border: '1px solid #1e2d40' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}><FiInfo size={14} color="#6366f1" /> Shortcuts</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', fontSize: 12, color: '#94a3b8' }}>
              <span style={{ color: '#fff', fontWeight: 600, background: '#111827', padding: '2px 6px', borderRadius: 4, border: '1px solid #2a3352', textAlign: 'center' }}>Ctrl+C</span>
              <span style={{ alignSelf: 'center' }}>Copy Selected</span>
              <span style={{ color: '#fff', fontWeight: 600, background: '#111827', padding: '2px 6px', borderRadius: 4, border: '1px solid #2a3352', textAlign: 'center' }}>Ctrl+V</span>
              <span style={{ alignSelf: 'center' }}>Paste Shape</span>
              <span style={{ color: '#fff', fontWeight: 600, background: '#111827', padding: '2px 6px', borderRadius: 4, border: '1px solid #2a3352', textAlign: 'center' }}>Ctrl+⇧+D</span>
              <span style={{ alignSelf: 'center' }}>Duplicate</span>
              <span style={{ color: '#fff', fontWeight: 600, background: '#111827', padding: '2px 6px', borderRadius: 4, border: '1px solid #2a3352', textAlign: 'center' }}>Ctrl+Z</span>
              <span style={{ alignSelf: 'center' }}>Undo</span>
              <span style={{ color: '#fff', fontWeight: 600, background: '#111827', padding: '2px 6px', borderRadius: 4, border: '1px solid #2a3352', textAlign: 'center' }}>Ctrl+Y</span>
              <span style={{ alignSelf: 'center' }}>Redo</span>
              <span style={{ color: '#fff', fontWeight: 600, background: '#111827', padding: '2px 6px', borderRadius: 4, border: '1px solid #2a3352', textAlign: 'center' }}>Del</span>
              <span style={{ alignSelf: 'center' }}>Delete Selected</span>
              <span style={{ color: '#fff', fontWeight: 600, background: '#111827', padding: '2px 6px', borderRadius: 4, border: '1px solid #2a3352', textAlign: 'center' }}>Esc</span>
              <span style={{ alignSelf: 'center' }}>Cancel / Select Mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER CANVAS */}
      <div style={S.centerCanvas}>
        {/* Dynamic Top Toolbar based on Mode */}
        {!is3DMode && (
          <div style={S.topToolbar}>
            {step === 0 && (
              <>
                <button style={S.toolBtn(drawMode === 'select')} onClick={() => setDrawMode('select')}><FiMove /> Select</button>
                <button style={S.toolBtn(drawMode === 'addNode')} onClick={() => setDrawMode('addNode')}><FiMap /> Add Node</button>
                <button style={S.toolBtn(drawMode === 'addPath')} onClick={() => { setDrawMode('addPath'); setMainPathStart(null); }}><FiNavigation /> Draw Path</button>
                <button style={S.toolBtn(drawMode === 'drawRadius')} onClick={() => setDrawMode('drawRadius')}><FiCrosshair /> Draw Campus Radius</button>
                <div style={{ width: 1, height: 24, background: '#1e2d40' }} />
                <button style={S.toolBtn(false)} onClick={() => setShowMainPathway(!showMainPathway)}>
                  {showMainPathway ? '👁 Hide' : '👁‍🗨 Show'} Main Path
                </button>
              </>
            )}
            {step === 1 && (
              <>
                <button style={S.toolBtn(drawMode === 'select')} onClick={() => handleModeChange('select')}><FiMousePointer /> Select</button>
                <button style={S.toolBtn(drawMode === 'drag')} onClick={() => handleModeChange('drag')}><FiMove /> Drag</button>
                <button style={S.toolBtn(drawMode === 'rotate')} onClick={() => handleModeChange('rotate')}><FiRefreshCw /> Rotate</button>
                <button style={S.toolBtn(drawMode === 'drawBlockRect')} onClick={() => handleModeChange('drawBlockRect')}><FiSquare /> Draw Outer Block</button>
              </>
            )}
            {step === 3 && (
              <>
                <button style={S.toolBtn(drawMode === 'select')} onClick={() => handleModeChange('select')}><FiMousePointer /> Select Room</button>
                <button style={S.toolBtn(drawMode === 'drag')} onClick={() => handleModeChange('drag')}><FiMove /> Drag Room</button>
                <button style={S.toolBtn(drawMode === 'rotate')} onClick={() => handleModeChange('rotate')}><FiRefreshCw /> Rotate</button>
                <button style={S.toolBtn(drawMode === 'drawRoomRect')} onClick={() => handleModeChange('drawRoomRect')}><FiSquare /> Draw Room</button>
              </>
            )}
            {step === 4 && (
              <>
                <button style={S.toolBtn(drawMode === 'select')} onClick={() => setDrawMode('select')}><FiMousePointer /> Select</button>
                <button style={S.toolBtn(drawMode === 'drag')} onClick={() => setDrawMode('drag')}><FiMove /> Drag Node</button>
                <button style={S.toolBtn(drawMode === 'addNode')} onClick={() => setDrawMode('addNode')}><FiMap /> Add Node</button>
                <button style={S.toolBtn(drawMode === 'addPath')} onClick={() => { setDrawMode('addPath'); setPathStart(null); }}><FiNavigation /> Draw Path</button>
              </>
            )}
            {step === 5 && (
              <>
                <button style={S.toolBtn(drawMode === 'select')} onClick={() => handleModeChange('select')}><FiMousePointer /> Select Zone</button>
                <button style={S.toolBtn(drawMode === 'drag')} onClick={() => handleModeChange('drag')}><FiMove /> Drag Zone</button>
                <button style={S.toolBtn(drawMode === 'rotate')} onClick={() => handleModeChange('rotate')}><FiRefreshCw /> Rotate</button>
                <button style={S.toolBtn(drawMode === 'drawBlockPoly')} onClick={() => handleModeChange('drawBlockPoly')}><FiSquare /> Draw Polygon Zone</button>
              </>
            )}
          </div>
        )}

        {/* Floor Switcher for Steps 3 & 4 */}
        {!is3DMode && (step === 3 || step === 4) && floors.length > 0 && (
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

        {!is3DMode ? (
        <MapContainer center={GMRIT} zoom={17} style={{ width: '100%', height: '100%', zIndex: 0 }} zoomControl={false} maxZoom={24} whenReady={() => setMapReady(true)}>
          <TileLayer url={import.meta.env.VITE_MAPBOX_URL || ""} maxZoom={24} maxNativeZoom={19} />
          {campus?.location?.lat && campus?.location?.lng && <MapUpdater center={[campus.location.lat, campus.location.lng]} />}
          <GeomanController onShapeDraw={handleShapeDraw} activeMode={drawMode} />
          <ClickHandler onClick={handleMapClick} />

          {/* === ALWAYS VISIBLE: Main Campus Pathway Nodes & Paths === */}
          {showMainPathway && mainNodes.map(n => (
            <EditableNode key={n._id} n={n} stepMode={step} isMain={true}
              onUpdate={async (id, data) => { await import('../api').then(m => m.updateNode(id, data)); loadMainPathway(); }}
              onDelete={async (id) => { await import('../api').then(m => m.deleteNode(id)); loadMainPathway(); }}
            />
          ))}
          {showMainPathway && mainPaths.map(p => {
            const a = allNodes.find(n => n._id === p.nodeA);
            const b = allNodes.find(n => n._id === p.nodeB);
            if (!a || !b) return null;
            return <EditablePath key={p._id} p={p} a={a} b={b} stepMode={step}
              onUpdate={async (id, data) => { await updatePath(id, data); loadMainPathway(); }}
              onDelete={async (id) => { await deletePath(id); loadMainPathway(); }}
            />;
          })}
          {step === 0 && mainPathStart && <Circle center={[mainPathStart.x, mainPathStart.y]} radius={3} pathOptions={{ color: '#22c55e', fillOpacity: 1 }} />}
          {step === 0 && campus?.location?.lat && campus?.radius && (
            <Circle
              center={[campus.location.lat, campus.location.lng]}
              radius={campus.radius}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.1, weight: 2, dashArray: '10, 10' }}
            />
          )}

          {/* Render All Blocks */}
          {blocks.map(b => {
            const isActive = activeBlock?._id === b._id;
            const isSelected = isActive && step === 1;
            const isLocked = step > 1 || !isActive;
            const currentBlock = isActive ? activeBlock : b;
            if (!currentBlock.shape) return null;

            return (
              <EditablePolygon 
                key={`block-${b._id}`} 
                r={{ ...currentBlock, isBlock: true }} 
                isSelected={isSelected} 
                isLocked={isLocked} 
                onUpdate={(id, s) => {
                  if (isActive) {
                    setActiveBlock(p => ({ ...p, shape: s }));
                    setIsBlockDirty(true);
                  }
                }} 
                onClick={() => {
                  if (step === 1) {
                    setActiveBlock(b);
                    setTempBlockShape(null);
                    setBlockForm({ name: b.name, domain: b.domain || 'Academic Blocks', id: b._id });
                    setIsBlockDirty(false);
                  }
                }} 
                activeMode={drawMode} 
              />
            );
          })}
          {step === 1 && !activeBlock && tempBlockShape && (
            <EditablePolygon key="temp-block" r={{ _id: 'temp', shape: tempBlockShape, type: 'other', name: 'New Block', isBlock: true }} isSelected={true} isLocked={false} onUpdate={(_, s) => setTempBlockShape(s)} onClick={() => { }} activeMode={drawMode} />
          )}

          {/* Render Rooms (Step 3 & 4) */}
          {(step === 3 || step === 4) && rooms.map(r => {
            const currentRoom = activeRoom?._id === r._id ? activeRoom : r;
            return <EditablePolygon key={r._id} r={currentRoom} isSelected={activeRoom?._id === r._id} isLocked={step !== 3}
              onUpdate={(id, s) => {
                setRooms(prev => prev.map(x => x._id === id ? { ...x, shape: s } : x));
                setActiveRoom(p => p?._id === id ? { ...p, shape: s } : { ...r, shape: s });
                setIsRoomDirty(true);
              }}
              onClick={(roomData) => { 
                if (step === 3) {
                  setActiveRoom(p => p?._id === roomData._id ? p : roomData);
                  setIsRoomDirty(false);
                } 
              }}
              activeMode={drawMode} />;
          })}

          {/* Render Interior Nodes & Paths (Step 4) */}
          {step === 4 && nodes.map(n => (
            <EditableNode key={n._id} n={n} stepMode={step} isMain={false}
              onUpdate={async (id, data) => { await import('../api').then(m => m.updateNode(id, data)); loadFloorData(activeFloor._id); }}
              onDelete={async (id) => { await import('../api').then(m => m.deleteNode(id)); loadFloorData(activeFloor._id); }}
            />
          ))}
          {step === 4 && paths.map(p => {
            const a = allNodes.find(n => n._id === p.nodeA);
            const b = allNodes.find(n => n._id === p.nodeB);
            if (!a || !b) return null;
            return <EditablePath key={p._id} p={p} a={a} b={b} stepMode={step}
              onUpdate={async (id, data) => { await updatePath(id, data); loadFloorData(activeFloor._id); }}
              onDelete={async (id) => { await deletePath(id); loadFloorData(activeFloor._id); }}
            />;
          })}
          {step === 4 && pathStart && <Circle center={[pathStart.x, pathStart.y]} radius={3} pathOptions={{ color: '#f59e0b', fillOpacity: 1 }} />}

          {/* Render Map Layers (Step 5) */}
          {(step === 5 || step === 0) && mapLayers.map(l => {
            const currentLayer = activeLayer?._id === l._id ? activeLayer : l;
            if (l.geometry?.type === 'Polygon') {
              const polyShape = { points: l.geometry.coordinates[0].map(c => ({ x: c[1], y: c[0] })) };
              return <EditablePolygon key={l._id} r={{ ...currentLayer, shape: polyShape }}
                isSelected={activeLayer?._id === l._id} isLocked={step !== 5}
                onUpdate={(id, s) => {
                  const newGeo = { type: 'Polygon', coordinates: [s.points.map(p => [p.y, p.x])] };
                  setMapLayers(prev => prev.map(x => x._id === id ? { ...x, geometry: newGeo } : x));
                  setActiveLayer(p => p?._id === id ? { ...p, geometry: newGeo } : { ...l, geometry: newGeo });
                }}
                onClick={(layerData) => { if (step === 5) setActiveLayer(p => p?._id === layerData._id ? p : layerData); }}
                activeMode={drawMode} />;
            }
            return null;
          })}
          {step === 5 && !activeLayer && tempBlockShape && (
            <EditablePolygon key="temp-layer" r={{ _id: 'temp', shape: tempBlockShape, type: 'other', name: 'New Zone', color: blockForm.color }} isSelected={true} isLocked={false} onUpdate={(_, s) => setTempBlockShape(s)} onClick={() => { }} activeMode={drawMode} />
          )}
        </MapContainer>
        ) : (
          <Admin3DViewer 
            blocks={blocks} 
            floors={floors} 
            rooms={rooms} 
            nodes={Array.from(new Map([...allNodes, ...nodes, ...mainNodes].map(n => [n._id, n])).values())} 
            paths={Array.from(new Map([...paths, ...mainPaths].map(p => [p._id, p])).values())} 
            campus={campus}
            activeFloor={activeFloor}
            mapboxUrl={import.meta.env.VITE_MAPBOX_URL}
            onRefresh={() => {
              if (activeFloor) loadFloorData(activeFloor._id);
              loadMainPathway();
            }}
          />
        )}
      </div>

      {/* RIGHT PANEL: CONTEXT PROPERTIES */}
      <div style={S.rightPanel}>
        <div style={S.panelHeader}>
          {step === 0 && <><FiNavigation color="#f59e0b" /> Main Campus Pathway</>}
          {step === 1 && <><FiMap color="#6366f1" /> Block Definition</>}
          {step === 2 && <><FiLayers color="#6366f1" /> Floor Generation</>}
          {step === 3 && <><FiSquare color="#6366f1" /> Interior Elements</>}
          {step === 4 && <><FiNavigation color="#6366f1" /> Route Network</>}
          {step === 5 && <><FiMap color="#ef4444" /> Custom Map Zones</>}
        </div>

        <div style={S.panelBody}>
          {/* STEP 0: Main Pathway */}
          {step === 0 && (
            <>
              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #f59e0b30', fontSize: 13, color: '#94a3b8' }}>
                <FiInfo style={{ marginBottom: 8 }} color="#f59e0b" size={20} />
                <p style={{ margin: 0 }}>Draw the <strong style={{ color: '#f59e0b' }}>main campus walkway</strong> connecting all areas. Click on the map with <strong>"Add Node"</strong> to place waypoints along roads, then link them with <strong>"Draw Path"</strong>.</p>
              </div>

              <div style={{ padding: 16, background: '#0a0e1a', borderRadius: 12, border: '1px solid #1e2d40', marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#f1f5f9' }}>Main Pathway Stats</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#94a3b8' }}><span>Nodes:</span> <span style={{ color: '#f59e0b', fontWeight: 800 }}>{mainNodes.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}><span>Paths:</span> <span style={{ color: '#f59e0b', fontWeight: 800 }}>{mainPaths.length}</span></div>
              </div>

              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #2a3352', fontSize: 12, color: '#94a3b8' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#f1f5f9' }}><FiRepeat size={14} style={{ marginRight: 6 }} /> Direction Toggle</h4>
                <p style={{ margin: '0 0 8px' }}>Click on any <strong style={{ color: '#f59e0b' }}>path line</strong> to toggle between:</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>↔</span>
                  <span>Bidirectional (two-way)</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>→</span>
                  <span>One-way (incoming/outgoing)</span>
                </div>
              </div>

              {(mainNodes.length > 0 || mainPaths.length > 0) && (
                <button style={{ ...S.primaryBtn, background: '#1a2235', color: '#ef4444', border: '1px solid #ef444450', marginBottom: 10 }} onClick={clearAllMainPaths}>
                  <FiTrash2 style={{ marginRight: 6 }} /> Clear All Paths & Nodes
                </button>
              )}

              {mainNodes.length > 0 && (
                <button style={{ ...S.successBtn, background: '#f59e0b', marginBottom: 10 }} onClick={() => { toast.success('Main pathway saved!'); setStep(1); }}>
                  Save Main Pathway & Add Blocks →
                </button>
              )}
              {mainNodes.length === 0 && (
                <button style={{ ...S.primaryBtn, opacity: 0.5 }} disabled>
                  Add nodes to proceed
                </button>
              )}
            </>
          )}

          {/* STEP 1: Block Props */}
          {step === 1 && (
            <>
              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #2a3352', fontSize: 13, color: '#94a3b8' }}>
                <FiInfo style={{ marginBottom: 8 }} color="#6366f1" size={20} />
                <p style={{ margin: 0 }}>Draw the outer bounding box of your building on the map. The <span style={{ color: '#f59e0b' }}>main pathway</span> is shown in the background for reference.</p>
              </div>

              {blocks.length > 0 && !activeBlock && (
                <div style={{ marginBottom: 20 }}>
                  <label style={S.label}>Existing Blocks</label>
                  {blocks.map(b => (
                    <div key={b._id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#1a2235', borderRadius: 8, marginBottom: 8, border: '1px solid #2a3352', cursor: 'pointer' }} onClick={() => { setActiveBlock(b); setTempBlockShape(null); setBlockForm({ name: b.name, domain: b.domain || 'Academic Blocks', id: b._id }); setIsBlockDirty(false); }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{b.domain || 'Academic Blocks'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={async (e) => { e.preventDefault(); e.stopPropagation(); const newName = window.prompt('Rename Block:', b.name); if (newName && newName.trim() && newName !== b.name) { try { await updateBlock(b._id, { name: newName.trim() }); toast.success('Block renamed!'); loadBlocks(); } catch(err) { toast.error('Failed to rename block'); } } }} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 4 }} title="Rename Block"><FiEdit2 size={15}/></button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBlock(b._id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }} title="Delete Block"><FiTrash2 size={15}/></button>
                      </div>
                    </div>
                  ))}
                  <button style={{ ...S.primaryBtn, background: '#1a2235', border: '1px solid #1e2d40' }} onClick={() => { setActiveBlock(null); setTempBlockShape(null); setBlockForm({ name: '', domain: 'Academic Blocks', id: '' }); setIsBlockDirty(false); }}>+ Draw New Block</button>
                </div>
              )}

              {(!activeBlock && (!blocks.length || tempBlockShape)) && (
                <>
                  <div style={S.formGroup}>
                    <label style={S.label}>New Block Name</label>
                    <input style={S.input} placeholder="e.g. CSE Block" value={blockForm.name} onChange={e => { setBlockForm({ ...blockForm, name: e.target.value }); setIsBlockDirty(true); }} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Domain / Category</label>
                    <select style={S.input} value={blockForm.domain} onChange={e => { setBlockForm({ ...blockForm, domain: e.target.value }); setIsBlockDirty(true); }}>
                      {(VENUE_DOMAINS[venueType] || VENUE_DOMAINS.campus).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <button style={S.successBtn} onClick={saveBlock} disabled={saving}>{saving ? 'Saving...' : 'Confirm & Lock Block Shape'}</button>
                </>
              )}

              {activeBlock && (
                <>
                  <div style={S.formGroup}>
                    <label style={S.label}>Block Name</label>
                    <input style={S.input} value={blockForm.name} onChange={e => { setBlockForm({ ...blockForm, name: e.target.value }); setIsBlockDirty(true); }} placeholder="Block name" />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Domain / Category</label>
                    <select style={S.input} value={blockForm.domain} onChange={e => { setBlockForm({ ...blockForm, domain: e.target.value }); setIsBlockDirty(true); }}>
                      {(VENUE_DOMAINS[venueType] || VENUE_DOMAINS.campus).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...S.primaryBtn, flex: 1, background: '#1a2235', color: '#ef4444', border: '1px solid #ef444450' }} onClick={(e) => { e.preventDefault(); removeBlock(activeBlock._id); }}>Delete</button>
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
                <p style={{ margin: 0 }}>The block shape is locked. Manage floors for <strong>{activeBlock?.name}</strong>.</p>
              </div>

              {floors.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <label style={S.label}>Existing Floors</label>
                  {floors.map(f => (
                    <div key={f._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#1a2235', borderRadius: 8, marginBottom: 8, border: '1px solid #2a3352' }}>
                      <span style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{f.name}</span>
                      <div style={{ display: 'flex' }}>
                        <button onClick={() => {
                          const newName = window.prompt('Rename Floor:', f.name);
                          if (newName) { import('../api').then(m => m.updateFloor(f._id, { name: newName }).then(() => loadFloors(activeBlock._id))); }
                        }} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', marginRight: 8 }}><FiSettings /></button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFloor(f._id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><FiTrash2 /></button>
                      </div>
                    </div>
                  ))}
                  <button style={{ ...S.primaryBtn, background: '#1a2235', border: '1px solid #1e2d40', marginTop: 10 }} onClick={() => setStep(3)}>Proceed to Interior Design</button>
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
                    <select style={S.input} value={activeRoom.type || 'other'} onChange={e => handlePropChange('type', e.target.value)}>
                      {(VENUE_ROOM_TYPES[venueType] || VENUE_ROOM_TYPES.campus).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>

                  {activeRoom.type === 'stairs' && (
                    <div style={{ marginTop: 20, padding: 16, background: '#1a2235', borderRadius: 12, border: '1px solid #f9731630', textAlign: 'left' }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: 13, color: '#f97316', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiLayers /> 3D Stairs Configuration
                      </h4>
                      
                      <div style={S.formGroup}>
                        <label style={S.label}>Start Floor (Bottom)</label>
                        <select 
                          style={S.input} 
                          value={activeRoom.stairsConfig?.startFloorId || activeRoom.floorId?._id || activeRoom.floorId || ''} 
                          onChange={e => handleStairsConfigChange('startFloorId', e.target.value)}
                        >
                          <option value="">Select Floor</option>
                          {floors.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                        </select>
                      </div>

                      <div style={S.formGroup}>
                        <label style={S.label}>End Floor (Top)</label>
                        <select 
                          style={S.input} 
                          value={activeRoom.stairsConfig?.endFloorId || ''} 
                          onChange={e => handleStairsConfigChange('endFloorId', e.target.value)}
                        >
                          <option value="">Select Floor</option>
                          {floors.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                        </select>
                      </div>

                      <div style={S.formGroup}>
                        <label style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Number of Steps</span>
                          <span style={{ color: '#f97316', fontWeight: 700 }}>{activeRoom.stairsConfig?.stepCount || 15}</span>
                        </label>
                        <input 
                          type="range" 
                          min="5" 
                          max="30" 
                          style={{ width: '100%', accentColor: '#f97316' }} 
                          value={activeRoom.stairsConfig?.stepCount || 15} 
                          onChange={e => handleStairsConfigChange('stepCount', parseInt(e.target.value))} 
                        />
                      </div>

                      <div style={S.formGroup}>
                        <label style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Width Scale</span>
                          <span style={{ color: '#f97316', fontWeight: 700 }}>{Math.round((activeRoom.stairsConfig?.stairWidthScale !== undefined ? activeRoom.stairsConfig.stairWidthScale : 1.0) * 100)}%</span>
                        </label>
                        <input 
                          type="range" 
                          min="0.2" 
                          max="1.0" 
                          step="0.05"
                          style={{ width: '100%', accentColor: '#f97316' }} 
                          value={activeRoom.stairsConfig?.stairWidthScale !== undefined ? activeRoom.stairsConfig.stairWidthScale : 1.0} 
                          onChange={e => handleStairsConfigChange('stairWidthScale', parseFloat(e.target.value))} 
                        />
                      </div>

                      <div style={S.formGroup}>
                        <label style={S.label}>Stair Direction / Flow</label>
                        <select 
                          style={S.input} 
                          value={activeRoom.stairsConfig?.stairDirection || 'auto'} 
                          onChange={e => handleStairsConfigChange('stairDirection', e.target.value)}
                        >
                          <option value="auto">Automatic (based on shape)</option>
                          <option value="longitudinal">Along Length (Side 1 to 3)</option>
                          <option value="transverse">Along Width (Side 4 to 2)</option>
                        </select>
                      </div>

                      <div style={{ ...S.formGroup, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Invert Slope (Flip Up/Down)</span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleStairsConfigChange('invertSlope', !(activeRoom.stairsConfig?.invertSlope || false));
                          }}
                          style={{
                            padding: '6px 16px',
                            borderRadius: 8,
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 12,
                            background: activeRoom.stairsConfig?.invertSlope ? '#f97316' : '#1a2235',
                            color: '#fff',
                            border: '1px solid #f9731640',
                            transition: 'all 0.2s'
                          }}
                        >
                          {activeRoom.stairsConfig?.invertSlope ? 'Inverted (Reversed)' : 'Normal'}
                        </button>
                      </div>

                      <div style={{ ...S.formGroup, marginTop: 16 }}>
                        <label style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Vertical Start Height</span>
                          <span style={{ color: '#f97316', fontWeight: 700 }}>{activeRoom.stairsConfig?.startHeightPct !== undefined ? activeRoom.stairsConfig.startHeightPct : 0}%</span>
                        </label>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          step="5"
                          style={{ width: '100%', accentColor: '#f97316' }} 
                          value={activeRoom.stairsConfig?.startHeightPct !== undefined ? activeRoom.stairsConfig.startHeightPct : 0} 
                          onChange={e => handleStairsConfigChange('startHeightPct', parseInt(e.target.value))} 
                        />
                      </div>

                      <div style={S.formGroup}>
                        <label style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Vertical End Height</span>
                          <span style={{ color: '#f97316', fontWeight: 700 }}>{activeRoom.stairsConfig?.endHeightPct !== undefined ? activeRoom.stairsConfig.endHeightPct : 100}%</span>
                        </label>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          step="5"
                          style={{ width: '100%', accentColor: '#f97316' }} 
                          value={activeRoom.stairsConfig?.endHeightPct !== undefined ? activeRoom.stairsConfig.endHeightPct : 100} 
                          onChange={e => handleStairsConfigChange('endHeightPct', parseInt(e.target.value))} 
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                    <button style={{ ...S.primaryBtn, marginTop: 0, flex: 1, background: '#1a2235', color: '#ef4444', border: '1px solid #ef444450' }} onClick={(e) => { e.preventDefault(); if (window.confirm('Delete Room?')) deleteRoom(activeRoom._id).then(() => { setActiveRoom(null); loadFloorData(activeFloor._id); }); }}>Delete Room</button>
                    <button style={{ ...S.successBtn, marginTop: 0, flex: 2 }} onClick={updateRoomProps} disabled={saving}>{saving ? 'Saving...' : 'Save Room'}</button>
                  </div>

                  {/* Per-Floor Stairs Management Panel */}
                  {['stairs', 'elevator'].includes(activeRoom.type) && stairsFloorPanel && floors.length > 0 && (
                    <div style={{ marginTop: 24, background: '#0a0e1a', borderRadius: 14, border: '1px solid #f9731640', overflow: 'hidden' }}>
                      <div
                        onClick={() => setStairsFloorPanel(prev => !prev)}
                        style={{
                          padding: '14px 16px',
                          background: 'linear-gradient(135deg, #f9731615, #f9731608)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f9731620'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f9731620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiLayers size={16} color="#f97316" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#f97316' }}>Per-Floor Control</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                              Remove {activeRoom.type} from specific floors
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: '#64748b', transform: stairsFloorPanel ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>▼</span>
                      </div>

                      <div style={{ padding: '12px 14px' }}>
                        <p style={{ margin: '0 0 12px', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                          Toggle visibility of this <strong style={{ color: '#f97316' }}>{activeRoom.type}</strong> on each floor.
                          Disabled floors will not show this {activeRoom.type} in the interior map.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {floors.map(f => {
                            const excList = excludedFloorsMap[activeRoom._id] || [];
                            const isExcluded = excList.some(excId => excId === f._id || excId.toString() === f._id);
                            const isOwnerFloor = activeRoom.floorId === f._id || activeRoom.floorId?._id === f._id;
                            const isCurrentFloor = activeFloor?._id === f._id;

                            return (
                              <div key={f._id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: isCurrentFloor ? '#22c55e08' : '#1a2235',
                                border: `1px solid ${isCurrentFloor ? '#22c55e30' : '#1e2d40'}`,
                                transition: 'all 0.2s'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{
                                    width: 8, height: 8, borderRadius: 4,
                                    background: isExcluded ? '#ef4444' : '#22c55e',
                                    boxShadow: isExcluded ? '0 0 6px #ef444460' : '0 0 6px #22c55e60'
                                  }} />
                                  <div>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{f.name}</span>
                                    {isOwnerFloor && (
                                      <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 6, fontWeight: 700 }}>ORIGIN</span>
                                    )}
                                    {isCurrentFloor && (
                                      <span style={{ fontSize: 10, color: '#22c55e', marginLeft: 6, fontWeight: 700 }}>ACTIVE</span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleStairsFloorToggle(activeRoom._id, f._id, isExcluded)}
                                  disabled={stairsLoading}
                                  style={{
                                    padding: '6px 14px',
                                    borderRadius: 8,
                                    border: 'none',
                                    cursor: stairsLoading ? 'wait' : 'pointer',
                                    fontWeight: 700,
                                    fontSize: 11,
                                    background: isExcluded ? '#22c55e20' : '#ef444420',
                                    color: isExcluded ? '#22c55e' : '#ef4444',
                                    transition: 'all 0.2s',
                                    opacity: stairsLoading ? 0.5 : 1
                                  }}
                                >
                                  {isExcluded ? '↩ Restore' : '✕ Remove'}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Summary */}
                        <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: '#111827', fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Visible on:</span>
                          <span style={{ color: '#22c55e', fontWeight: 700 }}>
                            {floors.length - (excludedFloorsMap[activeRoom._id] || []).length} / {floors.length} floors
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
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
                <p style={{ margin: 0 }}>Rooms are locked. Add nodes and link them to create the walkable navigation graph.</p>
              </div>
              <div style={{ padding: 16, background: '#0a0e1a', borderRadius: 12, border: '1px solid #1e2d40' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#f1f5f9' }}>Graph Stats</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#94a3b8' }}><span>Nodes:</span> <span style={{ color: '#22c55e', fontWeight: 800 }}>{nodes.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}><span>Paths:</span> <span style={{ color: '#22c55e', fontWeight: 800 }}>{paths.length}</span></div>
              </div>
              <button style={{ ...S.primaryBtn, marginTop: 'auto', background: '#1a2235', border: '1px solid #1e2d40' }} onClick={() => setStep(5)}>Proceed to Custom Zones</button>
            </>
          )}

          {/* STEP 5: Custom Map Zones */}
          {step === 5 && (
            <>
              <div style={{ background: '#1a2235', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #2a3352', fontSize: 13, color: '#94a3b8' }}>
                <FiInfo style={{ marginBottom: 8 }} color="#ef4444" size={20} />
                <p style={{ margin: 0 }}>Draw generic custom zones (parking, gardens, restricted areas). These override default map styling.</p>
              </div>

              {mapLayers.length > 0 && !activeLayer && (
                <div style={{ marginBottom: 20 }}>
                  <label style={S.label}>Existing Zones</label>
                  {mapLayers.map(l => (
                    <div key={l._id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#1a2235', borderRadius: 8, marginBottom: 8, border: '1px solid #2a3352', cursor: 'pointer' }} onClick={() => { setActiveLayer(l); setTempBlockShape(null); }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{l.name}</div>
                        <div style={{ fontSize: 11, color: l.color || '#3b82f6', marginTop: 2 }}>{l.category}</div>
                      </div>
                      <button onClick={async (e) => { e.preventDefault(); e.stopPropagation(); if (window.confirm('Delete zone?')) { await deleteMapLayer(l._id); loadMainPathway(); } }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><FiTrash2 /></button>
                    </div>
                  ))}
                  <button style={{ ...S.primaryBtn, background: '#1a2235', border: '1px solid #1e2d40' }} onClick={() => { setActiveLayer(null); setTempBlockShape(null); }}>+ Draw New Zone</button>
                </div>
              )}

              {!activeLayer && (
                <>
                  <div style={S.formGroup}>
                    <label style={S.label}>Zone Name</label>
                    <input style={S.input} placeholder="e.g. Staff Parking" value={blockForm.name} onChange={e => setBlockForm({ ...blockForm, name: e.target.value })} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Color</label>
                    <input type="color" style={{ ...S.input, padding: 0, height: 40 }} value={blockForm.color || '#3b82f6'} onChange={e => setBlockForm({ ...blockForm, color: e.target.value })} />
                  </div>
                  {!tempBlockShape && (
                    <div style={{ background: '#1a2235', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px dashed #f59e0b50', fontSize: 12, color: '#f59e0b' }}>
                      👆 Select <strong>"Draw Polygon Zone"</strong> tool above and draw a shape on the map, then come back here to save.
                    </div>
                  )}
                  <button style={{ ...S.successBtn, opacity: tempBlockShape ? 1 : 0.5 }} disabled={saving || !tempBlockShape} onClick={async () => {
                    if (!tempBlockShape) return toast.warn('Draw shape first');
                    setSaving(true);
                    try {
                      const geo = { type: 'Polygon', coordinates: [tempBlockShape.points.map(p => [p.y, p.x])] };
                      const res = await createMapLayer({ name: blockForm.name || 'New Zone', campusId, type: 'zone', category: 'custom', color: blockForm.color || '#3b82f6', geometry: geo });
                      toast.success('Zone Created!');
                      setActiveLayer(res.data);
                      setTempBlockShape(null);
                      loadMainPathway();
                    } catch (e) { toast.error('Failed to create zone'); }
                    setSaving(false);
                  }}>{saving ? 'Saving...' : (tempBlockShape ? 'Save Zone Shape' : 'Draw a shape first')}</button>
                </>
              )}

              {activeLayer && (
                <>
                  <div style={S.formGroup}>
                    <label style={S.label}>Editing Zone: {activeLayer.name}</label>
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>Color</label>
                    <input type="color" style={{ ...S.input, padding: 0, height: 40 }} value={activeLayer.color || '#3b82f6'} onChange={e => setActiveLayer({ ...activeLayer, color: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...S.primaryBtn, flex: 1, background: '#1a2235', color: '#ef4444', border: '1px solid #ef444450' }} onClick={async (e) => { e.preventDefault(); if (window.confirm('Delete zone?')) { await deleteMapLayer(activeLayer._id); setActiveLayer(null); loadMainPathway(); } }}>Delete</button>
                    <button style={{ ...S.successBtn, flex: 2 }} disabled={saving} onClick={async () => {
                      setSaving(true);
                      try {
                        await updateMapLayer(activeLayer._id, { geometry: activeLayer.geometry, color: activeLayer.color });
                        toast.success('Zone Updated!');
                        loadMainPathway();
                      } catch (e) { toast.error('Update failed'); }
                      setSaving(false);
                    }}>Save Shape</button>
                  </div>
                </>
              )}

              <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #2a3352' }}>
                <button style={{ ...S.primaryBtn, width: '100%', background: '#8b5cf6', color: '#fff', border: 'none', fontWeight: 800, padding: 16 }} onClick={async () => {
                  if (window.confirm('Publish all map changes live to mobile users now?')) {
                    try {
                      await publishMap(campusId);
                      toast.success('Map published successfully! Users will see updates instantly.');
                    } catch (e) {
                      toast.error('Failed to publish map');
                    }
                  }
                }}>
                  <FiUploadCloud style={{ marginRight: 8, display: 'inline' }} />
                  Publish Live to Users
                </button>
                <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                  Edits are saved as drafts. Click publish to push the final design to the mobile app.
                </p>
              </div>

              <button style={{ ...S.successBtn, marginTop: 40 }} onClick={() => { toast.success('Building Map Published Successfully!'); nav('/campus'); }}>Finish & Publish Map</button>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPendingPath(null)}>
          <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 20, padding: 28, width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#fff' }}>Choose Direction</h3>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: '#94a3b8' }}>Select the traffic direction for this path segment.</p>
            {pendingPath.isCrossFloor ? (
              <>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#f97316', fontWeight: 600 }}>Cross-Floor link detected.</p>
                <button onClick={() => savePendingPath('both', 'stairs')} style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #f9731630',
                  background: '#f9731620', color: '#fff', cursor: 'pointer', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f9731640', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📶</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#f97316' }}>Stairs (Bidirectional)</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Creates a 3D stair connection</div>
                  </div>
                </button>
                <button onClick={() => savePendingPath('both', 'elevator')} style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #6366f130',
                  background: '#6366f120', color: '#fff', cursor: 'pointer', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#6366f140', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🛗</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#6366f1' }}>Elevator (Bidirectional)</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Creates a 3D elevator connection</div>
                  </div>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => savePendingPath('outgoing')} style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #3b82f630',
                  background: '#1a2235', color: '#fff', cursor: 'pointer', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#3b82f620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20 }}>→</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#3b82f6' }}>Outgoing (A → B)</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>One-way from start to end node</div>
                  </div>
                </button>

                <button onClick={() => savePendingPath('incoming')} style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #f59e0b30',
                  background: '#1a2235', color: '#fff', cursor: 'pointer', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20 }}>←</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>Incoming (B → A)</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>One-way from end to start node</div>
                  </div>
                </button>

                <button onClick={() => savePendingPath('both')} style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #22c55e30',
                  background: '#1a2235', color: '#fff', cursor: 'pointer', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#22c55e20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 20 }}>↔</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#22c55e' }}>Both Ways (A ↔ B)</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Bidirectional, two-way traffic</div>
                  </div>
                </button>
              </>
            )}
            <button onClick={() => setPendingPath(null)} style={{
              width: '100%', padding: 10, borderRadius: 10, background: 'transparent',
              color: '#64748b', border: '1px solid #1e2d40', cursor: 'pointer', marginTop: 6, fontWeight: 600, fontSize: 13
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
