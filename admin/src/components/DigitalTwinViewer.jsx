import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Box, Line, Sphere, Cylinder, Grid, Float, Text, Html, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Layers, 
  Eye, 
  Compass, 
  Maximize2, 
  Sparkles, 
  Navigation2, 
  DoorOpen, 
  Palette, 
  Info, 
  Camera,
  CheckCircle2
} from 'lucide-react';

// Realistic Dual-Tone Plaster Wall (Matches Hostel Corridor: Ivory Cream Top + Khaki Sandstone Lower Dado)
function RealisticDualToneWall({ wall, index, wireframe = false, defaultColors }) {
  const startX = wall.start?.x ?? 0;
  const startZ = wall.start?.z ?? (wall.start?.y ?? 0);
  const endX = wall.end?.x ?? 0;
  const endZ = wall.end?.z ?? (wall.end?.y ?? 0);

  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.sqrt(dx * dx + dz * dz) || 1;
  const totalHeight = wall.height || 2.8;
  const thickness = wall.thickness || 0.18;

  // Split ratio: Lower dado is ~1.0m, Upper wall is remaining (1.8m)
  const dadoHeight = Math.min(1.0, totalHeight * 0.38);
  const upperHeight = totalHeight - dadoHeight;

  const midX = (startX + endX) / 2;
  const midZ = (startZ + endZ) / 2;
  const angle = Math.atan2(dz, dx);

  const colorTop = wall.colorTop || defaultColors?.top || '#f6f5ee';
  const colorBottom = wall.colorBottom || defaultColors?.bottom || '#b5a68e';

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      {/* 1. Lower Dado / Wainscot Section (Sandstone Beige Khaki) */}
      <Box args={[length, dadoHeight, thickness]} position={[0, dadoHeight / 2, 0]}>
        <meshStandardMaterial
          color={colorBottom}
          roughness={0.75}
          metalness={0.05}
          wireframe={wireframe}
        />
      </Box>

      {/* 2. Upper Plaster Wall Section (Ivory Cream / Off-White) */}
      <Box args={[length, upperHeight, thickness]} position={[0, dadoHeight + upperHeight / 2, 0]}>
        <meshStandardMaterial
          color={colorTop}
          roughness={0.68}
          metalness={0.04}
          wireframe={wireframe}
        />
      </Box>

      {/* 3. Dado Separator Moulding Trim (at y = dadoHeight) */}
      {!wireframe && (
        <Box args={[length + 0.01, 0.04, thickness + 0.02]} position={[0, dadoHeight, 0]}>
          <meshStandardMaterial color="#9e8f76" roughness={0.4} metalness={0.15} />
        </Box>
      )}

      {/* 4. Floor Baseboard / Skirting Board */}
      {!wireframe && (
        <Box args={[length + 0.02, 0.09, thickness + 0.03]} position={[0, 0.045, 0]}>
          <meshStandardMaterial color="#574f45" roughness={0.5} metalness={0.1} />
        </Box>
      )}

      {/* 5. Top Crown / Ceiling Concrete Lintel Trim */}
      {!wireframe && (
        <Box args={[length + 0.02, 0.08, thickness + 0.03]} position={[0, totalHeight - 0.04, 0]}>
          <meshStandardMaterial color="#d1d5db" roughness={0.6} />
        </Box>
      )}
    </group>
  );
}

