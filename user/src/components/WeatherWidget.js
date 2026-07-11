import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Modal, Image, ImageBackground, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../context/ThemeContext';
import { getWeatherForCurrentLocation, getForecastForCurrentLocation, getWeatherTheme, getWeatherIconUrl, clearWeatherCache, estimateUVIndex } from '../services/weatherService';
import { SunRays, RainDrops, FloatingClouds, FrostParticles, LightningBolts, WarmParticles, AmbientPulse, TwinklingStars } from './weather/WeatherAnimations';

const { width: SW, height: SH } = Dimensions.get('window');
const REFRESH = 5 * 60 * 1000;

// ─── Weather Background Images ──────────────────────────────────────────
const weatherBackgrounds = {
  sunny: require('../../assets/weather/sunny.jpg'),
  rain: require('../../assets/weather/rainy.jpg'),
  cloudy: require('../../assets/weather/cloudy.jpg'),
  cool: require('../../assets/weather/snow.jpg'),
  snow: require('../../assets/weather/snow.jpg'),
  storm: require('../../assets/weather/storm.jpg'),
};

function WeatherEffects({ type, theme, isNight }) {
  if (isNight) {
    switch (type) {
      case 'rain':
        return (
          <>
            <TwinklingStars count={16} />
            <RainDrops count={30} color="#7EB8E0" />
            <FloatingClouds count={4} color="rgba(15, 23, 42, 0.4)" />
            <AmbientPulse color="rgba(15, 23, 42, 0.15)" />
          </>
        );
      case 'cloudy':
        return (
          <>
            <TwinklingStars count={12} />
            <FloatingClouds count={6} color="rgba(255, 255, 255, 0.05)" />
            <AmbientPulse color="rgba(10, 15, 30, 0.1)" />
          </>
        );
      case 'storm':
        return (
          <>
            <LightningBolts />
            <RainDrops count={35} color="#8B7EC8" />
            <AmbientPulse color="rgba(15, 10, 30, 0.2)" />
          </>
        );
      case 'cool':
      case 'snow':
        return (
          <>
            <TwinklingStars count={10} />
            <FrostParticles count={20} color="#FFF" color2="#94A3B8" />
            <AmbientPulse color="rgba(15, 23, 42, 0.12)" />
          </>
        );
      case 'sunny': // Clear night
      default:
        return (
          <>
            <TwinklingStars count={42} />
            <AmbientPulse color="rgba(15, 23, 42, 0.1)" />
          </>
        );
    }
  }

  // Daytime Effects
  switch (type) {
    case 'sunny': return <><SunRays /><FloatingClouds count={4} color="rgba(255,255,255,0.15)" /><WarmParticles /><AmbientPulse color="rgba(255,180,0,0.06)" /></>;
    case 'rain': return <><RainDrops count={35} color={theme.particleColor} /><FloatingClouds color="rgba(100,140,180,0.08)" /><AmbientPulse color="rgba(50,80,120,0.06)" /></>;
    case 'cloudy': return <><FloatingClouds count={7} color="rgba(160, 160, 160, 0.1)" /><AmbientPulse color="rgba(180,190,210,0.06)" /></>;
    case 'cool': case 'snow': return <><FrostParticles count={24} color={theme.particleColor} color2={theme.particleColor2} /><AmbientPulse color="rgba(150,200,240,0.08)" /></>;
    case 'storm': return <><LightningBolts /><RainDrops count={40} color="#8B7EC8" /><AmbientPulse color="rgba(100,50,180,0.08)" /></>;
    default: return <AmbientPulse color="rgba(100,100,100,0.05)" />;
  }
}

