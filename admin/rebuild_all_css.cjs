const fs = require('fs');
const { execSync } = require('child_process');

// 1. Get base CSS from git history (before any corruption/truncation)
let baseCSS = execSync('git show 3bd9511', { maxBuffer: 10 * 1024 * 1024 }).toString('utf8');

// 2. Remove any duplicate tooltips block at the end of baseCSS
const tooltipIdx = baseCSS.indexOf('/* Collapsed sidebar tooltips */');
if (tooltipIdx > -1) {
  baseCSS = baseCSS.substring(0, tooltipIdx);
}

// 3. Clean up hardcoded dark colors in base CSS so CSS variables take effect
baseCSS = baseCSS.replace(/rgba\(13, 21, \d+, [\d.]+\)/g, 'var(--bg-card)');
baseCSS = baseCSS.replace(/rgba\(8, 14, \d+, [\d.]+\)/g, 'var(--bg-primary)');
baseCSS = baseCSS.replace(/rgba\(99, 102, 241, 0\.15\)/g, 'var(--border-color)');
baseCSS = baseCSS.replace(/background: linear-gradient\(180deg, rgba\(8, 12, 28, [\d.]+\) 0%, rgba\(6, 10, 20, [\d.]+\) 100%\);/g, 'background: var(--gradient-dark);');
baseCSS = baseCSS.replace(/background: linear-gradient\(180deg, rgba\(8, 12, 24, [\d.]+\) 0%, rgba\(6, 10, 20, [\d.]+\) 100%\);/g, 'background: var(--gradient-dark);');
baseCSS = baseCSS.replace(/background: rgba\(8, 12, 24, [\d.]+\) !important;/g, 'background: var(--bg-card) !important;');

// 4. Read the light theme definitions from temp_light_theme.css
const lightThemeCSS = fs.readFileSync('temp_light_theme.css', 'utf8');

