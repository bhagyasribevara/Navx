import React, { useState, useEffect, Component } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { FiEye, FiMap, FiCheckCircle, FiXCircle, FiTrash2, FiVideo, FiUploadCloud } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { getBlocks, getFloors, getStreetViewSessions, publishStreetViewSession, deleteStreetViewSession, getStreetViewGraph } from '../api';
import StreetViewCanvas from '../components/StreetViewCanvas';
import StreetViewMiniMap from '../components/StreetViewMiniMap';

// ─── Error Boundary ────────────────────────────────────────────────────────
class StreetViewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('StreetView Error Boundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-[#0f172a] p-8">
          <FiVideo size={48} className="mb-4 opacity-50 text-red-400" />
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-sm mb-4">{this.state.error?.message || 'An unexpected error occurred in the Street View module.'}</p>
          <button
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main Component ────────────────────────────────────────────────────────
function StreetViewManagerInner({ admin }) {
  const { campus } = useOutletContext();
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Preview state
  const [previewGraph, setPreviewGraph] = useState(null);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [cameraHeading, setCameraHeading] = useState(0);

  useEffect(() => {
    if (campus?._id) {
      getBlocks(campus._id).then(res => setBlocks(res.data)).catch(console.error);
    }
  }, [campus]);

  useEffect(() => {
    if (selectedBlock) {
      getFloors(selectedBlock, campus?._id).then(res => setFloors(res.data)).catch(console.error);
      setSelectedFloor('');
    } else {
      setFloors([]);
      setSelectedFloor('');
    }
  }, [selectedBlock, campus]);

  const loadSessions = async () => {
    if (!selectedFloor) return;
    setLoading(true);
    try {
      const res = await getStreetViewSessions({ blockId: selectedBlock, floorId: selectedFloor });
      const data = res.data;
      setSessions(Array.isArray(data) ? data : Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (err) {
      toast.error('Failed to load sessions');
      setSessions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedFloor) {
      loadSessions();
    } else {
      setSessions([]);
    }
  }, [selectedFloor]);

  const handlePublishToggle = async (session) => {
    try {
      await publishStreetViewSession(session._id);
      toast.success(`Session ${session.isPublished ? 'unpublished' : 'published'} successfully`);
      loadSessions();
    } catch (err) {
      toast.error('Failed to update publish status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    try {
      await deleteStreetViewSession(id);
      toast.success('Session deleted');
      loadSessions();
    } catch (err) {
      toast.error('Failed to delete session');
    }
  };

  const handlePreview = async (session) => {
    try {
      console.log("Previewing session:", session._id);
      const res = await getStreetViewGraph(session._id);
      console.log("Graph response:", res.data);
      const graph = res.data?.nodes || [];
      if (!graph.length) {
        toast.warning('No nodes found for this session');
        return;
      }
      setPreviewGraph(graph);
      setActiveNodeId(graph[0]._id);
      setCameraHeading(graph[0]?.orientation?.heading || 0);
      setShowPreview(true);
      console.log("Preview modal opened");
    } catch (err) {
      console.error("Preview error:", err);
      toast.error(`Failed to load preview: ${err.message}`);
    }
  };

  const handleNodeChange = (nodeId) => {
    setActiveNodeId(nodeId);
    const node = previewGraph?.find(n => n._id === nodeId);
    if (node?.orientation?.heading !== undefined) {
      setCameraHeading(node.orientation.heading);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-[#0f172a] text-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FiMap className="text-blue-400" />
            Street View Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage and publish immersive panoramic tours.</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="flex gap-4 mb-8 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-400 mb-1">Building</label>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value)}
          >
            <option value="">Select Building</option>
            {blocks.map(b => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-400 mb-1">Floor</label>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            disabled={!selectedBlock}
          >
            <option value="">Select Floor</option>
            {floors.map(f => (
              <option key={f._id} value={f._id}>Level {f.level} - {f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!selectedFloor ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <FiVideo size={48} className="mb-4 opacity-50" />
            <p>Select a building and floor to view sessions.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center mt-12">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <FiUploadCloud size={48} className="mb-4 opacity-50" />
            <p>No street view sessions found for this floor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map(session => (
              <div key={session._id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
                <div className="h-40 bg-slate-900 relative">
                  {session.thumbnailUrl ? (
                    <img src={session.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <FiVideo size={32} />
                    </div>
                  )}
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold shadow
                    ${session.status === 'completed' ? 'bg-green-500 text-white' : 
                      session.status === 'processing' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'}`}>
                    {session.status?.toUpperCase() || 'UNKNOWN'}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-lg text-white mb-2">Capture Session</h3>
                  <div className="text-sm text-slate-400 space-y-1 mb-4 flex-1">
                    <p>Nodes: {session.totalNodes || 0}</p>
                    <p>Distance: {session.totalDistance ? session.totalDistance.toFixed(1) + 'm' : 'N/A'}</p>
                    <p>Captured: {new Date(session.createdAt).toLocaleDateString()}</p>
                    {session.doorTags && session.doorTags.length > 0 && (
                      <p className="truncate">Rooms: {session.doorTags.length} ({session.doorTags.map(t => t.roomName).filter(Boolean).join(', ')})</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-700">
                    <button 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      onClick={() => handlePreview(session)}
                    >
                      <FiEye /> Preview
                    </button>
                    <button 
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
                        ${session.isPublished ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                      onClick={() => handlePublishToggle(session)}
                    >
                      {session.isPublished ? <><FiXCircle /> Unpublish</> : <><FiCheckCircle /> Publish</>}
                    </button>
                    <button 
                      className="px-3 py-2 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                      onClick={() => handleDelete(session._id)}
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Fullscreen Modal via Portal */}
      {showPreview && previewGraph && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black">
          <StreetViewCanvas 
            nodes={previewGraph}
            activeNodeId={activeNodeId}
            onNodeChange={handleNodeChange}
            onClose={() => setShowPreview(false)}
          />
          <StreetViewMiniMap 
            nodes={previewGraph}
            activeNodeId={activeNodeId}
            onNodeClick={handleNodeChange}
            cameraAngle={cameraHeading * Math.PI / 180}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Wrapped Export ────────────────────────────────────────────────────────
export default function StreetViewManager(props) {
  return (
    <StreetViewErrorBoundary>
      <StreetViewManagerInner {...props} />
    </StreetViewErrorBoundary>
  );
}
