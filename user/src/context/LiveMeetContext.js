import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useGeofence } from './GeofenceContext';
import { useAuth } from './AuthContext';
import { database } from '../config/firebase';
import { ref, set, onValue, off, update, remove } from 'firebase/database';

export const LiveMeetContext = createContext();

export function LiveMeetProvider({ children }) {
  const [activeSession, setActiveSession] = useState(null);
  const [remoteParticipant, setRemoteParticipant] = useState(null);
  const [locationSub, setLocationSub] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const { currentFloorId } = useGeofence();
  const { user } = useAuth();
  
  // Refs to keep track of listeners to clean them up properly
  const fbListenersRef = useRef([]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        // 1. Load stored notifications first to avoid race condition with firebase listener
        const storedNotifs = await AsyncStorage.getItem('navx_notifications');
        let initialNotifs = [];
        if (storedNotifs) {
          initialNotifs = JSON.parse(storedNotifs);
        } else {
          initialNotifs = [
            { id: 'notif_1', title: "Map Updated", desc: "Admin published new navigation paths for CSE Block.", time: "Just now", unread: true },
            { id: 'notif_2', title: "New Floor Added", desc: "Floor 2 was added to Block A.", time: "1d ago", unread: false },
          ];
          await AsyncStorage.setItem('navx_notifications', JSON.stringify(initialNotifs));
        }
        setNotifications(initialNotifs);

        // 2. Load active meet after notifications are loaded and set
        const storedMeet = await AsyncStorage.getItem('navx_active_meet');
        if (storedMeet) {
          const s = JSON.parse(storedMeet);
          if (new Date(s.expiresAt) > new Date()) {
            setActiveSession(s);
            // Re-start location sharing on app startup!
            const myName = user?.username || (s.role === 'creator' ? s.creatorName : s.joinerName);
            startSharingLocation(s.sessionId, s.role, myName);
            listenToFirebase(s.sessionId, s.role);
          } else {
            await AsyncStorage.removeItem('navx_active_meet');
          }
        }
      } catch (e) {
        console.log("Error loading initial data in LiveMeetContext:", e);
      }
    }

    loadInitialData();

    return () => {
      if (locationSub) locationSub.remove();
      fbListenersRef.current.forEach(({ path }) => {
        off(ref(database, path));
      });
    };
  }, []);

  const listenToFirebase = (sessionId, role) => {
    const remoteRole = role === 'creator' ? 'joiner' : 'creator';
    
    // Listen to remote participant's location and status
    const remotePath = `meets/${sessionId}/${remoteRole}`;
    const rRef = ref(database, remotePath);
    
    onValue(rRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRemoteParticipant(prev => ({
          ...prev,
          location: data.location,
          status: data.status || prev?.status,
          name: data.name || prev?.name
        }));

        // Trigger dynamic notifications if creator and joiner joins (status is active)
        if (role === 'creator' && data.status === 'active') {
          const notifId = `${sessionId}_joined`;
          setNotifications(prevNotifs => {
            if (prevNotifs.some(n => n.id === notifId)) return prevNotifs;
            const newNotif = {
              id: notifId,
              title: "Participant Joined",
              desc: `${data.name || "Someone"} has joined your Live Meet.`,
              time: "Just now",
              unread: true,
              type: "live_meet",
              sessionId: sessionId
            };
            const updated = [newNotif, ...prevNotifs];
            AsyncStorage.setItem('navx_notifications', JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }
      }
    });

    fbListenersRef.current.push({ path: remotePath });
  };

  const startSharingLocation = async (sessionId, role, name) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    if (locationSub) locationSub.remove();

    const locRef = ref(database, `meets/${sessionId}/${role}`);

    // Fetch initial location immediately
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentPos({ x: location.coords.latitude, y: location.coords.longitude });
      await set(locRef, {
        name,
        status: 'active',
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          heading: location.coords.heading || 0,
          speed: location.coords.speed || 0,
          floorId: currentFloorId || null, 
        }
      });
    } catch (e) {
      console.log("Error getting initial location in context, trying last known:", e);
      let lastKnown = null;
      try {
        lastKnown = await Location.getLastKnownPositionAsync({});
      } catch (err) {
        console.log("Error getting last known position:", err);
      }

      if (lastKnown) {
        setCurrentPos({ x: lastKnown.coords.latitude, y: lastKnown.coords.longitude });
        await set(locRef, {
          name,
          status: 'active',
          location: {
            lat: lastKnown.coords.latitude,
            lng: lastKnown.coords.longitude,
            heading: lastKnown.coords.heading || 0,
            speed: lastKnown.coords.speed || 0,
            floorId: currentFloorId || null, 
          }
        });
      } else {
        await set(locRef, {
          name,
          status: 'active'
        });
      }
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1500,
        distanceInterval: 0.5,
      },
      (location) => {
        setCurrentPos({ x: location.coords.latitude, y: location.coords.longitude });
        const payload = {
          location: {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            heading: location.coords.heading || 0,
            speed: location.coords.speed || 0,
            floorId: currentFloorId || null, 
          }
        };
        update(locRef, payload);
      }
    );
    setLocationSub(sub);
  };

  const enterMeetSession = async (sessionData, role) => {
    const s = { ...sessionData, role };
    setActiveSession(s);
    await AsyncStorage.setItem('navx_active_meet', JSON.stringify(s));
    
    // Use the real username from AuthContext if available
    const myName = user?.username || (role === 'creator' ? s.creatorName : s.joinerName);
    startSharingLocation(s.sessionId, role, myName);
    listenToFirebase(s.sessionId, role);
    
    // Set initial remote participant data if joining an active session
    if (role === 'joiner') {
      setRemoteParticipant({
        name: s.creatorName,
        location: s.creatorLocation
      });
    } else if (role === 'creator' && s.joinerDevice) {
      setRemoteParticipant({
        name: s.joinerName,
        location: s.joinerLocation
      });
    }
  };

  const leaveMeetSession = async () => {
    if (locationSub) {
      locationSub.remove();
      setLocationSub(null);
    }
    
    if (activeSession) {
      fbListenersRef.current.forEach(({ path }) => off(ref(database, path)));
      fbListenersRef.current = [];
      // Clean up my node from firebase
      remove(ref(database, `meets/${activeSession.sessionId}/${activeSession.role}`));
    }

    setActiveSession(null);
    setRemoteParticipant(null);
    await AsyncStorage.removeItem('navx_active_meet');
  };

  const broadcastStatus = (statusStr) => {
    if (activeSession) {
      const myRef = ref(database, `meets/${activeSession.sessionId}/${activeSession.role}`);
      update(myRef, { status: statusStr });
    }
  };

  const markNotifRead = async (notifId) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === notifId ? { ...n, unread: false } : n);
      AsyncStorage.setItem('navx_notifications', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const hasUnread = notifications.some(n => n.unread);

  return (
    <LiveMeetContext.Provider value={{
      activeSession,
      remoteParticipant,
      currentPos,
      enterMeetSession,
      leaveMeetSession,
      broadcastStatus,
      notifications,
      markNotifRead,
      hasUnread
    }}>
      {children}
    </LiveMeetContext.Provider>
  );
}

export const useLiveMeet = () => useContext(LiveMeetContext);