function StatCard({ icon, label, value, unit, theme, delay }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(a, { toValue: 1, delay, tension: 120, friction: 12, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[s.stat, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, opacity: a, transform: [{ scale: a }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Ionicons name={icon} size={18} color={theme.iconTint} style={{ marginRight: 6 }} />
        <Text style={[s.statLbl, { color: theme.textMuted }]}>{label}</Text>
      </View>
      <Text style={[s.statVal, { color: theme.textPrimary }]}>{value}<Text style={{ fontSize: 13, color: theme.textPrimary }}>{unit}</Text></Text>
    </Animated.View>
  );
}


export default function WeatherWidget() {
  const { colors } = useContext(ThemeContext);
  const [vis, setVis] = useState(false);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [activeTab, setActiveTab] = useState('weather');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const tmr = useRef(null);
  const btnP = useRef(new Animated.Value(1)).current;
  const btnG = useRef(new Animated.Value(0.4)).current;
  const btnF = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(SH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const cFade = useRef(new Animated.Value(0)).current;
  // Staggered content anims
  const hdrA = useRef(new Animated.Value(0)).current;
  const locA = useRef(new Animated.Value(0)).current;
  const tmpA = useRef(new Animated.Value(0)).current;
  const cndA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    load(); // Fetch weather on mount
    Animated.loop(Animated.sequence([
      Animated.timing(btnG, { toValue: 0.85, duration: 1800, useNativeDriver: true }),
      Animated.timing(btnG, { toValue: 0.4, duration: 1800, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(btnF, { toValue: -3, duration: 2200, useNativeDriver: true }),
      Animated.timing(btnF, { toValue: 3, duration: 2200, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    if (weather && vis) tmr.current = setInterval(() => { clearWeatherCache(); load(); }, REFRESH);
    return () => { if (tmr.current) clearInterval(tmr.current); };
  }, [weather, vis]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [d, f] = await Promise.all([
        getWeatherForCurrentLocation(),
        getForecastForCurrentLocation().catch(e => e.message || 'Forecast failed')
      ]);
      setWeather(d);
      setForecast(f);
      // Stagger content entrance
      [cFade, hdrA, locA, tmpA, cndA].forEach(a => a.setValue(0));
      Animated.stagger(80, [
        Animated.timing(cFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(hdrA, { toValue: 1, tension: 140, friction: 12, useNativeDriver: true }),
        Animated.spring(locA, { toValue: 1, tension: 140, friction: 12, useNativeDriver: true }),
        Animated.spring(tmpA, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
        Animated.spring(cndA, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const open = () => {
    setVis(true);
    slideY.setValue(SH); fade.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    if (!weather) load();
  };

  const close = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: SH, duration: 280, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setVis(false));
  };

  const tap = () => {
    Animated.sequence([
      Animated.timing(btnP, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(btnP, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();
    open();
  };

  const isNight = weather?.icon?.endsWith('n') || new Date().getHours() < 6 || new Date().getHours() > 18;
  const theme = getWeatherTheme(weather?.weatherType || 'sunny', isNight);
  const uv = weather ? estimateUVIndex(weather.weatherType, weather.clouds) : { value: 0, label: 'Low' };
  const mkAnim = (a) => ({ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] });

  return (
    <>
      {/* Button */}
      <Animated.View style={{ transform: [{ scale: btnP }, { translateY: btnF }] }}>
        <TouchableOpacity onPress={tap} activeOpacity={0.8} style={s.btn}>
          <Animated.View style={[s.btnGlow, { opacity: btnG }]} />
          {weather ? (
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFF', textAlign: 'center' }}>
              {weather.temperature}°
            </Text>
          ) : (
            <Ionicons name="partly-sunny" size={19} color="#FFF" />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Full-Screen Weather Modal */}
      <Modal visible={vis} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <Animated.View style={[s.backdrop, { opacity: fade }]}>
          <Animated.View style={[s.fullScreen, { transform: [{ translateY: slideY }] }]}>
            <ImageBackground
              source={weatherBackgrounds[weather?.weatherType] || weatherBackgrounds.sunny}
              style={s.fullScreen}
              imageStyle={{ opacity: isNight ? 0.25 : 0.7 }}
              resizeMode="cover"
            >
              <LinearGradient
                colors={theme.gradientColors}
                start={theme.gradientStart || { x: 0.5, y: 0 }}
                end={theme.gradientEnd || { x: 0.5, y: 1 }}
                style={s.fullScreen}
              >
                {/* Animated weather effects layer */}
                {weather && <WeatherEffects type={weather.weatherType} theme={theme} isNight={isNight} />}

                {/* Close button */}
                <TouchableOpacity style={[s.closeBtn, { backgroundColor: theme.closeBtnBg }]} onPress={close}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>

                {loading && !weather ? <ActivityIndicator size="large" color="#FFF" style={{ flex: 1 }} /> : error ? (
                  <View style={s.errW}>
                    <View style={s.errIc}><Ionicons name={error === 'LOCATION_DENIED' ? 'location-outline' : 'cloud-offline-outline'} size={40} color="rgba(255,255,255,0.8)" /></View>
                    <Text style={s.errT}>{error === 'LOCATION_DENIED' ? 'Location Access Required' : 'Weather Unavailable'}</Text>
                    <Text style={s.errD}>{error === 'LOCATION_DENIED' ? 'Enable location permissions to see live weather.' : 'Check your connection and try again.'}</Text>
                    <TouchableOpacity style={s.retryB} onPress={() => { clearWeatherCache(); load(); }}>
                      <Ionicons name="refresh" size={16} color="#7C3AED" /><Text style={s.retryT}>Try Again</Text>
                    </TouchableOpacity>
                  </View>
                ) : weather ? (
                  <Animated.View style={{ flex: 1, opacity: cFade }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 40 }}>
                      {/* Header */}
                      <Animated.View style={[s.hdr, mkAnim(hdrA)]}>
                        <View style={[s.liveBdg, { backgroundColor: theme.liveBadgeBg }]}>
                          <View style={[s.liveDot, { backgroundColor: theme.liveDotColor }]} />
                          <Text style={[s.liveTxt, { color: theme.textPrimary }]}>Live Weather</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[s.updTxt, { color: theme.textPrimary }]}>Updated just now</Text>
                          <Ionicons name="refresh" size={14} color={theme.textPrimary} style={{ marginLeft: 4 }} />
                        </View>
                      </Animated.View>

                      {/* Location */}
                      <Animated.View style={[s.locRow, mkAnim(locA)]}>
                        <Text style={[s.locTxt, { color: theme.textPrimary }]}>{weather.location}{weather.country ? `, ${weather.country}` : ''}</Text>
                        <Ionicons name="location-outline" size={18} color={theme.textPrimary} style={{ marginLeft: 6 }} />
                      </Animated.View>

                      {/* Main Info Row (Temp + Condition vs Icon) */}
                      <Animated.View style={[s.mainRow, mkAnim(tmpA)]}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={[s.temp, { color: theme.textPrimary }]}>{weather.temperature}°</Text>
                          <Text style={[s.condN, { color: theme.accentColor || '#8B5CF6' }]}>{weather.condition}</Text>
                          <Text style={[s.condD, { color: theme.textSecondary }]}>{weather.description}</Text>
                        </View>
                        <View style={s.iconW}>
                          <Image source={{ uri: getWeatherIconUrl(weather.icon) }} style={s.wIcon} />
                        </View>
                      </Animated.View>

                      <View style={[s.div, { backgroundColor: theme.dividerColor, marginTop: 10 }]} />

                      {/* Stats Row 1 */}
                      <View style={s.sRow}>
                        <StatCard icon="thermometer-outline" label="Feels Like" value={weather.feelsLike} unit="°" theme={theme} delay={300} />
                        <StatCard icon="water-outline" label="Humidity" value={weather.humidity} unit="%" theme={theme} delay={380} />
                        <StatCard icon="speedometer-outline" label="Wind Speed" value={weather.windSpeed} unit=" km/h" theme={theme} delay={460} />
                      </View>
                      {/* Stats Row 2 */}
                      <View style={s.sRow}>
                        <StatCard icon="sunny-outline" label="UV Index" value={`${uv.value} ${uv.label}`} unit="" theme={theme} delay={540} />
                        <StatCard icon="eye-outline" label="Visibility" value={weather.visibility} unit=" km" theme={theme} delay={620} />
                        <StatCard icon="analytics-outline" label="Pressure" value={weather.pressure} unit=" hPa" theme={theme} delay={700} />
                      </View>

                      {/* Sunrise / Sunset Card (Gradient) */}
                      <LinearGradient
                        colors={theme.cardGradient || ['#7C3AED', '#4F46E5']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={s.sunCard}
                      >
                        <View style={s.sunIt}>
                          <Ionicons name="sunny" size={24} color="#FFF" style={{ marginBottom: 6 }} />
                          <Text style={[s.sunLbl, { color: 'rgba(255,255,255,0.8)' }]}>Sunrise</Text>
                          <Text style={[s.sunTm, { color: '#FFF' }]}>{weather.sunrise}</Text>
                        </View>
                        <View style={s.sunCenter}>
                          <Ionicons name="partly-sunny" size={22} color="rgba(255,255,255,0.6)" />
                        </View>
                        <View style={s.sunIt}>
                          <Ionicons name="moon" size={24} color="#FFF" style={{ marginBottom: 6 }} />
                          <Text style={[s.sunLbl, { color: 'rgba(255,255,255,0.8)' }]}>Sunset</Text>
                          <Text style={[s.sunTm, { color: '#FFF' }]}>{weather.sunset}</Text>
                        </View>
                      </LinearGradient>

                      <Text style={[s.locTxt, { color: theme.textPrimary, marginTop: 12, marginBottom: 12 }]}>5-Day Forecast</Text>
                      {typeof forecast === 'string' ? (
                        <Text style={{ color: 'red', fontSize: 16 }}>{forecast}</Text>
                      ) : forecast && Array.isArray(forecast) ? forecast.map((day, i) => (
                        <View key={i} style={[s.forecastCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                          <Text style={[s.forecastDay, { color: theme.textPrimary }]}>{day.dayName}</Text>
                          <Image source={{ uri: getWeatherIconUrl(day.icon) }} style={s.forecastIcon} />
                          <View style={s.forecastTemps}>
                            <Text style={[s.forecastTempMax, { color: theme.textPrimary }]}>{day.tempMax}°</Text>
                            <Text style={[s.forecastTempMin, { color: theme.textMuted }]}>{day.tempMin}°</Text>
                          </View>
                        </View>
                      )) : null}
                    </ScrollView>
                  </Animated.View>
                ) : null}
              </LinearGradient>
            </ImageBackground>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#8B5CF6', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8 },
  btnGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 21, borderWidth: 3, borderColor: '#A78BFA' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  fullScreen: { flex: 1 },
  closeBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, right: 20, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  liveBdg: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  liveTxt: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  updTxt: { fontSize: 12, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  locTxt: { fontSize: 20, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  mainRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginTop: 4 },
  temp: { fontSize: 72, fontWeight: '800', letterSpacing: -2, lineHeight: 80, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  iconW: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  wIcon: { width: 130, height: 130 },
  condN: { fontSize: 22, fontWeight: '700', marginBottom: 2, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  condD: { fontSize: 15, fontWeight: '500', textTransform: 'capitalize', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  div: { height: 1, marginBottom: 16 },
  sRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  statLbl: { fontSize: 11, fontWeight: '600' },
  statVal: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  sunCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 24, padding: 20, marginTop: 4, marginBottom: 10, ...SHADOWS_MD },
  sunIt: { alignItems: 'center', justifyContent: 'center' },
  sunCenter: { alignItems: 'center', justifyContent: 'flex-end', height: 40, flex: 1, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)', borderStyle: 'dashed', marginHorizontal: 20 },
  sunLbl: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  sunTm: { fontSize: 16, fontWeight: '700' },
  tabBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...SHADOWS_LG },
  tabItem: { alignItems: 'center', justifyContent: 'center', width: 90 },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  forecastCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  forecastDay: { fontSize: 18, fontWeight: '700', width: 60 },
  forecastIcon: { width: 44, height: 44 },
  forecastTemps: { flexDirection: 'row', alignItems: 'center', width: 90, justifyContent: 'flex-end', gap: 12 },
  forecastTempMax: { fontSize: 18, fontWeight: '700' },
  forecastTempMin: { fontSize: 16, fontWeight: '600' },
  errW: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errIc: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  errT: { fontSize: 20, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  errD: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 20 },
  retryB: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, gap: 8 },
  retryT: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

const SHADOWS_MD = { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 };
const SHADOWS_LG = { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 };
