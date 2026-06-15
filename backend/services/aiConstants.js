/**
 * NavX AI Assistant — Constants & Configuration
 * Centralized constants for the AI pipeline: FAQ, keywords, templates, emoji mappings.
 */

// ─── Supported Languages ────────────────────────────────────────────────────
const LANGUAGES = {
  ENGLISH: 'en',
  HINDI: 'hi',
  TELUGU: 'te',
};

// ─── Room Type → Emoji Mapping ──────────────────────────────────────────────
const ROOM_EMOJI = {
  classroom: '🏫',
  office: '🏢',
  lab: '🔬',
  restroom: '🚻',
  cafeteria: '🍽️',
  library: '📚',
  auditorium: '🎭',
  elevator: '🛗',
  stairs: '🪜',
  corridor: '🚶',
  entrance: '🚪',
  exit: '🚪',
  parking: '🅿️',
  gym: '💪',
  conference: '📋',
  pharmacy: '💊',
  emergency: '🚨',
  reception: '🛎️',
  store: '🛍️',
  food_court: '🍔',
  other: '📍',
};

// ─── Quick Suggestion Chips ─────────────────────────────────────────────────
const SUGGESTION_CHIPS = [
  { label: '📍 Find Library', query: 'Where is the library?' },
  { label: '🍽️ Cafeteria', query: 'Take me to the cafeteria' },
  { label: '🚻 Washroom', query: 'Where is the nearest washroom?' },
  { label: '🅿️ Parking', query: 'Where is the parking area?' },
  { label: '🎉 Events', query: 'Any events happening nearby?' },
  { label: '🤝 Live Meet', query: 'How does Live Meet work?' },
  { label: '🎯 Navigate', query: 'How do I navigate inside campus?' },
  { label: '♿ Accessibility', query: 'Show me accessible routes' },
  { label: '🚨 Emergency', query: 'Where is the nearest emergency exit?' },
  { label: '🔍 Search Room', query: 'Help me find a room' },
];

// ─── FAQ Entries ────────────────────────────────────────────────────────────
const FAQ_ENTRIES = [
  {
    question: 'How does AR navigation work?',
    answer: 'NavX AR navigation uses your phone camera to overlay directional arrows and markers on the real world. Simply tap "Start AR" on any navigation route, point your camera forward, and follow the on-screen arrows to reach your destination. It works best indoors with well-lit areas.',
  },
  {
    question: 'How does Live Meet work?',
    answer: 'Live Meet lets you share your real-time location with a friend on campus. Create a Meet session, share the link, and your friend can see your live position and navigate towards you. You can also see their ETA and distance in real-time.',
  },
  {
    question: 'How does QR navigation work?',
    answer: 'QR codes are placed at key locations around campus. Scan any NavX QR code with the app to instantly know your exact position on the map. This is especially useful for indoor navigation where GPS may not be accurate.',
  },
  {
    question: 'How does indoor navigation work?',
    answer: 'NavX uses a combination of QR codes, Bluetooth beacons, and the campus navigation graph to guide you through buildings. The system calculates the shortest path using the A* algorithm and provides step-by-step directions including floor transitions via stairs or elevators.',
  },
  {
    question: 'How do location permissions work?',
    answer: 'NavX needs location permissions to show your position on the campus map and calculate routes from your current location. For outdoor navigation, GPS is used. For indoor positioning, NavX uses QR codes and beacons. You can revoke permissions anytime from your device settings.',
  },
  {
    question: 'How to report map issues?',
    answer: 'If you find an incorrect room label, missing path, or wrong floor layout, you can report it through the Settings screen in the NavX app. The campus admin will review and update the map data.',
  },
  {
    question: 'How to save favorite places?',
    answer: 'Tap the heart/star icon on any room or location in the search results to save it as a favorite. Access your saved places from the Favorites tab for quick navigation.',
  },
  {
    question: 'How to share location?',
    answer: 'Use the Live Meet feature to share your real-time location with friends. Create a session and share the generated link via any messaging app.',
  },
  {
    question: 'How to create meeting links?',
    answer: 'Open the Live Meet feature, tap "Create Meet", and NavX will generate a unique session link. Share this link with your friend — they can open it in the NavX app to see your location and navigate towards you.',
  },
  {
    question: 'How does offline navigation work?',
    answer: 'NavX can download campus map data for offline use. Go to Settings → Offline Maps to download your campus. Once downloaded, you can view maps and get basic navigation even without internet. Live features like Meet require connectivity.',
  },
];

