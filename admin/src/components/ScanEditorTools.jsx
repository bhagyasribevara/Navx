import React from 'react';
import { Play, Square, RotateCcw, Merge, Save, CheckCircle2 } from 'lucide-react';

export default function ScanEditorTools({ isScanning, onStart, onStop, onApprove, onUndo }) {
  return (
    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg text-white">
      <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Editor Tools</h3>
      
      <div className="grid grid-cols-2 gap-3 mb-6">
        {!isScanning ? (
          <button 
            onClick={onStart}
            className="flex flex-col items-center justify-center p-3 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg border border-purple-500/30 transition-colors"
          >
            <Play size={20} className="mb-2" />
            <span className="text-xs font-medium">Start Scan</span>
          </button>
        ) : (
          <button 
            onClick={onStop}
            className="flex flex-col items-center justify-center p-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg border border-red-500/30 transition-colors animate-pulse"
          >
            <Square size={20} className="mb-2" />
            <span className="text-xs font-medium">Stop Scan</span>
          </button>
        )}

        <button 
          onClick={onUndo}
          className="flex flex-col items-center justify-center p-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
        >
          <RotateCcw size={20} className="mb-2" />
          <span className="text-xs font-medium">Undo Last</span>
        </button>
      </div>
      
      <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">AI Operations</h3>
      <div className="space-y-3">
        <button 
          onClick={onApprove}
          className="w-full flex items-center p-3 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg border border-green-500/30 transition-colors"
        >
          <CheckCircle2 size={18} className="mr-3" />
          <span className="text-sm font-medium">Approve AI Suggestions</span>
        </button>
        
        <button className="w-full flex items-center p-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors">
          <Merge size={18} className="mr-3" />
          <span className="text-sm font-medium">Merge Sessions</span>
        </button>
        
        <button className="w-full flex items-center p-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg border border-blue-500/30 transition-colors">
          <Save size={18} className="mr-3" />
          <span className="text-sm font-medium">Publish Map</span>
        </button>
      </div>
    </div>
  );
}
