/**
 * NavX AI Assistant — Intent Detector & Language Detection
 * Pre-processes user messages to classify intent and detect language
 * BEFORE sending to the Gemini API.
 */

const {
  NAVX_KEYWORDS,
  TELUGU_NAVX_KEYWORDS,
  HINDI_NAVX_KEYWORDS,
  ACTION_TYPES,
} = require('./aiConstants');

// ─── Telugu Script Detection ────────────────────────────────────────────────
const TELUGU_REGEX = /[\u0C00-\u0C7F]/;
// Common Telugu transliteration patterns
const TELUGU_TRANSLITERATION = [
  'ekkada', 'undi', 'ela', 'vellali', 'chesthe', 'cheppu', 'cheppandi',
  'doggarlo', 'samipam', 'deggara', 'akkada', 'ikkada', 'anni', 'emiti',
  'enduku', 'evaru', 'meeru', 'nenu', 'manaki', 'vaallaki', 'kavali',
  'cheyandi', 'cheyali', 'undhi', 'ledhu', 'unn', 'unnaru', 'ledu',
  'raandi', 'vellu', 'chudandi', 'chudu', 'pakkana', 'mundhu', 'venaka',
  'eppudu', 'ipudu', 'tarvata',
];

// ─── Hindi Script Detection ────────────────────────────────────────────────
const HINDI_REGEX = /[\u0900-\u097F]/;
// Common Hindi transliteration patterns
const HINDI_TRANSLITERATION = [
  'kahan', 'hai', 'kaise', 'jaana', 'rasta', 'batao', 'bataiye',
  'kidhar', 'dikha', 'dikhao', 'chahiye', 'kya', 'kaun', 'kyun',
  'paas', 'nazdeek', 'yahan', 'wahan', 'dur', 'aur', 'ya',
  'le chalo', 'pahuncha', 'pahunchao', 'mujhe', 'humko', 'aap',
  'madad', 'sahayata', 'kripya', 'dhanyavaad', 'shukriya',
  'abhi', 'baad', 'pehle', 'upar', 'neeche', 'andar', 'bahar',
];

/**
 * Detect the language of user input.
 * Returns: 'en' | 'hi' | 'te'
 */
function detectLanguage(message) {
  if (!message) return 'en';

  // Check for native script first
  if (TELUGU_REGEX.test(message)) return 'te';
  if (HINDI_REGEX.test(message)) return 'hi';

  const lower = message.toLowerCase();
  const words = lower.split(/\s+/);

  // Check transliteration patterns
  let teluguScore = 0;
  let hindiScore = 0;

  for (const word of words) {
    if (TELUGU_TRANSLITERATION.some(tw => word.includes(tw))) teluguScore++;
    if (HINDI_TRANSLITERATION.some(hw => word.includes(hw))) hindiScore++;
  }

  if (teluguScore > hindiScore && teluguScore >= 1) return 'te';
  if (hindiScore > teluguScore && hindiScore >= 1) return 'hi';

  return 'en';
}

