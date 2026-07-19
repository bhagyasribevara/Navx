import React, { useContext, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Image
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import { SHADOWS, RADIUS } from "../theme/designSystem";
import api from '../api';
import Toast from 'react-native-root-toast';
import AnimatedPressable from '../components/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);

  // OTP Flow States
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep, setOtpStep] = useState(1); // 1 = request, 2 = verify
  const [loadingOtp, setLoadingOtp] = useState(false);
  
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber || "");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleRequestOtp = async () => {
    if (!mobileNumber) {
      Alert.alert("Error", "Please enter your registered mobile number");
      return;
    }

    setLoadingOtp(true);
    try {
      const res = await api.post("/app-auth/request-otp", { mobileNumber });
      if (res.data.success) {
        setOtpStep(2);
        
        // Show an elegant in-app drop-down toast notification
        Toast.show(`💬 New Message\nYour NavX password reset OTP is: ${res.data.devOtp}`, {
          duration: Toast.durations.LONG,
          position: Toast.positions.TOP,
          shadow: true,
          animation: true,
          hideOnPress: true,
          delay: 0,
          backgroundColor: '#3b82f6',
          opacity: 1,
        });
      }
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Failed to send OTP");
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || !newPassword) {
      Alert.alert("Error", "OTP and New Password are required");
      return;
    }
    setLoadingOtp(true);
    try {
      const res = await api.post("/app-auth/verify-otp", { mobileNumber, otpCode, newPassword });
      if (res.data.success) {
        Alert.alert("Success", "Password updated successfully!");
        setShowOtpModal(false);
        setOtpStep(1);
        setOtpCode("");
        setNewPassword("");
      }
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Failed to verify OTP");
    } finally {
      setLoadingOtp(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    header: {
      paddingTop: Platform.OS === 'ios' ? 8 : 22,
      paddingHorizontal: 20, paddingBottom: 16,
      backgroundColor: "transparent",
      flexDirection: "row", alignItems: "center",
    },
    title: { fontSize: 24, fontWeight: "800", color: colors.text, marginLeft: 16, flex: 1 },
    profileCard: {
      margin: 16, borderRadius: 20,
      backgroundColor: colors.card, padding: 18,
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.25)", ...SHADOWS.sm,
    },
    avatar: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: colors.primary + "20",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2.5, borderColor: colors.primary + "40", marginRight: 16,
      overflow: 'hidden'
    },
    avatarImg: { width: '100%', height: '100%' },
    profileName: { fontSize: 17, fontWeight: "800", color: colors.text },
    profileSub: { fontSize: 13, color: colors.textSec, marginTop: 2 },
    
    secLabel: {
      fontSize: 11, fontWeight: "800", color: colors.textMuted,
      textTransform: "uppercase", letterSpacing: 1.4,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    },
    group: {
      marginHorizontal: 16, backgroundColor: colors.card,
      borderRadius: 16, overflow: "hidden",
      borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.25)",
      ...SHADOWS.sm,
    },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    iconBox: {
      width: 36, height: 36, borderRadius: 99,
      alignItems: "center", justifyContent: "center", marginRight: 14,
    },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
    rowValue: { fontSize: 13, color: colors.textMuted },
    versionText: {
      textAlign: "center", color: colors.textMuted,
      fontSize: 12, marginTop: 20, marginBottom: 40,
    },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
    modalContent: { backgroundColor: colors.card, borderRadius: 20, padding: 24, ...SHADOWS.lg },
    modalTitle: { fontSize: 20, fontWeight: "bold", color: colors.text, marginBottom: 16, textAlign: "center" },
    input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, marginBottom: 12 },
    btnPrimary: { backgroundColor: colors.primary, padding: 14, borderRadius: 99, alignItems: "center", marginTop: 8, ...SHADOWS.primary() },
    btnPrimaryText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
    btnSecondary: { padding: 14, alignItems: "center", marginTop: 4 },
    btnSecondaryText: { color: colors.textSec, fontSize: 14, fontWeight: "600" },
    passwordInputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 16, marginBottom: 12 },
    passwordInput: { flex: 1, paddingVertical: 12, color: colors.text }
  });

  const RowAction = ({ icon, iconBg, label, onPress, last }) => (
    <AnimatedPressable style={[s.row, last && s.rowLast]} onPress={onPress}>
      <View style={[s.iconBox, { backgroundColor: iconBg || colors.primary + "15" }]}>
        <Ionicons name={icon} size={18} color={iconBg ? "#fff" : colors.primary} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </AnimatedPressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.22)', 'rgba(99, 102, 241, 0.10)', 'rgba(255, 255, 255, 0)']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 380,
        }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <AnimatedPressable onPress={() => navigation?.goBack?.()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </AnimatedPressable>
          <Text style={s.title}>Settings</Text>
        </View>

        {/* Profile card */}
        <TouchableOpacity style={s.profileCard} onPress={() => navigation.navigate("Profile")} activeOpacity={0.8}>
          <View style={s.avatar}>
            {user?.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={s.avatarImg} />
            ) : (
              <Ionicons name="person" size={26} color={colors.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{user?.fullName || (user?.username?.startsWith('stu_') ? 'NavX Student' : user?.username) || "NavX User"}</Text>
            <Text style={s.profileSub}>{user?.collegeEmail || user?.mobileNumber || "No contact linked"}</Text>
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + "15", alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pencil" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Student Services */}
        {user && !user.isGuest && (
          <>
            <Text style={s.secLabel}>Student Services</Text>
            <View style={s.group}>
              <RowAction 
                icon="school" iconBg="#6366f1" label="Academics & Timetable" 
                onPress={() => navigation.navigate("Academics")} 
              />
              <RowAction 
                icon="card" iconBg="#10b981" label="Fee Receipts & Payments" last
                onPress={() => navigation.navigate("Fees")} 
              />
            </View>
          </>
        )}

        {/* Account Security */}
        <Text style={s.secLabel}>Account Security</Text>
        <View style={s.group}>
          <RowAction 
            icon="lock-closed" iconBg="#f59e0b" label="Change Password (OTP)" 
            onPress={() => {
              setOtpStep(1);
              setMobileNumber(user?.mobileNumber || "");
              setShowOtpModal(true);
            }} 
          />
          <RowAction 
            icon="log-out" iconBg="#ef4444" label="Sign Out" last
            onPress={() => {
              Alert.alert("Sign Out", "Are you sure you want to log out?", [
                { text: "Cancel", style: "cancel" },
                { text: "Log Out", style: "destructive", onPress: logout }
              ]);
            }} 
          />
        </View>

        {/* About */}
        <Text style={s.secLabel}>About NavX</Text>
        <View style={s.group}>
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: "#6366f1" }]}><Ionicons name="information-circle" size={18} color="#fff" /></View>
            <Text style={s.rowLabel}>Version</Text>
            <Text style={s.rowValue}>1.0.0</Text>
          </View>
          <View style={[s.row, s.rowLast]}>
            <View style={[s.iconBox, { backgroundColor: "#8b5cf6" }]}><Ionicons name="code-slash" size={18} color="#fff" /></View>
            <Text style={s.rowLabel}>Build</Text>
            <Text style={s.rowValue}>2026.05.01</Text>
          </View>
        </View>

        <Text style={s.versionText}>
          NavX Indoor Navigation v1.0{"\n"}Built by Team NavX 
        </Text>

        {/* OTP Password Reset Modal */}
        <Modal visible={showOtpModal} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Change Password</Text>

              {otpStep === 1 ? (
                <>
                  <Text style={{ color: colors.textSec, marginBottom: 12 }}>Enter your registered mobile number to receive a 6-digit OTP code.</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Mobile Number"
                    placeholderTextColor={colors.textMuted}
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    keyboardType="phone-pad"
                    editable={!user?.mobileNumber} // Lock it if already set
                  />
                  <TouchableOpacity style={s.btnPrimary} onPress={handleRequestOtp} disabled={loadingOtp}>
                    {loadingOtp ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Send OTP</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ color: colors.textSec, marginBottom: 12 }}>Enter the OTP sent to your mobile terminal and your new password.</Text>
                  <TextInput
                    style={s.input}
                    placeholder="6-Digit OTP"
                    placeholderTextColor={colors.textMuted}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={s.passwordInputContainer}>
                    <TextInput
                      style={s.passwordInput}
                      placeholder="New Password"
                      placeholderTextColor={colors.textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 12 }}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={s.btnPrimary} onPress={handleVerifyOtp} disabled={loadingOtp}>
                    {loadingOtp ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Update Password</Text>}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={s.btnSecondary} onPress={() => setShowOtpModal(false)} disabled={loadingOtp}>
                <Text style={s.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </ScrollView>
    </View>
  );
}
