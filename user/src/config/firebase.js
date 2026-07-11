import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

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

// Initialize only once (guard against hot-reload double init)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const database = getDatabase(app);

// Legacy export kept for backward compatibility
export function initializeFirebase() {
  return database;
}
