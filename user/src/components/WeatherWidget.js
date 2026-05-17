import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Modal, Image, ImageBackground, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../context/ThemeContext';
import { getWeatherForCurrentLocation, getWeatherTheme, getWeatherIconUrl, clearWeatherCache, estimateUVIndex } from '../services/weatherService';
import { SunRays, RainDrops, FloatingClouds, FrostParticles, LightningBolts, WarmParticles, AmbientPulse } from './weather/WeatherAnimations';

const { width: SW, height: SH } = Dimensions.get('window');
const REFRESH = 5 * 60 * 1000;

// ─── Weather Background Images ──────────────────────────────────────────
const weatherBackgrounds = {
  sunny: require('../../assets/weather/sunny.png'),
  rain: require('../../assets/weather/rainy.png'),
  cloudy: require('../../assets/weather/cloudy.png'),
  cool: require('../../assets/weather/snow.png'),
  snow: require('../../assets/weather/snow.png'),
  storm: require('../../assets/weather/storm.png'),
};

function WeatherEffects({ type, theme }) {
  switch (type) {
    case 'sunny': return <><SunRays /><WarmParticles /><AmbientPulse color="rgba(255,180,0,0.06)" /></>;
    case 'rain': return <><RainDrops count={35} color={theme.particleColor} /><FloatingClouds color="rgba(100,140,180,0.08)" /><AmbientPulse color="rgba(50,80,120,0.06)" /></>;
    case 'cloudy': return <><FloatingClouds count={7} color="rgba(255,255,255,0.1)" /><AmbientPulse color="rgba(180,190,210,0.06)" /></>;
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
      <Ionicons name={icon} size={18} color={theme.iconTint} />
      <Text style={[s.statLbl, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[s.statVal, { color: theme.textPrimary }]}>{value}<Text style={{ fontSize: 11, color: theme.textSecondary }}>{unit}</Text></Text>
    </Animated.View>
  );
}

function ShimmerLoader() {
  const sh = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(sh, { toValue: 1, duration: 1400, useNativeDriver: true })).start(); }, []);
  const B = ({ w, h = 14, mt = 0 }) => <Animated.View style={{ width: w, height: h, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: mt, opacity: sh.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.6, 0.3] }) }} />;
  return (
    <View style={{ padding: 28, flex: 1, justifyContent: 'center' }}>
      <B w={140} h={18} /><B w={200} h={14} mt={14} /><B w={120} h={60} mt={28} /><B w={SW * 0.6} h={16} mt={18} /><B w={SW * 0.5} h={14} mt={10} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}><B w={(SW - 76) / 3} h={80} /><B w={(SW - 76) / 3} h={80} /><B w={(SW - 76) / 3} h={80} /></View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}><B w={(SW - 76) / 3} h={80} /><B w={(SW - 76) / 3} h={80} /><B w={(SW - 76) / 3} h={80} /></View>
    </View>
  );
}

