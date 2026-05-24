import axios from 'axios';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── API Configuration ──────────────────────────────────────────────────
let devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
if (Constants?.expoConfig?.hostUri) {
  devHost = Constants.expoConfig.hostUri.split(':')[0];
}
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${devHost}:5000/api`;

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

function mapWMOCode(code) {
  if (code === 0) return { condition: 'Clear', icon: '01d', type: 'sunny' };
  if (code === 1 || code === 2) return { condition: 'Partly Cloudy', icon: '02d', type: 'cloudy' };
  if (code === 3) return { condition: 'Overcast', icon: '04d', type: 'cloudy' };
  if (code === 45 || code === 48) return { condition: 'Fog', icon: '50d', type: 'cloudy' };
  if (code >= 51 && code <= 67) return { condition: 'Rain', icon: '10d', type: 'rain' };
  if (code >= 71 && code <= 77) return { condition: 'Snow', icon: '13d', type: 'snow' };
  if (code >= 80 && code <= 82) return { condition: 'Showers', icon: '09d', type: 'rain' };
  if (code >= 85 && code <= 86) return { condition: 'Snow Showers', icon: '13d', type: 'snow' };
  if (code >= 95) return { condition: 'Thunderstorm', icon: '11d', type: 'storm' };
  return { condition: 'Clear', icon: '01d', type: 'sunny' };
}

export async function fetchForecastData(latitude, longitude) {
  try {
    const response = await axios.get(`https://api.open-meteo.com/v1/forecast`, {
      params: {
        latitude: latitude,
        longitude: longitude,
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        timezone: 'auto'
      },
      timeout: 10000,
    });
    
    const daily = response.data.daily;
    const forecast = [];
    
    for (let i = 0; i < 5; i++) {
      const dateObj = new Date(daily.time[i]);
      const mapped = mapWMOCode(daily.weather_code[i]);
      forecast.push({
        id: daily.time[i],
        dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        tempMin: Math.round(daily.temperature_2m_min[i]),
        tempMax: Math.round(daily.temperature_2m_max[i]),
        weatherType: mapped.type,
        icon: mapped.icon,
        condition: mapped.condition
      });
    }
    return forecast;
  } catch (error) {
    console.error("Open-Meteo Error:", error);
    throw new Error('Failed to fetch forecast');
  }
}
// ─── Combined: Get Location + Weather ───────────────────────────────────
export async function getWeatherForCurrentLocation() {
  const location = await getCurrentLocation();
  const weather = await fetchWeatherData(location.latitude, location.longitude);
  return weather;
}

export async function getForecastForCurrentLocation() {
  const location = await getCurrentLocation();
  const forecast = await fetchForecastData(location.latitude, location.longitude);
  return forecast;
}

