import React, { useState, useEffect, useContext } from "react";
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  ActivityIndicator, RefreshControl, Dimensions 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import api from "../api";
import { LinearGradient } from 'expo-linear-gradient';
import { SHADOWS } from "../theme/designSystem";

const { width: SW } = Dimensions.get("window");
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function AcademicsScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState("timetable"); // "timetable" | "attendance" | "grades" | "materials"
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [academicsData, setAcademicsData] = useState(null);

  const fetchAcademics = async () => {
    try {
      const res = await api.get("/student/academics");
      if (res.data.success) {
        setAcademicsData(res.data);
      }
    } catch (e) {
      console.log("Failed to fetch academics:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAcademics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAcademics();
  };

  const handleNavigateToRoom = async (roomName) => {
    try {
      const campusId = academicsData?.campusId;
      const url = campusId ? `/rooms?campusId=${campusId}` : `/rooms`;
      const res = await api.get(url);
      const targetRoom = res.data.find(r => r.name.toLowerCase() === roomName.toLowerCase());
      if (targetRoom) {
        navigation.navigate("Navigation", { room: targetRoom, campusId: targetRoom.campusId || campusId });
      } else {
        alert(`Room ${roomName} not found.`);
      }
    } catch (e) {
      alert("Failed to navigate.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSec, marginTop: 10 }}>Loading Academics…</Text>
      </View>
    );
  }

  const timetable = academicsData?.timetable || {};
  const attendance = academicsData?.attendance || [];
  const internalMarks = academicsData?.internalMarks || [];
  const semesterResults = academicsData?.semesterResults || [];
  const studyMaterials = academicsData?.studyMaterials || [];
  const calendar = academicsData?.calendar || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Academics</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {[
          { id: "timetable", label: "Timetable", icon: "calendar" },
          { id: "attendance", label: "Attendance", icon: "checkbox-outline" },
          { id: "grades", label: "Grades", icon: "ribbon-outline" },
          { id: "materials", label: "Study Files", icon: "document-text-outline" }
        ].map(tab => (
          <TouchableOpacity 
            key={tab.id} 
            style={[styles.tabBtn, activeTab === tab.id && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons name={tab.icon} size={18} color={activeTab === tab.id ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* TIMETABLE TAB */}
        {activeTab === "timetable" && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {DAYS.map(day => (
                <TouchableOpacity 
                  key={day} 
                  style={[styles.dayChip, { backgroundColor: selectedDay === day ? colors.primary : colors.card, borderColor: colors.border }]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text style={[styles.dayChipText, { color: selectedDay === day ? "#fff" : colors.textSec }]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>{selectedDay}'s Classes</Text>
            {timetable[selectedDay] && timetable[selectedDay].length > 0 ? (
              timetable[selectedDay].map((slot, idx) => (
                <View key={slot._id || idx} style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1, marginRight: 8 }}>
                      <View style={[styles.periodBadge, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={{ color: colors.primary, fontWeight: '800' }}>P{slot.period}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.classSubject, { color: colors.text }]}>{slot.subject}</Text>
                        <Text style={{ color: colors.textSec, fontSize: 12, marginTop: 3, fontWeight: '500' }}>
                          📍 Room: {slot.roomName}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          🕰️ {slot.startTime} - {slot.endTime}
                        </Text>
                        {slot.facultyName ? (
                          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                            👨‍🏫 Teacher: {slot.facultyName}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={[styles.navBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleNavigateToRoom(slot.roomName)}
                    >
                      <Ionicons name="navigate" size={14} color="#fff" />
                      <Text style={styles.navBtnText}>Navigate</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textSec, fontSize: 14 }}>No classes scheduled for {selectedDay}.</Text>
            )}
          </View>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === "attendance" && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Subject Attendance Summary</Text>
            {attendance.length > 0 ? (
              attendance.map((att, idx) => (
                <View key={idx} style={[styles.attCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={[styles.attSubject, { color: colors.text }]}>{att.subject}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Attended: {att.present}/{att.total} lectures</Text>
                    </View>
                    <Text style={[styles.attPercent, { color: att.percentage >= 75 ? '#10b981' : '#f59e0b' }]}>{att.percentage}%</Text>
                  </View>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressBarFill, { width: `${att.percentage}%`, backgroundColor: att.percentage >= 75 ? '#10b981' : '#f59e0b' }]} />
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textSec }}>No attendance logs loaded.</Text>
            )}
          </View>
        )}

        {/* GRADES TAB */}
        {activeTab === "grades" && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Internal Marks (Total: 25)</Text>
            {internalMarks.map((m, idx) => (
              <View key={idx} style={[styles.gradeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{m.subject}</Text>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{m.obtainedMarks}/{m.totalMarks}</Text>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Semester Examination Results</Text>
            {semesterResults.map((m, idx) => (
              <View key={idx} style={[styles.gradeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{m.subject}</Text>
                <Text style={{ color: '#10b981', fontWeight: '800' }}>{m.obtainedMarks}/{m.totalMarks} ({m.comments})</Text>
              </View>
            ))}
          </View>
        )}

        {/* MATERIALS TAB */}
        {activeTab === "materials" && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Lecture Notes & slides</Text>
            {studyMaterials.map((file, idx) => (
              <View key={idx} style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{file.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{file.subject} · By {file.uploadedByName}</Text>
                  </View>
                  <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.primary }]} onPress={() => alert('PDF downloaded successfully!')}>
                    <Ionicons name="cloud-download-outline" size={16} color="#fff" />
                    <Text style={styles.navBtnText}>PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    paddingTop: 10
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', gap: 6 },
  tabLabel: { fontSize: 12, fontWeight: '700' },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  dayChipText: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginVertical: 12 },
  classCard: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10, ...SHADOWS.sm },
  periodBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  classSubject: { fontSize: 15, fontWeight: '800' },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  navBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  attCard: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10, ...SHADOWS.sm },
  attSubject: { fontSize: 15, fontWeight: '800' },
  attPercent: { fontSize: 18, fontWeight: '800' },
  progressBarBg: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 }
});
