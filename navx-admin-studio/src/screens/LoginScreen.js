import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Animated, Dimensions, Image, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from '../context/AdminContext';

const { width: SW, height: SH } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { login, admin, loading: contextLoading } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Auto-navigate if already logged in
    if (admin && !contextLoading) {
      navigation.replace('Dashboard');
      return;
    }

    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    // Floating orb animations
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Anim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(orb1Anim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Anim, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(orb2Anim, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();

    // Logo pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [admin, contextLoading]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);

    if (result.success) {
      navigation.replace('Dashboard');
    } else {
      Alert.alert('Login Failed', result.error);
    }
  };

  const orb1TranslateY = orb1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  const orb2TranslateX = orb2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 25],
  });

  if (contextLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Background lighting orbs */}
      <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1TranslateY }] }]} />
      <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateX: orb2TranslateX }] }]} />
      <View style={styles.orb3} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={['rgba(139,92,246,0.12)', 'rgba(168,85,247,0.06)']}
            style={styles.logoGlow}
          >
            <Image
              source={require('../../assets/navx-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.title}>NavX Admin Studio</Text>
        <Text style={styles.subtitle}>Spatial & Management Portal</Text>

        {/* Login Card */}
        <View style={styles.card}>
          {/* Username Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputIconWrap}>
              <Ionicons name="person" size={18} color="#8b5cf6" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Admin Username"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputIconWrap}>
              <Ionicons name="lock-closed" size={18} color="#8b5cf6" />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#94a3b8"
              />
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8b5cf6', '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginBtnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.loginBtnText}>Secure Login</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>Protected by NavX Security</Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  // Background lighting orbs
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 280,
    height: 280,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    top: -60,
    right: -80,
  },
  orb2: {
    width: 220,
    height: 220,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
    bottom: 80,
    left: -60,
  },
  orb3: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
    top: SH * 0.35,
    right: -40,
  },
  // Logo
  logoContainer: {
    marginBottom: 20,
  },
  logoGlow: {
    width: 110,
    height: 110,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 36,
  },
  // Card
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.12)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  // Inputs
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    marginBottom: 14,
    paddingHorizontal: 4,
    height: 54,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 10,
  },
  // Login button
  loginBtn: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  loginBtnGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 54,
    borderRadius: 14,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
