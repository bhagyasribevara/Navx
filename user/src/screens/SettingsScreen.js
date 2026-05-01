import React, { useContext, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import { SHADOWS, RADIUS } from "../theme/designSystem";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
  { code: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { code: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export default function SettingsScreen({ navigation }) {
  const { colors, isDark, setIsDark, language, setLanguage } = useContext(ThemeContext);
  const [voiceNav, setVoiceNav] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [avoidStairs, setAvoidStairs] = useState(false);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingTop: Platform.OS === "ios" ? 56 : 16,
      paddingHorizontal: 20, paddingBottom: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      flexDirection: "row", alignItems: "center",
    },
    title: { fontSize: 24, fontWeight: "800", color: colors.text, marginLeft: 16, flex: 1 },
    profileCard: {
      margin: 16, borderRadius: RADIUS.lg,
      backgroundColor: colors.card, padding: 20,
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: colors.border, ...SHADOWS.sm,
    },
    avatar: {
      width: 58, height: 58, borderRadius: 29,
      backgroundColor: colors.primary + "20",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2.5, borderColor: colors.primary + "40", marginRight: 16,
    },
    profileName: { fontSize: 17, fontWeight: "800", color: colors.text },
    profileSub: { fontSize: 13, color: colors.textSec, marginTop: 2 },
    editBtn: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
      borderWidth: 1.5, borderColor: colors.primary + "40",
      backgroundColor: colors.primary + "12",
    },
    editBtnText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    secLabel: {
      fontSize: 11, fontWeight: "700", color: colors.textMuted,
      textTransform: "uppercase", letterSpacing: 1.4,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    },
    group: {
      marginHorizontal: 16, backgroundColor: colors.card,
      borderRadius: RADIUS.md, overflow: "hidden",
      borderWidth: 1, borderColor: colors.border,
    },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    iconBox: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center", marginRight: 14,
    },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
    rowValue: { fontSize: 13, color: colors.textMuted },
    // Language grid
    langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
    langChip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 99, borderWidth: 1.5,
      flexDirection: "row", alignItems: "center", gap: 6,
    },
    langText: { fontSize: 13, fontWeight: "600" },
    // Theme toggle
    themeRow: {
      flexDirection: "row", margin: 16, gap: 10,
    },
    themeBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 14, borderRadius: RADIUS.md,
      borderWidth: 1.5, gap: 8,
    },
    themeBtnText: { fontSize: 14, fontWeight: "700" },
    // Version
    versionText: {
      textAlign: "center", color: colors.textMuted,
      fontSize: 12, marginTop: 20, marginBottom: 40,
    },
  });

  const Row = ({ icon, iconBg, label, value, last, children }) => (
    <View style={[s.row, last && s.rowLast]}>
      <View style={[s.iconBox, { backgroundColor: iconBg || colors.primary + "15" }]}>
        <Ionicons name={icon} size={18} color={iconBg ? "#fff" : colors.primary} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      {value && <Text style={s.rowValue}>{value}</Text>}
      {children}
    </View>
  );

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
      </View>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Ionicons name="person" size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.profileName}>NavX User</Text>
          <Text style={s.profileSub}>Student · Indoor Navigator</Text>
        </View>
        <TouchableOpacity style={s.editBtn}>
          <Text style={s.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Appearance */}
      <Text style={s.secLabel}>Appearance</Text>
      <View style={s.themeRow}>
        <TouchableOpacity
          style={[s.themeBtn, {
            borderColor: !isDark ? colors.primary : colors.border,
            backgroundColor: !isDark ? colors.primary + "12" : "transparent",
          }]}
          onPress={() => setIsDark(false)}
        >
          <Ionicons name="sunny" size={18} color={!isDark ? colors.primary : colors.textMuted} />
          <Text style={[s.themeBtnText, { color: !isDark ? colors.primary : colors.textMuted }]}>Light</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.themeBtn, {
            borderColor: isDark ? colors.primary : colors.border,
            backgroundColor: isDark ? colors.primary + "12" : "transparent",
          }]}
          onPress={() => setIsDark(true)}
        >
          <Ionicons name="moon" size={18} color={isDark ? colors.primary : colors.textMuted} />
          <Text style={[s.themeBtnText, { color: isDark ? colors.primary : colors.textMuted }]}>Dark</Text>
        </TouchableOpacity>
      </View>

      {/* Language */}
      <Text style={s.secLabel}>Language</Text>
      <View style={[s.group]}>
        <View style={[s.langGrid]}>
          {LANGUAGES.map(lang => {
            const isActive = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[s.langChip, {
                  borderColor: isActive ? colors.primary : colors.border,
                  backgroundColor: isActive ? colors.primary + "18" : "transparent",
                }]}
                onPress={() => setLanguage(lang.code)}
              >
                <Text style={{ fontSize: 16 }}>{lang.flag}</Text>
                <Text style={[s.langText, { color: isActive ? colors.primary : colors.textSec }]}>{lang.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Accessibility */}
      <Text style={s.secLabel}>Accessibility</Text>
      <View style={s.group}>
        <Row icon="volume-high" iconBg="#22c55e" label="Voice Navigation">
          <Switch value={voiceNav} onValueChange={setVoiceNav} trackColor={{ false: "#374151", true: "#22c55e60" }} thumbColor={voiceNav ? "#22c55e" : "#6b7280"} />
        </Row>
        <Row icon="contrast" iconBg="#f59e0b" label="High Contrast">
          <Switch value={highContrast} onValueChange={setHighContrast} trackColor={{ false: "#374151", true: colors.primary + "60" }} thumbColor={highContrast ? colors.primary : "#6b7280"} />
        </Row>
        <Row icon="text" iconBg="#3b82f6" label="Large Text">
          <Switch value={largeText} onValueChange={setLargeText} trackColor={{ false: "#374151", true: colors.primary + "60" }} thumbColor={largeText ? colors.primary : "#6b7280"} />
        </Row>
        <Row icon="phone-portrait" iconBg="#8b5cf6" label="Haptic Feedback" last>
          <Switch value={hapticFeedback} onValueChange={setHapticFeedback} trackColor={{ false: "#374151", true: colors.primary + "60" }} thumbColor={hapticFeedback ? colors.primary : "#6b7280"} />
        </Row>
      </View>

      {/* Navigation */}
      <Text style={s.secLabel}>Navigation</Text>
      <View style={s.group}>
        <Row icon="walk" iconBg="#f97316" label="Avoid Stairs">
          <Switch value={avoidStairs} onValueChange={setAvoidStairs} trackColor={{ false: "#374151", true: colors.primary + "60" }} thumbColor={avoidStairs ? colors.primary : "#6b7280"} />
        </Row>
        <Row icon="cloud-offline" iconBg="#64748b" label="Offline Mode">
          <Switch value={offlineMode} onValueChange={setOfflineMode} trackColor={{ false: "#374151", true: colors.primary + "60" }} thumbColor={offlineMode ? colors.primary : "#6b7280"} />
        </Row>
        <Row icon="analytics" iconBg="#06b6d4" label="Share Analytics" last>
          <Switch value={analytics} onValueChange={setAnalytics} trackColor={{ false: "#374151", true: colors.primary + "60" }} thumbColor={analytics ? colors.primary : "#6b7280"} />
        </Row>
      </View>

      {/* About */}
      <Text style={s.secLabel}>About</Text>
      <View style={s.group}>
        <Row icon="information-circle" iconBg="#6366f1" label="Version" value="1.0.0" />
        <Row icon="code-slash" iconBg="#8b5cf6" label="Build" value="2026.05.01" />
        <Row icon="shield-checkmark" iconBg="#22c55e" label="Privacy Policy" last>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Row>
      </View>

      <Text style={s.versionText}>
        NavX Indoor Navigation v1.0{"\n"}Built with ❤️ using Expo & React Native
      </Text>
    </ScrollView>
  );
}
