/**
 * NavX AI Assistant — Domain Guard
 * Enforces strict domain restriction: only NavX/campus-related queries are allowed.
 * Off-topic queries receive a polite, multilingual refusal.
 */

const {
  OFF_TOPIC_KEYWORDS,
  NAVX_KEYWORDS,
  TELUGU_NAVX_KEYWORDS,
  HINDI_NAVX_KEYWORDS,
  REFUSAL_MESSAGES,
} = require('./aiConstants');

/**
 * Check if a message is related to the NavX domain.
 * 
 * Strategy:
 * 1. Check if message contains NavX-related keywords → allow
 * 2. Check if message matches off-topic keyword categories → block
 * 3. If ambiguous, allow (let Gemini handle with system prompt restrictions)
 * 
 * @param {string} message - User message
 * @param {string} language - Detected language ('en', 'hi', 'te')
 * @returns {{ isAllowed: boolean, reason: string|null, category: string|null }}
 */
function checkDomain(message, language = 'en') {
  if (!message || !message.trim()) {
    return { isAllowed: true, reason: null, category: null };
  }

  const lower = message.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // ─── Step 1: Check NavX whitelist first ────────────────────────────────
  // If the message contains ANY NavX-related keyword, allow it
  const allNavXKeywords = [
    ...NAVX_KEYWORDS,
    ...TELUGU_NAVX_KEYWORDS,
    ...HINDI_NAVX_KEYWORDS,
  ];

  const hasNavXKeyword = allNavXKeywords.some(keyword => {
    if (keyword.includes(' ')) {
      return lower.includes(keyword);
    }
    return words.includes(keyword);
  });

  if (hasNavXKeyword) {
    return { isAllowed: true, reason: null, category: null };
  }

  // ─── Step 2: Check off-topic categories ────────────────────────────────
  for (const [category, keywords] of Object.entries(OFF_TOPIC_KEYWORDS)) {
    const matchCount = keywords.filter(keyword => {
      if (keyword.includes(' ')) {
        return lower.includes(keyword);
      }
      return words.includes(keyword);
    }).length;

    // If 2+ off-topic keywords from same category, it's clearly off-topic
    if (matchCount >= 2) {
      return {
        isAllowed: false,
        reason: `Off-topic: ${category}`,
        category,
      };
    }

    // If 1 keyword matches and message is short (likely a direct question about the topic)
    if (matchCount === 1 && words.length <= 8) {
      // Check if the word could be in a campus context
      // e.g., "computer lab" — "computer" is in coding keywords but contextually NavX-related
      const contextuallyNavX = lower.includes('lab') || lower.includes('room') ||
        lower.includes('block') || lower.includes('department') ||
        lower.includes('class') || lower.includes('hall') ||
        lower.includes('building') || lower.includes('floor');

      if (!contextuallyNavX) {
        return {
          isAllowed: false,
          reason: `Likely off-topic: ${category}`,
          category,
        };
      }
    }
  }

  // ─── Step 3: Ambiguous — allow and let Gemini's system prompt handle ───
  return { isAllowed: true, reason: null, category: null };
}

/**
 * Get a polite refusal message in the detected language.
 * @param {string} language - 'en', 'hi', 'te'
 * @returns {string} Refusal message
 */
function getRefusalMessage(language = 'en') {
  return REFUSAL_MESSAGES[language] || REFUSAL_MESSAGES.en;
}

/**
 * Build a full refusal response object (matches AI response schema).
 * @param {string} language - 'en', 'hi', 'te'
 * @returns {object} Response object
 */
function buildRefusalResponse(language = 'en') {
  return {
    text: getRefusalMessage(language),
    action: null,
    destination: null,
    navigationData: null,
    suggestions: [
      'Where is the library?',
      'Take me to the cafeteria',
      'Any events nearby?',
      'How does AR navigation work?',
    ],
    language,
    isRefusal: true,
  };
}

module.exports = {
  checkDomain,
  getRefusalMessage,
  buildRefusalResponse,
};