// ─── Off-Topic Keyword Categories ───────────────────────────────────────────
const OFF_TOPIC_KEYWORDS = {
  coding: [
    'python', 'javascript', 'java', 'c++', 'code', 'coding', 'programming',
    'algorithm', 'data structure', 'compile', 'debug', 'function', 'class',
    'html', 'css', 'react', 'angular', 'vue', 'node.js', 'api', 'database',
    'sql', 'mongodb', 'git', 'github', 'stackoverflow', 'leetcode', 'hackerrank',
    'syntax', 'variable', 'loop', 'array', 'object', 'string', 'integer',
    'software', 'developer', 'framework', 'backend', 'frontend', 'fullstack',
  ],
  politics: [
    'politics', 'election', 'president', 'prime minister', 'government',
    'parliament', 'congress', 'senator', 'democrat', 'republican', 'bjp',
    'congress party', 'vote', 'political', 'minister', 'modi', 'trump',
    'biden', 'policy', 'bill', 'legislation',
  ],
  sports: [
    'cricket', 'football', 'soccer', 'basketball', 'tennis', 'ipl',
    'world cup', 'match score', 'virat', 'dhoni', 'messi', 'ronaldo',
    'nba', 'nfl', 'olympics', 'batting', 'bowling', 'wicket', 'goal',
    'stadium', 'tournament', 'champion', 'league',
  ],
  entertainment: [
    'movie', 'film', 'bollywood', 'hollywood', 'tollywood', 'actor',
    'actress', 'director', 'netflix', 'amazon prime', 'disney', 'series',
    'song', 'music', 'album', 'singer', 'concert', 'celebrity', 'gossip',
    'trailer', 'box office', 'oscar', 'grammy',
  ],
  mathematics: [
    'solve', 'equation', 'calculus', 'algebra', 'geometry', 'trigonometry',
    'integral', 'derivative', 'matrix', 'probability', 'statistics',
    'theorem', 'proof', 'formula', 'calculate', 'math', 'maths',
    'arithmetic', 'logarithm', 'factorial',
  ],
  general_knowledge: [
    'capital of', 'population of', 'who invented', 'when was', 'history of',
    'geography', 'science fact', 'planet', 'universe', 'solar system',
    'dinosaur', 'evolution', 'physics', 'chemistry', 'biology',
    'encyclopedia', 'wikipedia', 'general knowledge', 'trivia', 'quiz',
  ],
  personal_advice: [
    'relationship', 'love advice', 'breakup', 'dating', 'marriage',
    'mental health', 'depression', 'anxiety', 'therapy', 'counseling',
    'career advice', 'job interview', 'resume', 'salary', 'horoscope',
    'zodiac', 'astrology', 'dream meaning', 'personality test',
  ],
  recipes_food: [
    'recipe', 'cook', 'bake', 'ingredients', 'cuisine', 'restaurant review',
    'calories', 'diet', 'nutrition', 'meal plan', 'food blog',
  ],
};

// ─── NavX-Related Keywords (Whitelist) ──────────────────────────────────────
const NAVX_KEYWORDS = [
  // Navigation
  'navigate', 'navigation', 'route', 'direction', 'directions', 'path',
  'way', 'take me', 'go to', 'reach', 'find', 'locate', 'search',
  'where is', 'how to go', 'how to reach', 'shortest', 'fastest',
  'nearest', 'closest', 'nearby', 'around', 'near me', 'distance',
  'far', 'how far', 'eta', 'time', 'walk', 'walking',
  
  // Campus Locations
  'block', 'building', 'floor', 'room', 'hall', 'lab', 'laboratory',
  'classroom', 'lecture', 'office', 'department', 'faculty', 'staff',
  'library', 'cafeteria', 'canteen', 'food', 'washroom', 'restroom',
  'toilet', 'bathroom', 'parking', 'lot', 'entrance', 'exit', 'gate',
  'auditorium', 'seminar', 'conference', 'computer', 'science',
  'principal', 'dean', 'hod', 'professor',
  
  // NavX Features
  'navx', 'ar', 'augmented reality', 'qr', 'qr code', 'scan',
  'live meet', 'meet', 'meeting', 'friend', 'share location',
  'beacon', 'indoor', 'outdoor', 'map', 'campus', 'campus map',
  'favorite', 'bookmark', 'save', 'history', 'recent',
  'offline', 'download', 'settings', 'help',
  
  // Accessibility
  'wheelchair', 'accessible', 'accessibility', 'ramp', 'elevator',
  'lift', 'escalator', 'disabled', 'barrier free', 'handicap',
  
  // Emergency
  'emergency', 'fire', 'fire exit', 'medical', 'first aid',
  'security', 'guard', 'help desk', 'sos', 'ambulance', 'hospital',
  'clinic', 'health', 'safety',
  
  // Events & Announcements
  'event', 'events', 'announcement', 'notice', 'fest', 'festival',
  'workshop', 'seminar', 'hackathon', 'competition', 'exam',
  'schedule', 'timetable', 'timing', 'open', 'closed',
  
  // Campus Services
  'shuttle', 'bus', 'transport', 'atm', 'bank', 'xerox', 'print',
  'stationery', 'bookstore', 'lost', 'found', 'lost and found',
  'wifi', 'internet', 'charging', 'water', 'cooler',
  
  // Greetings and general chat
  'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
  'thank', 'thanks', 'bye', 'goodbye', 'help', 'assist',
  'who are you', 'what can you do', 'what are you',
];

