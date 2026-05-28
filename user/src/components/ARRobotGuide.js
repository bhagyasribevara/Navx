import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, Dimensions, StyleSheet, Image } from "react-native";
import * as Speech from "expo-speech";

const { width: SW, height: SH } = Dimensions.get("window");

export default function ARRobotGuide({ dirType = "straight", instructionText = "Follow the glowing path!", style }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const [displayedText, setDisplayedText] = useState("");

  // Floating bob animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Hover glow pulse
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.9, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Typewriter effect & Speech
  useEffect(() => {
    if (!instructionText) return;

    // Pop bubble in
    bubbleScale.setValue(0);
    Animated.spring(bubbleScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true
    }).start();

    // Typewriter effect
    setDisplayedText("");
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(instructionText.slice(0, i));
      i++;
      if (i > instructionText.length) clearInterval(interval);
    }, 40);

    // Speak it out loud!
    Speech.stop();
    Speech.speak(instructionText, {
      rate: 1.0,
      pitch: 1.1,
      language: 'en-US'
    });

    return () => {
      clearInterval(interval);
      Speech.stop();
    };
  }, [instructionText]);

  const floatTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      
      {/* Speech Bubble */}
      {instructionText ? (
        <Animated.View style={[styles.bubbleWrap, { transform: [{ scale: bubbleScale }] }]}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{displayedText}</Text>
          </View>
          <View style={styles.bubbleTail} />
        </Animated.View>
      ) : null}

      {/* Robot Image & Hover */}
      <Animated.View style={{ transform: [{ translateY: floatTranslateY }], alignItems: 'center' }}>
        <Image 
          source={require('../../assets/robot.png')} 
          style={styles.robotImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Ground Hover Glow */}
      <Animated.View style={[styles.hoverGlow, { opacity: glowAnim }]} />
      <Animated.View style={[styles.hoverGlowInner, { opacity: glowAnim }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: SH * 0.12,
    left: 20,
    width: 140,
    alignItems: 'center',
    zIndex: 15,
  },
  robotImage: {
    width: 180,
    height: 220,
    // Add a subtle drop shadow to ground the realistic image in AR
    shadowColor: "#00e5ff",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  hoverGlow: {
    position: "absolute",
    bottom: -15,
    width: 120,
    height: 25,
    borderRadius: 60,
    backgroundColor: "#00e5ff",
    transform: [{ scaleX: 1.5 }, { scaleY: 0.5 }],
    opacity: 0.6,
    // React Native shadows instead of CSS filter blur
    shadowColor: "#00e5ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 5,
  },
  hoverGlowInner: {
    position: "absolute",
    bottom: -8,
    width: 70,
    height: 12,
    borderRadius: 35,
    backgroundColor: "#ffffff",
    transform: [{ scaleX: 1.5 }, { scaleY: 0.5 }],
    opacity: 0.9,
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  bubbleWrap: {
    position: 'absolute',
    top: -90,
    left: 10,
    width: 180,
    zIndex: 20,
  },
  bubble: {
    backgroundColor: 'rgba(10, 16, 30, 0.95)',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.6)',
    shadowColor: '#00e5ff',
    shadowOpacity: 0.6,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  bubbleText: {
    color: '#e0f7fa',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  bubbleTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0, 229, 255, 0.4)',
    alignSelf: 'center',
    marginTop: -1,
  },
});