export default function WeatherWidget() {
  const { colors } = useContext(ThemeContext);
  const [vis, setVis] = useState(false);
  const [weather, setWeather] = useState(null);
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
      const d = await getWeatherForCurrentLocation();
      setWeather(d);
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

  const theme = getWeatherTheme(weather?.weatherType || 'sunny');
  const uv = weather ? estimateUVIndex(weather.weatherType, weather.clouds) : { value: 0, label: 'Low' };
  const mkAnim = (a) => ({ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] });

  return (
    <>
      {/* Button */}
      <Animated.View style={{ transform: [{ scale: btnP }, { translateY: btnF }] }}>
        <TouchableOpacity onPress={tap} activeOpacity={0.8} style={s.btn}>
          <Animated.View style={[s.btnGlow, { opacity: btnG }]} />
          <Ionicons name="partly-sunny" size={19} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Full-Screen Weather Modal */}
      <Modal visible={vis} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <Animated.View style={[s.backdrop, { opacity: fade }]}>
          <Animated.View style={[s.fullScreen, { transform: [{ translateY: slideY }] }]}>
            <ImageBackground
              source={weatherBackgrounds[weather?.weatherType] || weatherBackgrounds.sunny}
              style={s.fullScreen}
              resizeMode="cover"
            >
            <LinearGradient
              colors={[
                'rgba(0,0,0,0.35)',
                'rgba(0,0,0,0.15)',
                'rgba(0,0,0,0.10)',
                'rgba(0,0,0,0.25)',
                'rgba(0,0,0,0.55)',
              ]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={s.fullScreen}
            >
              {/* Animated weather effects layer */}
              {weather && <WeatherEffects type={weather.weatherType} theme={theme} />}

              {/* Close button */}
              <TouchableOpacity style={[s.closeBtn, { backgroundColor: theme.closeBtnBg }]} onPress={close}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>

              {loading && !weather ? <ShimmerLoader /> : error ? (
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
                      <Text style={[s.updTxt, { color: theme.textMuted }]}>Updated just now</Text>
                    </Animated.View>

                    {/* Location */}
                    <Animated.View style={[s.locRow, mkAnim(locA)]}>
                      <Text style={[s.locTxt, { color: theme.textPrimary }]}>{weather.location}{weather.country ? `, ${weather.country}` : ''}</Text>
                      <Ionicons name="location-sharp" size={16} color={theme.iconTint} style={{ marginLeft: 6 }} />
                    </Animated.View>

                    {/* Temperature + Icon */}
                    <Animated.View style={[s.mainRow, mkAnim(tmpA)]}>
                      <Text style={[s.temp, { color: theme.textPrimary }]}>{weather.temperature}°</Text>
                      <View style={s.iconW}><Image source={{ uri: getWeatherIconUrl(weather.icon) }} style={s.wIcon} /></View>
                    </Animated.View>

                    {/* Condition */}
                    <Animated.View style={mkAnim(cndA)}>
                      <Text style={[s.condN, { color: theme.textPrimary }]}>{weather.condition}</Text>
                      <Text style={[s.condD, { color: theme.textSecondary }]}>{weather.description}</Text>
                    </Animated.View>

                    <View style={[s.div, { backgroundColor: theme.dividerColor }]} />

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

                    {/* Sunrise / Sunset */}
                    <View style={[s.sunRow, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                      <View style={s.sunIt}>
                        <Ionicons name="sunny-outline" size={22} color={theme.iconTint} />
                        <View style={{ marginLeft: 10 }}>
                          <Text style={[s.sunLbl, { color: theme.textMuted }]}>Sunrise</Text>
                          <Text style={[s.sunTm, { color: theme.textPrimary }]}>{weather.sunrise}</Text>
                        </View>
                      </View>
                      <View style={[s.sunDv, { backgroundColor: theme.dividerColor }]} />
                      <View style={s.sunIt}>
                        <Ionicons name="moon-outline" size={22} color={theme.iconTint} />
                        <View style={{ marginLeft: 10 }}>
                          <Text style={[s.sunLbl, { color: theme.textMuted }]}>Sunset</Text>
                          <Text style={[s.sunTm, { color: theme.textPrimary }]}>{weather.sunset}</Text>
                        </View>
                      </View>
                    </View>
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
  liveTxt: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  updTxt: { fontSize: 11, fontWeight: '500' },
  locRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  locTxt: { fontSize: 20, fontWeight: '700' },
  mainRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  temp: { fontSize: 72, fontWeight: '800', letterSpacing: -3, lineHeight: 80 },
  iconW: { marginLeft: 'auto', width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  wIcon: { width: 105, height: 105 },
  condN: { fontSize: 24, fontWeight: '800', marginBottom: 3 },
  condD: { fontSize: 15, fontWeight: '500', textTransform: 'capitalize', marginBottom: 20 },
  div: { height: 1, marginBottom: 20 },
  sRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1 },
  statLbl: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
  statVal: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  sunRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1 },
  sunIt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  sunLbl: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sunTm: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  sunDv: { width: 1, height: 36 },
  errW: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errIc: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  errT: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 10, textAlign: 'center' },
  errD: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 20 },
  retryB: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, gap: 8 },
  retryT: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
});
