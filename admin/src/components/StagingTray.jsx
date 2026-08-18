import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import { Box as BoxIcon, Plus, Move, Sparkles, Layers, RefreshCw, CheckCircle2, Route, Map as MapIcon, Compass } from 'lucide-react';

// Miniature 3D Thumbnail Mesh Renderer for Staging Card (Realistic dual-tone for rooms)
function PreviewMesh({ type, dimensions, color }) {
  const meshRef = useRef();

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.8;
      meshRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.15;
    }
  });

  const w = dimensions?.width || (type === 'corridor' ? 1.5 : 2.5);
  const l = dimensions?.length || (type === 'corridor' ? 4.5 : 3.2);
  const h = dimensions?.height || 2.2;
  const scaleFactor = Math.min(1.4 / Math.max(w, l, h), 0.35);
  const isRoom = type === 'room' || type !== 'corridor';

  if (isRoom) {
    const dadoH = Math.min(0.8, h * 0.38);
    const upperH = h - dadoH;
    return (
      <group ref={meshRef} scale={[scaleFactor, scaleFactor, scaleFactor]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 2]} intensity={1.5} />
        {/* Dado */}
        <Box args={[w, dadoH, l]} position={[0, -h / 2 + dadoH / 2, 0]}>
          <meshStandardMaterial color="#b5a68e" roughness={0.7} />
        </Box>
        {/* Dado Rail */}
        <Box args={[w + 0.01, 0.03, l + 0.01]} position={[0, -h / 2 + dadoH, 0]}>
          <meshStandardMaterial color="#9e8f76" roughness={0.4} />
        </Box>
        {/* Upper Wall */}
        <Box args={[w, upperH, l]} position={[0, -h / 2 + dadoH + upperH / 2, 0]}>
          <meshStandardMaterial color="#f6f5ee" roughness={0.65} />
        </Box>
        {/* Wireframe */}
        <Box args={[w + 0.02, h + 0.02, l + 0.02]}>
          <meshBasicMaterial color="#ffffff" wireframe opacity={0.2} transparent />
        </Box>
      </group>
    );
  }

  return (
    <group ref={meshRef} scale={[scaleFactor, scaleFactor, scaleFactor]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 2]} intensity={1.5} />
      <Box args={[w, h, l]}>
        <meshStandardMaterial color={color || '#8b5cf6'} roughness={0.3} metalness={0.1} transparent opacity={0.85} />
      </Box>
      <Box args={[w + 0.02, h + 0.02, l + 0.02]}>
        <meshBasicMaterial color="#ffffff" wireframe />
      </Box>
    </group>
  );
}

