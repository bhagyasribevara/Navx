import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useOutletContext } from 'react-router-dom';
import { FiCpu, FiGrid, FiFileText, FiClock } from 'react-icons/fi';

export default function AdminAiAssistant({ admin }) {
  const { campus } = useOutletContext();
  const [promptOption, setPromptOption] = useState('ROOM_OPTIMIZE');
  const [customPrompt, setCustomPrompt] = useState('Optimize classroom allocations for CSE department to minimize cross-floor movement.');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
  const token = localStorage.getItem("navx_token");
  const headers = { Authorization: `Bearer ${token}` };

  const handleGenerate = async () => {
    setLoading(true);
    setOutput('');
    try {
      const { data } = await axios.post(`${API_BASE}/adminAi/calculate`, {
        calculationType: promptOption,
        promptText: customPrompt,
        campusId: campus._id
      }, { headers });

      if (data.success) {
        setOutput(data.result);
      }
    } catch (e) {
      toast.error('Failed to run AI calculation.');
    } finally {
      setLoading(false);
    }
  };

  const handlePromptSelect = (option) => {
    setPromptOption(option);
    if (option === 'ROOM_OPTIMIZE') {
      setCustomPrompt('Optimize classroom allocations for CSE department to minimize cross-floor student movement.');
    } else if (option === 'TEACHER_WORKLOAD') {
      setCustomPrompt('Calculate weekly teaching workloads for all active faculties and check if any exceed 16 hours/week.');
    } else if (option === 'CONFLICT_REPORT') {
      setCustomPrompt('Perform conflict analysis on today\'s timetable to identify double-booked classrooms or clashing faculty slots.');
    } else {
      setCustomPrompt('Analyze student attendance and QR navigation search rates to suggest venue marketing placements.');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Admin Assistant</h1>
          <p className="page-subtitle">Run automated room allocation audits, teacher workload calculations, and timetable collision reports.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 24 }}>
        
        {/* Selection panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiCpu color="#a855f7" /> AI Calculations</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button 
              onClick={() => handlePromptSelect('ROOM_OPTIMIZE')}
              className="btn btn-secondary btn-sm"
              style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                background: promptOption === 'ROOM_OPTIMIZE' ? 'rgba(168, 85, 247, 0.1)' : 'none',
                border: promptOption === 'ROOM_OPTIMIZE' ? '1px solid #a855f7' : '1px solid var(--border-color)',
                color: promptOption === 'ROOM_OPTIMIZE' ? '#a855f7' : '#fff'
              }}
            >
              <FiGrid style={{ marginRight: 8 }} /> Classroom Optimization Audit
            </button>
            <button 
              onClick={() => handlePromptSelect('TEACHER_WORKLOAD')}
              className="btn btn-secondary btn-sm"
              style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                background: promptOption === 'TEACHER_WORKLOAD' ? 'rgba(168, 85, 247, 0.1)' : 'none',
                border: promptOption === 'TEACHER_WORKLOAD' ? '1px solid #a855f7' : '1px solid var(--border-color)',
                color: promptOption === 'TEACHER_WORKLOAD' ? '#a855f7' : '#fff'
              }}
            >
              <FiClock style={{ marginRight: 8 }} /> Weekly Teacher Workload Calculation
            </button>
            <button 
              onClick={() => handlePromptSelect('CONFLICT_REPORT')}
              className="btn btn-secondary btn-sm"
              style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                background: promptOption === 'CONFLICT_REPORT' ? 'rgba(168, 85, 247, 0.1)' : 'none',
                border: promptOption === 'CONFLICT_REPORT' ? '1px solid #a855f7' : '1px solid var(--border-color)',
                color: promptOption === 'CONFLICT_REPORT' ? '#a855f7' : '#fff'
              }}
            >
              <FiFileText style={{ marginRight: 8 }} /> Timetable Collision Analysis
            </button>
          </div>

          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Customize Audit Parameters</label>
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              className="input"
              rows={4}
              style={{ width: '100%', borderRadius: 10 }}
            />
          </div>

          <button onClick={handleGenerate} disabled={loading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? 'Performing AI Calculations...' : <><FiCpu /> Run AI Audit</>}
          </button>
        </div>

        {/* AI calculation output */}
        <div className="card" style={{ minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title">Audit Report Results</h3>
          
          <div style={{
            flex: 1,
            marginTop: 12,
            padding: 16,
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            fontFamily: 'monospace',
            fontSize: 13,
            color: '#94a3b8',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {output || 'Run an AI administrative audit on the left to generate the analytical report details here.'}
          </div>
        </div>

      </div>
    </div>
  );
}
