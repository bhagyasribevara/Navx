import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiPlus, FiTrash2, FiEdit2, FiSave, FiMove, FiSquare, FiCircle, FiNavigation, FiZoomIn, FiZoomOut, FiRotateCcw, FiCopy, FiEye } from 'react-icons/fi';
import * as api from '../api';

const GRID_SIZE = 20;
const COLORS = {
  classroom: '#3b82f6', office: '#8b5cf6', lab: '#22c55e', restroom: '#f59e0b',
  cafeteria: '#ef4444', library: '#06b6d4', auditorium: '#ec4899', elevator: '#6366f1',
  stairs: '#f97316', corridor: '#64748b', entrance: '#10b981', exit: '#ef4444', other: '#94a3b8'
};

export default function MapEditor() {
  const { campusId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [campus, setCampus] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [navPaths, setNavPaths] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [tool, setTool] = useState('select');
  const [mode, setMode] = useState('rooms'); // rooms, nodes, paths
  const [showModal, setShowModal] = useState(null);
  const [form, setForm] = useState({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [pathStart, setPathStart] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load data
  useEffect(() => {
    api.getCampus(campusId).then(r => setCampus(r.data)).catch(() => toast.error('Campus not found'));
    api.getBlocks(campusId).then(r => setBlocks(r.data));
  }, [campusId]);

  useEffect(() => {
    if (selectedBlock) {
      api.getFloors(selectedBlock._id).then(r => {
        setFloors(r.data);
        if (r.data.length > 0 && !selectedFloor) setSelectedFloor(r.data[0]);
      });
    }
  }, [selectedBlock]);

  useEffect(() => {
    if (selectedFloor) {
      api.getRooms(selectedFloor._id).then(r => setRooms(r.data));
      api.getNodes(selectedFloor._id).then(r => setNodes(r.data));
      api.getPaths(selectedFloor._id).then(r => setNavPaths(r.data));
    }
  }, [selectedFloor]);

  const snapToGrid = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  // Canvas drawing
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = canvas.parentElement.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    ctx.strokeStyle = '#1a2040';
    ctx.lineWidth = 0.5;
    const gridStart = -1000, gridEnd = 2000;
    for (let x = gridStart; x < gridEnd; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, gridStart); ctx.lineTo(x, gridEnd); ctx.stroke();
    }
    for (let y = gridStart; y < gridEnd; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(gridStart, y); ctx.lineTo(gridEnd, y); ctx.stroke();
    }

    // Draw rooms
    rooms.forEach(room => {
      const s = room.shape;
      const isSelected = selectedItem && selectedItem._id === room._id;
      ctx.fillStyle = isSelected ? '#6366f180' : (COLORS[room.type] || '#3b82f6') + '40';
      ctx.strokeStyle = isSelected ? '#818cf8' : (COLORS[room.type] || '#3b82f6');
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.beginPath();
      if (s.type === 'circle') {
        ctx.arc(s.x + (s.radius || 30), s.y + (s.radius || 30), s.radius || 30, 0, Math.PI * 2);
      } else {
        ctx.rect(s.x, s.y, s.width || 80, s.height || 60);
      }
      ctx.fill(); ctx.stroke();

      // Room label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const cx = s.type === 'circle' ? s.x + (s.radius || 30) : s.x + (s.width || 80) / 2;
      const cy = s.type === 'circle' ? s.y + (s.radius || 30) : s.y + (s.height || 60) / 2;
      ctx.fillText(room.name, cx, cy + 4);
    });

    // Draw nav paths
    if (mode === 'nodes' || mode === 'paths') {
      navPaths.forEach(p => {
        const nA = nodes.find(n => n._id === p.nodeA);
        const nB = nodes.find(n => n._id === p.nodeB);
        if (!nA || !nB) return;
        ctx.strokeStyle = '#22c55e60';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(nA.x, nA.y); ctx.lineTo(nB.x, nB.y); ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw nodes
      nodes.forEach(node => {
        const isSelected = selectedItem && selectedItem._id === node._id;
        const isPathStart = pathStart === node._id;
        ctx.fillStyle = isPathStart ? '#f59e0b' : isSelected ? '#818cf8' : '#22c55e';
        ctx.strokeStyle = isSelected ? '#fff' : '#22c55e80';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, isSelected ? 8 : 6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        if (node.label) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y - 12);
        }
      });
    }

    ctx.restore();
  }, [rooms, nodes, navPaths, selectedItem, zoom, pan, mode, pathStart]);

  useEffect(() => {
    drawCanvas();
    const handleResize = () => drawCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  // Mouse handlers
  const getCanvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom
    };
  };

  const handleCanvasClick = (e) => {
    if (isPanning) return;
    const pos = getCanvasPos(e);

    if (tool === 'rect' && mode === 'rooms' && selectedFloor) {
      const newRoom = {
        floorId: selectedFloor._id, blockId: selectedBlock._id, campusId,
        name: `Room ${rooms.length + 1}`, type: 'classroom',
        shape: { type: 'rectangle', x: snapToGrid(pos.x), y: snapToGrid(pos.y), width: 100, height: 80, fill: '#3b82f640', stroke: '#3b82f6' }
      };
      api.createRoom(newRoom).then(r => {
        setRooms([...rooms, r.data]);
        toast.success('Room added');
        pushHistory();
      }).catch(() => toast.error('Failed'));
      return;
    }

    if (tool === 'circle' && mode === 'rooms' && selectedFloor) {
      const newRoom = {
        floorId: selectedFloor._id, blockId: selectedBlock._id, campusId,
        name: `Room ${rooms.length + 1}`, type: 'classroom',
        shape: { type: 'circle', x: snapToGrid(pos.x) - 30, y: snapToGrid(pos.y) - 30, radius: 30 }
      };
      api.createRoom(newRoom).then(r => {
        setRooms([...rooms, r.data]);
        toast.success('Room added');
        pushHistory();
      }).catch(() => toast.error('Failed'));
      return;
    }

    if (tool === 'node' && (mode === 'nodes' || mode === 'paths') && selectedFloor) {
      const newNode = {
        floorId: selectedFloor._id, blockId: selectedBlock._id, campusId,
        x: snapToGrid(pos.x), y: snapToGrid(pos.y), type: 'waypoint'
      };
      api.createNode(newNode).then(r => {
        setNodes([...nodes, r.data]);
        toast.success('Node placed');
      }).catch(() => toast.error('Failed'));
      return;
    }

    if (tool === 'path' && mode === 'paths') {
      const clicked = nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < 15);
      if (!clicked) return;
      if (!pathStart) {
        setPathStart(clicked._id);
        toast.info('Click another node to create path');
      } else {
        if (pathStart === clicked._id) { setPathStart(null); return; }
        const newPath = {
          floorId: selectedFloor._id, campusId,
          nodeA: pathStart, nodeB: clicked._id, type: 'hallway'
        };
        api.createPath(newPath).then(r => {
          setNavPaths([...navPaths, r.data]);
          setPathStart(null);
          toast.success('Path created');
        }).catch(() => toast.error('Failed'));
      }
      return;
    }

    // Select mode - find clicked item
    if (tool === 'select') {
      if (mode === 'nodes' || mode === 'paths') {
        const clickedNode = nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < 15);
        if (clickedNode) { setSelectedItem(clickedNode); return; }
      }
      const clickedRoom = rooms.find(r => {
        const s = r.shape;
        if (s.type === 'circle') return Math.hypot(s.x + (s.radius || 30) - pos.x, s.y + (s.radius || 30) - pos.y) < (s.radius || 30);
        return pos.x >= s.x && pos.x <= s.x + (s.width || 80) && pos.y >= s.y && pos.y <= s.y + (s.height || 60);
      });
      setSelectedItem(clickedRoom || null);
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && tool === 'pan')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const handleMouseMove = (e) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const handleMouseUp = () => setIsPanning(false);
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(5, z * delta)));
  };

  const pushHistory = () => {
    const state = { rooms: [...rooms], nodes: [...nodes], navPaths: [...navPaths] };
    setHistory(h => [...h.slice(0, historyIndex + 1), state]);
    setHistoryIndex(i => i + 1);
  };

  // CRUD helpers
  const addBlock = () => {
    const name = prompt('Block name:');
    if (!name) return;
    api.createBlock({ campusId, name }).then(r => {
      setBlocks([...blocks, r.data]);
      setSelectedBlock(r.data);
      toast.success('Block created');
    });
  };

  const addFloor = () => {
    if (!selectedBlock) return toast.warn('Select a block first');
    const name = prompt('Floor name:');
    if (!name) return;
    api.createFloor({ blockId: selectedBlock._id, campusId, name, level: floors.length }).then(r => {
      setFloors([...floors, r.data]);
      setSelectedFloor(r.data);
      toast.success('Floor created');
    });
  };

  const deleteSelected = () => {
    if (!selectedItem) return;
    if (!confirm('Delete this item?')) return;
    if (selectedItem.shape) {
      api.deleteRoom(selectedItem._id).then(() => {
        setRooms(rooms.filter(r => r._id !== selectedItem._id));
        setSelectedItem(null);
        toast.success('Room deleted');
      });
    } else {
      api.deleteNode(selectedItem._id).then(() => {
        setNodes(nodes.filter(n => n._id !== selectedItem._id));
        setNavPaths(navPaths.filter(p => p.nodeA !== selectedItem._id && p.nodeB !== selectedItem._id));
        setSelectedItem(null);
        toast.success('Node deleted');
      });
    }
  };

  const duplicateSelected = () => {
    if (!selectedItem || !selectedItem.shape) return;
    const dup = { ...selectedItem, name: selectedItem.name + ' Copy', shape: { ...selectedItem.shape, x: selectedItem.shape.x + 20, y: selectedItem.shape.y + 20 } };
    delete dup._id; delete dup.__v; delete dup.createdAt; delete dup.updatedAt;
    api.createRoom(dup).then(r => { setRooms([...rooms, r.data]); toast.success('Duplicated'); });
  };

  const updateSelectedRoom = (updates) => {
    if (!selectedItem) return;
    api.updateRoom(selectedItem._id, updates).then(r => {
      setRooms(rooms.map(rm => rm._id === r.data._id ? r.data : rm));
      setSelectedItem(r.data);
    });
  };

  const tools = [
    { id: 'select', icon: <FiMove />, label: 'Select' },
    { id: 'pan', icon: <FiEye />, label: 'Pan' },
    { id: 'rect', icon: <FiSquare />, label: 'Rectangle' },
    { id: 'circle', icon: <FiCircle />, label: 'Circle' },
    { id: 'node', icon: <FiNavigation />, label: 'Node' },
    { id: 'path', icon: <FiNavigation style={{ transform: 'rotate(90deg)' }} />, label: 'Path' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top toolbar */}
      <div style={{ height: 52, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <button className="btn-icon" onClick={() => navigate(-1)}><FiArrowLeft /></button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{campus?.name || 'Map Editor'}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 8, padding: 3 }}>
          {['rooms', 'nodes', 'paths'].map(m => (
            <button key={m} className={`tool-btn ${mode === m ? 'active' : ''}`} onClick={() => { setMode(m); setTool('select'); setPathStart(null); }} style={{ fontSize: 12, padding: '6px 14px' }}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 8, padding: 3 }}>
          <button className="tool-btn" onClick={() => setZoom(z => Math.min(5, z * 1.2))}><FiZoomIn /></button>
          <button className="tool-btn" onClick={() => setZoom(z => Math.max(0.2, z / 1.2))}><FiZoomOut /></button>
          <button className="tool-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><FiRotateCcw /></button>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(zoom * 100)}%</span>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        {/* Left panel - Structure tree */}
        <div style={{ width: 240, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', overflow: 'auto', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Structure</span>
            <button className="btn-icon" style={{ padding: 4, fontSize: 14 }} onClick={addBlock}><FiPlus /></button>
          </div>

          {blocks.map(block => (
            <div key={block._id} style={{ marginBottom: 8 }}>
              <div className={`tree-item ${selectedBlock?._id === block._id ? 'selected' : ''}`}
                onClick={() => { setSelectedBlock(block); setSelectedFloor(null); setRooms([]); setNodes([]); setNavPaths([]); }}>
                🏢 {block.name}
              </div>
              {selectedBlock?._id === block._id && (
                <div className="tree-children">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>FLOORS</span>
                    <button className="btn-icon" style={{ padding: 2, fontSize: 12 }} onClick={addFloor}><FiPlus /></button>
                  </div>
                  {floors.map(floor => (
                    <div key={floor._id} className={`tree-item ${selectedFloor?._id === floor._id ? 'selected' : ''}`}
                      onClick={() => setSelectedFloor(floor)} style={{ fontSize: 12 }}>
                      📐 {floor.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {selectedFloor && mode === 'rooms' && (
            <>
              <div style={{ marginTop: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Rooms ({rooms.length})
              </div>
              {rooms.map(room => (
                <div key={room._id} className={`tree-item ${selectedItem?._id === room._id ? 'selected' : ''}`}
                  onClick={() => setSelectedItem(room)} style={{ fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[room.type], flexShrink: 0 }} />
                  {room.name}
                </div>
              ))}
            </>
          )}

          {selectedFloor && (mode === 'nodes' || mode === 'paths') && (
            <>
              <div style={{ marginTop: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Nodes ({nodes.length}) · Paths ({navPaths.length})
              </div>
            </>
          )}
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, position: 'relative', background: '#080c16' }}>
          {/* Tool palette */}
          <div className="editor-toolbar">
            {tools.filter(t => {
              if (mode === 'rooms') return ['select', 'pan', 'rect', 'circle'].includes(t.id);
              if (mode === 'nodes') return ['select', 'pan', 'node'].includes(t.id);
              if (mode === 'paths') return ['select', 'pan', 'node', 'path'].includes(t.id);
              return true;
            }).map(t => (
              <button key={t.id} className={`tool-btn ${tool === t.id ? 'active' : ''}`} onClick={() => { setTool(t.id); setPathStart(null); }} title={t.label}>
                {t.icon}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          {selectedItem && (
            <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 4, zIndex: 10 }}>
              {selectedItem.shape && <button className="btn btn-secondary btn-sm" onClick={duplicateSelected}><FiCopy /> Duplicate</button>}
              <button className="btn btn-danger btn-sm" onClick={deleteSelected}><FiTrash2 /> Delete</button>
            </div>
          )}

          {!selectedFloor && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: 12 }}>
              <FiMap style={{ fontSize: 48, opacity: 0.3 }} />
              <p>Select a block and floor to start editing</p>
              {blocks.length === 0 && <button className="btn btn-primary" onClick={addBlock}><FiPlus /> Add Block</button>}
            </div>
          )}

          <canvas ref={canvasRef} onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onWheel={handleWheel} style={{ width: '100%', height: '100%', cursor: tool === 'pan' || isPanning ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }} />
        </div>

        {/* Right panel - Properties */}
        <div className="editor-panel">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Properties</div>

          {!selectedItem ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select an element to edit its properties</p>
          ) : selectedItem.shape ? (
            <>
              <div className="input-group">
                <label>Name</label>
                <input className="input" value={selectedItem.name} onChange={e => updateSelectedRoom({ name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Type</label>
                <select value={selectedItem.type} onChange={e => updateSelectedRoom({ type: e.target.value })}>
                  {Object.keys(COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Room Number</label>
                <input className="input" value={selectedItem.roomNumber || ''} onChange={e => updateSelectedRoom({ roomNumber: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="input-group">
                  <label>X</label>
                  <input className="input" type="number" value={selectedItem.shape.x} onChange={e => updateSelectedRoom({ shape: { ...selectedItem.shape, x: +e.target.value } })} />
                </div>
                <div className="input-group">
                  <label>Y</label>
                  <input className="input" type="number" value={selectedItem.shape.y} onChange={e => updateSelectedRoom({ shape: { ...selectedItem.shape, y: +e.target.value } })} />
                </div>
                {selectedItem.shape.type !== 'circle' && <>
                  <div className="input-group">
                    <label>Width</label>
                    <input className="input" type="number" value={selectedItem.shape.width} onChange={e => updateSelectedRoom({ shape: { ...selectedItem.shape, width: +e.target.value } })} />
                  </div>
                  <div className="input-group">
                    <label>Height</label>
                    <input className="input" type="number" value={selectedItem.shape.height} onChange={e => updateSelectedRoom({ shape: { ...selectedItem.shape, height: +e.target.value } })} />
                  </div>
                </>}
                {selectedItem.shape.type === 'circle' && (
                  <div className="input-group">
                    <label>Radius</label>
                    <input className="input" type="number" value={selectedItem.shape.radius} onChange={e => updateSelectedRoom({ shape: { ...selectedItem.shape, radius: +e.target.value } })} />
                  </div>
                )}
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="input" rows={2} value={selectedItem.description || ''} onChange={e => updateSelectedRoom({ description: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div className="input-group">
                <label>Node Type</label>
                <select value={selectedItem.type} onChange={e => api.updateNode(selectedItem._id, { type: e.target.value }).then(r => { setNodes(nodes.map(n => n._id === r.data._id ? r.data : n)); setSelectedItem(r.data); })}>
                  {['waypoint', 'entrance', 'exit', 'elevator', 'stairs', 'room_entry', 'intersection'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Label</label>
                <input className="input" value={selectedItem.label || ''} onChange={e => api.updateNode(selectedItem._id, { label: e.target.value }).then(r => { setNodes(nodes.map(n => n._id === r.data._id ? r.data : n)); setSelectedItem(r.data); })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="input-group"><label>X</label><input className="input" type="number" value={selectedItem.x} readOnly /></div>
                <div className="input-group"><label>Y</label><input className="input" type="number" value={selectedItem.y} readOnly /></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
