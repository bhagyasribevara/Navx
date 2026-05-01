import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Magnetometer } from 'expo-sensors';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Text as SvgText, G, Polygon } from 'react-native-svg';
import { ThemeContext } from '../../App';

const { width: SW, height: SH } = Dimensions.get('window');

export default function ARScreen({ navigation, route }) {
  const { colors } = useContext(ThemeContext);
  const { routeData, room, heading: initHeading } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [heading, setHeading] = useState(initHeading || 0);
  const [currentStep, setCurrentStep] = useState(0);
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sub = Magnetometer.addListener(data => {
      const h = Math.atan2(data.y, data.x) * (180 / Math.PI);
      setHeading((h + 360) % 360);
    });
    Magnetometer.setUpdateInterval(100);

    // Arrow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    ).start();

    return () => sub.remove();
  }, []);

  if (!permission?.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Ionicons name="camera" size={48} color={colors.textMuted} />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 }}>Camera Access Required</Text>
        <Text style={{ color: colors.textSec, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
          We need camera access to show AR navigation overlay
        </Text>
        <TouchableOpacity style={[styles.permBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textMuted }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentDir = routeData?.directions?.[currentStep];
  const totalDist = routeData?.distance || 0;
  const remainingDist = routeData?.directions?.slice(currentStep).reduce((sum, d) => sum + d.distance, 0) || 0;

  // Calculate arrow direction based on heading and target angle
  const targetAngle = currentDir?.angle || 0;
  const relativeAngle = targetAngle - heading;

  // Determine arrow direction
  let arrowDirection = 'straight';
  let arrowIcon = 'arrow-up';
  if (currentDir) {
    if (currentDir.instruction.includes('left')) { arrowDirection = 'left'; arrowIcon = 'arrow-back'; }
    else if (currentDir.instruction.includes('right')) { arrowDirection = 'right'; arrowIcon = 'arrow-forward'; }
    else if (currentDir.instruction.includes('stairs')) { arrowDirection = 'stairs'; arrowIcon = 'trending-up'; }
    else if (currentDir.instruction.includes('elevator')) { arrowDirection = 'elevator'; arrowIcon = 'arrow-up'; }
  }

  const arrowTranslateY = arrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* AR Overlay */}
      <View style={StyleSheet.absoluteFill}>
        {/* Direction Arrow */}
        <View style={styles.arrowContainer}>
          <Animated.View style={[styles.arrowWrap, { transform: [{ translateY: arrowTranslateY }] }]}>
            <View style={styles.arrowCircle}>
              <Ionicons name={arrowIcon} size={48} color="#fff" />
            </View>
          </Animated.View>
          {currentDir && (
            <Text style={styles.arrowLabel}>{currentDir.instruction}</Text>
          )}
        </View>

        {/* Direction indicator line */}
        <Svg width={SW} height={SH} style={StyleSheet.absoluteFill}>
          {/* Path line preview */}
          <Line x1={SW / 2} y1={SH * 0.65} x2={SW / 2 + Math.sin(relativeAngle * Math.PI / 180) * 100}
            y2={SH * 0.65 - 80} stroke="#6366f1" strokeWidth={4} strokeLinecap="round" opacity={0.6} />
          <Circle cx={SW / 2 + Math.sin(relativeAngle * Math.PI / 180) * 100}
            cy={SH * 0.65 - 80} r={8} fill="#6366f1" opacity={0.8} />
        </Svg>

        {/* Top bar */}
        <View style={[styles.topBar, { backgroundColor: colors.card + 'E0' }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.destLabel}>Navigating to</Text>
            <Text style={styles.destName}>{room?.name || 'Destination'}</Text>
          </View>
          <View style={styles.compassWrap}>
            <Ionicons name="compass" size={22} color="#6366f1" />
            <Text style={styles.compassText}>{Math.round(heading)}°</Text>
          </View>
        </View>

        {/* Bottom info */}
        <View style={[styles.bottomBar, { backgroundColor: colors.card + 'F0' }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="walk" size={20} color="#6366f1" />
              <Text style={styles.infoValue}>{Math.round(remainingDist)}m</Text>
              <Text style={styles.infoLabel}>Remaining</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoItem}>
              <Ionicons name="time" size={20} color="#22c55e" />
              <Text style={styles.infoValue}>{Math.round(remainingDist / 1.2)}s</Text>
              <Text style={styles.infoLabel}>ETA</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoItem}>
              <Ionicons name="footsteps" size={20} color="#f59e0b" />
              <Text style={styles.infoValue}>{currentStep + 1}/{routeData?.directions?.length || 0}</Text>
              <Text style={styles.infoLabel}>Step</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.mapBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="map" size={18} color="#6366f1" />
            <Text style={styles.mapBtnText}>Switch to Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  permBtn: { marginTop: 20, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 14 },
  arrowContainer: { position: 'absolute', top: SH * 0.3, alignSelf: 'center', alignItems: 'center' },
  arrowWrap: { alignItems: 'center' },
  arrowCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  arrowLabel: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 16, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  destLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  destName: { fontSize: 16, color: '#fff', fontWeight: '700', marginTop: 2 },
  compassWrap: { alignItems: 'center' },
  compassText: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  infoItem: { alignItems: 'center' },
  infoValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 4 },
  infoLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  divider: { width: 1, backgroundColor: '#2a3352', marginVertical: 4 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(99,102,241,0.15)', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  mapBtnText: { color: '#818cf8', fontWeight: '600', marginLeft: 8, fontSize: 14 },
});
