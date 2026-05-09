import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../api';
import { ThemeContext } from '../context/ThemeContext';

export default function EmergencyOverlay() {
  const [emergency, setEmergency] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const navigation = useNavigation();
  const { colors } = useContext(ThemeContext);

  useEffect(() => {
    let interval;
    const checkEmergency = async () => {
      try {
        const res = await api.get(`/campus`);
        const campuses = res.data;
        const emergencyCampus = campuses.find(c => c.emergencyState && c.emergencyState.isActive);
        
        if (emergencyCampus) {
          if (!emergency || emergency.campusId !== emergencyCampus._id) {
            setEmergency({ ...emergencyCampus.emergencyState, campusId: emergencyCampus._id });
            setDismissed(false); // Reset dismissal on new emergency
            // Trigger haptics and start pulse animation
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Animated.loop(
              Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true })
              ])
            ).start();
          }
        } else {
          setEmergency(null);
          setDismissed(false);
        }
      } catch (e) {
        console.warn("Emergency poll failed", e);
      }
    };

    checkEmergency();
    interval = setInterval(checkEmergency, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [emergency]);

  if (!emergency || dismissed) return null;

  const navigateToExit = async () => {
    setDismissed(true);
    navigation.navigate("Navigation", { emergencyMode: true, campusId: emergency.campusId });
  };

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name="warning" size={48} color="#ef4444" />
        <Text style={styles.title}>{emergency.type.toUpperCase()} EMERGENCY</Text>
        <Text style={styles.message}>{emergency.message}</Text>
        
        <TouchableOpacity style={styles.button} onPress={navigateToExit} activeOpacity={0.8}>
          <Text style={styles.buttonText}>NAVIGATE TO EMERGENCY EXIT</Text>
          <Ionicons name="exit" size={24} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#111827',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#ef4444'
  },
  title: {
    color: '#ef4444',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 2
  },
  message: {
    color: '#f1f5f9',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 24
  },
  button: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  }
});