// ─── Navigation Intent Patterns ─────────────────────────────────────────────
const NAVIGATION_PATTERNS = [
  /take me to (.+)/i,
  /navigate to (.+)/i,
  /go to (.+)/i,
  /guide me to (.+)/i,
  /how (?:do i|to) (?:get|go|reach|find) (.+)/i,
  /where is (.+)/i,
  /where(?:'s| is) the (.+)/i,
  /find (.+)/i,
  /locate (.+)/i,
  /show me (.+)/i,
  /directions? to (.+)/i,
  /route to (.+)/i,
  /way to (.+)/i,
  /(.+) ekkada undi/i,        // Telugu: "X ekkada undi?"
  /(.+) ekkada/i,              // Telugu: "X ekkada?"
  /(.+) kahan hai/i,           // Hindi: "X kahan hai?"
  /(.+) kidhar hai/i,          // Hindi: "X kidhar hai?"
  /mujhe (.+) le chalo/i,      // Hindi: "Mujhe X le chalo"
  /(.+) ki taraf/i,            // Hindi: "X ki taraf"
];

// ─── Nearest/Nearby Patterns ────────────────────────────────────────────────
const NEARBY_PATTERNS = [
  /nearest (.+)/i,
  /closest (.+)/i,
  /nearby (.+)/i,
  /(.+) near me/i,
  /(.+) near here/i,
  /any (.+) nearby/i,
  /(.+) around here/i,
  /samipam lo (.+)/i,   // Telugu: nearby
  /paas mein (.+)/i,    // Hindi: nearby
  /nazdeek (.+)/i,      // Hindi: nearest
];

// ─── Emergency Patterns ─────────────────────────────────────────────────────
const EMERGENCY_PATTERNS = [
  /emergency/i,
  /fire exit/i,
  /fire escape/i,
  /medical room/i,
  /first aid/i,
  /security office/i,
  /help desk/i,
  /sos/i,
  /ambulance/i,
  /nearest exit/i,
  /emergency exit/i,
  /safe route/i,
  /evacuat/i,
];

// ─── Live Meet Patterns ─────────────────────────────────────────────────────
const LIVE_MEET_PATTERNS = [
  /live meet/i,
  /meet link/i,
  /meeting link/i,
  /share.*(location|position)/i,
  /friend.*(location|where|coming|eta)/i,
  /waiting for.*(friend|someone)/i,
  /join.*(meet|session)/i,
  /create.*(meet|session)/i,
  /how far.*friend/i,
  /friend.*how far/i,
];

// ─── Accessibility Patterns ─────────────────────────────────────────────────
const ACCESSIBILITY_PATTERNS = [
  /wheelchair/i,
  /accessible/i,
  /accessibility/i,
  /ramp/i,
  /elevator/i,
  /lift/i,
  /disabled/i,
  /barrier.?free/i,
  /handicap/i,
  /accessible.*route/i,
  /accessible.*washroom/i,
  /accessible.*entrance/i,
];

// ─── Event Patterns ─────────────────────────────────────────────────────────
const EVENT_PATTERNS = [
  /event/i,
  /events/i,
  /happening/i,
  /workshop/i,
  /hackathon/i,
  /fest /i,
  /festival/i,
  /seminar/i,
  /competition/i,
  /announcement/i,
  /what.*going on/i,
  /anything.*today/i,
  /any.*upcoming/i,
];

// ─── FAQ Patterns ───────────────────────────────────────────────────────────
const FAQ_PATTERNS = [
  /how does (.+) work/i,
  /how do (.+) work/i,
  /what is (.+)/i,
  /explain (.+)/i,
  /tell me about (.+)/i,
  /how to use (.+)/i,
  /how can i (.+)/i,
];

/**
 * Extract destination from a navigation query.
 * Returns the destination string or null.
 */
function extractDestination(message) {
  for (const pattern of [...NAVIGATION_PATTERNS, ...NEARBY_PATTERNS]) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted destination
      let dest = match[1].trim();
      // Remove trailing punctuation
      dest = dest.replace(/[?.!,]+$/, '').trim();
      // Remove articles
      dest = dest.replace(/^(the|a|an)\s+/i, '').trim();
      if (dest.length > 0 && dest.length < 100) {
        return dest;
      }
    }
  }
  return null;
}

/**
 * Detect primary intent of the user message.
 * Returns: { intent, extractedDestination, confidence }
 */
function detectIntent(message) {
  if (!message || !message.trim()) {
    return { intent: ACTION_TYPES.NONE, extractedDestination: null, confidence: 0 };
  }

  const lower = message.toLowerCase().trim();

  // 1. Emergency — highest priority
  if (EMERGENCY_PATTERNS.some(p => p.test(lower))) {
    return {
      intent: ACTION_TYPES.EMERGENCY,
      extractedDestination: extractDestination(message),
      confidence: 0.95,
    };
  }

  // 2. Live Meet
  if (LIVE_MEET_PATTERNS.some(p => p.test(lower))) {
    return {
      intent: ACTION_TYPES.LIVE_MEET,
      extractedDestination: null,
      confidence: 0.9,
    };
  }

  // 3. Accessibility
  if (ACCESSIBILITY_PATTERNS.some(p => p.test(lower))) {
    return {
      intent: ACTION_TYPES.ACCESSIBILITY,
      extractedDestination: extractDestination(message),
      confidence: 0.9,
    };
  }

  // 4. Nearby facility
  if (NEARBY_PATTERNS.some(p => p.test(lower))) {
    return {
      intent: ACTION_TYPES.SHOW_NEARBY,
      extractedDestination: extractDestination(message),
      confidence: 0.85,
    };
  }

  // 5. Navigation
  if (NAVIGATION_PATTERNS.some(p => p.test(lower))) {
    return {
      intent: ACTION_TYPES.NAVIGATE,
      extractedDestination: extractDestination(message),
      confidence: 0.85,
    };
  }

  // 6. Events
  if (EVENT_PATTERNS.some(p => p.test(lower))) {
    return {
      intent: ACTION_TYPES.EVENT_INFO,
      extractedDestination: null,
      confidence: 0.8,
    };
  }

  // 7. FAQ / How-to
  if (FAQ_PATTERNS.some(p => p.test(lower))) {
    return {
      intent: ACTION_TYPES.FAQ,
      extractedDestination: null,
      confidence: 0.75,
    };
  }

  // 8. General info (greetings, simple questions about NavX)
  return {
    intent: ACTION_TYPES.INFO,
    extractedDestination: extractDestination(message),
    confidence: 0.5,
  };
}

module.exports = {
  detectLanguage,
  detectIntent,
  extractDestination,
};
