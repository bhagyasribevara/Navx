import React, { useEffect, useState, useRef } from "react";
import { View, Text, Animated, StyleSheet, Dimensions, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../api";
import { useGeofence } from "../context/GeofenceContext";
import { useLiveMeet } from "../context/LiveMeetContext";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

export default function NotificationBanner() {
  const { activeCampusId } = useGeofence();
  const { activeSession, remoteParticipant } = useLiveMeet() || {};
  const navigation = useNavigation();
  const [notification, setNotification] = useState(null);
  const [lastNotifiedSession, setLastNotifiedSession] = useState(null);
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!activeCampusId) return;

    const socket = io(SOCKET_URL, {
      query: { campusId: activeCampusId }
    });

    socket.on("campaign_updated", (data) => {
      const isDelete = data.action === "deleted";
      setNotification({
        title: isDelete ? "Event Removed" : "New Updates Available",
        message: isDelete ? "An event was cancelled or removed." : `Admin updated: ${data.title || 'a campaign'}`,
        icon: isDelete ? "trash" : "megaphone",
        color: isDelete ? "#ef4444" : "#6366f1",
        type: "campaign"
      });

      // Slide in
      Animated.spring(slideAnim, {
        toValue: Platform.OS === "ios" ? 50 : 20,
        useNativeDriver: true,
        tension: 80,
        friction: 10
      }).start();

      // Auto-hide after 5 seconds
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -150,
          duration: 300,
          useNativeDriver: true
        }).start(() => setNotification(null));
      }, 5000);
    });

    return () => {
      socket.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [activeCampusId, slideAnim]);

  // Handle Live Meet participant joined notification
  useEffect(() => {
    if (activeSession && activeSession.role === 'creator' && remoteParticipant && remoteParticipant.status === 'active') {
      const notificationKey = `${activeSession.sessionId}_joined`;
      if (lastNotifiedSession !== notificationKey) {
        setLastNotifiedSession(notificationKey);
        
        setNotification({
          title: "Participant Joined",
          message: `${remoteParticipant.name || "Someone"} has joined your Live Meet.`,
          icon: "people",
          color: "#10b981",
          type: "live_meet"
        });

        // Slide in
        Animated.spring(slideAnim, {
          toValue: Platform.OS === "ios" ? 50 : 20,
          useNativeDriver: true,
          tension: 80,
          friction: 10
        }).start();

        // Auto-hide after 5 seconds
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: -150,
            duration: 300,
            useNativeDriver: true
          }).start(() => setNotification(null));
        }, 5000);
      }
    }
  }, [activeSession, remoteParticipant, lastNotifiedSession, slideAnim]);

  const handleBannerPress = () => {
    if (notification) {
      if (notification.type === "live_meet" && activeSession?.sessionId) {
        navigation.navigate("LiveMeet", { sessionId: activeSession.sessionId });
      }
      // Future expansion: we can also handle campaign clicks if needed
    }
    
    // Auto-hide immediately on click
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true
    }).start(() => setNotification(null));
  };

  if (!notification) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity 
        style={styles.touchable} 
        activeOpacity={0.9} 
        onPress={handleBannerPress}
      >
        <View style={[styles.iconBox, { backgroundColor: notification.color + "20" }]}>
          <Ionicons name={notification.icon} size={20} color={notification.color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.message}>{notification.message}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: width * 0.05,
    width: width * 0.9,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  touchable: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    width: "100%",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: "#475569",
  }
});