export default function StagingTray({
  scannedElements = [],
  placedComponents = [],
  onSpawnElement,
  onAddCustomRoom,
  onResetStaging,
  onAutoRouteCorridors,
  selectedElementId,
  startPoint,
  endPoint,
  detectedRooms = [],
  blockShape,
  scannedElementNames = []
}) {
  const unplacedList = scannedElements.filter(e => !placedComponents.some(p => p.id === e.id));
  const placedList = placedComponents;

  // Render 2D Reference SVG Map with block perimeter and sequential room layout
  const renderReferenceMap = () => {
    if (!startPoint && !endPoint && (!blockShape?.points || blockShape.points.length < 3)) return null;
    
    const svgW = 320;
    const svgH = 160;
    const pad = 20;

    // Build block perimeter polygon (scaled to SVG)
    let blockPoly = '';
    const bPts = blockShape?.points || [];
    let bMinX = 0, bMaxX = 1, bMinY = 0, bMaxY = 1, bSpanX = 1, bSpanY = 1;

    if (bPts.length >= 3) {
      bMinX = Math.min(...bPts.map(p => p.x));
      bMaxX = Math.max(...bPts.map(p => p.x));
      bMinY = Math.min(...bPts.map(p => p.y));
      bMaxY = Math.max(...bPts.map(p => p.y));
      bSpanX = bMaxX - bMinX || 1;
      bSpanY = bMaxY - bMinY || 1;
      blockPoly = bPts.map(p => {
        const sx = pad + ((p.x - bMinX) / bSpanX) * (svgW - pad * 2);
        const sy = pad + ((p.y - bMinY) / bSpanY) * (svgH - pad * 2);
        return `${sx.toFixed(1)},${sy.toFixed(1)}`;
      }).join(' ');
    }

    // Map start/end points to SVG space accurately matching the admin's chosen path
    const projectToSvg = (pt) => {
      if (!pt) return null;
      const px = pt.x !== undefined ? pt.x : pt.lat;
      const py = pt.y !== undefined ? pt.y : pt.lng;
      if (px === undefined || py === undefined) return null;

      const sx = pad + ((px - bMinX) / bSpanX) * (svgW - pad * 2);
      const sy = pad + ((py - bMinY) / bSpanY) * (svgH - pad * 2);

      // If coordinates are wildly out of bounds, they are likely in a different coordinate system (e.g. local 0,0)
      if (sx < -2000 || sx > svgW + 2000 || sy < -2000 || sy > svgH + 2000) {
        return null;
      }
      return { x: sx, y: sy };
    };

    const spProj = startPoint ? projectToSvg(startPoint) : null;
    const epProj = endPoint ? projectToSvg(endPoint) : null;

    const spX = spProj ? spProj.x : pad + 10;
    const spY = spProj ? spProj.y : svgH / 2;
    const epX = epProj ? epProj.x : svgW - pad - 10;
    const epY = epProj ? epProj.y : svgH / 2;

    // Room names from scanned elements, positioned sequentially along start→end
    const roomNames = scannedElementNames.length > 0
      ? scannedElementNames.filter(n => n)
      : detectedRooms.map(r => r.roomName || r.roomNumber || 'Room');
    const roomCount = roomNames.length;

    return (
      <div className="mt-4 border-t border-slate-800/80 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-2">
          <MapIcon className="w-3.5 h-3.5 text-blue-400" />
          2D Reference Map
        </span>
        <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 relative w-full overflow-hidden" style={{ height: svgH + 16 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
            {/* Block Perimeter Polygon */}
            {blockPoly && (
              <polygon points={blockPoly} fill="#1e293b" fillOpacity="0.6" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 2" />
            )}
            {/* Corridor Path Line (start → end) */}
            <line x1={spX} y1={spY} x2={epX} y2={epY} stroke="#475569" strokeWidth="5" strokeLinecap="round" strokeDasharray="3 2" />

            {/* Rooms positioned sequentially along the path vector */}
            {roomNames.map((name, idx) => {
              const t = roomCount > 1 ? (idx + 0.5) / roomCount : 0.5;
              const rx = spX + t * (epX - spX);
              const ry = spY + t * (epY - spY) + (idx % 2 === 0 ? -18 : 18);
              const rw = 42;
              const rh = 14;
              return (
                <g key={idx}>
                  <rect x={rx - rw / 2} y={ry - rh / 2} width={rw} height={rh} fill="#3b82f6" fillOpacity="0.4" stroke="#60a5fa" strokeWidth="1" rx="2" />
                  <text x={rx} y={ry + 3} fontSize="6" fill="#e2e8f0" textAnchor="middle" fontWeight="bold">{name.length > 10 ? name.slice(0, 10) + '…' : name}</text>
                  {/* Connector to corridor path */}
                  <line x1={rx} y1={idx % 2 === 0 ? ry + rh / 2 : ry - rh / 2} x2={rx} y2={spY + t * (epY - spY)} stroke="#475569" strokeWidth="1" strokeDasharray="2 1" />
                </g>
              );
            })}

            {/* Start Node */}
            <circle cx={spX} cy={spY} r="5" fill="#22c55e" />
            <text x={spX} y={spY - 8} fontSize="7" fill="#22c55e" textAnchor="middle" fontWeight="bold">Start</text>
            {/* End Node */}
            <circle cx={epX} cy={epY} r="5" fill="#ef4444" />
            <text x={epX} y={epY - 8} fontSize="7" fill="#ef4444" textAnchor="middle" fontWeight="bold">End</text>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-md border-l border-slate-800 text-slate-100 overflow-hidden shadow-2xl rounded-r-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
            <BoxIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
              3D Staging Tray
              <span className="px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                {unplacedList.length} Available
              </span>
            </h3>
            <p className="text-xs text-slate-400">Click to align onto active floor plane</p>
          </div>
        </div>

        <button
          onClick={onAddCustomRoom}
          className="p-2 text-xs font-semibold text-violet-300 hover:text-white bg-violet-600/30 hover:bg-violet-600/50 rounded-lg border border-violet-500/40 transition-all flex items-center gap-1 shadow-sm"
          title="Add new 3D Room tag"
        >
          <Plus className="w-4 h-4" />
          <span>Add Tag</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Unplaced Staging Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Incoming 3D Geometry ({unplacedList.length})
            </span>
            {placedList.length > 0 && (
              <button
                onClick={onResetStaging}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>

          {unplacedList.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-800 bg-slate-950/30 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
              <p className="text-xs text-slate-300 font-medium">All components placed onto floor!</p>
              <button
                onClick={onAutoRouteCorridors}
                className="mt-2 w-full text-xs font-semibold py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Route className="w-4 h-4" />
                <span>Auto-Route Corridors</span>
              </button>
            </div>
          ) : (
            unplacedList.map((item) => {
              const isSelected = selectedElementId === item.id;
              const w = item.geometry3D?.dimensions?.width || (item.type === 'corridor' ? 2.4 : 3.0);
              const l = item.geometry3D?.dimensions?.length || (item.type === 'corridor' ? 20.0 : 4.0);
              const h = item.geometry3D?.dimensions?.height || 2.8;

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-xl border transition-all duration-200 p-3 bg-slate-950/70 hover:bg-slate-950 flex gap-3 ${
                    isSelected
                      ? 'border-violet-500 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/50'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Miniature R3F Canvas Viewport */}
                  <div className="w-20 h-20 rounded-lg bg-slate-900 border border-slate-800/80 overflow-hidden relative shrink-0 shadow-inner">
                    <Canvas camera={{ position: [0, 2, 3], fov: 45 }}>
                      <PreviewMesh
                        type={item.type}
                        dimensions={item.geometry3D?.dimensions}
                        color={item.geometry3D?.color}
                      />
                    </Canvas>
                    <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 rounded bg-black/60 text-slate-300 backdrop-blur-xs">
                      3D
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-100 truncate group-hover:text-violet-300 transition">
                          {item.name}
                        </h4>
                        <span
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                            item.type === 'corridor'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {item.type}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-1">
                        {w}m × {l}m × {h}m
                      </p>
                    </div>

                    <button
                      onClick={() => onSpawnElement(item)}
                      className="mt-2 text-xs font-semibold py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/20"
                    >
                      <Move className="w-3.5 h-3.5" />
                      <span>Place on Map Grid</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Placed Elements List */}
        {placedList.length > 0 && (
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Positioned Elements ({placedList.length})
            </span>
            <div className="space-y-1.5">
              {placedList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs"
                >
                  <div className="flex items-center gap-2 max-w-[160px]">
                    <span className={`w-2 h-2 rounded-full ${item.type === 'corridor' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                    <span className="font-medium text-slate-300 truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase font-bold px-1 py-0.5 rounded ${item.type === 'corridor' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {item.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ({item.position?.x?.toFixed(1) || 0}, {item.position?.z?.toFixed(1) || 0})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {renderReferenceMap()}
      </div>
    </div>
  );
}
