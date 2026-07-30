import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, KeyboardAvoidingView, Platform, 
  ActivityIndicator, Alert, ScrollView, Animated,
  Modal, Pressable, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle as SvgCircle, G } from 'react-native-svg';
import { AuthContext } from '../context/AuthContext';
import { LIGHT as COLORS, SHADOWS, RADIUS } from '../theme/designSystem';
import api from '../api';

const { width: SW } = Dimensions.get('window');

// ── SVG LOGO ICONS FOR SOCIAL & ILLUSTRATIONS ───────────────────────
function GoogleLogoSVG({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function MicrosoftLogoSVG({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <Rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <Rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <Rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </Svg>
  );
}

function AppleLogoSVG({ size = 20, color = "#000000" }) {
  return (
    <Ionicons name="logo-apple" size={size} color={color} />
  );
}

function EmailLogoSVG({ size = 20, color = "#6D28D9" }) {
  return (
    <Ionicons name="mail" size={size} color={color} />
  );
}

// ── HOVER PRESSABLE WRAPPER WITH MICRO-ANIMATIONS ───────────────────
function HoverPressable({ children, onPress, style, scaleTo = 0.97, hoverScale = 1.02, disabled = false, ...props }) {
  const anim = useRef(new Animated.Value(0)).current; // 0: Idle, 1: Hover/Press

  const handleMouseEnter = () => {
    if (disabled) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, hoverScale],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPressIn={handleMouseEnter}
      onPressOut={handleMouseLeave}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale }, { translateY }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ── CUSTOM INPUT FIELD COMPONENT WITH HOVER & FOCUS ANIMATION ────────
function CustomInputField({
  leftIcon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  rightElement,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  maxLength
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isFocused ? 1 : (isHovered ? 0.5 : 0),
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, isHovered]);

  const borderColor = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#EEF2F6', '#C4B5FD', '#7C3AED'],
  });

  const backgroundColor = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#F8FAFC', '#FAF5FF', '#FFFFFF'],
  });

  return (
    <Animated.View
      style={[
        s.inputContainer,
        { borderColor, backgroundColor },
        isFocused && s.inputContainerFocused
      ]}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {leftIcon && (
        <View style={s.inputIconBadge}>
          <Ionicons name={leftIcon} size={18} color="#7C3AED" />
        </View>
      )}
      <TextInput
        style={s.textInput}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        maxLength={maxLength}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {rightElement && <View style={s.rightElementWrap}>{rightElement}</View>}
    </Animated.View>
  );
}

