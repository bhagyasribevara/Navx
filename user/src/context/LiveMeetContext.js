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
  const { currentFloorId } = useGeofence();
  const { user } = useAuth();
  
  // Refs to keep track of listeners to clean them up properly
  const fbListenersRef = useRef([]);

  useEffect(() => {
    // Check if there is an active session stored
    AsyncStorage.getItem('navx_active_meet').then(res => {
      if (res) {
        try {
          const s = JSON.parse(res);
          // Auto clear if expired
          if (new Date(s.expiresAt) > new Date()) {
            setActiveSession(s);
            listenToFirebase(s.sessionId, s.role);
          } else {
            AsyncStorage.removeItem('navx_active_meet');
          }
        } catch (e) {}
      }
    });

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
      }
    });

    fbListenersRef.current.push({ path: remotePath });
  };

  const startSharingLocation = async (sessionId, role, name) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    if (locationSub) locationSub.remove();

    // Initial write
    const locRef = ref(database, `meets/${sessionId}/${role}`);
    await set(locRef, {
      name,
      status: 'active'
    });

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
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

  return (
    <LiveMeetContext.Provider value={{
      activeSession,
      remoteParticipant,
      currentPos,
      enterMeetSession,
      leaveMeetSession,
      broadcastStatus
    }}>
      {children}
    </LiveMeetContext.Provider>
  );
}

export const useLiveMeet = () => useContext(LiveMeetContext);
