/**
 * NavX AI Chatbot Service
 * Handles all AI, voice, and navigation integration logic
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { chatWithAI } from './api';

// ─── Session ID (one per app launch) ──────────────────────────────────────────
export const SESSION_ID = `session_${Date.now()}`;

// ─── Send message to Gemini via backend ───────────────────────────────────────
export async function sendMessageToAI(message, context = {}) {
  try {
    const data = await chatWithAI(message, SESSION_ID, context);

    return {
      text: data.text || "I didn't quite get that. Could you rephrase?",
      action: data.action || null,
      destination: data.destination || null,
    };
  } catch (err) {
    console.warn('AI API error:', err.message);
    return {
      text: "I'm having trouble connecting. Please check your network.",
      action: null,
      destination: null,
      isError: true,
    };
  }
}

// ─── Text-to-Speech ────────────────────────────────────────────────────────────
export function speakResponse(text, language = 'en') {
  Speech.stop();
  if (!text) return;
  Speech.speak(text, {
    language: language === 'te' ? 'te-IN' : 'en-US',
    pitch: 1.0,
    rate: 0.95,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

// ─── Extract destination from AI response for navigation ──────────────────────
export function extractNavigationIntent(aiResponse, rooms = []) {
  if (aiResponse.action !== 'navigate' || !aiResponse.destination) return null;

  const destLower = aiResponse.destination.toLowerCase().trim();

  // Try to match with actual rooms from the map data
  if (rooms.length > 0) {
    const exact = rooms.find(r => r.name?.toLowerCase() === destLower);
    if (exact) return exact;

    const partial = rooms.find(r => 
      r.name?.toLowerCase().includes(destLower) ||
      destLower.includes(r.name?.toLowerCase())
    );
    if (partial) return partial;
  }

  // Return a stub with the destination name for UI display
  return { name: aiResponse.destination, _id: null };
}

// ─── Build context payload for AI ─────────────────────────────────────────────
export function buildContext({ currentLocation, selectedRoom, selectedFloor, selectedBlock, campusName } = {}) {
  const ctx = {};
  if (campusName) ctx.campus = campusName;
  if (selectedBlock?.name) ctx.currentBlock = selectedBlock.name;
  if (selectedFloor?.name) ctx.currentFloor = selectedFloor.name;
  if (selectedRoom?.name) ctx.nearRoom = selectedRoom.name;
  if (currentLocation) ctx.coordinates = `${currentLocation.lat?.toFixed(4)}, ${currentLocation.lng?.toFixed(4)}`;
  return ctx;
}

// ─── Quick suggestion chips ────────────────────────────────────────────────────
export const QUICK_SUGGESTIONS = [
  { label: '🔬 Find Lab', message: 'Where is the Computer Lab?' },
  { label: '📚 Library', message: 'Take me to the Library' },
  { label: '🍽️ Cafeteria', message: 'Navigate to cafeteria' },
  { label: '🏫 Office', message: 'Where is the Principal Office?' },
  { label: '🆘 Help', message: 'What can you help me with?' },
];

// ─── Message factory ───────────────────────────────────────────────────────────
export function createMessage(type, text, extras = {}) {
  return {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,      // 'user' | 'ai' | 'system'
    text,
    timestamp: new Date(),
    ...extras, // action, destination, isError
  };
}

export const WELCOME_MESSAGE = createMessage(
  'ai',
  "👋 Hi! I'm NavX Assistant. I can help you find rooms, navigate around campus, and answer questions. Try saying 'Take me to the Library' or tap a suggestion below!",
);
