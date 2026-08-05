import React, { useEffect } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';

export default function AROverlay({ isScanning }) {
  const scanLineY = new Animated.Value(0);

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineY, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(scanLineY, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      scanLineY.setValue(0);
    }
  }, [isScanning]);

  if (!isScanning) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View 
        style={[
          styles.scanLine, 
          { 
            transform: [{
              translateY: scanLineY.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 500] // Scan distance
              })
            }] 
          }
        ]} 
      />
      <View style={styles.reticle}>
        <View style={styles.reticleCenter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(168, 85, 247, 0.8)',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  reticle: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  }
});