// Realistic Room Entrance with 3D Room Number Plate (e.g. "301" to "308"), Open Pine Door & Furnished Interior Volume
function RealisticRoomEntrance({ door, index, onSelectRoom, isSelected }) {
  const posX = door.position?.x ?? 0;
  const posZ = door.position?.z ?? (door.position?.y ?? 0);
  const width = door.width || 1.15;
  const height = door.height || 2.2;
  const roomNumber = door.roomNumber || (index === 0 ? '301' : index === 1 ? '302' : `Room ${index + 1}`);
  const doorColor = door.color || '#9a3412'; // Warm polished natural pine wood

  const isNorthSide = posZ >= 0;
  const rotationY = isNorthSide ? 0 : Math.PI;

  const roomDepth = 3.6;
  const roomWidth = 3.4;
  const roomHeight = 2.8;

  // Render Washroom Suite if categorized as washroom
  if (door.type === 'washroom' || roomNumber.toLowerCase().includes('washroom') || roomNumber.toLowerCase().includes('bath')) {
    return (
      <RealisticWashroomSuite 
        posX={posX} 
        posZ={posZ} 
        width={width} 
        height={height} 
        isNorthSide={isNorthSide}
        onSelectRoom={onSelectRoom}
        isSelected={isSelected}
      />
    );
  }

  // Render Water Dispenser Station if categorized as water
  if (door.type === 'water' || roomNumber.toLowerCase().includes('water')) {
    return (
      <RealisticWaterCooler 
        posX={posX} 
        posZ={posZ} 
        isNorthSide={isNorthSide}
        onSelectRoom={onSelectRoom}
        isSelected={isSelected}
      />
    );
  }

  return (
    <group position={[posX, 0, posZ]} rotation={[0, rotationY, 0]}>
      {/* Wooden Architrave Frame */}
      <Box args={[width + 0.12, height + 0.12, 0.24]} position={[0, height / 2, 0]}>
        <meshStandardMaterial color="#3e2723" roughness={0.45} metalness={0.15} />
      </Box>

      {/* Cutout Doorway Opening Header */}
      <Box args={[width, 0.08, 0.22]} position={[0, height + 0.04, 0]}>
        <meshStandardMaterial color="#2d1b15" roughness={0.4} />
      </Box>

      {/* Authentic Blue 3D Room Label Plaque (e.g. "301" stenciled like real hostel photo) */}
      <group position={[0, height + 0.22, 0.13]}>
        {/* Plaque Background Plate */}
        <Box args={[0.55, 0.22, 0.02]}>
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </Box>
        {/* Blue Border Frame */}
        <Box args={[0.57, 0.24, 0.015]} position={[0, 0, -0.005]}>
          <meshStandardMaterial color="#1e40af" roughness={0.4} />
        </Box>
        {/* 3D Bold Blue Stenciled Text */}
        <Text
          position={[0, -0.01, 0.02]}
          fontSize={0.13}
          color="#1e3a8a"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          {roomNumber}
        </Text>
      </group>

      {/* Open Door Leaf (Swung Inward into the Room at 70 degrees) */}
      <group position={[-width / 2 + 0.04, 0, 0]} rotation={[0, 1.15, 0]}>
        {/* Main Timber Door Leaf */}
        <Box args={[width - 0.06, height - 0.03, 0.05]} position={[(width - 0.06) / 2, height / 2, 0]}>
          <meshStandardMaterial color={doorColor} roughness={0.32} metalness={0.12} />
        </Box>
        {/* Door Panels Bevel Details */}
        <Box args={[(width - 0.15), (height * 0.4), 0.055]} position={[(width - 0.06) / 2, height * 0.72, 0]}>
          <meshStandardMaterial color="#78350f" roughness={0.35} />
        </Box>
        <Box args={[(width - 0.15), (height * 0.4), 0.055]} position={[(width - 0.06) / 2, height * 0.26, 0]}>
          <meshStandardMaterial color="#78350f" roughness={0.35} />
        </Box>
        {/* Polished Brass Door Handle */}
        <group position={[width - 0.18, height * 0.48, 0.04]}>
          <Cylinder args={[0.012, 0.012, 0.14]} rotation={[0, 0, Math.PI / 2]}>
            <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.1} />
          </Cylinder>
          <Sphere args={[0.025, 16, 16]} position={[-0.07, 0, 0]}>
            <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.1} />
          </Sphere>
        </group>
      </group>

      {/* Room Interior Volume (Extending into room depth) */}
      <group position={[0, 0, roomDepth / 2 + 0.1]}>
        {/* Room Floor */}
        <Box args={[roomWidth, 0.05, roomDepth]} position={[0, 0.025, 0]}>
          <meshStandardMaterial color="#e5e0d8" roughness={0.6} />
        </Box>
        {/* Room Back Wall */}
        <Box args={[roomWidth, roomHeight, 0.1]} position={[0, roomHeight / 2, roomDepth / 2]}>
          <meshStandardMaterial color="#f8fafc" roughness={0.8} />
        </Box>
        {/* Back Wall Exterior Window with Daylight glow */}
        <group position={[0, roomHeight * 0.65, roomDepth / 2 - 0.02]}>
          <Box args={[1.4, 1.0, 0.04]}>
            <meshStandardMaterial color="#38bdf8" emissive="#bae6fd" emissiveIntensity={0.8} roughness={0.1} />
          </Box>
          <Box args={[1.44, 1.04, 0.02]} position={[0, 0, -0.01]}>
            <meshStandardMaterial color="#475569" />
          </Box>
        </group>

        {/* Room Left Wall */}
        <Box args={[0.1, roomHeight, roomDepth]} position={[-roomWidth / 2, roomHeight / 2, 0]}>
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
        </Box>
        {/* Room Right Wall */}
        <Box args={[0.1, roomHeight, roomDepth]} position={[roomWidth / 2, roomHeight / 2, 0]}>
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
        </Box>

        {/* Student Bed Frame & Mattress (Opposite Desk) */}
        <group position={[roomWidth / 2 - 0.65, 0, 0.4]}>
          {/* Bed Base */}
          <Box args={[1.0, 0.35, 2.0]} position={[0, 0.175, 0]}>
            <meshStandardMaterial color="#451a03" roughness={0.5} />
          </Box>
          {/* Foam Mattress with Clean White Linen */}
          <Box args={[0.94, 0.16, 1.94]} position={[0, 0.43, 0]}>
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </Box>
          {/* Soft Blue Pillow */}
          <Box args={[0.7, 0.1, 0.4]} position={[0, 0.54, 0.68]}>
            <meshStandardMaterial color="#3b82f6" roughness={0.6} />
          </Box>
        </group>

        {/* Study Desk & Laptop Silhouette (like in real hostel photo) */}
        <group position={[-0.7, 0, 0.9]}>
          {/* Desk Tabletop */}
          <Box args={[1.3, 0.06, 0.7]} position={[0, 0.75, 0]}>
            <meshStandardMaterial color="#78350f" roughness={0.4} />
          </Box>
          {/* Desk Legs */}
          <Cylinder args={[0.02, 0.02, 0.74]} position={[-0.55, 0.37, -0.28]}>
            <meshStandardMaterial color="#1e293b" />
          </Cylinder>
          <Cylinder args={[0.02, 0.02, 0.74]} position={[0.55, 0.37, -0.28]}>
            <meshStandardMaterial color="#1e293b" />
          </Cylinder>
          <Cylinder args={[0.02, 0.02, 0.74]} position={[-0.55, 0.37, 0.28]}>
            <meshStandardMaterial color="#1e293b" />
          </Cylinder>
          <Cylinder args={[0.02, 0.02, 0.74]} position={[0.55, 0.37, 0.28]}>
            <meshStandardMaterial color="#1e293b" />
          </Cylinder>
          {/* Study Chair */}
          <group position={[0, 0, -0.35]}>
            <Box args={[0.45, 0.04, 0.42]} position={[0, 0.44, 0]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
            <Box args={[0.45, 0.4, 0.04]} position={[0, 0.64, -0.19]}>
              <meshStandardMaterial color="#1e293b" />
            </Box>
          </group>
          {/* Laptop Open on Desk */}
          <group position={[0, 0.8, 0]}>
            <Box args={[0.28, 0.015, 0.2]} position={[0, 0, 0]}>
              <meshStandardMaterial color="#64748b" metalness={0.7} />
            </Box>
            <Box args={[0.28, 0.18, 0.015]} position={[0, 0.09, -0.09]} rotation={[-0.25, 0, 0]}>
              <meshStandardMaterial color="#0f172a" emissive="#3b82f6" emissiveIntensity={0.6} />
            </Box>
          </group>
        </group>

        {/* Room Wardrobe / Closet Silhouette */}
        <Box args={[0.7, 1.9, 0.9]} position={[-roomWidth / 2 + 0.45, 0.95, -0.6]}>
          <meshStandardMaterial color="#5c3d2e" roughness={0.5} />
        </Box>

        {/* Warm Room Interior Light Bulb */}
        <pointLight position={[0, roomHeight - 0.3, 0]} intensity={1.6} distance={6.5} color="#fffbeb" />
      </group>

      {/* Interactive Click Target / Badge */}
      <Html position={[0, height * 0.6, 0]} center distanceFactor={14}>
        <button
          onClick={() => onSelectRoom && onSelectRoom({ roomNumber, posX, posZ, confidence: 0.96 })}
          className={`px-2 py-1 rounded-md text-[11px] font-bold shadow-lg flex items-center gap-1.5 transition-all transform hover:scale-105 backdrop-blur-md cursor-pointer ${
            isSelected
              ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1 ring-offset-gray-900'
              : 'bg-gray-900/85 text-blue-300 hover:bg-blue-900/80 border border-blue-500/40'
          }`}
        >
          <DoorOpen size={12} className="text-blue-400" />
          <span>Room {roomNumber}</span>
        </button>
      </Html>
    </group>
  );
}

