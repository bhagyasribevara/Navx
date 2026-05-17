import axios from 'axios';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── API Configuration ──────────────────────────────────────────────────
let devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
if (Constants?.expoConfig?.hostUri) {
  devHost = Constants.expoConfig.hostUri.split(':')[0];
}
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${devHost}:5001/api`;

// ─── Weather Cache ──────────────────────────────────────────────────────
let weatherCache = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Location Service ───────────────────────────────────────────────────
export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('LOCATION_DENIED');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    timeout: 10000,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

// ─── Weather API ────────────────────────────────────────────────────────
export async function fetchWeatherData(latitude, longitude) {
  // Check cache first
  if (weatherCache && Date.now() - weatherCache.timestamp < CACHE_TTL) {
    return { ...weatherCache.data, cached: true };
  }

  try {
    const response = await axios.get(`${API_BASE}/weather`, {
      params: { lat: latitude, lon: longitude },
      timeout: 10000,
    });

    const data = response.data;

    // Update cache
    weatherCache = {
      data,
      timestamp: Date.now(),
    };

    return data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API_ERROR_${error.response.status}`);
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('TIMEOUT');
    }
    throw new Error('NETWORK_ERROR');
  }
}

// ─── Combined: Get Location + Weather ───────────────────────────────────
export async function getWeatherForCurrentLocation() {
  const location = await getCurrentLocation();
  const weather = await fetchWeatherData(location.latitude, location.longitude);
  return weather;
}

