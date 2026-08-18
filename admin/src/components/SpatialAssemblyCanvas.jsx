import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Box, Text, Html, Sphere, Cone } from '@react-three/drei';
import * as THREE from 'three';
import {
  RotateCw, Trash2, Layers, Sliders, Compass, LayoutGrid,
  Maximize2, Move, Sparkles, CheckCircle2, RefreshCcw
} from 'lucide-react';

// --- Telemetry Marker Component ---
function TelemetryMarker({ point, type }) {
  if (!point) return null;
  const isStart = type === 'start';
  const color = isStart ? '#22c55e' : '#ef4444';
  const label = isStart ? 'Start Point' : 'End Point';
  const heading = point.heading || 0; // Degrees
  
  return (
    <group position={[point.x || 0, 0.5, point.y || 0]}>
      <Sphere args={[0.4, 16, 16]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </Sphere>
      <Cone args={[0.3, 0.8, 8]} position={[0, 0.8, 0]} rotation={[Math.PI, -heading * (Math.PI / 180), 0]}>
        <meshStandardMaterial color={color} />
      </Cone>
      <Html position={[0, 1.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="px-2 py-1 bg-slate-900/80 backdrop-blur-md rounded border border-slate-700 shadow-xl whitespace-nowrap">
          <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        </div>
      </Html>
    </group>
  );
}

// --- Architectural Wall Component ---
function ArchitecturalWall({ wall, defaultColors }) {
  const startX = wall.start?.x ?? 0;
  const startZ = wall.start?.z ?? (wall.start?.y ?? 0);
  const endX = wall.end?.x ?? 0;
  const endZ = wall.end?.z ?? (wall.end?.y ?? 0);

  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.sqrt(dx * dx + dz * dz) || 1;
  const totalHeight = wall.height || 2.8;
  const thickness = wall.thickness || 0.18;

  const dadoHeight = Math.min(1.0, totalHeight * 0.38);
  const upperHeight = totalHeight - dadoHeight;

  const midX = (startX + endX) / 2;
  const midZ = (startZ + endZ) / 2;
  const angle = Math.atan2(dz, dx);

  const colorTop = wall.colorTop || defaultColors?.top || '#f6f5ee';
  const colorBottom = wall.colorBottom || defaultColors?.bottom || '#b5a68e';

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]} raycast={() => null}>
      <Box args={[length, dadoHeight, thickness]} position={[0, dadoHeight / 2, 0]}>
        <meshStandardMaterial color={colorBottom} roughness={0.75} metalness={0.05} />
      </Box>
      <Box args={[length, upperHeight, thickness]} position={[0, dadoHeight + upperHeight / 2, 0]}>
        <meshStandardMaterial color={colorTop} roughness={0.68} metalness={0.04} />
      </Box>
      <Box args={[length + 0.01, 0.04, thickness + 0.02]} position={[0, dadoHeight, 0]}>
        <meshStandardMaterial color="#9e8f76" roughness={0.4} />
      </Box>
      <Box args={[length + 0.02, 0.09, thickness + 0.03]} position={[0, 0.045, 0]}>
        <meshStandardMaterial color="#574f45" roughness={0.5} />
      </Box>
    </group>
  );
}

