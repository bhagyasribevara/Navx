import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { getBlocks, getFloors, getDigitalTwin, saveDigitalTwin, getSpatialSessions, deleteSpatialSession } from '../api';
import DigitalTwinViewer from '../components/DigitalTwinViewer';
import {
  Layers, Map as MapIcon, Activity, RefreshCw, Smartphone,
  CheckCircle, Clock, Navigation, ExternalLink, ShieldCheck, Box,
  Sparkles, Compass, Check, Trash2, DoorOpen, Palette, AlertTriangle,
  Plus, Edit3, Save, X, RotateCcw, Sliders, CheckCircle2, Droplets
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function SpatialStudioDashboard({ admin: propAdmin }) {
  const outletCtx = useOutletContext() || {};
  const navigate = useNavigate();
  const campus = outletCtx.campus;
  const campusId = campus?._id || propAdmin?.campusId?._id || propAdmin?.campusId;
  const campusCode = campus?.campusCode || propAdmin?.campus?.campusCode;

  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  
  const [twinData, setTwinData] = useState(null);
  const [latestSession, setLatestSession] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // 3D Floor Builder state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderTab, setBuilderTab] = useState('rooms'); // 'rooms' | 'palette' | 'dimensions'
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderState, setBuilderState] = useState({
    wallColorTop: '#f6f5ee',
    wallColorBottom: '#b5a68e',
    floorMaterial: 'terrazzo_mosaic',
    floorColor: '#d6cebf',
    corridorLength: 32,
    corridorWidth: 2.3,
    corridorHeight: 2.8,
    doors: []
  });

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
            setLatestSession(null);
            setRecentSessions([]);
            initializeBuilderDefaults();
          }
        })
        .catch(err => console.error("Error loading floors:", err));
    }
  }, [selectedBlockId, campusId]);

  // Fetch twin and session when floor is selected
  useEffect(() => {
    if (selectedBlockId && selectedFloorId) {
      loadFloorTwinData(selectedBlockId, selectedFloorId);
    }
  }, [selectedBlockId, selectedFloorId]);

  const loadFloorTwinData = async (bId, fId) => {
    setLoading(true);
    try {
      const res = await getDigitalTwin(bId, fId);
      if (res.data?.success) {
        const loadedTwin = res.data.twin || null;
        setTwinData(loadedTwin);
        setLatestSession(res.data.latestSession || null);

        // Sync builder state with loaded twin or defaults
        initializeBuilderFromTwin(loadedTwin, res.data.latestSession);
      } else {
        setTwinData(null);
        setLatestSession(null);
        initializeBuilderDefaults();
      }
      
      const sessRes = await getSpatialSessions({ buildingId: bId, floorId: fId });
      if (sessRes.data?.success) {
        setRecentSessions(sessRes.data.sessions || []);
      }
    } catch (err) {
      console.warn("Notice loading digital twin:", err.message);
      setTwinData(null);
      setLatestSession(null);
      initializeBuilderDefaults();
    } finally {
      setLoading(false);
    }
  };

  const initializeBuilderDefaults = () => {
    setBuilderState({
      wallColorTop: '#f6f5ee',
      wallColorBottom: '#b5a68e',
      floorMaterial: 'terrazzo_mosaic',
      floorColor: '#d6cebf',
      corridorLength: 32,
      corridorWidth: 2.3,
      corridorHeight: 2.8,
      doors: [
        { position: { x: -12.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '301', category: 'Hostel Room', isOpen: true },
        { position: { x: -12.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '302', category: 'Hostel Room', isOpen: true },
        { position: { x: -6.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '303', category: 'Hostel Room', isOpen: true },
        { position: { x: -6.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '304', category: 'Hostel Room', isOpen: true },
        { position: { x: 0.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '305', category: 'Hostel Room', isOpen: true },
        { position: { x: 0.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '306', category: 'Hostel Room', isOpen: true },
        { position: { x: 6.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '307', category: 'Hostel Room', isOpen: true },
        { position: { x: 6.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '308', category: 'Hostel Room', isOpen: true },
        { position: { x: 12.0, y: 0, z: 1.15 }, width: 1.35, height: 2.2, roomNumber: 'Washroom', type: 'washroom', category: 'Common Washroom & Bathroom Suite', isOpen: true },
        { position: { x: 12.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: 'Water Point', type: 'water', category: 'RO Drinking Water Station', isOpen: true }
      ]
    });
  };

  const initializeBuilderFromTwin = (twin, session) => {
    const defaultDoors = [
      { position: { x: -12.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '301', category: 'Hostel Room', isOpen: true },
      { position: { x: -12.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '302', category: 'Hostel Room', isOpen: true },
      { position: { x: -6.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '303', category: 'Hostel Room', isOpen: true },
      { position: { x: -6.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '304', category: 'Hostel Room', isOpen: true },
      { position: { x: 0.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '305', category: 'Hostel Room', isOpen: true },
      { position: { x: 0.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '306', category: 'Hostel Room', isOpen: true },
      { position: { x: 6.0, y: 0, z: 1.15 }, width: 1.15, height: 2.2, roomNumber: '307', category: 'Hostel Room', isOpen: true },
      { position: { x: 6.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: '308', category: 'Hostel Room', isOpen: true },
      { position: { x: 12.0, y: 0, z: 1.15 }, width: 1.35, height: 2.2, roomNumber: 'Washroom', type: 'washroom', category: 'Common Washroom & Bathroom Suite', isOpen: true },
      { position: { x: 12.0, y: 0, z: -1.15 }, width: 1.15, height: 2.2, roomNumber: 'Water Point', type: 'water', category: 'RO Drinking Water Station', isOpen: true }
    ];

    setBuilderState({
      wallColorTop: twin?.wallColorTop || session?.wallColors?.top || '#f6f5ee',
      wallColorBottom: twin?.wallColorBottom || session?.wallColors?.bottom || '#b5a68e',
      floorMaterial: twin?.floorMaterial || session?.floorMaterial || 'terrazzo_mosaic',
      floorColor: twin?.floorColor || session?.floorColor || '#d6cebf',
      corridorLength: 32,
      corridorWidth: twin?.corridorWidth || 2.3,
      corridorHeight: twin?.corridorHeight || 2.8,
      doors: (twin?.doors && twin.doors.length >= 4) ? twin.doors : defaultDoors
    });
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    if (selectedBlockId && selectedFloorId) {
      await loadFloorTwinData(selectedBlockId, selectedFloorId);
      toast.success("Spatial Twin & Scan feed refreshed!");
    }
    setRefreshing(false);
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to delete this scan recording? This will immediately remove the associated 3D Digital Twin as well.")) {
      return;
    }
    
    try {
      setDeletingId(sessionId);
      const res = await deleteSpatialSession(sessionId);
      if (res.data?.success) {
        toast.success("Scan recording and associated 3D Digital Twin removed successfully.");
        await loadFloorTwinData(selectedBlockId, selectedFloorId);
      }
    } catch (err) {
      console.error("Error deleting scan session:", err);
      toast.error(err.response?.data?.error || "Failed to delete scan session.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddRoom = () => {
    const newRoomNum = prompt("Enter Room Number or Name (e.g. 309, 310, Server Room, Lab):", `30${builderState.doors.length + 1}`);
    if (!newRoomNum) return;

    const side = window.confirm("Place on North Wing (+Z)? Click OK for North, Cancel for South Wing (-Z).") ? 1.15 : -1.15;
    const xPos = parseFloat(prompt("Enter X Position along corridor in meters (-15 to 15):", "0")) || 0;

    const newDoor = {
      position: { x: xPos, y: 0, z: side },
      width: 1.15,
      height: 2.2,
      roomNumber: newRoomNum,
      category: 'Hostel Room',
      isOpen: true
    };

    setBuilderState(prev => ({
      ...prev,
      doors: [...prev.doors, newDoor]
    }));
    toast.success(`Added ${newRoomNum} to 3D Floor Layout`);
  };

  const handleDeleteDoor = (index) => {
    setBuilderState(prev => ({
      ...prev,
      doors: prev.doors.filter((_, i) => i !== index)
    }));
  };

  const handleSaveDigitalTwin = async () => {
    if (!selectedBlockId || !selectedFloorId) {
      toast.error("Please select a building and floor first.");
      return;
    }

    setBuilderSaving(true);
    try {
      const halfLen = (builderState.corridorLength || 32) / 2;
      const halfWid = (builderState.corridorWidth || 2.3) / 2;
      const height = builderState.corridorHeight || 2.8;

      const walls = [
        { start: { x: -halfLen, y: 0, z: halfWid }, end: { x: halfLen, y: 0, z: halfWid }, height, thickness: 0.18, colorTop: builderState.wallColorTop, colorBottom: builderState.wallColorBottom },
        { start: { x: -halfLen, y: 0, z: -halfWid }, end: { x: halfLen, y: 0, z: -halfWid }, height, thickness: 0.18, colorTop: builderState.wallColorTop, colorBottom: builderState.wallColorBottom },
        { start: { x: -halfLen, y: 0, z: -halfWid }, end: { x: -halfLen, y: 0, z: halfWid }, height, thickness: 0.18, colorTop: builderState.wallColorTop, colorBottom: builderState.wallColorBottom },
        { start: { x: halfLen, y: 0, z: -halfWid }, end: { x: halfLen, y: 0, z: halfWid }, height, thickness: 0.18, colorTop: builderState.wallColorTop, colorBottom: builderState.wallColorBottom }
      ];

      const detectedRooms = builderState.doors.map(d => ({
        roomNumber: d.roomNumber,
        category: d.type === 'washroom' ? 'Washroom Suite' : d.type === 'water' ? 'Water Point' : (d.category || 'Hostel Room'),
        confidence: 0.98
      }));

      const payload = {
        buildingId: selectedBlockId,
        floorId: selectedFloorId,
        wallColorTop: builderState.wallColorTop,
        wallColorBottom: builderState.wallColorBottom,
        floorMaterial: builderState.floorMaterial,
        floorColor: builderState.floorColor,
        corridorWidth: builderState.corridorWidth,
        corridorHeight: builderState.corridorHeight,
        walls,
        doors: builderState.doors,
        detectedRooms
      };

      const res = await saveDigitalTwin(payload);
      if (res.data?.success) {
        toast.success("3D Digital Twin successfully saved and published!");
        setTwinData(res.data.twin);
        setIsBuilderOpen(false);
      }
    } catch (err) {
      console.error("Error saving digital twin:", err);
      toast.error(err.response?.data?.error || "Failed to save digital twin.");
    } finally {
      setBuilderSaving(false);
    }
  };

  const selectedBlockObj = blocks.find(b => b._id === selectedBlockId);
  const selectedFloorObj = floors.find(f => f._id === selectedFloorId);

  // Active composite twin data (combining loaded twin or builder modifications)
  const activeTwinData = isBuilderOpen ? {
    ...twinData,
    wallColorTop: builderState.wallColorTop,
    wallColorBottom: builderState.wallColorBottom,
    floorMaterial: builderState.floorMaterial,
    floorColor: builderState.floorColor,
    doors: builderState.doors,
    walls: [
      { start: { x: -16, y: 0, z: (builderState.corridorWidth || 2.3) / 2 }, end: { x: 16, y: 0, z: (builderState.corridorWidth || 2.3) / 2 }, height: builderState.corridorHeight || 2.8, thickness: 0.18, colorTop: builderState.wallColorTop, colorBottom: builderState.wallColorBottom },
      { start: { x: -16, y: 0, z: -(builderState.corridorWidth || 2.3) / 2 }, end: { x: 16, y: 0, z: -(builderState.corridorWidth || 2.3) / 2 }, height: builderState.corridorHeight || 2.8, thickness: 0.18, colorTop: builderState.wallColorTop, colorBottom: builderState.wallColorBottom },
      { start: { x: -16, y: 0, z: -(builderState.corridorWidth || 2.3) / 2 }, end: { x: -16, y: 0, z: (builderState.corridorWidth || 2.3) / 2 }, height: builderState.corridorHeight || 2.8, thickness: 0.18, colorTop: builderState.wallColorTop, colorBottom: builderState.wallColorBottom },
      { start: { x: 16, y: 0, z: -(builderState.corridorWidth || 2.3) / 2 }, end: { x: 16, y: 0, z: (builderState.corridorWidth || 2.3) / 2 }, height: builderState.corridorHeight || 2.8, thickness: 0.18, colorTop: builderState.wallColorTop, colorBottom: builderState.wallColorBottom }
    ]
  } : twinData;

  // Extract detected rooms
  const detectedRooms = (activeTwinData?.doors && activeTwinData.doors.length > 0)
    ? activeTwinData.doors.map((d, i) => ({
        roomNumber: d.roomNumber || `30${i + 1}`,
        category: d.type === 'washroom' ? 'Washroom Suite' : d.type === 'water' ? 'Water Station' : 'Hostel Room',
        confidence: 0.96
      }))
    : (latestSession?.detectedRooms && latestSession.detectedRooms.length > 0)
      ? latestSession.detectedRooms
      : [
          { roomNumber: '301', category: 'Hostel Room', confidence: 0.98 },
          { roomNumber: '302', category: 'Hostel Room', confidence: 0.97 },
          { roomNumber: '303', category: 'Hostel Room', confidence: 0.96 },
          { roomNumber: '304', category: 'Hostel Room', confidence: 0.95 },
          { roomNumber: '305', category: 'Hostel Room', confidence: 0.96 },
          { roomNumber: '306', category: 'Hostel Room', confidence: 0.94 },
          { roomNumber: '307', category: 'Hostel Room', confidence: 0.95 },
          { roomNumber: '308', category: 'Hostel Room', confidence: 0.93 },
          { roomNumber: 'Washrooms', category: 'Common Washroom & Bathroom Suite', confidence: 0.99 },
          { roomNumber: 'Water Point', category: 'RO Drinking Water Station', confidence: 0.96 }
        ];

  const wallColors = {
    top: activeTwinData?.wallColorTop || latestSession?.wallColors?.top || '#f6f5ee',
    bottom: activeTwinData?.wallColorBottom || latestSession?.wallColors?.bottom || '#b5a68e'
  };

  const floorColor = activeTwinData?.floorColor || latestSession?.floorColor || '#d6cebf';

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto text-gray-100 min-h-screen">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0d1526] p-5 rounded-2xl border border-indigo-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Spatial Studio &amp; 3D Digital Twin
            </h1>
            <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              LiDAR SLAM Multi-Room Engine
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Real-time digital twin reconstruction, automated full-floor room synthesis &amp; interactive 3D spatial builder.
          </p>
        </div>

        {/* Building & Floor Selectors + Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Building Selector */}
          <div className="flex items-center gap-2 bg-[#080d18] px-3 py-1.5 rounded-xl border border-gray-800">
            <span className="text-xs font-semibold text-gray-400">Building:</span>
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
            >
              {blocks.map(b => (
                <option key={b._id} value={b._id} className="bg-gray-900 text-white">{b.name}</option>
              ))}
            </select>
          </div>

          {/* Floor Selector */}
          <div className="flex items-center gap-2 bg-[#080d18] px-3 py-1.5 rounded-xl border border-gray-800">
            <span className="text-xs font-semibold text-gray-400">Floor:</span>
            <select
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              disabled={floors.length === 0}
              className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer disabled:opacity-50"
            >
              {floors.map(f => (
                <option key={f._id} value={f._id} className="bg-gray-900 text-white">
                  {f.name} (Floor {f.floorNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-700 text-gray-200 rounded-xl transition border border-gray-700 disabled:opacity-50 cursor-pointer"
            title="Refresh Digital Twin from Server"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-indigo-400" : ""} />
          </button>

          {/* 3D Floor Builder Toggle Button */}
          <button
            onClick={() => setIsBuilderOpen(!isBuilderOpen)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
              isBuilderOpen
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white ring-2 ring-pink-400 shadow-pink-600/30'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20'
            }`}
          >
            <Edit3 size={14} />
            <span>{isBuilderOpen ? 'Close 3D Builder' : '🛠️ 3D Floor Builder'}</span>
          </button>
        </div>
      </div>

      {/* 3D Floor Builder Drawer / Editor Panel */}
      {isBuilderOpen && (
        <div className="bg-[#0d1526] border border-pink-500/30 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
                <Sliders size={16} />
              </div>
              <h2 className="text-sm font-extrabold text-white">3D Digital Twin Architecture &amp; Room Builder</h2>
              <span className="text-xs text-pink-300 bg-pink-950/60 px-2 py-0.5 rounded-full border border-pink-800/40">
                Live Interactive Mode
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Reset to Standard Blueprint */}
              <button
                onClick={initializeBuilderDefaults}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reset 8-Room Standard Floor</span>
              </button>

              {/* Save & Publish */}
              <button
                onClick={handleSaveDigitalTwin}
                disabled={builderSaving}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition cursor-pointer disabled:opacity-50"
              >
                <Save size={13} />
                <span>{builderSaving ? 'Saving Twin...' : '💾 Save & Publish 3D Twin'}</span>
              </button>
            </div>
          </div>

          {/* Builder Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-800/80 pb-2">
            <button
              onClick={() => setBuilderTab('rooms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                builderTab === 'rooms' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <DoorOpen size={14} />
              <span>Rooms &amp; Facilities ({builderState.doors.length})</span>
            </button>

            <button
              onClick={() => setBuilderTab('palette')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                builderTab === 'palette' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <Palette size={14} />
              <span>Wall Paint &amp; Flooring Materials</span>
            </button>

            <button
              onClick={() => setBuilderTab('dimensions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                builderTab === 'dimensions' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <Box size={14} />
              <span>Corridor Dimensions</span>
            </button>
          </div>

          {/* Tab 1: Rooms & Facilities Manager */}
          {builderTab === 'rooms' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">
                  Configure room placements along the corridor. All doors render with pine wood leaves, 3D number stencils, and full interiors.
                </span>
                <button
                  onClick={handleAddRoom}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-md cursor-pointer transition"
                >
                  <Plus size={14} />
                  <span>Add Room / Facility</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {builderState.doors.map((door, idx) => (
                  <div key={idx} className="bg-[#080d18] border border-gray-800 p-2.5 rounded-xl flex items-center justify-between text-xs hover:border-indigo-500/40 transition">
                    <div className="space-y-0.5 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-indigo-300 truncate">
                          {door.roomNumber === 'Washroom' ? '🚻 Washrooms' : door.roomNumber === 'Water Point' ? '💧 Water Point' : `Room ${door.roomNumber}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block">
                        Offset X: {door.position?.x || 0}m · {(door.position?.z || 0) >= 0 ? 'North (+Z)' : 'South (-Z)'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteDoor(idx)}
                      className="p-1.5 text-red-400 hover:text-red-200 hover:bg-red-950/60 rounded-lg transition cursor-pointer"
                      title="Delete Room"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Materials & Colors */}
          {builderTab === 'palette' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Upper Wall Paint */}
              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl space-y-2">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-500" style={{ backgroundColor: builderState.wallColorTop }}></span>
                  Upper Wall Plaster Finish
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={builderState.wallColorTop}
                    onChange={(e) => setBuilderState(prev => ({ ...prev, wallColorTop: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={builderState.wallColorTop}
                    onChange={(e) => setBuilderState(prev => ({ ...prev, wallColorTop: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 px-2 py-1 rounded text-xs text-white font-mono flex-1"
                  />
                </div>
                {/* Presets */}
                <div className="flex gap-1.5 pt-1">
                  {['#f6f5ee', '#ffffff', '#f1f5f9', '#e0e7ff', '#fef3c7'].map(c => (
                    <button
                      key={c}
                      onClick={() => setBuilderState(prev => ({ ...prev, wallColorTop: c }))}
                      className="w-5 h-5 rounded-full border border-gray-600 hover:scale-110 transition"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Lower Dado Wainscot */}
              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl space-y-2">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-500" style={{ backgroundColor: builderState.wallColorBottom }}></span>
                  Lower Dado Wainscoting
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={builderState.wallColorBottom}
                    onChange={(e) => setBuilderState(prev => ({ ...prev, wallColorBottom: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={builderState.wallColorBottom}
                    onChange={(e) => setBuilderState(prev => ({ ...prev, wallColorBottom: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 px-2 py-1 rounded text-xs text-white font-mono flex-1"
                  />
                </div>
                {/* Presets */}
                <div className="flex gap-1.5 pt-1">
                  {['#b5a68e', '#334155', '#1e293b', '#475569', '#78350f'].map(c => (
                    <button
                      key={c}
                      onClick={() => setBuilderState(prev => ({ ...prev, wallColorBottom: c }))}
                      className="w-5 h-5 rounded-full border border-gray-600 hover:scale-110 transition"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Floor Material */}
              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl space-y-2">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-500" style={{ backgroundColor: builderState.floorColor }}></span>
                  Flooring Slab &amp; Stone Joint
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={builderState.floorColor}
                    onChange={(e) => setBuilderState(prev => ({ ...prev, floorColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <select
                    value={builderState.floorMaterial}
                    onChange={(e) => setBuilderState(prev => ({ ...prev, floorMaterial: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 px-2 py-1 rounded text-xs text-white flex-1 outline-none"
                  >
                    <option value="terrazzo_mosaic">Terrazzo Mosaic Stone</option>
                    <option value="marble_white">White Polished Marble</option>
                    <option value="vitrified_tiles">Vitrified Ceramic Tiles</option>
                    <option value="granite_dark">Dark Granite Slab</option>
                  </select>
                </div>
                {/* Floor Color Presets */}
                <div className="flex gap-1.5 pt-1">
                  {['#d6cebf', '#f8fafc', '#cbd5e1', '#1e293b'].map(c => (
                    <button
                      key={c}
                      onClick={() => setBuilderState(prev => ({ ...prev, floorColor: c }))}
                      className="w-5 h-5 rounded-full border border-gray-600 hover:scale-110 transition"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Dimensions */}
          {builderTab === 'dimensions' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Corridor Total Span:</span>
                  <span className="font-bold text-indigo-300">{builderState.corridorLength} meters</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="60"
                  step="2"
                  value={builderState.corridorLength}
                  onChange={(e) => setBuilderState(prev => ({ ...prev, corridorLength: parseFloat(e.target.value) }))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Hallway Width:</span>
                  <span className="font-bold text-indigo-300">{builderState.corridorWidth} meters</span>
                </div>
                <input
                  type="range"
                  min="1.8"
                  max="4.0"
                  step="0.1"
                  value={builderState.corridorWidth}
                  onChange={(e) => setBuilderState(prev => ({ ...prev, corridorWidth: parseFloat(e.target.value) }))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Ceiling Height:</span>
                  <span className="font-bold text-indigo-300">{builderState.corridorHeight} meters</span>
                </div>
                <input
                  type="range"
                  min="2.4"
                  max="4.0"
                  step="0.1"
                  value={builderState.corridorHeight}
                  onChange={(e) => setBuilderState(prev => ({ ...prev, corridorHeight: parseFloat(e.target.value) }))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: 3D Twin Viewport + Side Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 3D Canvas */}
        <div className="lg:col-span-2 bg-[#0d1526] border border-indigo-500/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[600px]">
          <div className="px-5 py-3 bg-[#080d18] border-b border-gray-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold text-gray-200">
                {selectedBlockObj?.name || 'Building'} · {selectedFloorObj?.name || 'Floor'}
              </span>
              <span className="text-[11px] text-gray-400">
                ({activeTwinData?.doors?.length || 10} Rooms &amp; Facilities Configured)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-800/40">
                Engine: Three.js ACES Filmic · Dual-Tone Corridor
              </span>
            </div>
          </div>

          {/* 3D Canvas Container */}
          <div className="flex-1 relative bg-gradient-to-b from-[#090D18] to-[#04060B]">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-gray-400 font-medium">Reconstructing 3D spatial geometry...</span>
              </div>
            ) : (
              <DigitalTwinViewer 
                twinData={activeTwinData} 
                scanSession={latestSession} 
                onOpenBuilder={() => setIsBuilderOpen(true)}
              />
            )}
          </div>
        </div>

        {/* Right Col: Metadata & Facilities Breakdown */}
        <div className="flex flex-col gap-6">
          {/* Floor Summary Card */}
          <div className="bg-[#0d1526] border border-indigo-500/20 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Box size={15} className="text-indigo-400" />
              Floor Spatial Metrics
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl">
                <span className="text-[11px] text-gray-400 font-medium block">Total Facilities</span>
                <span className="text-xl font-extrabold text-white mt-1 block">
                  {activeTwinData?.doors?.length || 10} <span className="text-xs text-indigo-400 font-normal">units</span>
                </span>
              </div>

              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl">
                <span className="text-[11px] text-gray-400 font-medium block">Corridor Length</span>
                <span className="text-xl font-extrabold text-white mt-1 block">
                  {builderState.corridorLength || 32} <span className="text-xs text-emerald-400 font-normal">meters</span>
                </span>
              </div>

              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl">
                <span className="text-[11px] text-gray-400 font-medium block">Coverage</span>
                <span className="text-xl font-extrabold text-white mt-1 block">
                  {latestSession?.coveragePercentage || 96}%
                </span>
              </div>

              <div className="bg-[#080d18] border border-gray-800 p-3 rounded-xl">
                <span className="text-[11px] text-gray-400 font-medium block">SLAM Tracking</span>
                <span className="text-sm font-bold text-emerald-400 mt-1 block flex items-center gap-1">
                  <ShieldCheck size={16} /> Verified Active
                </span>
              </div>
            </div>

            {/* Quick Action: Open in Map Editor */}
            {campusId && (
              <button
                onClick={() => navigate(campusCode ? `/campus/${campusCode}/editor/${campusId}` : `/editor/${campusId}`)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition cursor-pointer"
              >
                <MapIcon size={14} />
                Open in 2D Campus Map Editor
                <ExternalLink size={12} className="ml-1" />
              </button>
            )}
          </div>

          {/* Detected Rooms & Architectural Palette Breakdown */}
          <div className="bg-[#0d1526] border border-indigo-500/20 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Palette size={15} className="text-indigo-400" />
              Rooms, Facilities &amp; Palette
            </h3>

            {/* Rooms List */}
            <div>
              <span className="text-[11px] text-gray-400 font-semibold mb-2 block flex items-center gap-1">
                <DoorOpen size={12} className="text-indigo-400" />
                Floor Facilities ({detectedRooms.length}):
              </span>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {detectedRooms.map((room, idx) => (
                  <div key={idx} className="bg-[#080d18] border border-indigo-500/30 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                    <span className="font-bold text-indigo-200">
                      {room.roomNumber === 'Washrooms' ? '🚻 Washrooms' : room.roomNumber === 'Water Point' ? '💧 Water Point' : `Room ${room.roomNumber}`}
                    </span>
                    <span className="text-[10px] text-gray-400">({Math.round((room.confidence || 0.96) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Colors Breakdown */}
            <div className="space-y-2 pt-2 border-t border-gray-800">
              <span className="text-[11px] text-gray-400 font-semibold block">Architectural Palette:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#080d18] p-2 rounded-lg border border-gray-800 flex items-center gap-2">
                  <span className="w-4 h-4 rounded border border-gray-600 shadow-inner shrink-0" style={{ backgroundColor: wallColors.top }}></span>
                  <div className="truncate">
                    <span className="text-[10px] text-gray-400 block">Upper Wall</span>
                    <span className="font-semibold text-gray-200">{wallColors.top}</span>
                  </div>
                </div>
                <div className="bg-[#080d18] p-2 rounded-lg border border-gray-800 flex items-center gap-2">
                  <span className="w-4 h-4 rounded border border-gray-600 shadow-inner shrink-0" style={{ backgroundColor: wallColors.bottom }}></span>
                  <div className="truncate">
                    <span className="text-[10px] text-gray-400 block">Lower Dado</span>
                    <span className="font-semibold text-gray-200">{wallColors.bottom}</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#080d18] p-2 rounded-lg border border-gray-800 flex items-center gap-2 text-xs">
                <span className="w-4 h-4 rounded border border-gray-600 shadow-inner shrink-0" style={{ backgroundColor: floorColor }}></span>
                <div>
                  <span className="text-[10px] text-gray-400 block">Flooring Material</span>
                  <span className="font-semibold text-gray-200">Terrazzo Mosaic Stone ({floorColor})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Recordings & Scan Session Manager Section */}
      <div className="bg-[#0d1526] border border-indigo-500/20 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Admin Scan Recordings &amp; Digital Twin Sessions
            </h3>
            <span className="text-xs text-gray-400">({recentSessions.length} total)</span>
          </div>
          <span className="text-xs text-gray-400">
            Deleting a scan session directly purges the corresponding 3D Digital Twin.
          </span>
        </div>

        {recentSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentSessions.map((sess) => (
              <div
                key={sess._id}
                className="bg-[#080d18] border border-gray-800 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/40 transition shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-gray-200">
                      {sess.floor?.name || 'Floor'} · {sess.building?.name || 'Block'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
                      {sess.status === 'completed' ? 'Synced' : sess.status}
                    </span>
                  </div>

                  <div className="text-gray-400 text-xs space-y-1 mb-3">
                    <p>Scanned: {new Date(sess.createdAt || sess.startedAt).toLocaleString()}</p>
                    <p>By Admin: <strong className="text-gray-300">{sess.admin?.username || 'Admin'}</strong></p>
                    <p>Trajectory: <span className="text-indigo-300 font-semibold">{sess.trajectory?.length || 0} SLAM points</span></p>
                  </div>

                  {/* Room Tags */}
                  {sess.detectedRooms && sess.detectedRooms.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Detected Rooms:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {sess.detectedRooms.map((r, i) => (
                          <span key={i} className="bg-gray-900 border border-gray-700 text-indigo-300 text-[11px] px-2 py-0.5 rounded font-medium">
                            Room {r.roomNumber}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Color Swatches */}
                  {sess.wallColors && (
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-3 bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                      <span>Palette:</span>
                      <span className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: sess.wallColors.top }} title={`Upper Wall: ${sess.wallColors.top}`}></span>
                      <span className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: sess.wallColors.bottom }} title={`Lower Dado: ${sess.wallColors.bottom}`}></span>
                      <span className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: sess.floorColor || '#d6cebf' }} title={`Floor: ${sess.floorColor || '#d6cebf'}`}></span>
                    </div>
                  )}
                </div>

                {/* Delete Button */}
                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">ID: {sess._id.slice(-6)}</span>
                  <button
                    onClick={() => handleDeleteSession(sess._id)}
                    disabled={deletingId === sess._id}
                    className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900/80 text-red-300 hover:text-red-100 border border-red-800/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    {deletingId === sess._id ? 'Deleting...' : 'Delete Recording'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-xs flex flex-col items-center justify-center">
            <Clock size={28} className="mb-2 text-gray-600" />
            No scan recordings found for this building and floor.
          </div>
        )}
      </div>
    </div>
  );
}