// ─── Weather Condition Mapping (Matched to reference design) ────────────
export function getWeatherTheme(weatherType) {
  const themes = {
    // ☀ SUNNY — Deep navy top → warm golden/amber bottom (reference col 1)
    sunny: {
      gradientColors: ['#0B1A3B', '#1A2A5C', '#3D2E0A', '#B8860B', '#DAA520'],
      gradientStart: { x: 0.5, y: 0 },
      gradientEnd: { x: 0.5, y: 1 },
      particleColor: '#FFD700',
      particleColor2: '#FFA500',
      glowColor: 'rgba(218,165,32,0.25)',
      cardBg: 'rgba(0,0,0,0.25)',
      cardBorder: 'rgba(255,255,255,0.15)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.75)',
      textMuted: 'rgba(255,255,255,0.50)',
      iconTint: 'rgba(255,255,255,0.7)',
      liveDotColor: '#4ade80',
      liveBadgeBg: 'rgba(255,255,255,0.15)',
      closeBtnBg: 'rgba(255,255,255,0.12)',
      dividerColor: 'rgba(255,255,255,0.10)',
      label: 'Sunny',
      sublabel: 'Clear sky with sunlight',
      emoji: '☀️',
    },
    // 🌧 RAINY — Dark slate blue throughout, moody blue-purple (reference col 2)
    rain: {
      gradientColors: ['#0D1B2A', '#1B2838', '#1A2744', '#243B55', '#2D3A4A'],
      gradientStart: { x: 0.5, y: 0 },
      gradientEnd: { x: 0.5, y: 1 },
      particleColor: '#7EB8E0',
      particleColor2: '#5B9BD5',
      glowColor: 'rgba(91,155,213,0.15)',
      cardBg: 'rgba(0,0,0,0.28)',
      cardBorder: 'rgba(255,255,255,0.12)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.72)',
      textMuted: 'rgba(255,255,255,0.45)',
      iconTint: 'rgba(255,255,255,0.65)',
      liveDotColor: '#4ade80',
      liveBadgeBg: 'rgba(255,255,255,0.12)',
      closeBtnBg: 'rgba(255,255,255,0.10)',
      dividerColor: 'rgba(255,255,255,0.08)',
      label: 'Rainy',
      sublabel: 'Light rain showers',
      emoji: '🌧️',
    },
    // ☁ CLOUDY — Medium gray-blue, soft neutral tones (reference col 3)
    cloudy: {
      gradientColors: ['#3A4556', '#4A5A6E', '#5C6E82', '#6E8096', '#7A8FA3'],
      gradientStart: { x: 0.5, y: 0 },
      gradientEnd: { x: 0.5, y: 1 },
      particleColor: '#C8D6E5',
      particleColor2: '#DFE6ED',
      glowColor: 'rgba(200,214,229,0.12)',
      cardBg: 'rgba(0,0,0,0.22)',
      cardBorder: 'rgba(255,255,255,0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.78)',
      textMuted: 'rgba(255,255,255,0.50)',
      iconTint: 'rgba(255,255,255,0.7)',
      liveDotColor: '#4ade80',
      liveBadgeBg: 'rgba(255,255,255,0.15)',
      closeBtnBg: 'rgba(255,255,255,0.12)',
      dividerColor: 'rgba(255,255,255,0.10)',
      label: 'Cloudy',
      sublabel: 'Mostly cloudy',
      emoji: '☁️',
    },
    // ❄ COOL — Frosted winter landscape with photo background
    cool: {
      gradientColors: ['#B0D4F1', '#C6E2F7', '#D8EDF9', '#E6F3FC', '#F0F8FF'],
      gradientStart: { x: 0.5, y: 0 },
      gradientEnd: { x: 0.5, y: 1 },
      particleColor: '#FFFFFF',
      particleColor2: '#D6EAF8',
      glowColor: 'rgba(176,212,241,0.20)',
      cardBg: 'rgba(0,0,0,0.22)',
      cardBorder: 'rgba(255,255,255,0.18)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.82)',
      textMuted: 'rgba(255,255,255,0.55)',
      iconTint: 'rgba(255,255,255,0.70)',
      liveDotColor: '#22c55e',
      liveBadgeBg: 'rgba(255,255,255,0.15)',
      closeBtnBg: 'rgba(0,0,0,0.20)',
      dividerColor: 'rgba(255,255,255,0.15)',
      label: 'Cool',
      sublabel: 'Cool breeze',
      emoji: '❄️',
    },
    // ⛈ STORM — Very dark purple-black, electric purple glow (reference col 5)
    storm: {
      gradientColors: ['#0A0515', '#120A28', '#1A0E3E', '#1E1245', '#28184E'],
      gradientStart: { x: 0.5, y: 0 },
      gradientEnd: { x: 0.5, y: 1 },
      particleColor: '#B266FF',
      particleColor2: '#E040FB',
      glowColor: 'rgba(178,102,255,0.18)',
      cardBg: 'rgba(0,0,0,0.30)',
      cardBorder: 'rgba(178,102,255,0.20)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.72)',
      textMuted: 'rgba(255,255,255,0.42)',
      iconTint: 'rgba(255,255,255,0.65)',
      liveDotColor: '#a78bfa',
      liveBadgeBg: 'rgba(178,102,255,0.18)',
      closeBtnBg: 'rgba(255,255,255,0.08)',
      dividerColor: 'rgba(178,102,255,0.15)',
      label: 'Thunderstorm',
      sublabel: 'Heavy thunderstorm',
      emoji: '⛈️',
    },
    // ❄ SNOW — Winter snowfall with photo background
    snow: {
      gradientColors: ['#C5D5E8', '#D4E3F1', '#E2EEF7', '#EDF5FB', '#F5FAFF'],
      gradientStart: { x: 0.5, y: 0 },
      gradientEnd: { x: 0.5, y: 1 },
      particleColor: '#FFFFFF',
      particleColor2: '#E8EAF6',
      glowColor: 'rgba(200,220,240,0.20)',
      cardBg: 'rgba(0,0,0,0.22)',
      cardBorder: 'rgba(255,255,255,0.18)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.80)',
      textMuted: 'rgba(255,255,255,0.50)',
      iconTint: 'rgba(255,255,255,0.68)',
      liveDotColor: '#22c55e',
      liveBadgeBg: 'rgba(255,255,255,0.15)',
      closeBtnBg: 'rgba(0,0,0,0.20)',
      dividerColor: 'rgba(255,255,255,0.15)',
      label: 'Snow',
      sublabel: 'Snowfall',
      emoji: '❄️',
    },
  };

  return themes[weatherType] || themes.sunny;
}

// ─── UV Index Estimation ────────────────────────────────────────────────
export function estimateUVIndex(weatherType, clouds) {
  const hour = new Date().getHours();
  const isDaytime = hour >= 6 && hour <= 18;
  if (!isDaytime) return { value: 0, label: 'None' };

  // Peak UV around noon
  const peakFactor = 1 - Math.abs(hour - 12) / 6;
  let baseUV = 8 * peakFactor;

  // Adjust by weather
  if (weatherType === 'rain' || weatherType === 'storm') baseUV *= 0.2;
  else if (weatherType === 'cloudy') baseUV *= 0.5;
  else if (weatherType === 'snow' || weatherType === 'cool') baseUV *= 0.35;

  // Adjust by cloud cover
  baseUV *= (1 - (clouds || 0) / 200);

  const uv = Math.max(0, Math.round(baseUV));
  let label = 'Low';
  if (uv >= 3 && uv < 6) label = 'Moderate';
  else if (uv >= 6 && uv < 8) label = 'High';
  else if (uv >= 8 && uv < 11) label = 'Very High';
  else if (uv >= 11) label = 'Extreme';

  return { value: uv, label };
}

// ─── Weather Icon URL ───────────────────────────────────────────────────
export function getWeatherIconUrl(iconCode) {
  return `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
}

// ─── Clear Cache (for testing/refresh) ──────────────────────────────────
export function clearWeatherCache() {
  weatherCache = null;
}
