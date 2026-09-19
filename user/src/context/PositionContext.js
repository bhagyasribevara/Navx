import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import defaultPosEngine from "../positioning";

const PositionContext = createContext(null);

export function PositionProvider({ children }) {
  const posEngine = defaultPosEngine;
  const [position, setPosition] = useState(() => ({ ...posEngine.position }));
  const [heading, setHeading] = useState(() => posEngine.heading);

  useEffect(() => {
    const unsubscribe = posEngine.onPositionUpdate((newPos) => {
      setPosition({ ...newPos });
      if (newPos.heading !== undefined) {
        setHeading(newPos.heading);
      }
    });
    return unsubscribe;
  }, [posEngine]);

  const setPositionFromQR = useCallback((x, y, floorId, floorLevel = 0, z = null) => {
    return posEngine.setPositionFromQR(x, y, floorId, floorLevel, z);
  }, [posEngine]);

  const updateVerticalPosition = useCallback((z, floorId = null, floorLevelOrOptions = null, verticalProgress = 0.0, elevationSource = 'staircase') => {
    return posEngine.updateVerticalPosition(z, floorId, floorLevelOrOptions, verticalProgress, elevationSource);
  }, [posEngine]);

  const setFloor = useCallback((floorId, floorLevel = null, elevation = null, elevationSource = 'floor') => {
    return posEngine.setFloor(floorId, floorLevel, elevation, elevationSource);
  }, [posEngine]);

  const processGPSUpdate = useCallback((lat, lng, accuracy = 15) => {
    return posEngine.processGPSUpdate(lat, lng, accuracy);
  }, [posEngine]);

  const processStep = useCallback((h) => {
    return posEngine.processStep(h !== undefined ? h : posEngine.heading);
  }, [posEngine]);

  const updateHeading = useCallback((h) => {
    posEngine.updateHeading(h);
    setHeading(posEngine.heading);
  }, [posEngine]);

  const updatePosition = useCallback((patch) => {
    return posEngine.updatePosition(patch);
  }, [posEngine]);

  const resetPosition = useCallback(() => {
    posEngine.reset();
  }, [posEngine]);

  const value = {
    posEngine,
    position,
    heading,
    setPositionFromQR,
    updateVerticalPosition,
    setFloor,
    processGPSUpdate,
    processStep,
    updateHeading,
    updatePosition,
    resetPosition,
  };

  return (
    <PositionContext.Provider value={value}>
      {children}
    </PositionContext.Provider>
  );
}

export function usePosition() {
  const context = useContext(PositionContext);
  if (!context) {
    throw new Error("usePosition must be used within a PositionProvider");
  }
  return context;
}

export default PositionContext;
