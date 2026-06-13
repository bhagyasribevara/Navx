import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// We exclude getAnalytics to prevent errors in Expo if not configured correctly for native.

const firebaseConfig = {
  apiKey: "AIzaSyDcJLPgSFzC1mg_uDTpECbgJPBM-hOlcNs",
  authDomain: "navx-b6994.firebaseapp.com",
  databaseURL: "https://navx-b6994-default-rtdb.firebaseio.com",
  projectId: "navx-b6994",
  storageBucket: "navx-b6994.firebasestorage.app",
  messagingSenderId: "17081611047",
  appId: "1:17081611047:web:1469e7bae4b8a25864af02",
  measurementId: "G-WLGK7KRG7F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
