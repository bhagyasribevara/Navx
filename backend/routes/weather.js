const express = require('express');
const axios = require('axios');
const router = express.Router();

// ─── Configuration ──────────────────────────────────────────────────────
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '1230eedb69a8f149493da7dda9ecdbe2';
const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── In-Memory Cache ────────────────────────────────────────────────────
const weatherCache = new Map();

function getCacheKey(lat, lon) {
  // Round to 2 decimal places for cache grouping (~1.1km precision)
  return `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
}

function getCachedWeather(key) {
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  weatherCache.delete(key);
  return null;
}

function setCachedWeather(key, data) {
  // Limit cache size to prevent memory bloat
  if (weatherCache.size > 500) {
    const oldest = weatherCache.keys().next().value;
    weatherCache.delete(oldest);
  }
  weatherCache.set(key, { data, timestamp: Date.now() });
}

// ─── Helper: Format Unix Timestamp ──────────────────────────────────────
function formatTime(unixTimestamp, timezoneOffset) {
  const date = new Date((unixTimestamp + timezoneOffset) * 1000);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes.toString().padStart(2, '0');
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

// ─── Helper: Map Weather Condition ──────────────────────────────────────
function mapWeatherCondition(weatherId, temp) {
  if (weatherId >= 200 && weatherId < 300) return 'storm';
  if (weatherId >= 300 && weatherId < 400) return 'rain';
  if (weatherId >= 500 && weatherId < 600) return 'rain';
  if (weatherId >= 600 && weatherId < 700) return 'snow';
  if (weatherId >= 700 && weatherId < 800) return 'cloudy';
  if (weatherId === 800) {
    // If clear sky but cold temperature, show 'cool' theme
    if (temp !== undefined && temp < 18) return 'cool';
    return 'sunny';
  }
  if (weatherId > 800) {
    if (temp !== undefined && temp < 18) return 'cool';
    return 'cloudy';
  }
  return 'sunny';
}

// ─── GET /api/weather?lat={lat}&lon={lon} ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    // Validate params
    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both lat and lon query parameters are required',
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: 'lat and lon must be valid numbers',
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: 'Out of range',
        message: 'lat must be between -90 and 90, lon between -180 and 180',
      });
    }

    // Check cache
    const cacheKey = getCacheKey(latitude, longitude);
    const cached = getCachedWeather(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Fetch from OpenWeatherMap
    const response = await axios.get(OPENWEATHER_BASE, {
      params: {
        lat: latitude,
        lon: longitude,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
      },
      timeout: 8000,
    });

    const data = response.data;

    // Build optimized response
    const weatherResponse = {
      location: data.name || 'Unknown',
      country: data.sys?.country || '',
      temperature: Math.round(data.main?.temp ?? 0),
      condition: data.weather?.[0]?.main || 'Clear',
      description: data.weather?.[0]?.description || 'clear sky',
      weatherType: mapWeatherCondition(data.weather?.[0]?.id || 800, data.main?.temp),
      humidity: data.main?.humidity ?? 0,
      windSpeed: Math.round((data.wind?.speed ?? 0) * 3.6), // m/s to km/h
      feelsLike: Math.round(data.main?.feels_like ?? 0),
      tempMin: Math.round(data.main?.temp_min ?? 0),
      tempMax: Math.round(data.main?.temp_max ?? 0),
      pressure: data.main?.pressure ?? 0,
      visibility: data.visibility ? Math.round(data.visibility / 1000) : 10, // km
      icon: data.weather?.[0]?.icon || '01d',
      sunrise: formatTime(data.sys?.sunrise, data.timezone || 0),
      sunset: formatTime(data.sys?.sunset, data.timezone || 0),
      sunriseUnix: data.sys?.sunrise,
      sunsetUnix: data.sys?.sunset,
      clouds: data.clouds?.all ?? 0,
      timestamp: Date.now(),
      cached: false,
    };

    // Cache the response
    setCachedWeather(cacheKey, weatherResponse);

    res.json(weatherResponse);
  } catch (error) {
    console.error('❌ Weather API Error:', error.message);

    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        return res.status(401).json({
          error: 'API Key Invalid',
          message: 'The OpenWeatherMap API key is invalid or expired',
        });
      }
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate Limited',
          message: 'Too many requests to weather API. Please try again later.',
        });
      }
      return res.status(status).json({
        error: 'Weather API Error',
        message: error.response.data?.message || 'Failed to fetch weather data',
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Timeout',
        message: 'Weather API request timed out',
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch weather data',
    });
  }
});

// ─── GET /api/weather/forecast?lat={lat}&lon={lon} ────────────────────────
router.get('/forecast', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Missing parameters' });

    const response = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
      params: {
        lat, lon, appid: OPENWEATHER_API_KEY, units: 'metric'
      },
      timeout: 8000,
    });

    const data = response.data;
    
    // Group forecast by day
    const dailyForecasts = [];
    const daysSeen = new Set();
    
    // The API returns 3-hour chunks. We can find the min/max temp for each day.
    const groupedByDay = {};
    
    data.list.forEach(item => {
      const dateStr = item.dt_txt.split(' ')[0];
      if (!groupedByDay[dateStr]) {
        groupedByDay[dateStr] = {
          date: dateStr,
          tempMin: item.main.temp_min,
          tempMax: item.main.temp_max,
          weatherType: mapWeatherCondition(item.weather[0].id, item.main.temp),
          icon: item.weather[0].icon,
          condition: item.weather[0].main,
          readings: []
        };
      } else {
        if (item.main.temp_min < groupedByDay[dateStr].tempMin) groupedByDay[dateStr].tempMin = item.main.temp_min;
        if (item.main.temp_max > groupedByDay[dateStr].tempMax) groupedByDay[dateStr].tempMax = item.main.temp_max;
      }
      groupedByDay[dateStr].readings.push(item);
    });

    const forecast = Object.values(groupedByDay).slice(0, 5).map(day => {
      const dateObj = new Date(day.date);
      return {
        id: day.date,
        dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        tempMin: Math.round(day.tempMin),
        tempMax: Math.round(day.tempMax),
        weatherType: day.weatherType,
        icon: day.icon,
        condition: day.condition
      };
    });

    res.json({ forecast });
  } catch (error) {
    console.error('❌ Forecast API Error:', error.message);

    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        return res.status(401).json({
          error: 'API Key Invalid',
          message: 'The OpenWeatherMap API key is invalid or expired',
        });
      }
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate Limited',
          message: 'Too many requests to weather API. Please try again later.',
        });
      }
      return res.status(status).json({
        error: 'Weather API Error',
        message: error.response.data?.message || 'Failed to fetch forecast data',
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Timeout',
        message: 'Weather API request timed out',
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch forecast',
    });
  }
});

module.exports = router;
