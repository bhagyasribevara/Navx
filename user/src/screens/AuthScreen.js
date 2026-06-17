import React, { useState, useContext } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, KeyboardAvoidingView, Platform, 
  ActivityIndicator, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import { LIGHT as COLORS, SHADOWS, RADIUS } from '../theme/designSystem';

export default function AuthScreen() {
  const { login, register, guestLogin } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }
    if (!isLogin && !mobileNumber) {
      Alert.alert('Error', 'Mobile Number is required for registration');
      return;
    }

    setLoading(true);
    let res;
    if (isLogin) {
      res = await login(username, password);
    } else {
      res = await register(username, mobileNumber, password);
    }
    setLoading(false);

    if (!res.success) {
      Alert.alert('Authentication Failed', res.error);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    const res = await guestLogin();
    setLoading(false);
    if (!res.success) {
      Alert.alert('Guest Login Failed', res.error);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={s.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient 
        colors={[COLORS.bgGradient[0], COLORS.bgGradient[1]]} 
        style={StyleSheet.absoluteFillObject} 
      />

      <View style={s.card}>
        <View style={s.header}>
          <Ionicons name="compass" size={48} color={COLORS.primary} />
          <Text style={s.title}>NavX</Text>
          <Text style={s.subtitle}>
            {isLogin ? 'Welcome back! Please login.' : 'Create an account to get started.'}
          </Text>
        </View>

        <View style={s.form}>
          <View style={s.inputGroup}>
            <Ionicons name="person-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="Username"
              placeholderTextColor={COLORS.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {!isLogin && (
            <View style={s.inputGroup}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Mobile Number"
                placeholderTextColor={COLORS.textMuted}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                keyboardType="phone-pad"
              />
            </View>
          )}

          <View style={s.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSec} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
            )}
          </TouchableOpacity>

          <View style={s.dividerContainer}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity style={s.guestBtn} onPress={handleGuestLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={s.guestText}>Continue as Guest</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={s.toggleBtn} 
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={s.toggleText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 24,
    ...SHADOWS.lg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.text, marginTop: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSec, marginTop: 4, textAlign: 'center' },
  form: { gap: 16 },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    height: 56
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    height: '100%'
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    ...SHADOWS.md
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  toggleBtn: { marginTop: 24, alignItems: 'center' },
  toggleText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  guestBtn: {
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    height: 56,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  }
});