// Realistic Multi-Stall Washroom & Bathroom Suite
function RealisticWashroomSuite({ posX, posZ, width = 1.35, height = 2.2, isNorthSide, onSelectRoom, isSelected }) {
  const roomDepth = 4.2;
  const roomWidth = 4.6;
  const roomHeight = 2.8;
  const rotationY = isNorthSide ? 0 : Math.PI;

  return (
    <group position={[posX, 0, posZ]} rotation={[0, rotationY, 0]}>
      {/* Wooden Architrave Frame with Blue Sign */}
      <Box args={[width + 0.12, height + 0.12, 0.24]} position={[0, height / 2, 0]}>
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </Box>

      {/* Blue 3D Washroom Signage Plaque */}
      <group position={[0, height + 0.22, 0.13]}>
        <Box args={[1.2, 0.24, 0.02]}>
          <meshStandardMaterial color="#0284c7" roughness={0.3} />
        </Box>
        <Text
          position={[0, -0.01, 0.02]}
          fontSize={0.11}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          WASHROOMS / BATHROOMS
        </Text>
      </group>

      {/* Washroom Interior Volume */}
      <group position={[0, 0, roomDepth / 2 + 0.1]}>
        {/* Anti-Slip Blue/Grey Mosaic Ceramic Floor */}
        <Box args={[roomWidth, 0.05, roomDepth]} position={[0, 0.025, 0]}>
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.1} />
        </Box>
        {/* White Gloss Ceramic Tiled Back Wall */}
        <Box args={[roomWidth, roomHeight, 0.1]} position={[0, roomHeight / 2, roomDepth / 2]}>
          <meshStandardMaterial color="#f0fdf4" roughness={0.2} metalness={0.1} />
        </Box>
        {/* Left & Right Tile Walls */}
        <Box args={[0.1, roomHeight, roomDepth]} position={[-roomWidth / 2, roomHeight / 2, 0]}>
          <meshStandardMaterial color="#e0f2fe" roughness={0.2} />
        </Box>
        <Box args={[0.1, roomHeight, roomDepth]} position={[roomWidth / 2, roomHeight / 2, 0]}>
          <meshStandardMaterial color="#e0f2fe" roughness={0.2} />
        </Box>

        {/* 3 Restroom Toilet Stalls with Partitions */}
        {[-1.2, 0, 1.2].map((stallX, sIdx) => (
          <group key={`stall-${sIdx}`} position={[stallX, 0, roomDepth / 2 - 0.9]}>
            {/* Stall Divider Partition */}
            <Box args={[0.04, 2.0, 1.6]} position={[-0.55, 1.0, 0]}>
              <meshStandardMaterial color="#cbd5e1" roughness={0.3} />
            </Box>
            {/* Stall Door */}
            <Box args={[0.9, 1.9, 0.04]} position={[0, 0.95, -0.8]}>
              <meshStandardMaterial color="#0284c7" roughness={0.3} />
            </Box>
            {/* Ceramic Toilet Commode */}
            <Box args={[0.4, 0.42, 0.6]} position={[0, 0.21, 0.2]}>
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
            </Box>
          </group>
        ))}

        {/* Long Granite Vanity Counter with 2 Wash Basins & Mirrors */}
        <group position={[0, 0, -roomDepth / 2 + 1.2]}>
          {/* Granite Vanity Slab */}
          <Box args={[2.4, 0.08, 0.65]} position={[0, 0.82, 0]}>
            <meshStandardMaterial color="#1e293b" roughness={0.2} />
          </Box>
          {/* 2 Sinks */}
          {[-0.6, 0.6].map((sinkX, kIdx) => (
            <group key={`sink-${kIdx}`} position={[sinkX, 0.82, 0]}>
              <Cylinder args={[0.22, 0.18, 0.14, 16]} position={[0, -0.04, 0]}>
                <meshStandardMaterial color="#ffffff" roughness={0.1} />
              </Cylinder>
              {/* Chrome Faucet Tap */}
              <Cylinder args={[0.015, 0.015, 0.18]} position={[0, 0.1, -0.15]}>
                <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.05} />
              </Cylinder>
            </group>
          ))}
          {/* Wide Vanity Mirror on Wall */}
          <Box args={[2.2, 0.9, 0.02]} position={[0, 1.45, -0.32]}>
            <meshStandardMaterial color="#bae6fd" metalness={0.9} roughness={0.05} />
          </Box>
        </group>

        {/* Cool Bright Overhead Lighting */}
        <pointLight position={[0, roomHeight - 0.2, 0]} intensity={2.2} distance={8} color="#e0f2fe" />
      </group>

      {/* Interactive Badge */}
      <Html position={[0, height * 0.6, 0]} center distanceFactor={14}>
        <button
          onClick={() => onSelectRoom && onSelectRoom({ roomNumber: 'Washrooms', posX, posZ, confidence: 0.99 })}
          className="px-2.5 py-1 rounded-md text-[11px] font-bold shadow-lg flex items-center gap-1.5 transition-all transform hover:scale-105 bg-sky-900/90 text-sky-200 border border-sky-400/50 backdrop-blur-md cursor-pointer"
        >
          <span>🚻 Washroom Suite</span>
        </button>
      </Html>
    </group>
  );
}