// ─── Telugu Keywords (NavX domain) ──────────────────────────────────────────
const TELUGU_NAVX_KEYWORDS = [
  'ekkada', 'undi', 'ela', 'vellali', 'daaari', 'cheppu',
  'library', 'canteen', 'washroom', 'parking', 'block',
  'room', 'lab', 'office', 'entrance', 'exit',
  'doggarlo', 'samipam', 'deggara', 'akkada', 'ikkada',
  'navx', 'navigate', 'map', 'campus',
  'emergency', 'help', 'event', 'meet',
];

// ─── Hindi Keywords (NavX domain) ───────────────────────────────────────────
const HINDI_NAVX_KEYWORDS = [
  'kahan', 'hai', 'kaise', 'jaana', 'rasta', 'batao',
  'library', 'canteen', 'washroom', 'parking', 'block',
  'room', 'lab', 'office', 'entrance', 'exit',
  'paas', 'nazdeek', 'yahan', 'wahan', 'dur',
  'navx', 'navigate', 'map', 'campus',
  'emergency', 'madad', 'event', 'meet',
  'kidhar', 'dikha', 'le chalo', 'pahuncha',
];

// ─── Polite Refusal Messages ────────────────────────────────────────────────
const REFUSAL_MESSAGES = {
  en: "I'm NavX AI, designed specifically to help with campus navigation and NavX-related services. I can assist you with finding locations, routes, events, facilities, and navigation inside the campus. How can I help you navigate today?",
  hi: "मैं NavX AI हूं, जो विशेष रूप से कैंपस नेविगेशन और NavX सेवाओं में मदद करने के लिए बनाया गया है। मैं आपको कैंपस के अंदर स्थान, रास्ते, इवेंट, सुविधाएं और नेविगेशन में सहायता कर सकता हूं। आज मैं आपकी कैसे मदद कर सकता हूं?",
  te: "నేను NavX AI, క్యాంపస్ నావిగేషన్ మరియు NavX సేవల కోసం ప్రత్యేకంగా రూపొందించబడ్డాను. క్యాంపస్ లోపల లొకేషన్లు, రూట్లు, ఈవెంట్లు, సౌకర్యాలు మరియు నావిగేషన్ లో నేను మీకు సహాయం చేయగలను. నేను ఈ రోజు మీకు ఎలా సహాయం చేయగలను?",
};

// ─── Welcome Messages ───────────────────────────────────────────────────────
const WELCOME_MESSAGES = {
  en: "👋 Hello! I'm **NavX AI**, your smart campus navigation assistant. I can help you find buildings, rooms, navigate routes, discover events, and much more!\n\nTry asking me:\n• \"Where is the library?\"\n• \"Take me to CSE Block\"\n• \"Nearest washroom?\"\n• \"Any events nearby?\"",
  hi: "👋 नमस्ते! मैं **NavX AI** हूं, आपका स्मार्ट कैंपस नेविगेशन सहायक। मैं आपको इमारतें, कमरे खोजने, रास्ते नेविगेट करने, इवेंट खोजने और बहुत कुछ में मदद कर सकता हूं!",
  te: "👋 హలో! నేను **NavX AI**, మీ స్మార్ట్ క్యాంపస్ నావిగేషన్ అసిస్టెంట్. భవనాలు, గదులు కనుగొనడం, రూట్లు నావిగేట్ చేయడం, ఈవెంట్లు కనుగొనడం మరియు మరిన్ని విషయాల్లో నేను మీకు సహాయం చేయగలను!",
};

// ─── Action Types ───────────────────────────────────────────────────────────
const ACTION_TYPES = {
  NAVIGATE: 'navigate',
  SHOW_NEARBY: 'show_nearby',
  EMERGENCY: 'emergency',
  LIVE_MEET: 'live_meet',
  EVENT_INFO: 'event_info',
  ACCESSIBILITY: 'accessibility',
  FAQ: 'faq',
  INFO: 'info',
  NONE: null,
};

module.exports = {
  LANGUAGES,
  ROOM_EMOJI,
  SUGGESTION_CHIPS,
  FAQ_ENTRIES,
  OFF_TOPIC_KEYWORDS,
  NAVX_KEYWORDS,
  TELUGU_NAVX_KEYWORDS,
  HINDI_NAVX_KEYWORDS,
  REFUSAL_MESSAGES,
  WELCOME_MESSAGES,
  ACTION_TYPES,
};
