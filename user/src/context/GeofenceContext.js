import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const GeofenceContext = createContext();

export const useGeofence = () => useContext(GeofenceContext);

// Haversine distance in meters
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Wipe all campus-related data from the device
const wipeAllCampusData = async (campusId) => {
  try {
    const keysToRemove = [
      "navx_active_campus",
      "navx_recent",
      "navx_last_scan",
      "campuses",
    ];
    if (campusId) {
      keysToRemove.push(`navx_offline_${campusId}`);
    }
    await AsyncStorage.multiRemove(keysToRemove);
    console.log("🗑️ All campus data wiped from device");
  } catch (e) {
    console.error("Failed to wipe campus data:", e);
  }
};

export function GeofenceProvider({ children }) {
  const [activeCampus, setActiveCampus] = useState(null);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  const [revokedCampusName, setRevokedCampusName] = useState(null);
  const watcherRef = useRef(null);

  const { user, token, logout } = require("./AuthContext").useAuth();

  // Restore campus session from AsyncStorage on app launch — but VALIDATE location first
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.getItem("navx_active_campus");
        if (!stored) return;

        const parsed = JSON.parse(stored);

        // STRICT: require location + radius in the stored record to even attempt restore
        if (!parsed.location?.lat || !parsed.location?.lng || !parsed.radius) {
          console.warn("Stored session has no location/radius — wiping for safety.");
          await wipeAllCampusData(parsed.id);
          return;
        }

        // Require location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Location permission denied on restore — wiping session.");
          await wipeAllCampusData(parsed.id);
          return;
        }

        // Get current GPS position and verify user is still inside campus radius
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000,
          });
          const dist = haversine(
            loc.coords.latitude,
            loc.coords.longitude,
            parsed.location.lat,
            parsed.location.lng
          );
          // Add a 20m buffer for GPS inaccuracy during app restore
          if (dist > parsed.radius + 20) {
            console.log(`🚫 Session restore blocked: ${Math.round(dist)}m outside ${parsed.radius}m radius. Wiping.`);
            await wipeAllCampusData(parsed.id);
            return;
          }
          // ✅ User is inside — safe to restore
          console.log(`✅ Session restored: ${parsed.name} (${Math.round(dist)}m from center)`);
          setActiveCampus(parsed);
        } catch (locErr) {
          // GPS timeout or unavailable — play it safe and wipe
          console.warn("GPS check failed on restore — wiping session:", locErr?.message);
          await wipeAllCampusData(parsed.id);
        }
      } catch (e) {
        console.warn("Failed to restore geofence session:", e);
      }
    };
    restoreSession();
  }, []);

  // Start continuous location monitoring when a campus is active
  useEffect(() => {
    if (!activeCampus?.location?.lat || !activeCampus?.location?.lng || !activeCampus?.radius) {
      return;
    }

    let isMounted = true;

    const startMonitoring = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Location permission not granted for geofence monitoring");
          return;
        }

        watcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 8000,
            distanceInterval: 30,
          },
          async (loc) => {
            if (!isMounted) return;

            const dist = haversine(
              loc.coords.latitude,
              loc.coords.longitude,
              activeCampus.location.lat,
              activeCampus.location.lng
            );

            // Add a 10m buffer for GPS drift during active monitoring
            if (dist > activeCampus.radius + 10) {
              console.log(
                `🚫 User exited campus boundary (${Math.round(dist)}m > ${activeCampus.radius}m)`
              );

              // Haptic alert
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

              // If guest, log out immediately
              if (user?.isGuest) {
                console.log("Logging out guest user due to local boundary exit.");
                logout();
              } else {
                // Wipe all data
                await wipeAllCampusData(activeCampus.id);

                // Set revoked state
                const campusName = activeCampus.name;
                setRevokedCampusName(campusName);
                setActiveCampus(null);
                setSessionRevoked(true);
              }

              // Stop watcher
              if (watcherRef.current) {
                watcherRef.current.remove();
                watcherRef.current = null;
              }
            }
          }
        );
      } catch (e) {
        console.error("Geofence monitoring failed to start:", e);
      }
    };

    startMonitoring();

    return () => {
      isMounted = false;
      if (watcherRef.current) {
        watcherRef.current.remove();
        watcherRef.current = null;
      }
    };
  }, [activeCampus?.id, activeCampus?.location?.lat, activeCampus?.radius, user?.isGuest, logout]);

  // Guest heartbeat monitor (sends periodic location coordinates to backend)
  useEffect(() => {
    if (!user?.isGuest) return;

    let isMounted = true;
    let guestWatcher = null;

    const startGuestMonitoring = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Location permission not granted for guest geofence monitoring");
          return;
        }

        // Immediately send an initial heartbeat on mount/login
        try {
          const currentLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 5000,
          });
          if (isMounted) {
            const response = await api.post(
              "/app-auth/heartbeat",
              {
                location: {
                  lat: currentLoc.coords.latitude,
                  lng: currentLoc.coords.longitude
                },
                campusId: activeCampus?.id || null
              },
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            if (response.data.success && response.data.active === false) {
              console.log("Guest session deactivated by backend on initial check.");
              logout();
              return;
            }
          }
        } catch (initialErr) {
          console.warn("Failed to send initial guest heartbeat:", initialErr?.message);
        }

        guestWatcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000, // send heartbeat every 10 seconds
            distanceInterval: 10,
          },
          async (loc) => {
            if (!isMounted) return;

            // Send heartbeat to backend
            try {
              const response = await api.post(
                "/app-auth/heartbeat",
                {
                  location: {
                    lat: loc.coords.latitude,
                    lng: loc.coords.longitude
                  },
                  campusId: activeCampus?.id || null
                },
                {
                  headers: { Authorization: `Bearer ${token}` }
                }
              );

              if (response.data.success && response.data.active === false) {
                console.log("🚫 Guest session deactivated by backend (exited boundary or expired)");
                logout();
              }
            } catch (err) {
              console.warn("Guest heartbeat ping failed:", err?.message);
            }
          }
        );
      } catch (e) {
        console.error("Guest geofence monitoring failed to start:", e);
      }
    };

    startGuestMonitoring();

    return () => {
      isMounted = false;
      if (guestWatcher) {
        guestWatcher.remove();
      }
    };
  }, [user?.isGuest, activeCampus?.id, token, logout]);

  // Activate a campus session (called after QR scan + geofence verification)
  const activateCampus = useCallback(async (campus) => {
    const campusData = {
      id: campus._id || campus.id,
      name: campus.name,
      location: campus.location,
      radius: campus.radius,
    };

    try {
      await AsyncStorage.setItem("navx_active_campus", JSON.stringify(campusData));
    } catch (e) {
      console.warn("Failed to persist campus session:", e);
    }

    setSessionRevoked(false);
    setRevokedCampusName(null);
    setActiveCampus(campusData);
    console.log(`✅ Campus session activated: ${campusData.name}`);
  }, []);

  // Manually deactivate (e.g., user logs out)
  const deactivateCampus = useCallback(async () => {
    const campusId = activeCampus?.id;
    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }
    await wipeAllCampusData(campusId);
    setActiveCampus(null);
  }, [activeCampus?.id]);

  // Auto-deactivate campus if user logs out
  useEffect(() => {
    if (user === null && activeCampus) {
      deactivateCampus();
    }
  }, [user, activeCampus, deactivateCampus]);

  // Clear the revoked state (user acknowledged and wants to rescan)
  const clearRevocation = useCallback(() => {
    setSessionRevoked(false);
    setRevokedCampusName(null);
  }, []);

  return (
    <GeofenceContext.Provider
      value={{
        activeCampus,
        activeCampusId: activeCampus?.id || null,
        sessionRevoked,
        revokedCampusName,
        activateCampus,
        deactivateCampus,
        clearRevocation,
      }}
    >
      {children}
    </GeofenceContext.Provider>
  );
}

export default GeofenceContext;
