import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  ActivityIndicator, RefreshControl, Dimensions, Animated 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import api from "../api";
import { LinearGradient } from 'expo-linear-gradient';
import { SHADOWS, RADIUS } from "../theme/designSystem";

const { width: SW } = Dimensions.get("window");

// Get a range of dates around today
const generateDateRange = (centerDate, range = 3) => {
  const dates = [];
  for (let i = -range; i <= range; i++) {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Color-coded class type tags (matching reference screenshot)
const CLASS_TYPES = {
  'Lab': { color: '#ef4444', bg: '#fef2f2', label: 'Lab' },
  'Class': { color: '#3b82f6', bg: '#eff6ff', label: 'Class' },
  'Others': { color: '#f59e0b', bg: '#fffbeb', label: 'Others' },
  'Tutorial': { color: '#8b5cf6', bg: '#f5f3ff', label: 'Tutorial' },
};

// Determine class type from subject name
const getClassType = (subject) => {
  if (!subject) return CLASS_TYPES['Class'];
  const lower = subject.toLowerCase();
  if (lower.includes('lab')) return CLASS_TYPES['Lab'];
  if (lower.includes('tutorial') || lower.includes('counselling')) return CLASS_TYPES['Tutorial'];
  if (lower.includes('employability') || lower.includes('library') || lower.includes('sda') || lower.includes('counselling') || lower.includes('skill')) return CLASS_TYPES['Others'];
  return CLASS_TYPES['Class'];
};

// Parse time string like "09:00 AM" to hours in 24h format for comparison
const parseTimeToHours = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours + minutes / 60;
};

export default function AcademicsScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState("timetable");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [academicsData, setAcademicsData] = useState(null);
  
  // Date picker state
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const dateRange = useMemo(() => generateDateRange(today, 3), [today]);
  const dateScrollRef = useRef(null);

  const selectedDayName = DAY_NAMES_FULL[selectedDate.getDay()];

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

  // Auto-scroll to today's date in the date picker
  useEffect(() => {
    if (dateScrollRef.current) {
      const todayIndex = dateRange.findIndex(d => 
        d.toDateString() === today.toDateString()
      );
      if (todayIndex >= 0) {
        setTimeout(() => {
          dateScrollRef.current?.scrollTo({ x: todayIndex * 72 - SW / 2 + 36, animated: false });
        }, 100);
      }
    }
  }, [dateRange]);

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
        alert(`Room ${roomName} not found on the campus map yet.`);
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
  const assignments = academicsData?.assignments || [];
  const calendar = academicsData?.calendar || [];

  // Get classes for selected day, sorted by period
  const dayClasses = (timetable[selectedDayName] || []).sort((a, b) => a.period - b.period);

  // Current time for highlighting active class
  const now = new Date();
  const currentTimeHours = now.getHours() + now.getMinutes() / 60;
  const isToday = selectedDate.toDateString() === today.toDateString();
  const isPast = selectedDate < today && !isToday;

  // Determine class status: 'completed', 'active', 'upcoming'
  const getClassStatus = (slot) => {
    if (!isToday) {
      return isPast ? 'completed' : 'upcoming';
    }
    const startH = parseTimeToHours(slot.startTime);
    const endH = parseTimeToHours(slot.endTime);
    if (currentTimeHours >= endH) return 'completed';
    if (currentTimeHours >= startH && currentTimeHours < endH) return 'active';
    return 'upcoming';
  };

  const isDateSelected = (date) => date.toDateString() === selectedDate.toDateString();
  const isDateToday = (date) => date.toDateString() === today.toDateString();

  return (
    <View style={[styles.container, { backgroundColor: '#ffffff' }]}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.22)', 'rgba(99, 102, 241, 0.10)', 'rgba(255, 255, 255, 0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark || '#6d28d9']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedule</Text>
          <View style={styles.headerRight}>
            <Ionicons name="calendar-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.headerMonth}>{MONTH_NAMES[today.getMonth()]} {today.getFullYear()}</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingRight: 16 }}>
          {[
            { id: "timetable", label: "Timetable", icon: "calendar" },
            { id: "attendance", label: "Attendance", icon: "checkbox-outline" },
            { id: "grades", label: "Grades", icon: "ribbon-outline" },
            { id: "materials", label: "Study Files", icon: "document-text-outline" },
            { id: "assignments", label: "Assignments", icon: "clipboard-outline" },
            { id: "calendar", label: "Calendar", icon: "calendar-number-outline" }
          ].map(tab => (
            <TouchableOpacity 
              key={tab.id} 
              style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.6)"} />
              <Text style={[styles.tabLabel, { color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.6)" }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date Picker - only show for timetable tab */}
        {activeTab === "timetable" && (
          <ScrollView 
            ref={dateScrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datePickerContent}
            style={styles.datePicker}
          >
            {dateRange.map((date, idx) => {
              const selected = isDateSelected(date);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dateItem,
                    selected && styles.dateItemSelected,
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[
                    styles.dateDayName,
                    selected ? { color: colors.primary } : { color: isWeekend ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)' }
                  ]}>
                    {DAY_NAMES_SHORT[date.getDay()]}
                  </Text>
                  <Text style={[
                    styles.dateNumber,
                    selected ? { color: colors.primary } : { color: isWeekend ? 'rgba(255,255,255,0.4)' : '#fff' }
                  ]}>
                    {date.getDate()}
                  </Text>
                  {isDateToday(date) && (
                    <View style={[styles.todayDot, selected && { backgroundColor: colors.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* TIMETABLE TAB */}
        {activeTab === "timetable" && (
          <View>
            {dayClasses.length > 0 || (selectedDate.getDay() !== 0 && selectedDate.getDay() !== 6) ? (
              Array.from({ length: 7 }, (_, i) => {
                const period = i + 1;
                const slot = dayClasses.find(c => c.period === period);
                if (!slot) {
                  return (
                    <View key={`free-${period}`} style={[styles.classCard, { backgroundColor: colors.card, padding: 16, borderColor: colors.border, borderWidth: 1, flexDirection: 'row', alignItems: 'center' }]}>
                      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800' }}>P{period}</Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600' }}>Free Period</Text>
                    </View>
                  );
                }
                const classType = getClassType(slot.subject);
                const status = getClassStatus(slot);
                const isActive = status === 'active';
                
                return (
                  <Animated.View 
                    key={slot._id || idx} 
                    style={[
                      styles.classCard,
                      { 
                        backgroundColor: colors.card, 
                        borderColor: isActive ? colors.primary : colors.border,
                        borderWidth: isActive ? 1.5 : 1
                      }
                    ]}
                  >
                    <View style={styles.classCardInner}>
                      {/* Left content */}
                      <View style={styles.classCardLeft}>
                        <Text style={[styles.classSubject, { color: colors.text }]} numberOfLines={2}>
                          {slot.subject}
                        </Text>
                        <Text style={[styles.classTime, { color: colors.textMuted }]}>
                          {slot.startTime} - {slot.endTime}
                        </Text>
                        {slot.facultyName && (
                          <View style={styles.facultyRow}>
                            <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
                            <Text style={[styles.facultyName, { color: colors.textSec }]}>
                              {slot.facultyName}
                            </Text>
                          </View>
                        )}
                        {slot.roomName && (
                          <View style={styles.facultyRow}>
                            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                            <Text style={[styles.facultyName, { color: colors.textSec }]}>
                              Room: {slot.roomName}
                            </Text>
                          </View>
                        )}
                        {slot.isSubstituted && (
                          <View style={[styles.subBadge, { backgroundColor: '#fef3c7' }]}>
                            <Ionicons name="swap-horizontal" size={12} color="#d97706" />
                            <Text style={{ color: '#d97706', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                              Substitute: {slot.facultyName}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Right side: Status + Navigate */}
                      <View style={styles.classCardRight}>
                        {/* Status icon */}
                        <View style={{ alignItems: 'center', marginBottom: 8 }}>
                          {status === 'completed' && (
                            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                          )}
                          {status === 'active' && (
                            <View style={[styles.activePulse, { backgroundColor: colors.primary + '20' }]}>
                              <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
                            </View>
                          )}
                          {status === 'upcoming' && (
                            <Ionicons name="time-outline" size={22} color={colors.textMuted} />
                          )}
                        </View>

                        {/* Navigate button */}
                        {slot.roomName && (
                          <TouchableOpacity 
                            style={[styles.navBtn, { backgroundColor: colors.primary }]}
                            onPress={() => handleNavigateToRoom(slot.roomName)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="navigate" size={14} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Type tag on the right edge */}
                      <View style={[styles.typeTag, { backgroundColor: classType.color }]}>
                        <Text style={styles.typeTagText}>{classType.label}</Text>
                      </View>
                    </View>
                  </Animated.View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSec }]}>
                  It's the weekend! No classes today.
                </Text>
              </View>
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
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={[styles.attSubject, { color: colors.text }]}>{att.subject}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Attended: {att.present}/{att.total} lectures</Text>
                    </View>
                    <View style={[styles.attPercentBadge, { backgroundColor: att.percentage >= 75 ? '#dcfce7' : '#fef9c3' }]}>
                      <Text style={[styles.attPercent, { color: att.percentage >= 75 ? '#16a34a' : '#ca8a04' }]}>{att.percentage}%</Text>
                    </View>
                  </View>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressBarFill, { width: `${att.percentage}%`, backgroundColor: att.percentage >= 75 ? '#22c55e' : '#eab308' }]} />
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSec }]}>No attendance logs loaded.</Text>
              </View>
            )}
          </View>
        )}

        {/* GRADES TAB */}
        {activeTab === "grades" && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Internal Marks (Total: 25)</Text>
            {internalMarks.map((m, idx) => (
              <View key={idx} style={[styles.gradeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{m.subject}</Text>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{m.obtainedMarks}/{m.totalMarks}</Text>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Semester Examination Results</Text>
            {semesterResults.map((m, idx) => (
              <View key={idx} style={[styles.gradeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{m.subject}</Text>
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
              <View key={idx} style={[styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{file.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{file.subject} · By {file.uploadedByName}</Text>
                  </View>
                  <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: colors.primary }]} onPress={() => alert('PDF downloaded successfully!')}>
                    <Ionicons name="cloud-download-outline" size={16} color="#fff" />
                    <Text style={styles.downloadBtnText}>PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ASSIGNMENTS TAB */}
        {activeTab === "assignments" && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending Assignments</Text>
            {assignments.length > 0 ? assignments.map((assign, idx) => (
              <View key={idx} style={[styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{assign.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{assign.subject}</Text>
                    <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                      Due: {new Date(assign.dueDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.attPercentBadge, { backgroundColor: '#fef9c3' }]}>
                    <Text style={[styles.attPercent, { color: '#ca8a04', fontSize: 12 }]}>{assign.maxMarks} Marks</Text>
                  </View>
                </View>
              </View>
            )) : (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSec }]}>No pending assignments!</Text>
              </View>
            )}
          </View>
        )}

        {/* CALENDAR TAB */}
        {activeTab === "calendar" && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Academic Calendar</Text>
            {calendar.length > 0 ? calendar.map((event, idx) => (
              <View key={idx} style={[styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{event.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{event.description}</Text>
                    <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                      {new Date(event.startDate).toLocaleDateString()} {event.endDate !== event.startDate ? `- ${new Date(event.endDate).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.attPercentBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.attPercent, { color: colors.primary, fontSize: 12 }]}>{event.type}</Text>
                  </View>
                </View>
              </View>
            )) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSec }]}>No upcoming events!</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  // Header
  headerGradient: {
    paddingTop: 12,
    paddingBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerMonth: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Tabs
  tabBar: { 
    flexDirection: 'row', 
    paddingHorizontal: 12,
    marginTop: 4,
  },
  tabBtn: { 
    paddingHorizontal: 16,
    paddingVertical: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row', 
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#fff',
  },
  tabLabel: { fontSize: 11, fontWeight: '700' },

  // Date picker
  datePicker: {
    marginTop: 8,
    paddingBottom: 12,
  },
  datePickerContent: {
    paddingHorizontal: 16,
    gap: 4,
  },
  dateItem: {
    width: 64,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  dateItemSelected: {
    backgroundColor: '#fff',
    borderRadius: 16,
    ...SHADOWS.md,
  },
  dateDayName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginTop: 4,
  },

  // Class cards
  classCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  classCardInner: {
    flexDirection: 'row',
    padding: 16,
    paddingRight: 40,
  },
  classCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  classSubject: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  classTime: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  facultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  facultyName: {
    fontSize: 12,
    fontWeight: '500',
  },
  subBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  classCardRight: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activePulse: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },

  // Type tag (vertical on right edge)
  typeTag: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  typeTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    transform: [{ rotate: '90deg' }],
    width: 50,
    textAlign: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },

  // Section title
  sectionTitle: { fontSize: 16, fontWeight: '800', marginVertical: 12 },

  // Attendance
  attCard: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10, ...SHADOWS.sm },
  attSubject: { fontSize: 15, fontWeight: '800' },
  attPercentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  attPercent: { fontSize: 16, fontWeight: '800' },
  progressBarBg: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  // Grades
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },

  // Materials
  materialCard: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10, ...SHADOWS.sm },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  downloadBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