// 5. Build comprehensive Dashboard + Light Theme + User requirement fixes
const comprehensiveCSS = `
/* ═══════════════════════════════════════════════════════════════════════
   Dashboard Landing Overhaul (Unstop Style)
   ═══════════════════════════════════════════════════════════════════════ */

.dashboard-landing {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px 32px 60px;
  width: 100%;
}

/* Hero Section */
.hero-section {
  text-align: center;
  padding: 16px 20px 20px;
}

.hero-title {
  font-size: 46px;
  font-weight: 900;
  margin-bottom: 12px;
  letter-spacing: -1px;
  color: var(--text-primary);
  line-height: 1.2;
}

.hero-title .text-primary {
  color: var(--accent-primary, #6366f1);
}

.hero-subtitle {
  font-size: 17px;
  color: var(--text-secondary);
  margin-bottom: 36px;
}

/* Quick Links Row */
.quick-links-scroll {
  display: flex;
  gap: 20px;
  overflow-x: auto;
  padding: 10px 4px 20px;
  justify-content: center;
  flex-wrap: wrap;
}

.quick-link-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  min-width: 125px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
}

.quick-link-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(124, 58, 237, 0.25);
  border-color: rgba(124, 58, 237, 0.4);
}

.quick-link-card span {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}

.quick-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.quick-icon-wrapper.venues { color: #3b82f6; background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.2); }
.quick-icon-wrapper.campaigns { color: #ec4899; background: rgba(236, 72, 153, 0.12); border-color: rgba(236, 72, 153, 0.2); }
.quick-icon-wrapper.faculty { color: #10b981; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.2); }
.quick-icon-wrapper.timetable { color: #f59e0b; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.2); }
.quick-icon-wrapper.reports { color: #8b5cf6; background: rgba(139, 92, 246, 0.12); border-color: rgba(139, 92, 246, 0.2); }
.quick-icon-wrapper.spatial { color: #06b6d4; background: rgba(6, 182, 212, 0.12); border-color: rgba(6, 182, 212, 0.2); }

/* Featured Section */
.featured-section {
  margin-top: 12px;
}

.section-title {
  font-size: 24px;
  font-weight: 800;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.title-marker {
  color: var(--accent-primary, #6366f1);
  font-weight: 900;
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  padding-bottom: 20px;
}

.featured-card {
  height: 380px;
  border-radius: 22px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  border: 1px solid var(--border-color);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.featured-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 40px rgba(124, 58, 237, 0.25);
}

.featured-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ═══════════════════════════════════════════════════════════════════════
   Sidebar Toggle Adjustments:
   - When OPEN: toggle sits inside the sidebar (right: 15px)
   - When COLLAPSED: toggle sits outside the sidebar (right: -15px)
   ═══════════════════════════════════════════════════════════════════════ */
.sidebar-toggle {
  position: absolute;
  right: 15px;
  top: 36px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-toggle:hover {
  background: var(--accent-primary, #6366f1);
  color: #fff;
  border-color: var(--accent-primary, #6366f1);
}

.campus-sidebar.collapsed .sidebar-toggle {
  right: -15px !important;
  margin: 0 !important;
}

/* Make nav links pill-shaped */
.sidebar-nav-link {
  border-radius: 99px !important;
}

/* ═══════════════════════════════════════════════════════════════════════
   LIGHT THEME OVERRIDES — ARCTIC LIGHT (USER REQUEST SPECIFIC)
   - White Sidebar & Topbar with purple borders
   - Boxes with purple shadows & complete black text
   - Buttons with purple shadows & dark black text
   - Table / Faculty text completely visible & dark
   - Spatial Studio and dashboards completely theme-aware
   ═══════════════════════════════════════════════════════════════════════ */

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-card: #ffffff;
  --bg-card-hover: #f1f5f9;
  --bg-input: #f8fafc;
  --border-color: rgba(124, 58, 237, 0.25);
  --border-light: rgba(124, 58, 237, 0.12);
  --border-active: #7c3aed;
  --text-primary: #000000;
  --text-secondary: #1e293b;
  --text-muted: #475569;
  --shadow-sm: 0 4px 14px rgba(124, 58, 237, 0.12);
  --shadow-md: 0 8px 25px rgba(124, 58, 237, 0.18);
  --shadow-lg: 0 16px 40px rgba(124, 58, 237, 0.22);
}

[data-theme="light"] body {
  background: #f8fafc !important;
  background-image:
    radial-gradient(ellipse at 15% 0%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 85% 100%, rgba(139, 92, 246, 0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 1) 0%, #f8fafc 100%) !important;
  color: #000000 !important;
}

/* Light theme Sidebar */
[data-theme="light"] .campus-sidebar {
  background: #ffffff !important;
  border-right: 1px solid rgba(124, 58, 237, 0.18) !important;
  box-shadow: 4px 0 20px rgba(124, 58, 237, 0.08) !important;
}

[data-theme="light"] .campus-sidebar::before {
  background: linear-gradient(180deg, rgba(124, 58, 237, 0.04), transparent) !important;
}

[data-theme="light"] .sidebar-header {
  border-bottom: 1px solid rgba(124, 58, 237, 0.12) !important;
}

[data-theme="light"] .sidebar-title {
  color: #000000 !important;
  font-weight: 800 !important;
}

[data-theme="light"] .sidebar-subtitle {
  color: #475569 !important;
}

[data-theme="light"] .sidebar-section-label {
  color: #64748b !important;
  font-weight: 800 !important;
  letter-spacing: 1.2px !important;
}

[data-theme="light"] .sidebar-nav-link {
  color: #1e293b !important;
  font-weight: 600 !important;
}

[data-theme="light"] .sidebar-nav-link:hover {
  background: rgba(124, 58, 237, 0.08) !important;
  color: #000000 !important;
}

[data-theme="light"] .sidebar-nav-link.active {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%) !important;
  color: #6d28d9 !important;
  border: 1px solid rgba(124, 58, 237, 0.3) !important;
  box-shadow: 0 2px 10px rgba(124, 58, 237, 0.12) !important;
}

[data-theme="light"] .sidebar-nav-link.active::before {
  background: #7c3aed !important;
}

[data-theme="light"] .sidebar-user {
  background: rgba(124, 58, 237, 0.05) !important;
  border: 1px solid rgba(124, 58, 237, 0.18) !important;
}

[data-theme="light"] .sidebar-username {
  color: #000000 !important;
  font-weight: 700 !important;
}

[data-theme="light"] .sidebar-user-role {
  color: #6d28d9 !important;
  font-weight: 700 !important;
}

[data-theme="light"] .sidebar-toggle {
  background: #ffffff !important;
  color: #000000 !important;
  border: 1px solid rgba(124, 58, 237, 0.35) !important;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.2) !important;
}

[data-theme="light"] .sidebar-toggle:hover {
  background: #f5f3ff !important;
  color: #7c3aed !important;
  border-color: #7c3aed !important;
}

/* Light theme Top Bar */
[data-theme="light"] .top-bar {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(16px) !important;
  border-bottom: 1px solid rgba(124, 58, 237, 0.15) !important;
  box-shadow: 0 2px 12px rgba(124, 58, 237, 0.06) !important;
}

[data-theme="light"] .top-bar .breadcrumb {
  color: #475569 !important;
  font-weight: 600 !important;
}

[data-theme="light"] .top-bar .breadcrumb.active {
  color: #000000 !important;
  font-weight: 800 !important;
}

[data-theme="light"] .top-bar .breadcrumb-sep {
  color: #94a3b8 !important;
}

/* Light theme Box Overrides: PURPLE SHADOWS & PURE BLACK TEXT */
[data-theme="light"] .card,
[data-theme="light"] .stat-card,
[data-theme="light"] .quick-link-card,
[data-theme="light"] .featured-card,
[data-theme="light"] .admin-item,
[data-theme="light"] .venue-card,
[data-theme="light"] .table-container,
[data-theme="light"] .venues-table-container,
[data-theme="light"] .modal-content,
[data-theme="light"] .modal-box {
  background: #ffffff !important;
  color: #000000 !important;
  border: 1px solid rgba(124, 58, 237, 0.25) !important;
  box-shadow: 0 4px 20px rgba(124, 58, 237, 0.15) !important;
}

[data-theme="light"] .card:hover,
[data-theme="light"] .stat-card:hover,
[data-theme="light"] .quick-link-card:hover,
[data-theme="light"] .featured-card:hover {
  box-shadow: 0 10px 30px rgba(124, 58, 237, 0.25) !important;
  border-color: rgba(124, 58, 237, 0.45) !important;
}

/* Headings & Texts in Light Theme: COMPLETE BLACK */
[data-theme="light"] h1,
[data-theme="light"] h2,
[data-theme="light"] h3,
[data-theme="light"] h4,
[data-theme="light"] h5,
[data-theme="light"] h6,
[data-theme="light"] .hero-title,
[data-theme="light"] .section-title,
[data-theme="light"] .page-title,
[data-theme="light"] .card-title,
[data-theme="light"] .stat-value,
[data-theme="light"] .quick-link-card span,
[data-theme="light"] .venues-section h2,
[data-theme="light"] label {
  color: #000000 !important;
}

[data-theme="light"] .hero-subtitle,
[data-theme="light"] .page-subtitle,
[data-theme="light"] .stat-label {
  color: #334155 !important;
  font-weight: 600;
}

/* Button Overrides in Light Theme: PURPLE SHADOWS & DARK BLACK TEXT */
[data-theme="light"] button:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn),
[data-theme="light"] .btn:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn) {
  color: #000000 !important;
  font-weight: 700 !important;
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.22) !important;
  border: 1px solid rgba(124, 58, 237, 0.35) !important;
}

[data-theme="light"] button:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn) svg,
[data-theme="light"] .btn:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn) svg {
  color: #000000 !important;
}

[data-theme="light"] button:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn):hover,
[data-theme="light"] .btn:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn):hover {
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.32) !important;
  border-color: rgba(124, 58, 237, 0.5) !important;
}

[data-theme="light"] .btn-primary {
  background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%) !important;
  color: #000000 !important;
  border: 1px solid rgba(124, 58, 237, 0.4) !important;
}

[data-theme="light"] .btn-primary:hover {
  background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%) !important;
}

[data-theme="light"] .btn-secondary,
[data-theme="light"] .btn-outline {
  background: #ffffff !important;
  color: #000000 !important;
}

/* Faculty & Management Tables in Light Theme: DARK VISIBLE TEXT */
[data-theme="light"] .venues-table,
[data-theme="light"] table {
  background: #ffffff !important;
  color: #000000 !important;
  border: 1px solid rgba(124, 58, 237, 0.2) !important;
  box-shadow: 0 4px 20px rgba(124, 58, 237, 0.12) !important;
}

[data-theme="light"] .venues-table th,
[data-theme="light"] table th {
  background: #f1f5f9 !important;
  color: #000000 !important;
  font-weight: 800 !important;
  border-bottom: 2px solid rgba(124, 58, 237, 0.2) !important;
}

[data-theme="light"] .venues-table td,
[data-theme="light"] table td {
  color: #000000 !important;
  font-weight: 500 !important;
  border-bottom: 1px solid rgba(124, 58, 237, 0.1) !important;
}

[data-theme="light"] .venues-table tr:hover,
[data-theme="light"] table tr:hover {
  background: rgba(124, 58, 237, 0.04) !important;
}

[data-theme="light"] input,
[data-theme="light"] select,
[data-theme="light"] textarea {
  background: #ffffff !important;
  color: #000000 !important;
  border: 1px solid rgba(124, 58, 237, 0.3) !important;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.08) !important;
}

[data-theme="light"] input:focus,
[data-theme="light"] select:focus,
[data-theme="light"] textarea:focus {
  border-color: #7c3aed !important;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2) !important;
}

/* Spatial Studio light theme overrides */
[data-theme="light"] .spatial-studio-container,
[data-theme="light"] header {
  background-color: #ffffff !important;
  color: #000000 !important;
  border-color: rgba(124, 58, 237, 0.2) !important;
}

[data-theme="light"] select option {
  background: #ffffff !important;
  color: #000000 !important;
}

[data-theme="light"] .staging-tray-container {
  background: #ffffff !important;
  color: #000000 !important;
  border-color: rgba(124, 58, 237, 0.25) !important;
  box-shadow: -4px 0 20px rgba(124, 58, 237, 0.1) !important;
}

[data-theme="light"] .staging-tray-container > div:first-child {
  background: #f8fafc !important;
  border-bottom: 1px solid rgba(124, 58, 237, 0.2) !important;
}

[data-theme="light"] .staging-tray-container h3,
[data-theme="light"] .staging-tray-container p,
[data-theme="light"] .staging-tray-container span:not([class*="bg-"]),
[data-theme="light"] .staging-tray-container button {
  color: #000000 !important;
}
`;

// 6. Assemble everything
const fullCSS = baseCSS + '\n' + lightThemeCSS + '\n' + comprehensiveCSS;

fs.writeFileSync('src/index.css', fullCSS, 'utf8');
console.log('Successfully wrote complete index.css! Total lines:', fullCSS.split('\n').length);
