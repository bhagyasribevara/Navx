import React, { useContext, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useGeofence } from "../context/GeofenceContext";
import { ThemeContext } from "../context/ThemeContext";

export default function GeofenceGuard() {
  const { sessionRevoked, revokedCampusName, clearRevocation } = useGeofence();
  const { colors } = useContext(ThemeContext);
  const navigation = useNavigation();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const lockPulse = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (sessionRevoked) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous pulse on lock icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(lockPulse, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(lockPulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Continuous glow
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.6,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      lockPulse.setValue(1);
      glowAnim.setValue(0.3);
    }
  }, [sessionRevoked]);

  if (!sessionRevoked) return null;

  const handleRescan = () => {
    clearRevocation();
    navigation.navigate("QRScan");
  };

  const handleGoHome = () => {
    clearRevocation();
    navigation.navigate("MainTabs", { screen: "Home" });
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Glow ring behind lock */}
        <View style={styles.iconContainer}>
          <Animated.View
            style={[
              styles.glowRing,
              { opacity: glowAnim, transform: [{ scale: lockPulse }] },
            ]}
          />
          <Animated.View
            style={[
              styles.lockCircle,
              { transform: [{ scale: lockPulse }] },
            ]}
          >
            <Ionicons name="lock-closed" size={40} color="#fff" />
          </Animated.View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Session Terminated</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Message */}
        <Text style={styles.message}>
          You have left the{" "}
          {revokedCampusName ? (
            <Text style={styles.campusHighlight}>{revokedCampusName}</Text>
          ) : (
            "campus"
          )}{" "}
          boundary. All campus data has been removed from this device.
        </Text>

        {/* Info chips */}
        <View style={styles.infoRow}>
          <View style={styles.infoChip}>
            <Ionicons name="trash" size={14} color="#ef4444" />
            <Text style={styles.infoChipText}>Data Wiped</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="close-circle" size={14} color="#f59e0b" />
            <Text style={styles.infoChipText}>Session Ended</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="location-outline" size={14} color="#6366f1" />
            <Text style={styles.infoChipText}>Outside Area</Text>
          </View>
        </View>

        {/* Instruction */}
        <View style={styles.instructionBox}>
          <Ionicons name="information-circle" size={18} color="#6366f1" />
          <Text style={styles.instructionText}>
            To regain access, return to the campus and rescan the QR code at the entrance.
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleRescan}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Rescan QR Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleGoHome}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 11, 20, 0.95)",
    zIndex: 9998,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#111827",
    padding: 32,
    borderRadius: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  iconContainer: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  glowRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 2,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ef4444",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  divider: {
    width: 60,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(239, 68, 68, 0.3)",
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  campusHighlight: {
    color: "#f1f5f9",
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  instructionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.15)",
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: "#818cf8",
    lineHeight: 19,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
});