// Realistic RO Drinking Water Dispenser Station
function RealisticWaterCooler({ posX, posZ, isNorthSide, onSelectRoom }) {
  const rotationY = isNorthSide ? 0 : Math.PI;

  return (
    <group position={[posX, 0, posZ]} rotation={[0, rotationY, 0]}>
      {/* Wall Niche Frame */}
      <Box args={[1.2, 2.2, 0.3]} position={[0, 1.1, 0.1]}>
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </Box>

      {/* Stainless Steel Water Cooler Body */}
      <group position={[0, 0, 0.2]}>
        <Box args={[0.65, 1.1, 0.45]} position={[0, 0.55, 0]}>
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
        </Box>
        {/* Water Dispenser Top Hood */}
        <Box args={[0.67, 0.25, 0.47]} position={[0, 1.15, 0]}>
          <meshStandardMaterial color="#1e40af" metalness={0.3} roughness={0.3} />
        </Box>
        {/* Chrome Dispenser Taps */}
        <Cylinder args={[0.015, 0.015, 0.08]} position={[-0.12, 1.05, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#3b82f6" metalness={0.8} />
        </Cylinder>
        <Cylinder args={[0.015, 0.015, 0.08]} position={[0.12, 1.05, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#ef4444" metalness={0.8} />
        </Cylinder>
        {/* Drip Tray */}
        <Box args={[0.5, 0.04, 0.18]} position={[0, 0.88, 0.22]}>
          <meshStandardMaterial color="#0f172a" roughness={0.3} />
        </Box>
        {/* Glowing Blue LED Indicator */}
        <Sphere args={[0.02, 16, 16]} position={[0, 1.22, 0.24]}>
          <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={3.0} />
        </Sphere>
      </group>

      {/* Signage Plaque */}
      <group position={[0, 2.3, 0.15]}>
        <Box args={[0.9, 0.18, 0.02]}>
          <meshStandardMaterial color="#1e3a8a" roughness={0.3} />
        </Box>
        <Text
          position={[0, 0, 0.02]}
          fontSize={0.085}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          RO DRINKING WATER
        </Text>
      </group>

      {/* Interactive Badge */}
      <Html position={[0, 1.4, 0.3]} center distanceFactor={14}>
        <button
          onClick={() => onSelectRoom && onSelectRoom({ roomNumber: 'Water Point', posX, posZ, confidence: 0.96 })}
          className="px-2 py-1 rounded-md text-[10px] font-bold shadow-lg flex items-center gap-1 bg-blue-950/90 text-blue-200 border border-blue-400/40 backdrop-blur-md cursor-pointer"
        >
          <span>💧 RO Water Cooler</span>
        </button>
      </Html>
    </group>
  );
}

// Corridor Architectural Fixtures (Ceiling Beams, Glowing Fluorescent Tube Lights, Fire Exit Signs & Switches)
function CorridorFixtures({ length = 16, width = 2.3, height = 2.8, center = [0, 0, 0] }) {
  // Dynamically calculate light and beam counts based on length
  const beamCount = Math.max(3, Math.round(length / 4));
  const beamSpacing = length / (beamCount + 1);
  
  const lightCount = Math.max(2, Math.round(length / 5));
  const lightSpacing = length / (lightCount + 1);

  return (
    <group position={[center[0], 0, center[2]]}>
      {/* 1. Structural Concrete Ceiling Beams Running Across Corridor */}
      {Array.from({ length: beamCount }).map((_, i) => {
        const xPos = -length / 2 + (i + 1) * beamSpacing;
        return (
          <group key={`beam-${i}`} position={[xPos, height - 0.12, 0]}>
            <Box args={[0.35, 0.24, width + 0.3]}>
              <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
            </Box>
          </group>
        );
      })}

      {/* 2. Long Overhead Fluorescent / LED Corridor Lighting Fixtures */}
      {Array.from({ length: lightCount }).map((_, i) => {
        const xOffset = -length / 2 + (i + 1) * lightSpacing;
        return (
          <group key={`light-${i}`} position={[xOffset, height - 0.08, 0]}>
            {/* Metal Housing */}
            <Box args={[1.8, 0.06, 0.18]} position={[0, 0, 0]}>
              <meshStandardMaterial color="#475569" metalness={0.6} />
            </Box>
            {/* Glowing Fluorescent Tube */}
            <Cylinder args={[0.03, 0.03, 1.6, 16]} position={[0, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
              <meshStandardMaterial
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={3.2}
                roughness={0.1}
              />
            </Cylinder>
            {/* Downward Casting Architectural Corridor Light */}
            <spotLight
              position={[0, -0.1, 0]}
              intensity={2.8}
              angle={Math.PI / 3}
              penumbra={0.6}
              distance={6.5}
              color="#fffdfa"
            />
          </group>
        );
      })}

      {/* 3. Green Illuminated Fire Exit Sign on Corridor Wall */}
      <group position={[0.5, 2.2, width / 2 + 0.02]}>
        <Box args={[0.42, 0.2, 0.04]}>
          <meshStandardMaterial
            color="#15803d"
            emissive="#22c55e"
            emissiveIntensity={1.8}
            roughness={0.3}
          />
        </Box>
        <Text
          position={[0, 0, 0.025]}
          fontSize={0.08}
          color="#ffffff"
          fontWeight="bold"
          anchorX="center"
          anchorY="middle"
        >
          EXIT →
        </Text>
      </group>

      {/* 4. White Wall Switchboard Plate */}
      <group position={[-1.2, 1.25, width / 2 + 0.02]}>
        <Box args={[0.16, 0.12, 0.02]}>
          <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.1} />
        </Box>
        {/* Switch toggles */}
        <Box args={[0.03, 0.04, 0.01]} position={[-0.04, 0, 0.012]}>
          <meshStandardMaterial color="#cbd5e1" />
        </Box>
        <Box args={[0.03, 0.04, 0.01]} position={[0.04, 0, 0.012]}>
          <meshStandardMaterial color="#cbd5e1" />
        </Box>
      </group>
    </group>
  );
}

// Realistic Terrazzo Mosaic Stone Tile Floor with Dynamic Real-World Scale
function RealisticTerrazzoFloor({ width = 24, length = 3.5, center = [0, 0, 0], floorColor = '#d6cebf', floorMaterial = 'terrazzo_mosaic' }) {
  return (
    <group position={[center[0], -0.04, center[2]]}>
      {/* Main Terrazzo Stone Floor Slab */}
      <Box args={[width, 0.08, length]} position={[0, -0.04, 0]}>
        <meshStandardMaterial
          color={floorColor}
          roughness={0.4}
          metalness={0.08}
        />
      </Box>

      {/* Terrazzo Tile Seam Matrix Grid (1m x 1m Stone Joints) */}
      <Grid
        position={[0, 0.005, 0]}
        args={[width, length]}
        cellSize={1.0}
        cellThickness={1.0}
        cellColor="#a39a8c"
        sectionSize={2.0}
        sectionThickness={1.8}
        sectionColor="#786f62"
        fadeDistance={Math.max(40, width)}
        infiniteGrid={false}
      />
    </group>
  );
}

// Smooth Reactive Camera Controller inside Canvas
function CameraController({ cameraMode, sceneBounds, selectedRoom, controlsRef }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(-15.0, 1.62, 0.0));
  const targetLook = useRef(new THREE.Vector3(16.0, 1.50, 0.0));
  const isTransitioning = useRef(true);

  React.useEffect(() => {
    isTransitioning.current = true;
    if (cameraMode === 'first_person') {
      targetPos.current.set(-15.0, 1.62, 0.0);
      targetLook.current.set(16.0, 1.50, 0.0);
    } else if (cameraMode === 'orbit_3d') {
      const dist = Math.max(sceneBounds.spanX, sceneBounds.spanZ) * 0.7;
      targetPos.current.set(sceneBounds.centerX, Math.max(14, dist * 0.65), sceneBounds.centerZ + Math.max(16, dist * 0.75));
      targetLook.current.set(sceneBounds.centerX, 0.8, sceneBounds.centerZ);
    } else if (cameraMode === 'top_down') {
      const height = Math.max(sceneBounds.spanX, sceneBounds.spanZ) * 0.95;
      targetPos.current.set(sceneBounds.centerX, Math.max(24, height), sceneBounds.centerZ + 0.001);
      targetLook.current.set(sceneBounds.centerX, 0, sceneBounds.centerZ);
    } else if (cameraMode === 'focus_room' && selectedRoom) {
      const pX = selectedRoom.posX || 0;
      const pZ = selectedRoom.posZ || 0;
      const isNorth = pZ >= 0;
      targetPos.current.set(pX, 1.62, isNorth ? -2.2 : 2.2);
      targetLook.current.set(pX, 1.45, isNorth ? 3.2 : -3.2);
    }
  }, [cameraMode, sceneBounds, selectedRoom]);

  useFrame(() => {
    if (!isTransitioning.current || !camera) return;
    
    camera.position.lerp(targetPos.current, 0.09);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.09);
      controlsRef.current.update();
    }

    if (camera.position.distanceTo(targetPos.current) < 0.05) {
      isTransitioning.current = false;
    }
  });

  return null;
}

// LiDAR Scanner Pulse Node
function ScannerPulse({ position }) {
  const pulseRef = useRef();

  useFrame(({ clock }) => {
    if (pulseRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.25;
      pulseRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={position}>
      <Sphere args={[0.2, 24, 24]}>
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={2.5}
          roughness={0.2}
        />
      </Sphere>

      <Sphere ref={pulseRef} args={[0.42, 16, 16]}>
        <meshStandardMaterial
          color="#60a5fa"
          transparent
          opacity={0.35}
          wireframe
        />
      </Sphere>

      <Html position={[0, 0.6, 0]} center>
        <div className="bg-blue-900/90 text-blue-200 border border-blue-400/50 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-lg flex items-center gap-1 backdrop-blur-sm pointer-events-none">
          <Navigation2 size={10} className="text-blue-300 animate-spin" />
          <span>Scanner Active</span>
        </div>
      </Html>
    </group>
  );
}

export default function DigitalTwinViewer({ twinData, scanSession, onOpenBuilder, isBuilderMode, onUpdateDoor }) {
  const [wireframe, setWireframe] = useState(false);
  const [cameraMode, setCameraMode] = useState('first_person'); // 'first_person' | 'orbit_3d' | 'top_down' | 'focus_room'
  const [selectedRoom, setSelectedRoom] = useState(null);
  const controlsRef = useRef();

  // Extract trajectory points for line rendering
  const trajectoryPoints = useMemo(() => {
    if (!scanSession?.trajectory || scanSession.trajectory.length < 2) return [];
    return scanSession.trajectory.map(p => new THREE.Vector3(
      p.x || 0,
      0.35,
      p.z ?? (p.y ?? 0)
    ));
  }, [scanSession]);

  const latestPos = useMemo(() => {
    if (!scanSession?.trajectory || scanSession.trajectory.length === 0) return null;
    const last = scanSession.trajectory[scanSession.trajectory.length - 1];
    return [last.x || 0, 0.35, last.z ?? (last.y ?? 0)];
  }, [scanSession]);

  // Extract default walls, doors, and color properties
  const defaultColors = useMemo(() => ({
    top: twinData?.wallColorTop || scanSession?.wallColors?.top || '#f6f5ee',
    bottom: twinData?.wallColorBottom || scanSession?.wallColors?.bottom || '#b5a68e'
  }), [twinData, scanSession]);

  const floorColor = twinData?.floorColor || scanSession?.floorColor || '#d6cebf';
  const floorMaterial = twinData?.floorMaterial || scanSession?.floorMaterial || 'terrazzo_mosaic';

  // Ensure default realistic walls if array is empty or partial (spans full 32m corridor)
  const walls = useMemo(() => {
    if (twinData?.walls && twinData.walls.length >= 4) return twinData.walls;
    return [
      { start: { x: -16, y: 0, z: 1.15 }, end: { x: 16, y: 0, z: 1.15 }, height: 2.8, thickness: 0.18, colorTop: defaultColors.top, colorBottom: defaultColors.bottom },
      { start: { x: -16, y: 0, z: -1.15 }, end: { x: 16, y: 0, z: -1.15 }, height: 2.8, thickness: 0.18, colorTop: defaultColors.top, colorBottom: defaultColors.bottom },
      { start: { x: -16, y: 0, z: -1.15 }, end: { x: -16, y: 0, z: 1.15 }, height: 2.8, thickness: 0.18, colorTop: defaultColors.top, colorBottom: defaultColors.bottom },
      { start: { x: 16, y: 0, z: -1.15 }, end: { x: 16, y: 0, z: 1.15 }, height: 2.8, thickness: 0.18, colorTop: defaultColors.top, colorBottom: defaultColors.bottom }
    ];
  }, [twinData, defaultColors]);

  const doors = useMemo(() => {
    return twinData?.doors || [];
  }, [twinData]);

  // Dynamic Spatial Bounds Calculation for Real-World Scalability (Any floor size)
  const sceneBounds = useMemo(() => {
    let minX = -18, maxX = 18, minZ = -5.5, maxZ = 5.5;

    if (walls.length > 0) {
      walls.forEach(w => {
        if (w.start) {
          minX = Math.min(minX, w.start.x - 3);
          maxX = Math.max(maxX, w.start.x + 3);
          minZ = Math.min(minZ, (w.start.z ?? w.start.y ?? 0) - 3);
          maxZ = Math.max(maxZ, (w.start.z ?? w.start.y ?? 0) + 3);
        }
        if (w.end) {
          minX = Math.min(minX, w.end.x - 3);
          maxX = Math.max(maxX, w.end.x + 3);
          minZ = Math.min(minZ, (w.end.z ?? w.end.y ?? 0) - 3);
          maxZ = Math.max(maxZ, (w.end.z ?? w.end.y ?? 0) + 3);
        }
      });
    }

    if (scanSession?.trajectory && scanSession.trajectory.length > 0) {
      scanSession.trajectory.forEach(p => {
        minX = Math.min(minX, (p.x || 0) - 4);
        maxX = Math.max(maxX, (p.x || 0) + 4);
        minZ = Math.min(minZ, (p.z ?? (p.y ?? 0)) - 4);
        maxZ = Math.max(maxZ, (p.z ?? (p.y ?? 0)) + 4);
      });
    }

    const spanX = Math.max(maxX - minX, 36);
    const spanZ = Math.max(maxZ - minZ, 12);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    return { minX, maxX, minZ, maxZ, spanX, spanZ, centerX, centerZ };
  }, [walls, scanSession]);

  const handleSelectRoom = (roomInfo) => {
    setSelectedRoom(roomInfo);
    setCameraMode('focus_room');
  };

  return (
    <div className="w-full h-full min-h-[560px] bg-gradient-to-b from-[#0B0F19] to-[#05070C] rounded-xl overflow-hidden relative select-none flex flex-col border border-gray-800">
      {/* 3D WebGL Canvas */}
      <div className="flex-1 w-full relative">
        <Canvas
          camera={{ 
            position: [-15.0, 1.62, 0.05], 
            fov: 62 
          }}
          gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          {/* Reactive Camera Interpolator */}
          <CameraController
            cameraMode={cameraMode}
            sceneBounds={sceneBounds}
            selectedRoom={selectedRoom}
            controlsRef={controlsRef}
          />

          {/* Architectural Studio & Corridor Lighting */}
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 20, 15]} intensity={1.3} castShadow />
          <directionalLight position={[-10, 15, -10]} intensity={0.6} color="#cbd5e1" />
          <hemisphereLight skyColor="#ffffff" groundColor="#0f172a" intensity={0.45} />

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            maxPolarAngle={cameraMode === 'top_down' ? 0.01 : Math.PI / 2 - 0.02}
            minDistance={0.5}
            maxDistance={Math.max(100, sceneBounds.spanX * 2)}
          />

          {/* Authentic Terrazzo Floor Slab with Dynamic Real-World Scale */}
          <RealisticTerrazzoFloor 
            width={sceneBounds.spanX + 4} 
            length={sceneBounds.spanZ + 4} 
            center={[sceneBounds.centerX, 0, sceneBounds.centerZ]}
            floorColor={floorColor} 
            floorMaterial={floorMaterial} 
          />

          {/* Corridor Architectural Fixtures (Ceiling Beams, Tube Lights, Exit Sign, Switchboard) */}
          {!wireframe && (
            <CorridorFixtures 
              length={sceneBounds.spanX} 
              width={2.3} 
              height={2.8} 
              center={[sceneBounds.centerX, 0, sceneBounds.centerZ]} 
            />
          )}

          {/* Render Realistic Dual-Tone Walls */}
          {walls.map((wall, i) => (
            <RealisticDualToneWall 
              key={`wall-${i}`} 
              wall={wall} 
              index={i} 
              wireframe={wireframe} 
              defaultColors={defaultColors} 
            />
          ))}

          {/* Render Room Entrances & Interactive Doors */}
          {doors.map((door, i) => {
            const isSelected = selectedRoom?.roomNumber === door.roomNumber;
            if (isBuilderMode) {
              return (
                  <TransformControls
                    key={`door-${i}`}
                    mode="translate"
                    showY={true}
                    showX={true}
                    showZ={true}
                  translationSnap={0.5}
                  onMouseUp={(e) => {
                    if (e.target && e.target.object && onUpdateDoor) {
                      const pos = e.target.object.position;
                      onUpdateDoor(i, { x: pos.x, y: pos.y, z: pos.z });
                    }
                  }}
                >
                  <RealisticRoomEntrance 
                    door={door} 
                    index={i} 
                    onSelectRoom={handleSelectRoom} 
                    isSelected={isSelected} 
                  />
                </TransformControls>
              );
            }
            return (
              <RealisticRoomEntrance 
                key={`door-${i}`} 
                door={door} 
                index={i} 
                onSelectRoom={handleSelectRoom} 
                isSelected={isSelected} 
              />
            );
          })}

          {/* SLAM Trajectory Trail */}
          {trajectoryPoints.length > 1 && (
            <Line
              points={trajectoryPoints}
              color="#3b82f6"
              lineWidth={3.5}
              dashed={false}
            />
          )}

          {/* Current Active Scanner LiDAR Node */}
          {latestPos && <ScannerPulse position={latestPos} />}
        </Canvas>
      </div>

      {/* Floating HUD View Selector (First-Person, 3D Orbit, 2D Blueprint, 3D Builder) */}
      <div 
        className="absolute top-3 right-3 flex flex-wrap justify-end items-center gap-1.5 bg-[#0d1526]/95 backdrop-blur-md border border-indigo-500/30 p-1 rounded-lg shadow-2xl z-10 max-w-[65%]"
        style={{ background: 'rgba(13, 21, 38, 0.95)', borderColor: 'rgba(99, 102, 241, 0.3)' }}
      >
        <button
          onClick={() => setCameraMode('first_person')}
          className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            cameraMode === 'first_person' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/40 ring-1 ring-indigo-400' 
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          title="First-Person Walkthrough Perspective (Hallway eye level)"
        >
          <Camera size={12} />
          <span className="hidden sm:inline">Walkthrough</span>
        </button>

        <button
          onClick={() => setCameraMode('orbit_3d')}
          className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            cameraMode === 'orbit_3d' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/40 ring-1 ring-indigo-400' 
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          title="3D Orbit Overview"
        >
          <Maximize2 size={12} />
          <span className="hidden sm:inline">3D Orbit</span>
        </button>

        <button
          onClick={() => setCameraMode('top_down')}
          className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
            cameraMode === 'top_down' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/40 ring-1 ring-indigo-400' 
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
          title="2D Top-Down Blueprint"
        >
          <Compass size={12} />
          <span className="hidden sm:inline">2D Map</span>
        </button>

        <div className="w-[1px] h-3 bg-gray-700 mx-0.5" />

        <button
          onClick={() => setWireframe(!wireframe)}
          className={`p-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
            wireframe ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
          title="Toggle Wireframe Mesh"
        >
          <Layers size={12} />
        </button>

        {onOpenBuilder && (
          <button
            onClick={onOpenBuilder}
            className="px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md cursor-pointer transition"
            title="Open Interactive 3D Floor Builder"
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">3D Builder</span>
          </button>
        )}
      </div>

      {/* Detected Palette & Scene Breakdown Badge */}
      <div 
        className="absolute top-3 left-3 bg-[#0d1526]/95 backdrop-blur-md border border-gray-700/80 px-3 py-2 rounded-lg text-xs text-gray-300 shadow-xl hidden md:flex items-center gap-3 z-10"
        style={{ background: 'rgba(13, 21, 38, 0.95)' }}
      >
        <div className="flex items-center gap-1.5">
          <Palette size={14} className="text-indigo-400" />
          <span className="font-bold text-white text-[11px] uppercase tracking-wider">Scene Palette:</span>
        </div>
        {/* Upper Wall Swatch */}
        <div className="flex items-center gap-1.5" title="Upper Wall Paint (Off-White/Cream)">
          <span className="w-3 h-3 rounded-sm border border-gray-500 shadow-inner" style={{ backgroundColor: defaultColors.top }}></span>
          <span className="text-[10px] text-gray-300 font-medium">Upper</span>
        </div>
        {/* Lower Dado Swatch */}
        <div className="flex items-center gap-1.5" title="Lower Dado Wainscoting (Sandstone Beige Khaki)">
          <span className="w-3 h-3 rounded-sm border border-gray-500 shadow-inner" style={{ backgroundColor: defaultColors.bottom }}></span>
          <span className="text-[10px] text-gray-300 font-medium">Dado</span>
        </div>
        {/* Floor Swatch */}
        <div className="flex items-center gap-1.5" title="Floor Material (Terrazzo Stone)">
          <span className="w-3 h-3 rounded-sm border border-gray-500 shadow-inner" style={{ backgroundColor: floorColor }}></span>
          <span className="text-[10px] text-gray-300 font-medium">Floor</span>
        </div>
      </div>

      {/* Model Information Legend */}
      <div 
        className="absolute bottom-4 left-4 bg-[#0d1526]/95 backdrop-blur-md border border-gray-700/80 px-3.5 py-2 rounded-xl text-xs text-gray-300 shadow-xl flex items-center gap-4 z-10"
        style={{ background: 'rgba(13, 21, 38, 0.95)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-400"></span>
          <span className="font-bold text-white">{walls.length}</span>
          <span className="text-gray-400">Walls</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-600"></span>
          <span className="font-bold text-white">{doors.length}</span>
          <span className="text-gray-400">Rooms &amp; Facilities</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="font-bold text-white">{scanSession?.trajectory?.length || 0}</span>
          <span className="text-gray-400">SLAM Points</span>
        </div>
      </div>

      {/* Room Details Modal / HUD when a room is clicked */}
      {selectedRoom && (
        <div 
          className="absolute bottom-4 right-4 bg-[#0d1526]/98 backdrop-blur-xl border border-indigo-500/50 p-4 rounded-xl text-xs text-gray-200 shadow-2xl w-72 z-20"
          style={{ background: 'rgba(13, 21, 38, 0.98)' }}
        >
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <DoorOpen size={16} className="text-indigo-400" />
              <span className="font-extrabold text-sm text-white">
                {selectedRoom.roomNumber === 'Washrooms' ? '🚻 Washroom Suite' : selectedRoom.roomNumber === 'Water Point' ? '💧 RO Water Cooler' : `Room ${selectedRoom.roomNumber}`}
              </span>
            </div>
            <button 
              onClick={() => {
                setSelectedRoom(null);
                setCameraMode('orbit_3d');
              }} 
              className="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded bg-gray-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-400">Category:</span>
              <span className="font-bold text-indigo-300">
                {selectedRoom.roomNumber === 'Washrooms' ? 'Multi-Stall Restrooms' : selectedRoom.roomNumber === 'Water Point' ? 'Commercial RO Station' : 'Student Hostel Room'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">AI Confidence:</span>
              <span className="font-semibold text-emerald-400">{((selectedRoom.confidence || 0.96) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Wall Finish:</span>
              <span className="font-medium text-gray-200">Dual-Tone Plaster &amp; Dado</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Floor Coordinates:</span>
              <span className="font-mono text-gray-300">X: {selectedRoom.posX?.toFixed(1)}m, Z: {selectedRoom.posZ?.toFixed(1)}m</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
