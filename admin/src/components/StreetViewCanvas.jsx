import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

// ─── Panoramic Cylinder ────────────────────────────────────────────────────
const PanoramaCylinder = ({ url, onLoaded }) => {
  const texture = useTexture(url);
  const meshRef = useRef();

  useEffect(() => {
    if (texture) {
      // Proper texture settings for panoramic display
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.x = -1;  // flip horizontally for inside-out viewing
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      if (onLoaded) onLoaded();
    }
  }, [texture, onLoaded]);

  return (
    <mesh ref={meshRef}>
      {/* Balanced proportions: radius 50, height 50, 64 segments, open-ended */}
      <cylinderGeometry args={[50, 50, 50, 64, 1, true]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        toneMapped={false}
      />
    </mesh>
  );
};

// ─── WebGL Context Recovery ────────────────────────────────────────────────
const ContextWatcher = () => {
  const { gl } = useThree();
  
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleLost = (event) => {
      event.preventDefault();
      console.warn('WebGL context lost — will attempt recovery');
    };
    
    const handleRestored = () => {
      console.log('WebGL context restored');
    };
    
    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl]);
  
  return null;
};

// ─── Loading Fallback ──────────────────────────────────────────────────────
const LoadingFallback = () => (
  <Html center>
    <div className="text-white text-lg flex items-center gap-2">
      <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
      Loading panorama...
    </div>
  </Html>
);

// ─── Main Component ────────────────────────────────────────────────────────
export default function StreetViewCanvas({ nodes, activeNodeId, onNodeChange, onClose }) {
  const [targetNodeId, setTargetNodeId] = useState(activeNodeId);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setTargetNodeId(activeNodeId);
    setIsLoading(true);
  }, [activeNodeId]);

  const activeNode = nodes.find(n => n._id === targetNodeId) || nodes[0];
  const activeIndex = nodes.findIndex(n => n._id === targetNodeId);

  // Navigation
  const handleNav = useCallback((nodeId) => {
    if (nodeId) {
      setIsLoading(true);
      setTargetNodeId(nodeId);
      onNodeChange(nodeId);
    }
  }, [onNodeChange]);

  const goNext = useCallback(() => {
    if (activeIndex < nodes.length - 1) {
      handleNav(nodes[activeIndex + 1]._id);
    }
  }, [activeIndex, nodes, handleNav]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) {
      handleNav(nodes[activeIndex - 1]._id);
    }
  }, [activeIndex, nodes, handleNav]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onClose]);

  if (!activeNode) return null;

  const connectedNodes = (activeNode.connectedEdges || []).map(conn => {
    const node = nodes.find(n => n._id === conn.targetNodeId);
    return { ...conn, node };
  }).filter(c => c.node);

  const handleTextureLoaded = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <Canvas
        camera={{ position: [0, 0, 0.1], fov: 75 }}
        gl={{ 
          antialias: true, 
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false
        }}
        frameloop="always"
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ContextWatcher />
        
        <Suspense fallback={<LoadingFallback />}>
          <PanoramaCylinder 
            key={activeNode._id} 
            url={activeNode.imageUrl} 
            onLoaded={handleTextureLoaded}
          />
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.8}
          rotateSpeed={-0.3}
          target={[0, 0, 0]}
          enableDamping
          dampingFactor={0.1}
        />
        
        {/* Doorway / Staircase Labels */}
        {(activeNode.isDoorway || activeNode.isStaircase) && (
          <Html position={[0, -8, -30]} center>
            <div className={`px-4 py-2 rounded-full font-bold text-white shadow-lg whitespace-nowrap text-sm
              ${activeNode.isStaircase ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
              {activeNode.isStaircase ? '🔄 Staircase Transition' : `🚪 ${activeNode.doorDetails?.roomName || 'Doorway'}`}
            </div>
          </Html>
        )}
      </Canvas>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none z-10">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      )}

      {/* Top UI Bar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
        <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg text-white font-mono text-sm flex items-center gap-3">
          <span>Node {activeIndex + 1} / {nodes.length}</span>
          {activeNode.isDoorway && (
            <span className="bg-red-500/80 px-2 py-0.5 rounded text-xs">
              {activeNode.doorDetails?.roomName || 'Door'}
            </span>
          )}
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors backdrop-blur-sm"
          >
            <FiX size={24} />
          </button>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-20">
        <div className="text-white/50 text-xs tracking-wider font-medium">
          DRAG TO LOOK AROUND • ARROWS TO NAVIGATE
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={goPrev}
            disabled={activeIndex <= 0}
            className="p-3 bg-white/10 hover:bg-blue-600/80 disabled:opacity-30 disabled:cursor-not-allowed border border-white/20 rounded-full text-white backdrop-blur-sm transition-all"
          >
            <FiChevronLeft size={20} />
          </button>
          
          {connectedNodes.length > 0 ? (
            connectedNodes.map((conn, i) => (
              <button
                key={i}
                onClick={() => handleNav(conn.targetNodeId)}
                className="px-5 py-2.5 bg-white/10 hover:bg-blue-600/80 border border-white/20 rounded-full text-white text-sm backdrop-blur-sm transition-all"
              >
                {conn.direction === 'forward' ? '→' : '←'} {conn.node?.doorDetails?.roomName || conn.direction}
              </button>
            ))
          ) : (
            <span className="text-white/40 text-sm px-4">End of path</span>
          )}
          
          <button
            onClick={goNext}
            disabled={activeIndex >= nodes.length - 1}
            className="p-3 bg-white/10 hover:bg-blue-600/80 disabled:opacity-30 disabled:cursor-not-allowed border border-white/20 rounded-full text-white backdrop-blur-sm transition-all"
          >
            <FiChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