// ── MAIN AUTH SCREEN COMPONENT ───────────────────────────────────────
export default function AuthScreen() {
  const { login, register, guestLogin } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [isStudent, setIsStudent] = useState(false);
  
  // Fields
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot Password Flow (0: None, 1: Request OTP, 2: Verify OTP)
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Dropdown Pickers Modal
  const [pickerModal, setPickerModal] = useState({ visible: false, type: '', options: [], title: '' });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '#CBD5E1' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8 && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 1) return { score: 1, label: 'Weak', color: '#EF4444' };
    if (score === 2) return { score: 2, label: 'Fair', color: '#F59E0B' };
    if (score === 3) return { score: 3, label: 'Good', color: '#3B82F6' };
    return { score: 4, label: 'Strong', color: '#22C55E' };
  }, [password]);

  // Form Submit Handler
  const handleSubmit = async () => {
    if (!password) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }

    if (!isLogin && password !== confirmPassword && confirmPassword.length > 0) {
      Alert.alert('Mismatch', 'Passwords do not match. Please verify.');
      return;
    }

    if (isStudent) {
      if (!isLogin && (!collegeEmail || !collegeId || !username || !mobileNumber)) {
        Alert.alert('Incomplete Form', 'Please fill in all student registration details.');
        return;
      } else if (isLogin && !collegeEmail) {
        Alert.alert('Required', 'College Email is required for student login.');
        return;
      }
    } else {
      if (!username) {
        Alert.alert('Required', 'Username is required.');
        return;
      }
      if (!isLogin && !mobileNumber) {
        Alert.alert('Required', 'Mobile Number is required for registration.');
        return;
      }
    }

    setLoading(true);
    let res;
    
    if (isLogin) {
      res = await login({
        identifier: isStudent ? collegeEmail : username,
        password,
        isStudent,
        collegeEmail,
        collegeId
      });
    } else {
      res = await register({
        username,
        mobileNumber: countryCode + ' ' + mobileNumber,
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

    if (res && !res.success) {
      Alert.alert('Authentication Failed', res.error || 'Failed to authenticate');
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    const res = await guestLogin();
    setLoading(false);
    if (res && !res.success) {
      Alert.alert('Guest Mode Error', res.error || 'Guest login failed');
    }
  };

  const handleRequestOtp = async () => {
    if (isStudent && !collegeEmail) return Alert.alert('Required', 'Please enter your college email');
    if (!isStudent && !mobileNumber) return Alert.alert('Required', 'Please enter your mobile number');
    
    setLoading(true);
    try {
      const res = await api.post('/app-auth/request-otp', {
        isStudent,
        collegeEmail,
        mobileNumber
      });
      if (res.data.success) {
        Alert.alert('OTP Dispatched', res.data.message + (res.data.devOtp ? `\n\n(Dev OTP: ${res.data.devOtp})` : ''));
        setForgotPasswordStep(2);
      }
    } catch (e) {
      Alert.alert('OTP Failed', e.response?.data?.error || 'Failed to request OTP');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || !newPassword) return Alert.alert('Required', 'OTP and new password are required');
    
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
        Alert.alert('Success', 'Password reset successfully! You can now log in.');
        setForgotPasswordStep(0);
        setPassword('');
        setOtpCode('');
      }
    } catch (e) {
      Alert.alert('Verification Failed', e.response?.data?.error || 'Failed to verify OTP');
    }
    setLoading(false);
  };

  // Open Dropdown Pickers
  const openPicker = (type, title, options) => {
    setPickerModal({ visible: true, type, title, options });
  };

  const selectPickerOption = (val) => {
    if (pickerModal.type === 'dept') setDepartment(val);
    if (pickerModal.type === 'sem') setSemester(val);
    if (pickerModal.type === 'sec') setSection(val);
    if (pickerModal.type === 'country') setCountryCode(val);
    setPickerModal({ visible: false, type: '', options: [], title: '' });
  };

  return (
    <KeyboardAvoidingView 
      style={s.screenContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Dynamic Ambient Background Gradients */}
      <LinearGradient
        colors={['#F5F3FF', '#EDE9FE', '#F8FAFC']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* Decorative Top Ambient Glow */}
      <View style={s.topAmbientGlow} />

      <ScrollView 
        contentContainerStyle={s.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[s.authCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {/* Header Navigation Bar (Back Arrow & Settings Icon) */}
          <View style={s.topHeaderBar}>
            {(!isLogin || forgotPasswordStep > 0) ? (
              <TouchableOpacity 
                style={s.topIconBtn} 
                onPress={() => {
                  if (forgotPasswordStep > 0) setForgotPasswordStep(0);
                  else setIsLogin(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={20} color="#334155" />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}

            <TouchableOpacity 
              style={s.topIconBtn} 
              onPress={() => Alert.alert('NavX Navigation', 'NavX Smart Campus Navigation v1.0\nSecure & Isolated Venue Auth')}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-sharp" size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Logo Branding */}
          <View style={s.brandSection}>
            <Animated.View style={[s.logoRingOuter, { transform: [{ scale: logoPulse }] }]}>
              <View style={s.logoRingInner}>
                <Ionicons name="compass" size={32} color="#FFFFFF" />
              </View>
            </Animated.View>
            <Text style={s.brandTitle}>
              Nav<Text style={{ color: '#7C3AED' }}>X</Text>
            </Text>
            <Text style={s.brandSubtitle}>Smart Campus Navigation</Text>

            {/* Title / Header Context Text */}
            <Text style={s.formHeaderTitle}>
              {forgotPasswordStep > 0 ? (
                'Reset your password'
              ) : isLogin ? (
                'Welcome back! Please log in.'
              ) : isStudent ? (
                <>Create your <Text style={{ color: '#7C3AED' }}>student</Text> account 🎓</>
              ) : (
                'Create your account'
              )}
            </Text>
            {(!isLogin || forgotPasswordStep > 0) && (
              <Text style={s.formHeaderSubtitle}>
                {forgotPasswordStep > 0 
                  ? 'Verify your details to set a new password ✨'
                  : (isStudent ? 'Fill in your details to get started ✨' : "Let's get you started with NavX ✨")}
              </Text>
            )}
          </View>

          {/* Role Switcher Capsule (Regular vs Student) */}
          <View style={s.roleToggleContainer}>
            <TouchableOpacity 
              style={[s.roleTogglePill, !isStudent && s.roleTogglePillActive]} 
              onPress={() => setIsStudent(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="person" size={16} color={!isStudent ? '#FFFFFF' : '#64748B'} style={{ marginRight: 6 }} />
              <Text style={[s.roleToggleText, !isStudent && s.roleToggleTextActive]}>Regular</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.roleTogglePill, isStudent && s.roleTogglePillActive]} 
              onPress={() => setIsStudent(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="school" size={16} color={isStudent ? '#FFFFFF' : '#64748B'} style={{ marginRight: 6 }} />
              <Text style={[s.roleToggleText, isStudent && s.roleToggleTextActive]}>Student</Text>
            </TouchableOpacity>
          </View>

          {/* FORGOT PASSWORD FORM FLOW */}
          {forgotPasswordStep > 0 ? (
            <View style={s.formBody}>
              {isStudent ? (
                <CustomInputField
                  leftIcon="mail"
                  placeholder="College Email (e.g. you@college.edu.in)"
                  value={collegeEmail}
                  onChangeText={setCollegeEmail}
                  keyboardType="email-address"
                  editable={forgotPasswordStep === 1}
                />
              ) : (
                <CustomInputField
                  leftIcon="call"
                  placeholder="Mobile Number"
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  editable={forgotPasswordStep === 1}
                />
              )}

              {forgotPasswordStep === 2 && (
                <>
                  <CustomInputField
                    leftIcon="keypad"
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <CustomInputField
                    leftIcon="lock-closed"
                    placeholder="Create New Password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    rightElement={
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="#64748B" />
                      </TouchableOpacity>
                    }
                  />
                </>
              )}

              <HoverPressable 
                style={s.primaryGradientBtn} 
                onPress={forgotPasswordStep === 1 ? handleRequestOtp : handleVerifyOtp} 
                disabled={loading}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#6D28D9']}
                  style={s.gradientFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={s.primaryBtnText}>
                        {forgotPasswordStep === 1 ? 'Send OTP' : 'Reset Password'}
                      </Text>
                      <View style={s.circleArrowRight}>
                        <Ionicons name="arrow-forward" size={16} color="#7C3AED" />
                      </View>
                    </>
                  )}
                </LinearGradient>
              </HoverPressable>

              <TouchableOpacity 
                style={{ alignSelf: 'center', marginTop: 12 }} 
                onPress={() => setForgotPasswordStep(0)}
              >
                <Text style={{ color: '#7C3AED', fontSize: 14, fontWeight: '700' }}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* NORMAL LOGIN / SIGNUP FORM FLOW */
            <View style={s.formBody}>
              {/* REGULAR vs STUDENT INPUT FIELDS */}
              {isStudent ? (
                /* STUDENT FORM FIELDS */
                <>
                  {!isLogin && (
                    <>
                      <CustomInputField
                        leftIcon="person"
                        placeholder="Full Name"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="words"
                      />
                      <CustomInputField
                        leftIcon="call"
                        placeholder="Mobile Number"
                        value={mobileNumber}
                        onChangeText={setMobileNumber}
                        keyboardType="phone-pad"
                        rightElement={
                          <TouchableOpacity 
                            style={s.countryPill}
                            onPress={() => openPicker('country', 'Select Country Code', ['+91', '+1', '+44', '+61', '+971'])}
                          >
                            <Text style={s.countryPillText}>{countryCode} ▾</Text>
                          </TouchableOpacity>
                        }
                      />
                    </>
                  )}
                  
                  <CustomInputField
                    leftIcon="mail"
                    placeholder="College Email"
                    value={collegeEmail}
                    onChangeText={setCollegeEmail}
                    keyboardType="email-address"
                    rightElement={
                      collegeEmail.includes('@') ? (
                        <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                      ) : null
                    }
                  />

                  {!isLogin && (
                    <>
                      <CustomInputField
                        leftIcon="card"
                        placeholder="College ID / Roll Number"
                        value={collegeId}
                        onChangeText={setCollegeId}
                        autoCapitalize="characters"
                      />

                      {/* 3-COLUMN DROPDOWN PICKERS ROW (Department, Semester, Section) */}
                      <View style={s.gridRow}>
                        <TouchableOpacity 
                          style={s.gridPickerBox} 
                          onPress={() => openPicker('dept', 'Select Department', ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI&DS', 'Other'])}
                          activeOpacity={0.8}
                        >
                          <Text style={s.gridPickerLabel}>Department</Text>
                          <View style={s.gridPickerValueRow}>
                            <Text style={[s.gridPickerValue, !department && s.gridPickerPlaceholder]} numberOfLines={1}>
                              {department || 'Select dept'}
                            </Text>
                            <Ionicons name="chevron-down" size={14} color="#64748B" />
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={s.gridPickerBox} 
                          onPress={() => openPicker('sem', 'Select Semester', ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'])}
                          activeOpacity={0.8}
                        >
                          <Text style={s.gridPickerLabel}>Semester</Text>
                          <View style={s.gridPickerValueRow}>
                            <Text style={[s.gridPickerValue, !semester && s.gridPickerPlaceholder]} numberOfLines={1}>
                              {semester || 'Select sem'}
                            </Text>
                            <Ionicons name="chevron-down" size={14} color="#64748B" />
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={s.gridPickerBox} 
                          onPress={() => openPicker('sec', 'Select Section', ['Sec A', 'Sec B', 'Sec C', 'Sec D'])}
                          activeOpacity={0.8}
                        >
                          <Text style={s.gridPickerLabel}>Section</Text>
                          <View style={s.gridPickerValueRow}>
                            <Text style={[s.gridPickerValue, !section && s.gridPickerPlaceholder]} numberOfLines={1}>
                              {section || 'Select sec'}
                            </Text>
                            <Ionicons name="chevron-down" size={14} color="#64748B" />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              ) : (
                /* REGULAR FORM FIELDS */
                <>
                  <CustomInputField
                    leftIcon="person"
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    rightElement={
                      !isLogin && username.length > 2 ? (
                        <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                      ) : (isLogin ? <Ionicons name="person-outline" size={18} color="#94A3B8" /> : null)
                    }
                  />

                  {!isLogin && (
                    <CustomInputField
                      leftIcon="call"
                      placeholder="Mobile Number"
                      value={mobileNumber}
                      onChangeText={setMobileNumber}
                      keyboardType="phone-pad"
                      rightElement={
                        <TouchableOpacity 
                          style={s.countryPill}
                          onPress={() => openPicker('country', 'Select Country Code', ['+91', '+1', '+44', '+61', '+971'])}
                        >
                          <Text style={s.countryPillText}>{countryCode} ▾</Text>
                        </TouchableOpacity>
                      }
                    />
                  )}
                </>
              )}

              {/* PASSWORD FIELD */}
              <CustomInputField
                leftIcon="lock-closed"
                placeholder={isLogin ? "Password" : "Create a strong password"}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                rightElement={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="#64748B" />
                  </TouchableOpacity>
                }
              />

              {/* CONFIRM PASSWORD (ONLY ON SIGNUP) */}
              {!isLogin && (
                <CustomInputField
                  leftIcon="lock-closed"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  rightElement={
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={18} color="#64748B" />
                    </TouchableOpacity>
                  }
                />
              )}

              {/* PASSWORD STRENGTH INDICATOR (ONLY ON SIGNUP) */}
              {!isLogin && password.length > 0 && (
                <View style={s.strengthContainer}>
                  <View style={s.strengthHeader}>
                    <Ionicons name="shield-checkmark" size={14} color={passwordStrength.color} />
                    <Text style={s.strengthText}>
                      Password strength: <Text style={{ color: passwordStrength.color, fontWeight: '800' }}>{passwordStrength.label}</Text>
                    </Text>
                  </View>
                  <View style={s.strengthMeterBar}>
                    {[1, 2, 3, 4].map((step) => (
                      <View
                        key={step}
                        style={[
                          s.strengthSegment,
                          { backgroundColor: step <= passwordStrength.score ? passwordStrength.color : '#E2E8F0' }
                        ]}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* FORGOT PASSWORD LINK (ONLY ON LOGIN) */}
              {isLogin && (
                <View style={s.forgotRow}>
                  <TouchableOpacity onPress={() => setForgotPasswordStep(1)} activeOpacity={0.7}>
                    <Text style={s.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* MAIN VIBRANT GRADIENT BUTTON (SIGN IN / SIGN UP) */}
              <HoverPressable 
                style={s.primaryGradientBtn} 
                onPress={handleSubmit} 
                disabled={loading}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#6D28D9']}
                  style={s.gradientFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      {/* On Login: Left Circle Arrow Icon Badge */}
                      {isLogin && (
                        <View style={s.circleArrowLeft}>
                          <Ionicons name="arrow-forward" size={16} color="#7C3AED" />
                        </View>
                      )}

                      <Text style={s.primaryBtnText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>

                      {/* On Signup: Right Circle Arrow Icon Badge */}
                      {!isLogin && (
                        <View style={s.circleArrowRight}>
                          <Ionicons name="arrow-forward" size={16} color="#7C3AED" />
                        </View>
                      )}
                    </>
                  )}
                </LinearGradient>
              </HoverPressable>

              {/* DIVIDER: "or continue with" / "or sign up with" */}
              <View style={s.dividerContainer}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>{isLogin ? 'or continue with' : 'or sign up with'}</Text>
                <View style={s.dividerLine} />
              </View>

              {/* SOCIAL LOGIN BUTTONS ROW */}
              <View style={s.socialRow}>
                <HoverPressable 
                  style={s.socialBtn} 
                  onPress={() => Alert.alert('Google Sign-In', 'Google Authentication initialized.')}
                >
                  <GoogleLogoSVG size={22} />
                </HoverPressable>

                <HoverPressable 
                  style={s.socialBtn} 
                  onPress={() => Alert.alert('Microsoft Sign-In', 'Microsoft Authentication initialized.')}
                >
                  <MicrosoftLogoSVG size={20} />
                </HoverPressable>

                <HoverPressable 
                  style={s.socialBtn} 
                  onPress={() => Alert.alert('Apple Sign-In', 'Apple ID Authentication initialized.')}
                >
                  <AppleLogoSVG size={22} color="#000" />
                </HoverPressable>

                <HoverPressable 
                  style={s.socialBtn} 
                  onPress={() => Alert.alert('Direct Contact', 'Direct verification initialized.')}
                >
                  <EmailLogoSVG size={20} color="#7C3AED" />
                </HoverPressable>
              </View>

              {/* GUEST LOGIN BUTTON */}
              <HoverPressable 
                style={s.guestOutlineBtn} 
                onPress={handleGuestLogin} 
                disabled={loading}
              >
                <Ionicons name="person-outline" size={18} color="#7C3AED" style={{ marginRight: 8 }} />
                <Text style={s.guestBtnText}>Continue as Guest</Text>
              </HoverPressable>

              {/* SECURITY / DATA SAFE BANNER (FOR STUDENT REGISTRATION) */}
              {!isLogin && isStudent && (
                <View style={s.securityBanner}>
                  <View style={s.securityCapBadge}>
                    <Ionicons name="school" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.securityTitle}>Your data is safe with us</Text>
                    <Text style={s.securitySubtitle}>We never share your information.</Text>
                  </View>
                  <Ionicons name="shield-checkmark" size={20} color="#7C3AED" />
                </View>
              )}
            </View>
          )}

          {/* FOOTER SWITCH LINK */}
          {forgotPasswordStep === 0 && (
            <TouchableOpacity 
              style={s.footerLinkBtn} 
              onPress={() => setIsLogin(!isLogin)}
              activeOpacity={0.7}
            >
              <Text style={s.footerLinkText}>
                {isLogin ? (
                  <>Don't have an account? <Text style={s.footerLinkHighlight}>Sign Up</Text></>
                ) : (
                  <>Already have an account? <Text style={s.footerLinkHighlight}>Sign In ›</Text></>
                )}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>

      {/* DROPDOWN OPTIONS MODAL */}
      <Modal
        visible={pickerModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPickerModal({ ...pickerModal, visible: false })}
      >
        <Pressable style={s.modalOverlay} onPress={() => setPickerModal({ ...pickerModal, visible: false })}>
          <View style={s.modalContentCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{pickerModal.title}</Text>
              <TouchableOpacity onPress={() => setPickerModal({ ...pickerModal, visible: false })}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 280 }}>
              {pickerModal.options.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={s.modalOptionRow}
                  onPress={() => selectPickerOption(item)}
                >
                  <Text style={s.modalOptionText}>{item}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── STYLESHEET WITH PERFECT ALIGNMENT & DESIGN SYSTEM ───────────────
const s = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topAmbientGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: SW * 0.9,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  authCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.8)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },

  /* Top Navigation Header (Back / Settings) */
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  /* Brand Section */
  brandSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoRingOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#DDD6FE',
  },
  logoRingInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  formHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 14,
    textAlign: 'center',
  },
  formHeaderSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },

  /* Role Switcher Capsule */
  roleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleTogglePill: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  roleTogglePillActive: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  roleToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  roleToggleTextActive: {
    color: '#FFFFFF',
  },

  /* Form Body & Custom Inputs */
  formBody: {
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  inputContainerFocused: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  inputIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    height: '100%',
  },
  rightElementWrap: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  countryPill: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  countryPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6D28D9',
  },

  /* Grid 3-Column Dropdown Selectors */
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridPickerBox: {
    flex: 1,
    height: 52,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EEF2F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  gridPickerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  gridPickerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  gridPickerValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  gridPickerPlaceholder: {
    color: '#94A3B8',
    fontWeight: '600',
  },

  /* Password Strength Meter */
  strengthContainer: {
    marginTop: 2,
    marginBottom: 4,
  },
  strengthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  strengthText: {
    fontSize: 12,
    color: '#64748B',
  },
  strengthMeterBar: {
    flexDirection: 'row',
    gap: 6,
    height: 5,
  },
  strengthSegment: {
    flex: 1,
    borderRadius: 3,
  },

  /* Forgot Password Link */
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -2,
    marginBottom: 2,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },

  /* Main Gradient Button & Arrows */
  primaryGradientBtn: {
    height: 54,
    borderRadius: 18,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  gradientFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  circleArrowLeft: {
    position: 'absolute',
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  circleArrowRight: {
    position: 'absolute',
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  /* Divider */
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Social Icons Row */
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  socialBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },

  /* Guest Button */
  guestOutlineBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    borderStyle: 'dashed',
    backgroundColor: '#FAF5FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  guestBtnText: {
    color: '#7C3AED',
    fontSize: 15,
    fontWeight: '800',
  },

  /* Security Safe Banner (Student Signup) */
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginTop: 6,
    gap: 10,
  },
  securityCapBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6D28D9',
  },
  securitySubtitle: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 1,
  },

  /* Footer Switch Link */
  footerLinkBtn: {
    marginTop: 20,
    alignSelf: 'center',
    padding: 6,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  footerLinkHighlight: {
    color: '#7C3AED',
    fontWeight: '800',
  },

  /* Modal Overlay for Dropdown Selectors */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
});
