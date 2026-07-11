import React, { useState, useContext } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, KeyboardAvoidingView, Platform, 
  ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import { LIGHT as COLORS, SHADOWS, RADIUS } from '../theme/designSystem';
import AnimatedPressable from '../components/AnimatedPressable';
import api from '../api';

export default function AuthScreen() {
  const { login, register, guestLogin } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [isStudent, setIsStudent] = useState(false);
  
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [password, setPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 0: None, 1: Request OTP, 2: Verify OTP
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async () => {
    if (!password) {
      Alert.alert('Error', 'Password is required');
      return;
    }

    if (isStudent) {
      if (!collegeEmail || !collegeId) {
        Alert.alert('Error', 'College Email and College ID are required for student login');
        return;
      }
    } else {
      if (!username) {
        Alert.alert('Error', 'Username is required');
        return;
      }
      if (!isLogin && !mobileNumber) {
        Alert.alert('Error', 'Mobile Number is required for registration');
        return;
      }
    }

    if (isStudent && !isLogin) {
      if (!username || !mobileNumber || !collegeEmail || !collegeId || !department || !semester) {
        Alert.alert('Error', 'Please fill all required student details');
        return;
      }
    }

    setLoading(true);
    let res;
    
    if (isLogin) {
      res = await login({
        identifier: username,
        password,
        isStudent,
        collegeEmail,
        collegeId
      });
    } else {
      res = await register({
        username,
        mobileNumber,
        collegeEmail,
        collegeId,
        department,
        semester,
        section,
        password,
        isStudent
      });
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

  const handleRequestOtp = async () => {
    if (isStudent && !collegeEmail) return Alert.alert('Error', 'Please enter your college email');
    if (!isStudent && !mobileNumber) return Alert.alert('Error', 'Please enter your mobile number');
    
    setLoading(true);
    try {
      const res = await api.post('/app-auth/request-otp', {
        isStudent,
        collegeEmail,
        mobileNumber
      });
      if (res.data.success) {
        Alert.alert('OTP Sent', res.data.message + (res.data.devOtp ? `\n\n(Dev OTP: ${res.data.devOtp})` : ''));
        setForgotPasswordStep(2);
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to request OTP');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || !newPassword) return Alert.alert('Error', 'OTP and new password are required');
    
    setLoading(true);
    try {
      const res = await api.post('/app-auth/verify-otp', {
        isStudent,
        collegeEmail,
        mobileNumber,
        otpCode,
        newPassword
      });
      if (res.data.success) {
        Alert.alert('Success', 'Password reset successfully');
        setForgotPasswordStep(0);
        setPassword('');
        setOtpCode('');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to verify OTP');
    }
    setLoading(false);
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

      <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.header}>
            <Ionicons name="compass" size={48} color={COLORS.primary} />
            <Text style={s.title}>NavX</Text>
            <Text style={s.subtitle}>
              {forgotPasswordStep > 0 
                ? 'Reset your password'
                : (isLogin ? 'Welcome back! Please login.' : 'Create an account to get started.')}
            </Text>
          </View>

          {/* Role Toggle */}
          <View style={s.roleToggleContainer}>
            <AnimatedPressable 
              style={[s.roleToggleBtn, !isStudent && s.roleToggleActive]} 
              onPress={() => setIsStudent(false)}
            >
              <Ionicons name="person" size={16} color={!isStudent ? '#fff' : COLORS.textSec} style={{marginRight: 6}} />
              <Text style={[s.roleToggleText, !isStudent && s.roleToggleTextActive]}>Regular</Text>
            </AnimatedPressable>
            <AnimatedPressable 
              style={[s.roleToggleBtn, isStudent && s.roleToggleActive]} 
              onPress={() => setIsStudent(true)}
            >
              <Ionicons name="school" size={16} color={isStudent ? '#fff' : COLORS.textSec} style={{marginRight: 6}} />
              <Text style={[s.roleToggleText, isStudent && s.roleToggleTextActive]}>Student</Text>
            </AnimatedPressable>
          </View>

          {forgotPasswordStep > 0 ? (
            <View style={s.form}>
              {isStudent ? (
                <View style={s.inputGroup}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="College Email"
                    placeholderTextColor={COLORS.textMuted}
                    value={collegeEmail}
                    onChangeText={setCollegeEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={forgotPasswordStep === 1}
                  />
                </View>
              ) : (
                <View style={s.inputGroup}>
                  <Ionicons name="call-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="Mobile Number"
                    placeholderTextColor={COLORS.textMuted}
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    keyboardType="phone-pad"
                    editable={forgotPasswordStep === 1}
                  />
                </View>
              )}

              {forgotPasswordStep === 2 && (
                <>
                  <View style={s.inputGroup}>
                    <Ionicons name="keypad-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor={COLORS.textMuted}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <View style={s.inputGroup}>
                    <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      placeholder="New Password"
                      placeholderTextColor={COLORS.textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                    />
                    <AnimatedPressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSec} />
                    </AnimatedPressable>
                  </View>
                </>
              )}

              <AnimatedPressable 
                style={s.submitBtn} 
                onPress={forgotPasswordStep === 1 ? handleRequestOtp : handleVerifyOtp} 
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitText}>
                    {forgotPasswordStep === 1 ? 'Send OTP' : 'Reset Password'}
                  </Text>
                )}
              </AnimatedPressable>

              <AnimatedPressable 
                style={s.toggleBtn} 
                onPress={() => setForgotPasswordStep(0)}
              >
                <Text style={s.toggleText}>Back to Login</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <View style={s.form}>
              {isStudent ? (
                <>
                  {!isLogin && (
                    <>
                      <View style={s.inputGroup}>
                        <Ionicons name="person-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
                        <TextInput
                          style={s.input}
                          placeholder="Full Name"
                          placeholderTextColor={COLORS.textMuted}
                          value={username}
                          onChangeText={setUsername}
                        />
                      </View>
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
                    </>
                  )}
                  
                  <View style={s.inputGroup}>
                    <Ionicons name="mail-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      placeholder="College Email"
                      placeholderTextColor={COLORS.textMuted}
                      value={collegeEmail}
                      onChangeText={setCollegeEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={s.inputGroup}>
                    <Ionicons name="id-card-outline" size={20} color={COLORS.textSec} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      placeholder="College ID (Roll Number)"
                      placeholderTextColor={COLORS.textMuted}
                      value={collegeId}
                      onChangeText={setCollegeId}
                      autoCapitalize="characters"
                    />
                  </View>

                  {!isLogin && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={[s.inputGroup, { flex: 1 }]}>
                        <TextInput
                          style={s.input}
                          placeholder="Dept (e.g. CSE)"
                          placeholderTextColor={COLORS.textMuted}
                          value={department}
                          onChangeText={setDepartment}
                          autoCapitalize="characters"
                        />
                      </View>
                      <View style={[s.inputGroup, { flex: 1 }]}>
                        <TextInput
                          style={s.input}
                          placeholder="Sem (e.g. 6)"
                          placeholderTextColor={COLORS.textMuted}
                          value={semester}
                          onChangeText={setSemester}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={[s.inputGroup, { flex: 0.8 }]}>
                        <TextInput
                          style={s.input}
                          placeholder="Sec (A)"
                          placeholderTextColor={COLORS.textMuted}
                          value={section}
                          onChangeText={setSection}
                          autoCapitalize="characters"
                        />
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <>
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
                </>
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
                <AnimatedPressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSec} />
                </AnimatedPressable>
              </View>

              {isLogin && (
                <View style={{ alignItems: 'flex-end', marginTop: -8 }}>
                  <TouchableOpacity onPress={() => setForgotPasswordStep(1)}>
                    <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '500' }}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
              )}

              <AnimatedPressable style={s.submitBtn} onPress={handleSubmit} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
                )}
              </AnimatedPressable>

              <View style={s.dividerContainer}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              <AnimatedPressable style={s.guestBtn} onPress={handleGuestLogin} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Text style={s.guestText}>Continue as Guest</Text>
                )}
              </AnimatedPressable>
            </View>
          )}

          {forgotPasswordStep === 0 && (
            <AnimatedPressable 
              style={s.toggleBtn} 
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={s.toggleText}>
                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </Text>
            </AnimatedPressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 24,
    ...SHADOWS.lg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.text, marginTop: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSec, marginTop: 4, textAlign: 'center' },
  roleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  roleToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  roleToggleActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.sm
  },
  roleToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSec
  },
  roleToggleTextActive: {
    color: '#fff'
  },
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
    marginVertical: 8,
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
