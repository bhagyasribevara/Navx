import React, { useState, useRef, useEffect } from 'react';
import { useTheme, THEMES, THEME_ORDER } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { themeId, switchTheme, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Trigger: a small circle showing current theme color */}
      <button
        className="theme-btn"
        onClick={() => setOpen(!open)}
        title="Switch theme"
        aria-label="Switch theme"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: `2px solid ${theme.isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)'}`,
          background: theme.preview.accent,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: `0 0 12px ${theme.preview.accent}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        {/* Inner dot showing bg color */}
        <span style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: theme.preview.bg,
          border: `1.5px solid ${theme.isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.25)'}`,
        }} />
      </button>

      {/* Dropdown — 4 color circles */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 10,
            display: 'flex',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 40,
            background: theme.isLight
              ? 'rgba(255,255,255,0.97)'
              : 'rgba(10,14,26,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${theme.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
            boxShadow: theme.isLight
              ? '0 8px 32px rgba(0,0,0,0.12)'
              : '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 9999,
            animation: 'themeToggleFadeIn 0.15s ease-out',
          }}
        >
          {THEME_ORDER.map((id) => {
            const t = THEMES[id];
            const isActive = themeId === id;

            return (
              <button
                className="theme-btn"
                key={id}
                onClick={() => { switchTheme(id); setOpen(false); }}
                title={t.name}
                aria-label={t.name}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: isActive
                    ? `2.5px solid ${t.preview.accent}`
                    : `2px solid ${theme.isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'}`,
                  background: t.preview.bg,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  boxShadow: isActive ? `0 0 10px ${t.preview.accent}50` : 'none',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <span style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: t.preview.accent,
                  boxShadow: `0 0 6px ${t.preview.accent}40`,
                }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
