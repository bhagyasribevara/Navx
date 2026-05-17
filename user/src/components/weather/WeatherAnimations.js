import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Sun Rays (Sunny) ──────────────────────────────────────────────────
export function SunRays() {
  const rot = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(rot, { toValue: 1, duration: 30000, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 3000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.15, duration: 3000, useNativeDriver: true }),
    ])).start();
  }, []);
  const rays = Array.from({ length: 12 });
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
      <Animated.View style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, opacity: pulse, transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        {rays.map((_, i) => (
          <View key={i} style={{ position: 'absolute', top: 130, left: 136, width: 8, height: 80, backgroundColor: '#FFD700', borderRadius: 4, opacity: 0.3, transform: [{ rotate: `${i * 30}deg` }, { translateY: -100 }] }} />
        ))}
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: -20, right: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: '#FFD700', opacity: pulse }} />
    </View>
  );
}

// ─── Rain Drops ─────────────────────────────────────────────────────────
export function RainDrops({ count = 30, color = '#7EB8E0' }) {
  const drops = useRef(
    Array.from({ length: count }, () => ({
      a: new Animated.Value(0), x: Math.random() * SW, d: Math.random() * 1500,
      w: 1 + Math.random() * 1.5, h: 12 + Math.random() * 20, o: 0.2 + Math.random() * 0.4,
    }))
  ).current;
  useEffect(() => {
    drops.forEach(p => {
      const run = () => { p.a.setValue(0); Animated.timing(p.a, { toValue: 1, duration: 600 + Math.random() * 600, delay: p.d, useNativeDriver: true }).start(run); };
      run();
    });
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {drops.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.x, width: p.w, height: p.h, borderRadius: 2,
          backgroundColor: color, opacity: p.a.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, p.o, p.o * 0.6, 0] }),
          transform: [{ translateY: p.a.interpolate({ inputRange: [0, 1], outputRange: [-30, SH + 30] }) }],
        }} />
      ))}
    </View>
  );
}

// ─── Floating Clouds ────────────────────────────────────────────────────
export function FloatingClouds({ count = 5, color = 'rgba(255,255,255,0.12)' }) {
  const clouds = useRef(
    Array.from({ length: count }, () => ({
      a: new Animated.Value(Math.random()), y: 50 + Math.random() * 300,
      w: 100 + Math.random() * 160, h: 40 + Math.random() * 50, o: 0.08 + Math.random() * 0.12,
    }))
  ).current;
  useEffect(() => {
    clouds.forEach(c => {
      const run = () => { c.a.setValue(0); Animated.timing(c.a, { toValue: 1, duration: 15000 + Math.random() * 20000, useNativeDriver: true }).start(run); };
      run();
    });
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {clouds.map((c, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', top: c.y, width: c.w, height: c.h, borderRadius: c.h / 2,
          backgroundColor: color, opacity: c.o,
          transform: [{ translateX: c.a.interpolate({ inputRange: [0, 1], outputRange: [-c.w, SW + c.w] }) }],
        }} />
      ))}
    </View>
  );
}

// ─── Frost / Snow Particles ─────────────────────────────────────────────
export function FrostParticles({ count = 20, color = '#FFF', color2 = '#D6EAF8' }) {
  const ps = useRef(
    Array.from({ length: count }, () => ({
      a: new Animated.Value(0), x: Math.random() * SW, d: Math.random() * 3000,
      s: 2 + Math.random() * 6, dir: Math.random() > 0.5 ? 1 : -1,
    }))
  ).current;
  useEffect(() => {
    ps.forEach(p => {
      const run = () => { p.a.setValue(0); Animated.timing(p.a, { toValue: 1, duration: 4000 + Math.random() * 3000, delay: p.d, useNativeDriver: true }).start(run); };
      run();
    });
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {ps.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.x, width: p.s, height: p.s, borderRadius: p.s / 2,
          backgroundColor: i % 2 === 0 ? color : color2,
          opacity: p.a.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 0.7, 0.5, 0] }),
          transform: [
            { translateY: p.a.interpolate({ inputRange: [0, 1], outputRange: [-20, SH] }) },
            { translateX: p.a.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 15 * p.dir, 0, -15 * p.dir, 0] }) },
          ],
        }} />
      ))}
    </View>
  );
}

// ─── Lightning Bolts (Storm) ────────────────────────────────────────────
export function LightningBolts() {
  const f1 = useRef(new Animated.Value(0)).current;
  const f2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const flash = (a, delay) => {
      const go = () => Animated.sequence([
        Animated.delay(delay + Math.random() * 5000),
        Animated.timing(a, { toValue: 0.6, duration: 60, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.delay(120),
        Animated.timing(a, { toValue: 0.4, duration: 40, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.delay(3000 + Math.random() * 7000),
      ]).start(go);
      go();
    };
    flash(f1, 0); flash(f2, 2500);
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#B266FF', opacity: f1 }} />
      <Animated.View style={{ position: 'absolute', top: 60, left: SW * 0.3, width: 3, height: 120, backgroundColor: '#E0B0FF', borderRadius: 2, opacity: f1, transform: [{ rotate: '5deg' }] }} />
      <Animated.View style={{ position: 'absolute', top: 40, right: SW * 0.25, width: 2, height: 90, backgroundColor: '#D8A0FF', borderRadius: 2, opacity: f2, transform: [{ rotate: '-8deg' }] }} />
    </View>
  );
}

// ─── Warm Glow Particles (Sunny) ────────────────────────────────────────
export function WarmParticles({ count = 14 }) {
  const ps = useRef(
    Array.from({ length: count }, () => ({
      a: new Animated.Value(Math.random()), x: Math.random() * SW, y: Math.random() * SH,
      s: 3 + Math.random() * 8,
    }))
  ).current;
  useEffect(() => {
    ps.forEach(p => {
      const run = () => { p.a.setValue(0); Animated.timing(p.a, { toValue: 1, duration: 3000 + Math.random() * 4000, useNativeDriver: true }).start(run); };
      run();
    });
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {ps.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.x, top: p.y, width: p.s, height: p.s, borderRadius: p.s / 2,
          backgroundColor: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FFA500' : '#FFE4B5',
          opacity: p.a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.5, 0.1] }),
          transform: [{ translateY: p.a.interpolate({ inputRange: [0, 1], outputRange: [0, -30 - Math.random() * 20] }) }],
        }} />
      ))}
    </View>
  );
}

// ─── Ambient Pulse ──────────────────────────────────────────────────────
export function AmbientPulse({ color }) {
  const a = useRef(new Animated.Value(0.1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.3, duration: 3000, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.1, duration: 3000, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: color, opacity: a }} pointerEvents="none" />;
}