// --- Utility: Compute normalized polygon vertices for a block shape from map editor ---
function computeBlockBoundary(shapeData) {
  if (!shapeData) return { polygon: [], normW: 50, normL: 40 };
  const pts = shapeData.points || [];
  const shapeType = shapeData.type || 'rectangle';

  if (pts.length >= 3) {
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    const spanX = maxX - minX || 1e-8;
    const spanY = maxY - minY || 1e-8;

    let polygon = [];
    let normW = 50;
    let normL = 40;

    // Detect if lat-lng scale (spans usually < 5 degrees) vs pixel scale
    const isLatLng = spanX < 5 && spanY < 5;
    const avgX = (minX + maxX) / 2;
    const avgY = (minY + maxY) / 2;

    let scaleX = 1;
    let scaleZ = 1;

    if (isLatLng) {
      scaleX = 111320;
      scaleZ = 111320 * Math.cos((avgX * Math.PI) / 180);
      normW = Math.max(5, spanX * scaleX);
      normL = Math.max(5, spanY * scaleZ);
    } else {
      scaleX = 1;
      scaleZ = 1;
      normW = Math.max(5, spanX);
      normL = Math.max(5, spanY);
    }

    const project = (pt) => ({
      x: (pt.x - avgX) * scaleX,
      z: (pt.y - avgY) * scaleZ
    });

    polygon = pts.map(project);

    return { polygon, normW, normL, project };
  }

  if (shapeType === 'circle') {
    const radius = (shapeData.radius || 100) * 0.08;
    const segments = 32;
    const polygon = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      polygon.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
    }
    return { polygon, normW: radius * 2, normL: radius * 2, project: (pt) => pt };
  }

  // Rectangle — use actual width/height from map editor, scaled to meters
  const w = (shapeData.width || 200) * 0.08;
  const l = (shapeData.height || 150) * 0.08;
  const hw = w / 2;
  const hl = l / 2;
  const polygon = [
    { x: -hw, z: -hl }, { x: hw, z: -hl },
    { x: hw, z: hl }, { x: -hw, z: hl }
  ];
  return { polygon, normW: w, normL: l, project: (pt) => pt };
}

