import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { getBlocks, getFloors, getRooms, getDigitalTwin, saveDigitalTwin, publishDigitalTwinLayout, getSpatialSessions, deleteSpatialSession } from '../api';
import SpatialAssemblyCanvas from '../components/SpatialAssemblyCanvas';
import StagingTray from '../components/StagingTray';
import {
  Layers, Map as MapIcon, RefreshCw, Smartphone,
  CheckCircle, Clock, Navigation, ExternalLink, ShieldCheck, Box,
  Sparkles, Compass, Check, Trash2, DoorOpen, Palette, AlertTriangle,
  Plus, Edit3, Save, X, RotateCcw, Sliders, CheckCircle2, CloudLightning,
  Send, ChevronDown, Building, Layers3
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function SpatialStudioDashboard({ admin: propAdmin }) {
  const outletCtx = useOutletContext() || {};
  const navigate = useNavigate();
  const campus = outletCtx.campus;
  const campusId = campus?._id || propAdmin?.campusId?._id || propAdmin?.campusId;

  // Master Map State
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [floorRooms, setFloorRooms] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  
  const [twinData, setTwinData] = useState(null);
  const [latestSession, setLatestSession] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Staging & Assembly State
  const [scannedElements, setScannedElements] = useState([]);
  const [placedComponents, setPlacedComponents] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);

  // Load campus blocks
  useEffect(() => {
    if (campusId) {
      getBlocks(campusId)
        .then(res => {
          const list = res.data || [];
          setBlocks(list);
          if (list.length > 0) {
            setSelectedBlockId(list[0]._id);
          }
        })
        .catch(err => console.error("Error loading blocks:", err));
    }
  }, [campusId]);

  // Load floors when selected block changes
  useEffect(() => {
    if (selectedBlockId) {
      getFloors(selectedBlockId, campusId)
        .then(res => {
          const list = res.data || [];
          setFloors(list);
          if (list.length > 0) {
            setSelectedFloorId(list[0]._id);
          } else {
            setSelectedFloorId('');
            setTwinData(null);
            setFloorRooms([]);
            setScannedElements([]);
            setPlacedComponents([]);
          }
        })
        .catch(err => console.error("Error loading floors:", err));
    }
  }, [selectedBlockId, campusId]);

  // Fetch twin, rooms, and session when floor is selected
  useEffect(() => {
    if (selectedBlockId && selectedFloorId) {
      loadFloorTwinData(selectedBlockId, selectedFloorId);
    }
  }, [selectedBlockId, selectedFloorId]);

  const loadFloorTwinData = async (bId, fId) => {
    setLoading(true);
    try {
      // 1. Fetch Rooms from master map database
      getRooms(fId, bId)
        .then(rRes => {
          const rList = rRes.data || [];
          setFloorRooms(Array.isArray(rList) ? rList : []);
        })
        .catch(() => setFloorRooms([]));

      // 2. Fetch Digital Twin from master map database
      const res = await getDigitalTwin(bId, fId);
      if (res.data?.success) {
        const loadedTwin = res.data.twin || null;
        const session = res.data.latestSession || null;
        setTwinData(loadedTwin);
        setLatestSession(session);

        initializeAssemblyFromTwin(loadedTwin, session);
      } else {
        setTwinData(null);
        setLatestSession(null);
        initializeDefaults();
      }
      
      const sessRes = await getSpatialSessions({ buildingId: bId, floorId: fId });
      if (sessRes.data?.success) {
        setRecentSessions(sessRes.data.sessions || []);
      }
    } catch (err) {
      console.warn("Notice loading digital twin:", err.message);
      setTwinData(null);
      setLatestSession(null);
      initializeDefaults();
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = () => {
    setScannedElements([]);
    setPlacedComponents([]);
    setSelectedElementId(null);
  };

  const initializeAssemblyFromTwin = (twin, session) => {
    // 1. Restore Scanned Elements (checking non-empty arrays)
    let elements = (twin?.scannedElements && twin.scannedElements.length > 0)
      ? twin.scannedElements
      : (session?.scannedElements && session.scannedElements.length > 0)
        ? session.scannedElements
        : [];

    if (!elements || elements.length === 0) {
      const segs = (session?.roomSegments && session.roomSegments.length > 0)
        ? session.roomSegments
        : (session?.detectedRooms && session.detectedRooms.length > 0)
          ? session.detectedRooms
          : (twin?.detectedRooms && twin.detectedRooms.length > 0)
            ? twin.detectedRooms
            : [];
      
      elements = segs.map((s, idx) => ({
        id: `room_${idx}_${Date.now()}`,
        name: s.roomName || s.roomNumber || `Room ${idx + 1}`,
        type: 'room',
        geometry3D: {
          dimensions: { width: 3.2, length: 4.0, height: 2.8 },
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          color: '#3b82f6'
        },
        status: 'unplaced'
      }));
    }
    setScannedElements(elements);

    // 2. Restore Placed Components (filter out stale auto-generated corridors)
    let placed = twin?.placedComponents || [];
    placed = placed.filter(p => !p.id?.startsWith('corridor_default_') && !p.id?.startsWith('corridor_auto_'));
    setPlacedComponents(placed);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    if (selectedBlockId && selectedFloorId) {
      await loadFloorTwinData(selectedBlockId, selectedFloorId);
      toast.success("Refreshed master campus 3D map data!");
    }
    setRefreshing(false);
  };

  const handleSpawnElement = (element) => {
    const isAlreadyPlaced = placedComponents.some(p => p.id === element.id);
    if (isAlreadyPlaced) return;

    // Calculate default grid position
    const count = placedComponents.length;
    const posX = (Math.floor(count / 2) * 4) - 6;
    const posZ = count % 2 === 0 ? 1.15 : -1.15;

    const newPlacedItem = {
      id: element.id,
      name: element.name,
      type: element.type,
      position: element.geometry3D?.position || { x: posX, y: 0, z: posZ },
      rotation: element.geometry3D?.rotation || { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      dimensions: element.geometry3D?.dimensions || { width: 3.2, length: 4.0, height: 2.8 },
      color: element.geometry3D?.color || (element.type === 'corridor' ? '#8b5cf6' : '#3b82f6'),
      wallColorTop: twinData?.wallColorTop || '#f6f5ee',
      wallColorBottom: twinData?.wallColorBottom || '#b5a68e'
    };

    setPlacedComponents(prev => [...prev, newPlacedItem]);
    setSelectedElementId(element.id);
    toast.success(`Placed ${element.name} onto floor grid!`);
  };

  const handleTransformChange = (id, newTransforms) => {
    setPlacedComponents(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          position: newTransforms.position,
          rotation: newTransforms.rotation,
          scale: newTransforms.scale,
          ...(newTransforms.dimensions ? { dimensions: newTransforms.dimensions } : {})
        };
      }
      return item;
    }));
  };

  const handleDeletePlacedElement = (id) => {
    setPlacedComponents(prev => prev.filter(p => p.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
    toast.info("Item moved back to Staging Tray");
  };

  const handleAddCustomRoom = () => {
    const name = prompt("Enter Room Tag Name (e.g. Seminar Room 102, Lab A):", `Room ${scannedElements.length + 1}`);
    if (!name) return;

    const newElement = {
      id: `custom_room_${Date.now()}`,
      name: name.trim(),
      type: 'room',
      geometry3D: {
        dimensions: { width: 3.5, length: 4.5, height: 2.8 },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        color: '#3b82f6'
      },
      status: 'unplaced'
    };

    setScannedElements(prev => [...prev, newElement]);
    toast.success(`Added ${name} tag to Staging Tray!`);
  };

  const handleResetStaging = () => {
    setPlacedComponents([]);
    setSelectedElementId(null);
    toast.info("Assembly canvas cleared");
  };

  const handleAutoRouteCorridors = () => {
    const roomComponents = placedComponents.filter(c => c.type === 'room');
    if (roomComponents.length === 0) {
      toast.error("No rooms placed to route a corridor.");
      return;
    }

    // Find bounding box along X-axis for rooms to create a central corridor
    let minX = Infinity;
    let maxX = -Infinity;
    roomComponents.forEach(r => {
      if (r.position.x < minX) minX = r.position.x;
      if (r.position.x > maxX) maxX = r.position.x;
    });

    const corridorLength = Math.max(Math.abs(maxX - minX) + 6.0, 10.0);
    const centerX = (maxX + minX) / 2;

    const autoCorridor = {
      id: `corridor_auto_${Date.now()}`,
      name: 'Auto-Routed Corridor',
      type: 'corridor',
      position: { x: centerX, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      dimensions: { width: 2.4, length: corridorLength, height: 2.8 },
      color: '#8b5cf6'
    };

    setPlacedComponents(prev => [...prev, autoCorridor]);
    toast.success("Corridor automatically routed!");
  };

  // Req 5: Auto-trigger corridor generation when all scanned elements are placed
  useEffect(() => {
    if (scannedElements.length === 0) return;
    const unplacedCount = scannedElements.filter(e => !placedComponents.some(p => p.id === e.id)).length;
    const hasRooms = placedComponents.some(c => c.type === 'room');
    const hasCorridor = placedComponents.some(c => c.type === 'corridor');
    if (unplacedCount === 0 && hasRooms && !hasCorridor) {
      // Delay briefly so state settles
      const timer = setTimeout(() => handleAutoRouteCorridors(), 600);
      return () => clearTimeout(timer);
    }
  }, [scannedElements, placedComponents]);

  const handlePublishFloor = async () => {
    if (!selectedBlockId || !selectedFloorId) {
      toast.error("Please select a Building and Floor first.");
      return;
    }

    setPublishing(true);
    try {
      const payload = {
        campusId,
        buildingId: selectedBlockId,
        floorId: selectedFloorId,
        scannedElements,
        placedComponents,
        doors: placedComponents.map(p => ({
          position: p.position,
          width: p.dimensions?.width || 1.15,
          height: p.dimensions?.height || 2.2,
          roomNumber: p.name,
          isOpen: true
        }))
      };

      const res = await publishDigitalTwinLayout(payload);
      if (res.data?.success) {
        toast.success("🎉 Floor 3D Assembly Published Live! User App Navigation Cache Invalidated.");
        setTwinData(res.data.twin);
      } else {
        toast.error("Failed to publish floor layout.");
      }
    } catch (err) {
      console.error("Error publishing floor layout:", err);
      toast.error(err.response?.data?.error || "Error publishing layout");
    } finally {
      setPublishing(false);
    }
  };

  const selectedBlock = useMemo(() => blocks.find(b => b._id === selectedBlockId), [blocks, selectedBlockId]);
  const activeFloor = useMemo(() => floors.find(f => f._id === selectedFloorId), [floors, selectedFloorId]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Dynamic Header Bar */}
      <header className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-20 shrink-0 shadow-lg">
        {/* Left: Branding & Selectors */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30">
              <Layers3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base text-white tracking-tight">NavX Spatial Studio</h1>
              <p className="text-[11px] text-slate-400">Hybrid Manual Assembly & 3D Twin Editor</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 my-auto" />

          {/* Building Dropdown */}
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-violet-400" />
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="bg-slate-950 text-xs font-semibold text-slate-200 border border-slate-800 rounded-xl px-3 py-1.5 focus:outline-none focus:border-violet-500 transition"
            >
              {blocks.map(b => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Floor Dropdown */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <select
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              className="bg-slate-950 text-xs font-semibold text-slate-200 border border-slate-800 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition"
            >
              {floors.map(f => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Actions & Primary CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
            title="Refresh Map Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-violet-400' : ''}`} />
          </button>

          {/* Primary CTA: Publish Floor & Sync to User App */}
          <button
            onClick={handlePublishFloor}
            disabled={publishing}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 border border-violet-400/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {publishing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{publishing ? 'Publishing...' : 'Publish Floor & Sync to User App'}</span>
          </button>
        </div>
      </header>

      {/* Main Split-Screen Workspace (70% Canvas / 30% Staging Tray) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] overflow-hidden">
        {/* Left Panel (70%): Interactive R3F 3D Assembly Canvas */}
        <div className="relative h-full w-full overflow-hidden">
          <SpatialAssemblyCanvas
            floors={floors}
            activeFloor={activeFloor}
            selectedBlock={selectedBlock}
            twinData={twinData}
            floorRooms={floorRooms}
            placedComponents={placedComponents}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onTransformChange={handleTransformChange}
            onDeletePlacedElement={handleDeletePlacedElement}
            startPoint={twinData?.startPoint || latestSession?.startPoint}
            endPoint={twinData?.endPoint || latestSession?.endPoint}
          />
        </div>

        {/* Right Panel (30%): Live 3D Thumbnail Staging Tray */}
        <div className="h-full overflow-hidden">
          <StagingTray
            scannedElements={scannedElements}
            placedComponents={placedComponents}
            onSpawnElement={handleSpawnElement}
            onAddCustomRoom={handleAddCustomRoom}
            onResetStaging={handleResetStaging}
            onAutoRouteCorridors={handleAutoRouteCorridors}
            selectedElementId={selectedElementId}
            startPoint={twinData?.startPoint || latestSession?.startPoint}
            endPoint={twinData?.endPoint || latestSession?.endPoint}
            detectedRooms={twinData?.detectedRooms || latestSession?.detectedRooms || []}
            blockShape={selectedBlock?.shape}
            scannedElementNames={scannedElements.map(e => e.name)}
          />
        </div>
      </div>
    </div>
  );
}
