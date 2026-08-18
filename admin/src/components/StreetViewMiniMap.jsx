import React from 'react';

export default function StreetViewMiniMap({ nodes = [], activeNodeId, onNodeClick, cameraAngle = 0 }) {
  if (!nodes.length) return null;

  // Auto-scale logic
  const margin = 25;
  const size = 200;
  
  const xs = nodes.map(n => n.position?.x || 0);
  const zs = nodes.map(n => n.position?.z || 0);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  
  const rangeX = (maxX - minX) || 1;
  const rangeZ = (maxZ - minZ) || 1;
  
  // Add padding so nodes aren't at the edges
  const usable = size - margin * 2;
  const scale = Math.min(usable / rangeX, usable / rangeZ) * 0.85;
  
  // Center the path in the minimap
  const offsetX = (usable - rangeX * scale) / 2;
  const offsetZ = (usable - rangeZ * scale) / 2;
  
  const getPos = (x, z) => ({
    cx: margin + offsetX + (x - minX) * scale,
    cy: margin + offsetZ + (z - minZ) * scale
  });

  const activeNode = nodes.find(n => n._id === activeNodeId);
  const activeIndex = nodes.findIndex(n => n._id === activeNodeId);

  // Radar cone based on camera heading angle (in radians)
  const getConePoints = (cx, cy, angle) => {
    const r = 25;
    const spread = Math.PI / 3; // 60 degrees
    // Adjust angle: in our coordinate system, heading 0 = north = -Y in SVG
    const adjustedAngle = -angle + Math.PI / 2;
    
    const p1x = cx + r * Math.cos(adjustedAngle - spread / 2);
    const p1y = cy - r * Math.sin(adjustedAngle - spread / 2);
    const p2x = cx + r * Math.cos(adjustedAngle + spread / 2);
    const p2y = cy - r * Math.sin(adjustedAngle + spread / 2);
    
    return `${cx},${cy} ${p1x},${p1y} ${p2x},${p2y}`;
  };

  return (
    <div className="absolute bottom-6 left-6 w-[200px] h-[200px] bg-black/60 rounded-xl overflow-hidden border border-white/20 backdrop-blur-md shadow-2xl z-10">
      {/* Compass Rose */}
      <div className="absolute top-2 right-2 text-[10px] text-white/50 font-bold z-10">
        <span>N</span>
      </div>
      
      {/* Node counter */}
      <div className="absolute top-2 left-2 text-[10px] text-white/60 font-mono z-10">
        {activeIndex + 1}/{nodes.length}
      </div>

      <svg width={size} height={size}>
        {/* Path lines connecting sequential nodes */}
        {nodes.map((node, i) => {
          if (i === 0) return null;
          const prev = nodes[i - 1];
          const p1 = getPos(prev.position?.x || 0, prev.position?.z || 0);
          const p2 = getPos(node.position?.x || 0, node.position?.z || 0);
          return (
            <line 
              key={`path-${i}`}
              x1={p1.cx} y1={p1.cy} x2={p2.cx} y2={p2.cy}
              stroke="rgba(99, 102, 241, 0.5)" 
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
        
        {/* Edge connections (for non-sequential edges like branching) */}
        {nodes.map(node => (
          (node.connectedEdges || []).map(conn => {
            const target = nodes.find(n => n._id === conn.targetNodeId);
            if (!target) return null;
            // Skip sequential edges (already drawn above)
            const nodeIdx = nodes.indexOf(node);
            const targetIdx = nodes.indexOf(target);
            if (Math.abs(nodeIdx - targetIdx) === 1) return null;
            
            const p1 = getPos(node.position?.x || 0, node.position?.z || 0);
            const p2 = getPos(target.position?.x || 0, target.position?.z || 0);
            return (
              <line 
                key={`edge-${node._id}-${target._id}`}
                x1={p1.cx} y1={p1.cy} x2={p2.cx} y2={p2.cy}
                stroke="rgba(251, 191, 36, 0.4)" 
                strokeWidth="1"
                strokeDasharray="3,3"
              />
            );
          })
        ))}
        
        {/* Nodes */}
        {nodes.map(node => {
          const { cx, cy } = getPos(node.position?.x || 0, node.position?.z || 0);
          const isActive = node._id === activeNodeId;
          
          let fill = '#6366f1'; // indigo
          if (node.isDoorway) fill = '#ef4444'; // red
          if (node.isStaircase) fill = '#22c55e'; // green

          return (
            <g key={node._id} className="cursor-pointer" onClick={() => onNodeClick && onNodeClick(node._id)}>
              {isActive && (
                <>
                  {/* Radar cone showing view direction */}
                  <polygon 
                    points={getConePoints(cx, cy, cameraAngle)} 
                    fill="rgba(99, 102, 241, 0.25)" 
                    stroke="rgba(99, 102, 241, 0.4)"
                    strokeWidth="0.5"
                  />
                  {/* Pulse ring */}
                  <circle cx={cx} cy={cy} r="10" fill="none" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1" className="animate-ping" />
                </>
              )}
              <circle 
                cx={cx} 
                cy={cy} 
                r={isActive ? "5" : "3.5"} 
                fill={fill} 
                stroke={isActive ? "#fff" : "rgba(255,255,255,0.3)"}
                strokeWidth={isActive ? "2" : "0.5"}
              />
              {/* Doorway label */}
              {node.isDoorway && node.doorDetails?.roomName && (
                <text 
                  x={cx} 
                  y={cy - 10} 
                  textAnchor="middle" 
                  fill="rgba(239, 68, 68, 0.8)" 
                  fontSize="7" 
                  fontWeight="bold"
                >
                  {node.doorDetails.roomName}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
