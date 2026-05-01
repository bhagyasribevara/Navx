import React, { useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../App';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'es', label: 'Español (Spanish)' },
];

export default function SettingsScreen() {
  const { colors, isDark, setIsDark, language, setLanguage } = useContext(ThemeContext);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 8, marginTop: 20 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowFirst: { borderTopLeftRadius: 12, borderTopRightRadius: 12, marginHorizontal: 16, borderTopWidth: 0 },
    rowLast: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginHorizontal: 16, borderBottomWidth: 0 },
    rowMiddle: { marginHorizontal: 16 },
    rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
    rowValue: { fontSize: 13, color: colors.textMuted },
    langBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginRight: 6, marginBottom: 6 },
    langBtnActive: { backgroundColor: colors.primary },
    langBtnInactive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    langBtnText: { fontSize: 13, fontWeight: '600' },
    version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 20, marginBottom: 40 },
  });

  const SettingRow = ({ icon, iconBg, label, value, children, first, last }) => (
    <View style={[s.row, first && s.rowFirst, last && s.rowLast, !first && !last && s.rowMiddle]}>
      <View style={[s.rowIcon, { backgroundColor: iconBg || colors.primary + '15' }]}>
        <Ionicons name={icon} size={18} color={iconBg ? '#fff' : colors.primary} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      {value && <Text style={s.rowValue}>{value}</Text>}
      {children}
    </View>
  );

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionTitle}>Appearance</Text>
      <SettingRow icon="moon" label="Dark Mode" first last>
        <Switch value={isDark} onValueChange={setIsDark}
          trackColor={{ false: '#767577', true: colors.primary + '60' }}
          thumbColor={isDark ? colors.primary : '#f4f3f4'} />
      </SettingRow>

      <Text style={s.sectionTitle}>Language</Text>
      <View style={[s.row, s.rowFirst, s.rowLast, { flexWrap: 'wrap', gap: 0 }]}>
        {LANGUAGES.map(lang => (
          <TouchableOpacity key={lang.code}
            style={[s.langBtn, language === lang.code ? s.langBtnActive : s.langBtnInactive]}
            onPress={() => setLanguage(lang.code)}>
            <Text style={[s.langBtnText, { color: language === lang.code ? '#fff' : colors.textSec }]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionTitle}>Accessibility</Text>
      <SettingRow icon="volume-high" iconBg="#22c55e" label="Voice Navigation" value="On" first />
      <SettingRow icon="contrast" iconBg="#f59e0b" label="High Contrast" value="Off" />
      <SettingRow icon="text" iconBg="#3b82f6" label="Large Text" value="Off" last />

      <Text style={s.sectionTitle}>Navigation</Text>
      <SettingRow icon="walk" label="Avoid Stairs" first>
        <Switch value={false} trackColor={{ false: '#767577', true: colors.primary + '60' }} />
      </SettingRow>
      <SettingRow icon="analytics" label="Share Analytics" last>
        <Switch value={true} trackColor={{ false: '#767577', true: colors.primary + '60' }} thumbColor={colors.primary} />
      </SettingRow>

      <Text style={s.sectionTitle}>About</Text>
      <SettingRow icon="information-circle" label="Version" value="1.0.0" first />
      <SettingRow icon="code-slash" label="Build" value="2026.05.01" last />

      <Text style={s.version}>NavX Indoor Navigation v1.0{'\n'}Built with ❤️ using Expo</Text>
    </ScrollView>
  );
}
