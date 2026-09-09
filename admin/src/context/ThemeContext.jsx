import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── 4 Theme Palettes ────────────────────────────────────────────────────────
export const THEMES = {
  midnight: {
    id: 'midnight',
    name: 'Midnight Indigo',
    preview: { bg: '#060a14', accent: '#6366f1', text: '#e8ecf4' },
    vars: {
      '--bg-primary': '#060a14',
      '--bg-secondary': '#0c1424',
      '--bg-card': '#0d1526',
      '--bg-card-hover': '#142038',
      '--bg-input': '#080d18',
      '--border-color': 'rgba(99, 102, 241, 0.1)',
      '--border-light': 'rgba(99, 102, 241, 0.06)',
      '--border-active': '#6366f1',
      '--text-primary': '#e8ecf4',
      '--text-secondary': '#8b9dc3',
      '--text-muted': '#4a5a78',
      '--accent-primary': '#6366F1',
      '--accent-secondary': '#818CF8',
      '--accent-glow': 'rgba(99, 102, 241, 0.25)',
      '--success': '#10B981',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--info': '#38BDF8',
      '--gradient-primary': 'linear-gradient(135deg, #4f46e5, #6366f1, #818cf8)',
      '--gradient-dark': 'linear-gradient(180deg, #060a14 0%, #0c1424 100%)',
      '--shadow-sm': '0 2px 12px rgba(0, 0, 0, 0.35)',
      '--shadow-md': '0 8px 32px rgba(0, 0, 0, 0.45)',
      '--shadow-lg': '0 20px 60px rgba(0, 0, 0, 0.55)',
      '--shadow-glow': '0 0 24px rgba(99, 102, 241, 0.15)',
    },
    bodyBg: '#060a14',
    bodyGradient: `
      radial-gradient(ellipse at 15% 0%, rgba(30, 64, 175, 0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 85% 100%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(15, 23, 42, 1) 0%, #060a14 100%)
    `,
    isLight: false,
  },

  black: {
    id: 'black',
    name: 'Pure Black',
    preview: { bg: '#000000', accent: '#818cf8', text: '#ffffff' },
    vars: {
      '--bg-primary': '#000000',
      '--bg-secondary': '#0a0a0a',
      '--bg-card': '#0a0a0a',
      '--bg-card-hover': '#141414',
      '--bg-input': '#050505',
      '--border-color': 'rgba(130, 140, 248, 0.12)',
      '--border-light': 'rgba(255, 255, 255, 0.06)',
      '--border-active': '#818cf8',
      '--text-primary': '#ffffff',
      '--text-secondary': '#a0a0a0',
      '--text-muted': '#666666',
      '--accent-primary': '#818CF8',
      '--accent-secondary': '#A5B4FC',
      '--accent-glow': 'rgba(129, 140, 248, 0.3)',
      '--success': '#34D399',
      '--warning': '#FBBF24',
      '--danger': '#F87171',
      '--info': '#38BDF8',
      '--gradient-primary': 'linear-gradient(135deg, #6366f1, #818cf8, #a5b4fc)',
      '--gradient-dark': 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
      '--shadow-sm': '0 2px 12px rgba(0, 0, 0, 0.6)',
      '--shadow-md': '0 8px 32px rgba(0, 0, 0, 0.7)',
      '--shadow-lg': '0 20px 60px rgba(0, 0, 0, 0.8)',
      '--shadow-glow': '0 0 24px rgba(129, 140, 248, 0.2)',
    },
    bodyBg: '#000000',
    bodyGradient: 'none',
    isLight: false,
  },

  purple: {
    id: 'purple',
    name: 'Deep Purple',
    preview: { bg: '#1a0a2e', accent: '#c084fc', text: '#f5f0ff' },
    vars: {
      '--bg-primary': '#1a0a2e',
      '--bg-secondary': '#120720',
      '--bg-card': '#2d1548',
      '--bg-card-hover': '#3d1f62',
      '--bg-input': '#150a28',
      '--border-color': 'rgba(192, 132, 252, 0.15)',
      '--border-light': 'rgba(192, 132, 252, 0.08)',
      '--border-active': '#c084fc',
      '--text-primary': '#f5f0ff',
      '--text-secondary': '#c4b5e0',
      '--text-muted': '#8b72b0',
      '--accent-primary': '#C084FC',
      '--accent-secondary': '#D8B4FE',
      '--accent-glow': 'rgba(192, 132, 252, 0.25)',
      '--success': '#4ADE80',
      '--warning': '#FBBF24',
      '--danger': '#FB7185',
      '--info': '#67E8F9',
      '--gradient-primary': 'linear-gradient(135deg, #a855f7, #c084fc, #d8b4fe)',
      '--gradient-dark': 'linear-gradient(180deg, #1a0a2e 0%, #120720 100%)',
      '--shadow-sm': '0 2px 12px rgba(0, 0, 0, 0.4)',
      '--shadow-md': '0 8px 32px rgba(0, 0, 0, 0.5)',
      '--shadow-lg': '0 20px 60px rgba(0, 0, 0, 0.6)',
      '--shadow-glow': '0 0 24px rgba(192, 132, 252, 0.2)',
    },
    bodyBg: '#1a0a2e',
    bodyGradient: `
      radial-gradient(ellipse at 15% 0%, rgba(147, 51, 234, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 85% 100%, rgba(192, 132, 252, 0.1) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(26, 10, 46, 1) 0%, #120720 100%)
    `,
    isLight: false,
  },

  light: {
    id: 'light',
    name: 'Arctic Light',
    preview: { bg: '#f8fafc', accent: '#7c3aed', text: '#0f172a' },
    vars: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f1f5f9',
      '--bg-card': '#ffffff',
      '--bg-card-hover': '#f1f5f9',
      '--bg-input': '#f1f5f9',
      '--border-color': 'rgba(124, 58, 237, 0.4)',
      '--border-light': 'rgba(124, 58, 237, 0.15)',
      '--border-active': '#7c3aed',
      '--text-primary': '#000000',
      '--text-secondary': '#1e293b',
      '--text-muted': '#475569',
      '--accent-primary': '#7C3AED',
      '--accent-secondary': '#8B5CF6',
      '--accent-glow': 'rgba(124, 58, 237, 0.2)',
      '--success': '#16A34A',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--info': '#0284C7',
      '--gradient-primary': 'linear-gradient(135deg, #7c3aed, #8b5cf6, #a78bfa)',
      '--gradient-dark': 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
      '--shadow-sm': '0 2px 8px rgba(124, 58, 237, 0.15)',
      '--shadow-md': '0 4px 16px rgba(124, 58, 237, 0.2)',
      '--shadow-lg': '0 12px 40px rgba(124, 58, 237, 0.25)',
      '--shadow-glow': '0 0 20px rgba(124, 58, 237, 0.25)',
    },
    bodyBg: '#f1f5f9',
    bodyGradient: `
      radial-gradient(ellipse at 15% 0%, rgba(124, 58, 237, 0.05) 0%, transparent 50%),
      radial-gradient(ellipse at 85% 100%, rgba(124, 58, 237, 0.03) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 1) 0%, #f1f5f9 100%)
    `,
    isLight: true,
  },
};

export const THEME_ORDER = ['midnight', 'black', 'purple', 'light'];

const STORAGE_KEY = 'navx_admin_theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved && THEMES[saved] ? saved : 'midnight';
    } catch {
      return 'midnight';
    }
  });

  const applyTheme = useCallback((id) => {
    const theme = THEMES[id];
    if (!theme) return;

    const root = document.documentElement;

    Object.entries(theme.vars).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });

    root.setAttribute('data-theme', id);

    document.body.style.background = theme.bodyBg;
    document.body.style.backgroundImage = theme.bodyGradient;
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.color = theme.vars['--text-primary'];
  }, []);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId, applyTheme]);

  const switchTheme = useCallback((id) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ themeId, switchTheme, theme: THEMES[themeId] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { themeId: 'midnight', switchTheme: () => {}, theme: THEMES.midnight };
  }
  return ctx;
}
