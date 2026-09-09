const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

const additionalCSS = `
/* ═══════════════════════════════════════════════════════════════════════
   Dashboard Landing Overhaul
   ═══════════════════════════════════════════════════════════════════════ */

.dashboard-landing {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Hero Section */
.hero-section {
  text-align: center;
  padding: 40px 20px 20px;
}

.hero-title {
  font-size: 48px;
  font-weight: 900;
  margin-bottom: 12px;
  letter-spacing: -1px;
}

.text-primary {
  color: var(--primary-color, #6366f1);
}

.hero-subtitle {
  font-size: 18px;
  color: var(--text-secondary);
  margin-bottom: 40px;
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
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  min-width: 120px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.quick-link-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.4);
}

.quick-link-card span {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.quick-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.1);
}

/* Specific colors for icons */
.quick-icon-wrapper.venues { color: #60a5fa; background: rgba(96, 165, 250, 0.1); }
.quick-icon-wrapper.campaigns { color: #f472b6; background: rgba(244, 114, 182, 0.1); }
.quick-icon-wrapper.faculty { color: #34d399; background: rgba(52, 211, 153, 0.1); }
.quick-icon-wrapper.timetable { color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
.quick-icon-wrapper.reports { color: #a78bfa; background: rgba(167, 139, 250, 0.1); }
.quick-icon-wrapper.spatial { color: #38bdf8; background: rgba(56, 189, 248, 0.1); }

/* Featured Section */
.featured-section {
  margin-top: 16px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-marker {
  color: var(--primary-color, #6366f1);
  font-weight: 900;
}

.featured-grid {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  padding-bottom: 20px;
}

.featured-card {
  min-width: 280px;
  width: 280px;
  height: 380px;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  border: 1px solid var(--border-color);
  transition: transform 0.3s ease;
  flex-shrink: 0;
}

.featured-card:hover {
  transform: scale(1.02);
}

.featured-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Sidebar Toggle Adjustments to match reference "<<" */
.sidebar-toggle {
  position: absolute;
  right: -15px;
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
  transition: all 0.2s ease;
}

.sidebar-toggle:hover {
  background: var(--primary-color, #6366f1);
  color: #fff;
  border-color: var(--primary-color, #6366f1);
}

/* Make nav links look more like pills */
.sidebar-nav-link {
  border-radius: 99px !important;
}

/* ═══════════════════════════════════════════════════════════════════════
   Light Theme Fixes for new components
   ═══════════════════════════════════════════════════════════════════════ */
[data-theme="light"] .hero-title,
[data-theme="light"] .section-title,
[data-theme="light"] .venues-section h2 {
  color: #000000 !important;
}

[data-theme="light"] .quick-link-card {
  background: #ffffff !important;
  border-color: rgba(99, 102, 241, 0.15);
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.08);
}

[data-theme="light"] .quick-link-card span {
  color: #0f172a !important;
}

[data-theme="light"] .quick-link-card:hover {
  box-shadow: 0 8px 30px rgba(139, 92, 246, 0.15);
}

[data-theme="light"] .featured-card {
  box-shadow: 0 10px 30px rgba(139, 92, 246, 0.1);
  border-color: rgba(99, 102, 241, 0.15);
}

[data-theme="light"] .sidebar-toggle {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: rgba(99, 102, 241, 0.2);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
[data-theme="light"] .sidebar-toggle:hover {
  background: #f1f5f9 !important;
}
`;

fs.appendFileSync('src/index.css', '\n' + additionalCSS, 'utf8');
console.log('Appended dashboard CSS');