// --- Utility: Point-in-polygon test (ray casting algorithm) ---
function isPointInsidePolygon(px, pz, polygon) {
  if (!polygon || polygon.length < 3) return true; // No boundary = always inside
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    const intersect = ((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// --- Utility: Clamp point to nearest boundary edge ---
function clampToPolygon(px, pz, polygon) {
  if (!polygon || polygon.length < 3) return { x: px, z: pz };
  let closestDist = Infinity;
  let closestPoint = { x: px, z: pz };

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((px - a.x) * dx + (pz - a.z) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * dx, z: a.z + t * dz };
    const dist = Math.sqrt((px - proj.x) ** 2 + (pz - proj.z) ** 2);
    if (dist < closestDist) {
      closestDist = dist;
      closestPoint = proj;
    }
  }
  // Push slightly inward (1m margin)
  const cx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
  const cz = polygon.reduce((s, p) => s + p.z, 0) / polygon.length;
  const toCenter = { x: cx - closestPoint.x, z: cz - closestPoint.z };
  const tLen = Math.sqrt(toCenter.x ** 2 + toCenter.z ** 2) || 1;
  return { x: closestPoint.x + (toCenter.x / tLen) * 1.0, z: closestPoint.z + (toCenter.z / tLen) * 1.0 };
}

// --- Extruded Polygon Basement Floor Slab matching exact Block & Floor Shape from Map Editor ---
function ExactBlockFloorBasement({ selectedBlock, boundaryStatus }) {
  const shapeData = selectedBlock?.shape;

  const { geometry, centerPoint } = useMemo(() => {
    const { polygon } = computeBlockBoundary(shapeData);

    if (polygon.length >= 3) {
      const shape = new THREE.Shape();
      polygon.forEach((pt, i) => {
        if (i === 0) shape.moveTo(pt.x, pt.z);
        else shape.lineTo(pt.x, pt.z);
      });

      const extrudeSettings = { depth: 0.25, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 };
      const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geom.rotateX(Math.PI / 2);
      return { geometry: geom, centerPoint: [0, -0.125, 0] };
    }

    // Fallback square
    const shape = new THREE.Shape();
    shape.moveTo(-20, -16); shape.lineTo(20, -16); shape.lineTo(20, 16); shape.lineTo(-20, 16);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
    geom.rotateX(Math.PI / 2);
    return { geometry: geom, centerPoint: [0, -0.125, 0] };
  }, [shapeData]);

  // Boundary wireframe color based on drag status
  const wireColor = boundaryStatus === 'warning' ? '#ef4444' : boundaryStatus === 'safe' ? '#22c55e' : '#6366f1';

  return (
    <group position={centerPoint} raycast={() => null}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#1e293b" roughness={0.75} metalness={0.25} />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={wireColor} wireframe />
      </mesh>
    </group>
  );
}

// --- Render Imported 2D/3D Map Editor Rooms & Areas Overlay ---
function MasterMapFloorRooms({ floorRooms = [], selectedBlock }) {
  const shapeData = selectedBlock?.shape;

  const roomElements = useMemo(() => {
    if (!floorRooms || floorRooms.length === 0) return [];
    
    // Reuse identical bounds logic from ExactBlockFloorBasement for perfect alignment
    const { normW, normL, project } = computeBlockBoundary(shapeData);

    return floorRooms.map(rm => {
      const rPts = rm.shape?.points || [];
      const fill = rm.shape?.fill || '#3b82f6';
      const stroke = rm.shape?.stroke || '#60a5fa';

      if (rPts.length >= 3) {
        const rShape = new THREE.Shape();
        rPts.forEach((pt, i) => {
          const proj = project(pt);
          if (i === 0) rShape.moveTo(proj.x, proj.z);
          else rShape.lineTo(proj.x, proj.z);
        });

        const extrudeSettings = { depth: 0.1, bevelEnabled: false };
        const geom = new THREE.ExtrudeGeometry(rShape, extrudeSettings);
        geom.rotateX(Math.PI / 2);

        return { id: rm._id, name: rm.name, type: 'polygon', geometry: geom, fill, stroke, pos: [0, 0.05, 0] };
      } else {
        const rw = Math.max(2.0, (rm.shape?.width || 80) * 0.05);
        const rl = Math.max(2.0, (rm.shape?.height || 60) * 0.05);
        const rx = (rm.shape?.x || 0) * 0.05 - normW * 0.25;
        const ry = (rm.shape?.y || 0) * 0.05 - normL * 0.25;

        return { id: rm._id, name: rm.name, type: 'rectangle', dimensions: [rw, 0.1, rl], fill, stroke, pos: [rx, 0.05, ry] };
      }
    });
  }, [floorRooms, shapeData]);

  if (roomElements.length === 0) return null;

  return (
    <group raycast={() => null}>
      {roomElements.map(rm => (
        <group key={rm.id} position={rm.pos}>
          {rm.type === 'polygon' ? (
            <mesh geometry={rm.geometry}>
              <meshStandardMaterial color={rm.fill} opacity={0.65} transparent roughness={0.5} />
            </mesh>
          ) : (
            <Box args={rm.dimensions}>
              <meshStandardMaterial color={rm.fill} opacity={0.65} transparent roughness={0.5} />
            </Box>
          )}
          <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
            <span className="px-1.5 py-0.5 bg-slate-900/90 text-[9px] font-bold text-slate-200 border border-slate-700/80 rounded shadow-md whitespace-nowrap">
              {rm.name}
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}

// --- Render Placed Interactive 3D Component with Realistic Dual-Tone Wall Treatment ---
function PlacedComponentMesh({
  item,
  isSelected,
  onSelect,
  onStartDrag
}) {
  const width = item.dimensions?.width || (item.type === 'corridor' ? 2.4 : 3.2);
  const length = item.dimensions?.length || (item.type === 'corridor' ? 20.0 : 4.0);
  const height = item.dimensions?.height || 2.8;
  const baseColor = item.color || (item.type === 'corridor' ? '#8b5cf6' : '#3b82f6');

  const posX = item.position?.x || 0;
  const posY = (item.position?.y || 0);
  const posZ = item.position?.z || 0;
  const rotY = item.rotation?.y || 0;

  const isRoom = item.type === 'room';
  const wallTop = item.wallColorTop || '#f6f5ee';
  const wallBottom = item.wallColorBottom || '#b5a68e';
  const dadoHeight = isRoom ? Math.min(1.0, height * 0.38) : 0;
  const upperHeight = isRoom ? height - dadoHeight : height;

  const geomKey = `box-${width}-${height}-${length}`;

  const handleClick = (e) => { e.stopPropagation(); onSelect(item.id); };
  const handlePointerDown = (e) => { e.stopPropagation(); onSelect(item.id); onStartDrag(item.id); };

  if (isRoom) {
    return (
      <group position={[posX, posY, posZ]} rotation={[0, rotY, 0]}>
        {/* Dado / Lower Wall Band */}
        <Box
          args={[width, dadoHeight, length]}
          position={[0, dadoHeight / 2, 0]}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
        >
          <meshStandardMaterial color={isSelected ? '#38bdf8' : wallBottom} roughness={0.75} metalness={0.05} transparent opacity={isSelected ? 0.94 : 0.88} />
        </Box>

        {/* Dado Rail Trim */}
        <Box args={[width + 0.01, 0.04, length + 0.02]} position={[0, dadoHeight, 0]} raycast={() => null}>
          <meshStandardMaterial color="#9e8f76" roughness={0.4} />
        </Box>

        {/* Upper Wall */}
        <Box
          args={[width, upperHeight, length]}
          position={[0, dadoHeight + upperHeight / 2, 0]}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
        >
          <meshStandardMaterial color={isSelected ? '#7dd3fc' : wallTop} roughness={0.68} metalness={0.04} transparent opacity={isSelected ? 0.94 : 0.88} />
        </Box>

        {/* Baseboard Strip */}
        <Box args={[width + 0.02, 0.09, length + 0.03]} position={[0, 0.045, 0]} raycast={() => null}>
          <meshStandardMaterial color="#574f45" roughness={0.5} />
        </Box>

        {/* Door Frame (front face) */}
        <Box args={[1.0, 2.1, 0.1]} position={[0, 1.05, length / 2 + 0.05]} raycast={() => null}>
          <meshStandardMaterial color="#78716c" roughness={0.6} metalness={0.1} />
        </Box>
        <Box args={[1.1, 0.08, 0.12]} position={[0, 2.12, length / 2 + 0.05]} raycast={() => null}>
          <meshStandardMaterial color="#57534e" roughness={0.5} />
        </Box>

        {/* Selection Wireframe */}
        <Box args={[width + 0.04, height + 0.04, length + 0.04]} position={[0, height / 2, 0]}>
          <meshBasicMaterial color={isSelected ? '#f59e0b' : '#ffffff'} wireframe opacity={isSelected ? 1 : 0.15} transparent />
        </Box>

        {/* Selected Halo Ring */}
        {isSelected && (
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width + 0.4, length + 0.4]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    );
  }

  // Corridor: single-color mesh
  return (
    <group position={[posX, posY + height / 2, posZ]} rotation={[0, rotY, 0]}>
      <mesh onClick={handleClick} onPointerDown={handlePointerDown}>
        <boxGeometry key={geomKey} args={[width, height, length]} />
        <meshStandardMaterial color={isSelected ? '#38bdf8' : baseColor} roughness={0.3} metalness={0.2} transparent opacity={isSelected ? 0.94 : 0.84} />
      </mesh>
      <Box args={[width + 0.04, height + 0.04, length + 0.04]}>
        <meshBasicMaterial color={isSelected ? '#f59e0b' : '#ffffff'} wireframe opacity={isSelected ? 1 : 0.15} transparent />
      </Box>
      {isSelected && (
        <mesh position={[0, -height / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 0.4, length + 0.4]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// --- Non-Selected Ghost Floor Layer (Module B Feature 2) ---
function GhostFloorLayer({ level, floorName, activeLevel }) {
  const yPos = (level - activeLevel) * 4.0;
  if (yPos === 0) return null;

  return (
    <group position={[0, yPos, 0]} raycast={() => null}>
      <Box args={[40, 0.15, 32]} position={[0, -0.08, 0]}>
        <meshStandardMaterial color="#475569" transparent opacity={0.12} wireframe />
      </Box>
      <Html position={[-18, 0.4, -14]} center pointerEvents="none">
        <div className="bg-slate-950/40 text-slate-500 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-800">
          Ghost: {floorName} (L{level})
        </div>
      </Html>
    </group>
  );
}

export default function SpatialAssemblyCanvas({
  floors = [],
  activeFloor,
  selectedBlock,
  twinData,
  floorRooms = [],
  placedComponents = [],
  selectedElementId,
  onSelectElement,
  onTransformChange,
  onDeletePlacedElement,
  startPoint,
  endPoint
}) {
  const [viewMode, setViewMode] = useState('3D'); // '2D' | '3D'
  const [isDragging, setIsDragging] = useState(false);
  const [boundaryStatus, setBoundaryStatus] = useState(null); // null | 'safe' | 'warning'
  const draggingIdRef = useRef(null);

  const activeLevel = activeFloor?.level ?? 0;

  const selectedItem = useMemo(
    () => placedComponents.find(p => p.id === selectedElementId),
    [placedComponents, selectedElementId]
  );

  // Master Digital Twin Architectural Layout Data (only show real twin walls, no defaults)
  const architecturalWalls = useMemo(() => {
    if (twinData?.walls && twinData.walls.length > 0) return twinData.walls;
    return [];
  }, [twinData]);

  // Compute block boundary polygon once for drag clamping
  const blockBoundary = useMemo(
    () => computeBlockBoundary(selectedBlock?.shape),
    [selectedBlock]
  );

  // Handle direct ground pointer movement with boundary enforcement
  const handleGroundPointerMove = (e) => {
    if (!isDragging || !draggingIdRef.current) return;
    const point = e.point;
    if (!point) return;

    let snapX = Math.round(point.x * 2) / 2; // 0.5m grid snap
    let snapZ = Math.round(point.z * 2) / 2;

    const poly = blockBoundary.polygon;
    if (poly.length >= 3) {
      const inside = isPointInsidePolygon(snapX, snapZ, poly);
      if (!inside) {
        const clamped = clampToPolygon(snapX, snapZ, poly);
        snapX = Math.round(clamped.x * 2) / 2;
        snapZ = Math.round(clamped.z * 2) / 2;
        setBoundaryStatus('warning');
      } else {
        setBoundaryStatus('safe');
      }
    }

    const currentItem = placedComponents.find(p => p.id === draggingIdRef.current);
    if (currentItem) {
      onTransformChange(currentItem.id, {
        position: { x: snapX, y: currentItem.position?.y || 0, z: snapZ },
        rotation: currentItem.rotation || { x: 0, y: 0, z: 0 },
        scale: currentItem.scale || { x: 1, y: 1, z: 1 },
        dimensions: currentItem.dimensions
      });
    }
  };

  const handleStartDrag = (id) => {
    setIsDragging(true);
    draggingIdRef.current = id;
  };

  const handleStopDrag = () => {
    setIsDragging(false);
    draggingIdRef.current = null;
    setBoundaryStatus(null);
  };

  // --- Flexible Continuous Rotation Handlers (0° - 360°) ---
  const currentDegrees = useMemo(() => {
    if (!selectedItem?.rotation?.y) return 0;
    const deg = Math.round((selectedItem.rotation.y * 180) / Math.PI) % 360;
    return deg < 0 ? deg + 360 : deg;
  }, [selectedItem]);

  const handleSetRotationDegrees = (deg) => {
    if (!selectedItem) return;
    const targetDeg = parseFloat(deg) || 0;
    const rad = (targetDeg * Math.PI) / 180;
    onTransformChange(selectedItem.id, {
      position: selectedItem.position,
      rotation: { ...selectedItem.rotation, y: rad },
      scale: selectedItem.scale,
      dimensions: selectedItem.dimensions
    });
  };

  const handleDeltaRotate = (deltaDeg) => {
    if (!selectedItem) return;
    const newDeg = (currentDegrees + deltaDeg) % 360;
    handleSetRotationDegrees(newDeg);
  };

  // --- Dynamic Live Dimension Resizing Handlers (Width, Length, Height) ---
  const handleUpdateWidth = (newW) => {
    if (!selectedItem) return;
    const w = Math.max(0.5, Math.min(40, parseFloat(newW) || 1.0));
    onTransformChange(selectedItem.id, {
      position: selectedItem.position,
      rotation: selectedItem.rotation,
      scale: selectedItem.scale,
      dimensions: {
        width: w,
        length: selectedItem.dimensions?.length || 4.0,
        height: selectedItem.dimensions?.height || 2.8
      }
    });
  };

  const handleUpdateLength = (newL) => {
    if (!selectedItem) return;
    const l = Math.max(0.5, Math.min(60, parseFloat(newL) || 1.0));
    onTransformChange(selectedItem.id, {
      position: selectedItem.position,
      rotation: selectedItem.rotation,
      scale: selectedItem.scale,
      dimensions: {
        width: selectedItem.dimensions?.width || 3.2,
        length: l,
        height: selectedItem.dimensions?.height || 2.8
      }
    });
  };

  const handleUpdateHeight = (newH) => {
    if (!selectedItem) return;
    const h = Math.max(0.5, Math.min(15, parseFloat(newH) || 1.0));
    onTransformChange(selectedItem.id, {
      position: selectedItem.position,
      rotation: selectedItem.rotation,
      scale: selectedItem.scale,
      dimensions: {
        width: selectedItem.dimensions?.width || 3.2,
        length: selectedItem.dimensions?.length || 4.0,
        height: h
      }
    });
  };

  return (
    <div
      className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col select-none"
      onPointerUp={handleStopDrag}
    >
      {/* Top Controls Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
        {/* 2D Flat vs 3D Perspective View Toggle */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('3D')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === '3D' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> 3D View
          </button>
          <button
            onClick={() => setViewMode('2D')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === '2D' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Top 2D Floor Plan
          </button>
        </div>

        <span className="text-[11px] text-slate-400 px-2 font-medium">
          💡 Drag components to position on floor
        </span>
      </div>



      {/* Floating Inspector Panel for Flexible Continuous Rotation & Dynamic Dimensions */}
      {selectedItem && (
        <div className="absolute bottom-6 left-6 z-20 w-84 bg-slate-900/95 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${selectedItem.type === 'corridor' ? 'bg-purple-500' : 'bg-blue-500'}`} />
              <h4 className="font-extrabold text-sm text-white truncate max-w-[180px]">{selectedItem.name}</h4>
            </div>
            <button
              onClick={() => onDeletePlacedElement(selectedItem.id)}
              className="p-1.5 text-xs text-rose-400 hover:text-white hover:bg-rose-600/30 rounded-lg transition border border-rose-500/30"
              title="Remove component"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Flexible Continuous Rotation (0° - 360°) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <RotateCw className="w-3.5 h-3.5 text-amber-400" /> Flexible Rotation ({currentDegrees}°)
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => handleDeltaRotate(-45)} className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-950 text-slate-300 rounded border border-slate-800 hover:text-white">-45°</button>
                <button onClick={() => handleDeltaRotate(45)} className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-950 text-slate-300 rounded border border-slate-800 hover:text-white">+45°</button>
                <button onClick={() => handleDeltaRotate(90)} className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-950 text-slate-300 rounded border border-slate-800 hover:text-white">+90°</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={currentDegrees}
                onChange={(e) => handleSetRotationDegrees(e.target.value)}
                className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
              <input
                type="number"
                min="0"
                max="360"
                value={currentDegrees}
                onChange={(e) => handleSetRotationDegrees(e.target.value)}
                className="w-14 bg-slate-950 text-xs text-center font-mono font-bold text-amber-400 border border-slate-800 rounded-lg p-1 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Dynamic Live Dimension Resizing Sliders & Controls */}
          <div className="space-y-3 pt-1 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-violet-400" /> Dynamic Live Dimensions
            </span>

            {/* Width Slider & Input */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>Width (X-axis)</span>
                <span className="font-mono text-violet-300 font-bold">{(selectedItem.dimensions?.width || 3.2).toFixed(1)} m</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.8"
                  max="35.0"
                  step="0.2"
                  value={selectedItem.dimensions?.width || 3.2}
                  onChange={(e) => handleUpdateWidth(e.target.value)}
                  className="flex-1 accent-violet-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
                />
                <input
                  type="number"
                  step="0.2"
                  value={selectedItem.dimensions?.width || 3.2}
                  onChange={(e) => handleUpdateWidth(e.target.value)}
                  className="w-14 bg-slate-950 text-xs text-center font-mono font-bold text-white border border-slate-800 rounded-lg p-1 focus:border-violet-500 outline-none"
                />
              </div>
            </div>

            {/* Length Slider & Input */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>Length (Z-axis)</span>
                <span className="font-mono text-violet-300 font-bold">{(selectedItem.dimensions?.length || 4.0).toFixed(1)} m</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.8"
                  max="50.0"
                  step="0.2"
                  value={selectedItem.dimensions?.length || 4.0}
                  onChange={(e) => handleUpdateLength(e.target.value)}
                  className="flex-1 accent-violet-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
                />
                <input
                  type="number"
                  step="0.2"
                  value={selectedItem.dimensions?.length || 4.0}
                  onChange={(e) => handleUpdateLength(e.target.value)}
                  className="w-14 bg-slate-950 text-xs text-center font-mono font-bold text-white border border-slate-800 rounded-lg p-1 focus:border-violet-500 outline-none"
                />
              </div>
            </div>

            {/* Height Slider & Input */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>Height (Y-axis)</span>
                <span className="font-mono text-violet-300 font-bold">{(selectedItem.dimensions?.height || 2.8).toFixed(1)} m</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1.0"
                  max="12.0"
                  step="0.2"
                  value={selectedItem.dimensions?.height || 2.8}
                  onChange={(e) => handleUpdateHeight(e.target.value)}
                  className="flex-1 accent-violet-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
                />
                <input
                  type="number"
                  step="0.2"
                  value={selectedItem.dimensions?.height || 2.8}
                  onChange={(e) => handleUpdateHeight(e.target.value)}
                  className="w-14 bg-slate-950 text-xs text-center font-mono font-bold text-white border border-slate-800 rounded-lg p-1 focus:border-violet-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* R3F 3D Assembly Viewport */}
      <Canvas
        camera={
          viewMode === '2D'
            ? { position: [0, 48, 0.0001], fov: 45 }
            : { position: [0, 24, 28], fov: 45 }
        }
        onPointerUp={handleStopDrag}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            onSelectElement(null);
          }
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[14, 28, 20]} intensity={1.3} castShadow />
        <directionalLight position={[-14, 16, -20]} intensity={0.6} />

        <OrbitControls
          makeDefault
          enableRotate={viewMode === '3D'}
          minDistance={5}
          maxDistance={110}
          maxPolarAngle={viewMode === '2D' ? 0.001 : Math.PI / 2 - 0.05}
        />

        {/* Active Floor Coordinate Grid */}
        <Grid
          position={[0, 0, 0]}
          args={[90, 90]}
          cellSize={1}
          cellThickness={1}
          cellColor="#334155"
          sectionSize={5}
          sectionThickness={1.5}
          sectionColor="#64748b"
          fadeDistance={80}
          fadeStrength={1}
        />

        {/* Imported Exact Floor Basement Polygon Shape matching selected block */}
        <ExactBlockFloorBasement selectedBlock={selectedBlock} boundaryStatus={boundaryStatus} />

        {/* Master Map 2D/3D Editor Rooms & Area Layout Overlay */}
        <MasterMapFloorRooms floorRooms={floorRooms} selectedBlock={selectedBlock} />

        {/* Reactive Ground Plane for Direct Mouse Dragging & Placement */}
        <mesh
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={handleGroundPointerMove}
          onPointerUp={handleStopDrag}
        >
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#0f172a" transparent opacity={0.4} />
        </mesh>

        {/* Imported Architectural Walls */}
        {architecturalWalls.map((wall, wIdx) => (
          <ArchitecturalWall
            key={`wall-${wIdx}`}
            wall={wall}
            defaultColors={{ top: twinData?.wallColorTop || '#f6f5ee', bottom: twinData?.wallColorBottom || '#b5a68e' }}
          />
        ))}

        {/* Stacked Non-Selected Ghost Floor Layers */}
        {floors.map((f) => (
          <GhostFloorLayer
            key={f._id}
            level={f.level || 0}
            floorName={f.name}
            activeLevel={activeLevel}
          />
        ))}

        {/* Start / End Telemetry Markers */}
        <TelemetryMarker point={startPoint} type="start" />
        <TelemetryMarker point={endPoint} type="end" />

        {/* Render Placed Interactive 3D Components */}
        {placedComponents.map((item) => (
          <PlacedComponentMesh
            key={item.id}
            item={item}
            isSelected={selectedElementId === item.id}
            onSelect={onSelectElement}
            onStartDrag={handleStartDrag}
          />
        ))}
      </Canvas>
    </div>
  );
}
