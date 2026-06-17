import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// We exclude getAnalytics to prevent errors in Expo if not configured correctly for native.

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "navx-b6994.firebaseapp.com",
  databaseURL: "https://navx-b6994-default-rtdb.firebaseio.com",
  projectId: "navx-b6994",
  storageBucket: "navx-b6994.firebasestorage.app",
  messagingSenderId: "17081611047",
  appId: "1:17081611047:web:1469e7bae4b8a25864af02",
  measurementId: "G-WLGK7KRG7F"
};

let actualDatabase = null;

// Initialize synchronously if the build-time key is already present
if (firebaseConfig.apiKey) {
  try {
    const app = initializeApp(firebaseConfig);
    actualDatabase = getDatabase(app);
  } catch (e) {
    console.warn("Failed to initialize Firebase synchronously:", e);
  }
}

export function initializeFirebase(apiKey) {
  if (!actualDatabase) {
    try {
      const config = { ...firebaseConfig, apiKey };
      const app = initializeApp(config);
      actualDatabase = getDatabase(app);
      console.log("Firebase initialized successfully with dynamic API Key.");
    } catch (e) {
      console.warn("Failed to initialize Firebase dynamically:", e);
    }
  }
  return actualDatabase;
}

// Proxy wrapper around database to delegate dynamically
export const database = new Proxy({}, {
  get(target, prop) {
    if (!actualDatabase) {
      console.warn("Firebase Database accessed before initialization. Attempting default fallback...");
      if (firebaseConfig.apiKey) {
        initializeFirebase(firebaseConfig.apiKey);
      } else {
        throw new Error("Firebase accessed but not initialized. Make sure fetchAppConfig runs on startup.");
      }
    }
    const val = actualDatabase[prop];
    return typeof val === 'function' ? val.bind(actualDatabase) : val;
  }
});
