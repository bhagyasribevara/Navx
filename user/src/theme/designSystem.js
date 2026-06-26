// NavX Design System — Centralized tokens for consistency

export const DARK = {
  bg: "#0f172a",
  bgGradient: ["#0f172a", "#1e293b"],
  card: "#1e293b",
  cardElevated: "#334155",
  surface: "#1e293b",
  glass: "rgba(15,23,42,0.85)",
  primary: "#a855f7",
  primaryLight: "#c084fc",
  primaryDark: "#9333ea",
  primaryGlow: "rgba(168,85,247,0.25)",
  secondary: "#e879f9",
  accent: "#22c55e",
  accentLight: "#4ade80",
  accentGlow: "rgba(34,197,94,0.2)",
  text: "#f8fafc",
  textSec: "#cbd5e1",
  textMuted: "#64748b",
  textHighlight: "#ffffff",
  border: "#334155",
  borderLight: "#475569",
  danger: "#ef4444",
  dangerLight: "#fca5a5",
  warning: "#f59e0b",
  warningLight: "#fcd34d",
  info: "#38bdf8",
  mapBg: "#0f172a",
  mapGrid: "#1e293b",
};

export const LIGHT = {
  bg: "#ffffff",
  bgGradient: ["#ffffff", "#f8fafc"],
  card: "#ffffff",
  cardElevated: "#ffffff",
  surface: "#f8fafc",
  glass: "rgba(255,255,255,0.9)",
  primary: "#8b5cf6",
  primaryLight: "#a855f7",
  primaryDark: "#7c3aed",
  primaryGlow: "rgba(139,92,246,0.15)",
  secondary: "#d946ef",
  accent: "#16a34a",
  accentLight: "#22c55e",
  accentGlow: "rgba(22,163,74,0.15)",
  text: "#0f172a",
  textSec: "#475569",
  textMuted: "#94a3b8",
  textHighlight: "#000000",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  danger: "#dc2626",
  dangerLight: "#fca5a5",
  warning: "#d97706",
  warningLight: "#fcd34d",
  info: "#0284c7",
  mapBg: "#f8fafc",
  mapGrid: "#e2e8f0",
};

export const ROOM_COLORS = {
  // Campus
  classroom: "#3b82f6", office: "#8b5cf6", lab: "#22c55e", restroom: "#f59e0b",
  cafeteria: "#ef4444", library: "#06b6d4", auditorium: "#ec4899",
  elevator: "#6366f1", stairs: "#f97316", corridor: "#64748b80",
  entrance: "#10b981", exit: "#ef4444", bus_stop: "#14b8a6", other: "#94a3b8",
  // Hospital
  ward: "#3b82f6", icu: "#ef4444", ot: "#dc2626", pharmacy: "#22c55e",
  reception: "#8b5cf6", emergency: "#ef4444", radiology: "#f59e0b",
  pathology: "#06b6d4", blood_bank: "#dc2626", consultation: "#6366f1",
  waiting_area: "#94a3b8", nursing_station: "#ec4899",
  // Airport
  gate: "#3b82f6", terminal: "#6366f1", check_in: "#22c55e",
  security: "#ef4444", lounge: "#8b5cf6", baggage_claim: "#f59e0b",
  immigration: "#f97316", duty_free: "#ec4899", boarding: "#06b6d4", customs: "#64748b",
  // Mall
  store: "#3b82f6", food_court: "#ef4444", anchor_store: "#6366f1",
  kiosk: "#f59e0b", parking: "#64748b", entertainment: "#ec4899",
  atm: "#22c55e", customer_service: "#8b5cf6", fitting_room: "#94a3b8",
  // Building
  conference: "#3b82f6", server_room: "#ef4444", lobby: "#6366f1",
  mail_room: "#f59e0b", gym: "#22c55e", rooftop: "#06b6d4",
  storage: "#64748b", utility: "#94a3b8", break_room: "#ec4899", reception_desk: "#8b5cf6",
};

export const ROOM_ICONS = {
  // Campus
  classroom: "school", office: "business", lab: "flask", restroom: "water",
  cafeteria: "restaurant", library: "library", auditorium: "megaphone",
  elevator: "arrow-up", stairs: "trending-up", corridor: "walk",
  entrance: "enter", exit: "exit", bus_stop: "bus", other: "location",
  // Hospital
  ward: "bed", icu: "pulse", ot: "medkit", pharmacy: "medkit",
  reception: "information-circle", emergency: "alert-circle", radiology: "scan",
  pathology: "analytics", blood_bank: "water", consultation: "chatbubbles",
  waiting_area: "time", nursing_station: "people",
  // Airport
  gate: "airplane", terminal: "business", check_in: "checkmark-circle",
  security: "shield-checkmark", lounge: "cafe", baggage_claim: "briefcase",
  immigration: "document-text", duty_free: "bag-handle", boarding: "log-in", customs: "shield",
  // Mall
  store: "storefront", food_court: "fast-food", anchor_store: "pricetag",
  kiosk: "newspaper", parking: "car", entertainment: "game-controller",
  atm: "card", customer_service: "headset", fitting_room: "shirt",
  // Building
  conference: "people", server_room: "server", lobby: "home",
  mail_room: "mail", gym: "fitness", rooftop: "sunny",
  storage: "cube", utility: "construct", break_room: "cafe", reception_desk: "desktop",
};

export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  primary: (color = "#6366f1") => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  }),
};

export const RADIUS = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
};

export const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  h2: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: "700" },
  h4: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: "600" },
  caption: { fontSize: 12, fontWeight: "500" },
  overline: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  label: { fontSize: 13, fontWeight: "600" },
};

export const QUICK_ACTIONS = [
  { icon: "navigate", label: "Navigate", color: "#6366f1", bg: "#6366f115", screen: "Search" },
  { icon: "people", label: "Live Meet", color: "#ec4899", bg: "#ec489915", screen: "MeetModal" },
  { icon: "qr-code", label: "Scan QR", color: "#22c55e", bg: "#22c55e15", screen: "QRScan" },
  { icon: "map", label: "Open Map", color: "#3b82f6", bg: "#3b82f615", screen: "Map" },
];