// ─── Weather Condition Mapping (Matched to reference design) ────────────
export function getWeatherTheme(weatherType, isNight = false) {
  const themes = {
    // ☀ SUNNY — Realistic Photo Background with Glassmorphism
    sunny: {
      gradientColors: ['rgba(0,30,80,0.1)', 'rgba(0,10,40,0.4)'],
      gradientStart: { x: 0, y: 0 },
      gradientEnd: { x: 0, y: 1 },
      particleColor: '#FBBF24',
      particleColor2: '#FDE68A',
      glowColor: 'rgba(251,191,36,0.15)',
      cardBg: 'rgba(0,0,0,0.25)',
      cardBorder: 'rgba(255,255,255,0.2)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.85)',
      textMuted: 'rgba(255,255,255,0.6)',
      iconTint: '#FFFFFF',
      accentColor: '#FFFFFF', // White accent to match realistic
      liveDotColor: '#22c55e',
      liveBadgeBg: 'rgba(0,0,0,0.3)',
      closeBtnBg: 'rgba(0,0,0,0.3)',
      dividerColor: 'rgba(255,255,255,0.15)',
      cardGradient: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.02)'], 
      tabBg: 'rgba(0,0,0,0.4)',
      tabIcon: 'rgba(255,255,255,0.5)',
      tabText: 'rgba(255,255,255,0.5)',
      label: 'Sunny',
      sublabel: 'Clear sky with sunlight',
      emoji: '☀️',
    },
    // 🌧 RAINY — Dark slate blue (matches Image 2 panel 2)
    rain: {
      gradientColors: ['rgba(13,27,42,0.85)', 'rgba(27,40,56,0.85)', 'rgba(26,39,68,0.85)', 'rgba(36,59,85,0.85)', 'rgba(45,58,74,0.95)'],
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
      accentColor: '#FFFFFF',
      liveDotColor: '#4ade80',
      liveBadgeBg: 'rgba(255,255,255,0.12)',
      closeBtnBg: 'rgba(255,255,255,0.10)',
      dividerColor: 'rgba(255,255,255,0.08)',
      cardGradient: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)'],
      tabBg: '#0B1622',
      tabIcon: 'rgba(255,255,255,0.4)',
      tabText: 'rgba(255,255,255,0.4)',
      label: 'Rainy',
      sublabel: 'Light rain showers',
      emoji: '🌧️',
    },
    // ☁ CLOUDY — Medium gray-blue (matches Image 2 panel 3)
    cloudy: {
      gradientColors: ['rgba(58,69,86,0.85)', 'rgba(74,90,110,0.85)', 'rgba(92,110,130,0.85)', 'rgba(110,128,150,0.85)', 'rgba(122,143,163,0.95)'],
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
      accentColor: '#FFFFFF',
      liveDotColor: '#4ade80',
      liveBadgeBg: 'rgba(255,255,255,0.15)',
      closeBtnBg: 'rgba(255,255,255,0.12)',
      dividerColor: 'rgba(255,255,255,0.10)',
      cardGradient: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)'],
      tabBg: '#2A3441',
      tabIcon: 'rgba(255,255,255,0.4)',
      tabText: 'rgba(255,255,255,0.4)',
      label: 'Cloudy',
      sublabel: 'Mostly cloudy',
      emoji: '☁️',
    },
    // ❄ COOL — Bright cool blue (matches Image 2 panel 4)
    cool: {
      gradientColors: ['rgba(176,212,241,0.85)', 'rgba(198,226,247,0.85)', 'rgba(216,237,249,0.85)', 'rgba(230,243,252,0.85)', 'rgba(240,248,255,0.95)'],
      gradientStart: { x: 0.5, y: 0 },
      gradientEnd: { x: 0.5, y: 1 },
      particleColor: '#FFFFFF',
      particleColor2: '#D6EAF8',
      glowColor: 'rgba(176,212,241,0.20)',
      cardBg: 'rgba(0,0,0,0.15)',
      cardBorder: 'rgba(255,255,255,0.25)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.9)',
      textMuted: 'rgba(255,255,255,0.7)',
      iconTint: '#FFFFFF',
      accentColor: '#FFFFFF',
      liveDotColor: '#22c55e',
      liveBadgeBg: 'rgba(0,0,0,0.2)',
      closeBtnBg: 'rgba(0,0,0,0.15)',
      dividerColor: 'rgba(255,255,255,0.2)',
      cardGradient: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.08)'],
      tabBg: '#8CBFE6',
      tabIcon: 'rgba(255,255,255,0.6)',
      tabText: 'rgba(255,255,255,0.6)',
      label: 'Cool',
      sublabel: 'Cool breeze',
      emoji: '❄️',
    },
    // ⛈ STORM — Dark violet (matches Image 2 panel 5)
    storm: {
      gradientColors: ['rgba(10,5,21,0.85)', 'rgba(18,10,40,0.85)', 'rgba(26,14,62,0.85)', 'rgba(30,18,69,0.85)', 'rgba(40,24,78,0.95)'],
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
      accentColor: '#FFFFFF',
      liveDotColor: '#a78bfa',
      liveBadgeBg: 'rgba(178,102,255,0.18)',
      closeBtnBg: 'rgba(255,255,255,0.08)',
      dividerColor: 'rgba(178,102,255,0.15)',
      cardGradient: ['rgba(178,102,255,0.15)', 'rgba(178,102,255,0.05)'],
      tabBg: '#06030F',
      tabIcon: 'rgba(255,255,255,0.4)',
      tabText: 'rgba(255,255,255,0.4)',
      label: 'Thunderstorm',
      sublabel: 'Heavy thunderstorm',
      emoji: '⛈️',
    },
    // ❄ SNOW — Snowfall
    snow: {
      gradientColors: ['#81D4FA', '#B3E5FC', '#E1F5FE', '#F0F9FF', '#FFFFFF'],
      gradientStart: { x: 0.5, y: 0 },
      gradientEnd: { x: 0.5, y: 1 },
      particleColor: '#FFFFFF',
      particleColor2: '#E1F5FE',
      glowColor: 'rgba(255,255,255,0.3)',
      cardBg: 'rgba(255,255,255,0.4)',
      cardBorder: 'rgba(0,0,0,0.05)',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#475569',
      iconTint: '#0F172A',
      liveDotColor: '#22c55e',
      liveBadgeBg: 'rgba(255,255,255,0.6)',
      closeBtnBg: 'rgba(255,255,255,0.5)',
      dividerColor: 'rgba(0,0,0,0.1)',
      label: 'Snow',
      sublabel: 'Snowfall',
      emoji: '❄️',
    }
  };

  if (isNight) {
    const nightThemes = {
      // 🌌 CLEAR NIGHT — Deep starless dark blue → obsidian black
      sunny: {
        gradientColors: ['#02040A', '#060B18', '#0C1326', '#14203D', '#060B18'],
        gradientStart: { x: 0.5, y: 0 },
        gradientEnd: { x: 0.5, y: 1 },
        particleColor: '#F8FAFC',
        particleColor2: '#94A3B8',
        glowColor: 'rgba(255,255,255,0.1)',
        cardBg: 'rgba(15, 23, 42, 0.45)',
        cardBorder: 'rgba(255,255,255,0.08)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(241,245,249,0.75)',
        textMuted: 'rgba(241,245,249,0.45)',
        iconTint: 'rgba(241,245,249,0.65)',
        liveDotColor: '#38BDF8',
        liveBadgeBg: 'rgba(30,41,59,0.5)',
        closeBtnBg: 'rgba(30,41,59,0.4)',
        dividerColor: 'rgba(255,255,255,0.06)',
        label: 'Clear Night',
        sublabel: 'Starlit night sky',
        emoji: '🌌',
      },
      // 🌧️ RAINY NIGHT — Moody dark blue / deep sea black with starry glow
      rain: {
        gradientColors: ['#010307', '#050914', '#091124', '#0F1C36', '#050914'],
        gradientStart: { x: 0.5, y: 0 },
        gradientEnd: { x: 0.5, y: 1 },
        particleColor: '#7EB8E0',
        particleColor2: '#5B9BD5',
        glowColor: 'rgba(91,155,213,0.1)',
        cardBg: 'rgba(15, 23, 42, 0.5)',
        cardBorder: 'rgba(255,255,255,0.06)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(241,245,249,0.7)',
        textMuted: 'rgba(241,245,249,0.4)',
        iconTint: 'rgba(241,245,249,0.6)',
        liveDotColor: '#38BDF8',
        liveBadgeBg: 'rgba(30,41,59,0.5)',
        closeBtnBg: 'rgba(30,41,59,0.4)',
        dividerColor: 'rgba(255,255,255,0.05)',
        label: 'Rainy Night',
        sublabel: 'Showers under the dark sky',
        emoji: '🌧️',
      },
      // ☁️ CLOUDY NIGHT — Dark charcoal gray-blue
      cloudy: {
        gradientColors: ['#030508', '#0A0F1B', '#121A2E', '#1B2742', '#0A0F1B'],
        gradientStart: { x: 0.5, y: 0 },
        gradientEnd: { x: 0.5, y: 1 },
        particleColor: '#94A3B8',
        particleColor2: '#64748B',
        glowColor: 'rgba(148,163,184,0.08)',
        cardBg: 'rgba(15, 23, 42, 0.48)',
        cardBorder: 'rgba(255,255,255,0.07)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(241,245,249,0.72)',
        textMuted: 'rgba(241,245,249,0.42)',
        iconTint: 'rgba(241,245,249,0.62)',
        liveDotColor: '#38BDF8',
        liveBadgeBg: 'rgba(30,41,59,0.5)',
        closeBtnBg: 'rgba(30,41,59,0.4)',
        dividerColor: 'rgba(255,255,255,0.05)',
        label: 'Cloudy Night',
        sublabel: 'Overcast starlit sky',
        emoji: '☁️',
      },
      // ⛈️ STORM NIGHT — Dark violet / electric twilight black
      storm: {
        gradientColors: ['#020105', '#06030F', '#0C061E', '#130B2D', '#06030F'],
        gradientStart: { x: 0.5, y: 0 },
        gradientEnd: { x: 0.5, y: 1 },
        particleColor: '#A78BFA',
        particleColor2: '#C084FC',
        glowColor: 'rgba(192,132,252,0.12)',
        cardBg: 'rgba(15, 23, 42, 0.55)',
        cardBorder: 'rgba(192,132,252,0.12)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(241,245,249,0.68)',
        textMuted: 'rgba(241,245,249,0.38)',
        iconTint: 'rgba(241,245,249,0.58)',
        liveDotColor: '#A78BFA',
        liveBadgeBg: 'rgba(30,41,59,0.5)',
        closeBtnBg: 'rgba(30,41,59,0.4)',
        dividerColor: 'rgba(255,255,255,0.06)',
        label: 'Thunderstorm Night',
        sublabel: 'Storms in the dark',
        emoji: '⛈️',
      },
      // ❄️ COOL/SNOW NIGHT — Ice white particles on black-blue
      snow: {
        gradientColors: ['#020407', '#080E1A', '#0F1A30', '#172747', '#080E1A'],
        gradientStart: { x: 0.5, y: 0 },
        gradientEnd: { x: 0.5, y: 1 },
        particleColor: '#FFFFFF',
        particleColor2: '#94A3B8',
        glowColor: 'rgba(200,220,240,0.1)',
        cardBg: 'rgba(15, 23, 42, 0.48)',
        cardBorder: 'rgba(255,255,255,0.07)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(241,245,249,0.72)',
        textMuted: 'rgba(241,245,249,0.42)',
        iconTint: 'rgba(241,245,249,0.62)',
        liveDotColor: '#38BDF8',
        liveBadgeBg: 'rgba(30,41,59,0.5)',
        closeBtnBg: 'rgba(30,41,59,0.4)',
        dividerColor: 'rgba(255,255,255,0.05)',
        label: 'Snow Night',
        sublabel: 'Midnight snowfall',
        emoji: '❄️',
      },
      cool: {
        gradientColors: ['#020407', '#080E1A', '#0F1A30', '#172747', '#080E1A'],
        gradientStart: { x: 0.5, y: 0 },
        gradientEnd: { x: 0.5, y: 1 },
        particleColor: '#FFFFFF',
        particleColor2: '#94A3B8',
        glowColor: 'rgba(200,220,240,0.1)',
        cardBg: 'rgba(15, 23, 42, 0.48)',
        cardBorder: 'rgba(255,255,255,0.07)',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(241,245,249,0.72)',
        textMuted: 'rgba(241,245,249,0.42)',
        iconTint: 'rgba(241,245,249,0.62)',
        liveDotColor: '#38BDF8',
        liveBadgeBg: 'rgba(30,41,59,0.5)',
        closeBtnBg: 'rgba(30,41,59,0.4)',
        dividerColor: 'rgba(255,255,255,0.05)',
        label: 'Cool Night',
        sublabel: 'Chilly midnight breeze',
        emoji: '❄️',
      },
    };

    return nightThemes[weatherType] || nightThemes.sunny;
  }

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
