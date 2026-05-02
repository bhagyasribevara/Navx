const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory session store (per sessionId)
const sessions = {};

const SYSTEM_PROMPT = `You are NavX, a smart indoor navigation assistant for a university campus. 
Your job is to help students and staff find rooms, labs, offices, and other facilities.

RULES:
1. Keep responses SHORT (2-3 sentences max) and friendly.
2. If the user asks to go somewhere or find a location, extract the destination and include an ACTION in your response.
3. For navigation intent, always respond with JSON format: {"text": "your friendly message", "action": "navigate", "destination": "room name"}.
4. For information only (no navigation needed), respond with JSON format: {"text": "your friendly message", "action": null, "destination": null}.
5. Common places on campus: CSE Block, ECE Block, Labs, Library, Cafeteria, Principal Office, Seminar Hall, Computer Lab, Physics Lab, Chemistry Lab.
6. Be context aware — if user provides current location, reference it in your reply.
7. Fallback: If you don't understand, ask the user to rephrase in JSON format: {"text": "Sorry, I didn't understand that. Could you rephrase?", "action": null, "destination": null}.
8. Always return valid JSON. Never return plain text.`;

router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default', context = {} } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      // Fallback mock response for testing without API key
      const lower = message.toLowerCase();
      let response = { text: "I'm here to help you navigate! Ask me to find any room or facility.", action: null, destination: null };
      
      if (lower.includes('navigate') || lower.includes('take me') || lower.includes('find') || lower.includes('where is') || lower.includes('go to')) {
        const places = ['library', 'cafeteria', 'lab', 'office', 'computer lab', 'seminar hall'];
        const found = places.find(p => lower.includes(p));
        if (found) {
          response = { text: `Sure! Let me take you to the ${found}.`, action: 'navigate', destination: found };
        } else {
          response = { text: "I can help you navigate! Which room or facility are you looking for?", action: null, destination: null };
        }
      } else if (lower.includes('hello') || lower.includes('hi')) {
        response = { text: "Hello! I'm NavX assistant. Ask me to find any room or building on campus!", action: null, destination: null };
      } else if (lower.includes('help')) {
        response = { text: "I can help you find rooms, labs, offices, and navigate around campus. Just say 'Take me to Library' or 'Where is Lab 3?'", action: null, destination: null };
      }
      
      return res.json(response);
    }

    // Build history for this session
    if (!sessions[sessionId]) sessions[sessionId] = [];
    const history = sessions[sessionId];

    // Build context string
    const contextStr = Object.keys(context).length > 0 
      ? `\nContext: ${JSON.stringify(context)}` 
      : '';

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: '{"text": "Hello! I am NavX, your campus navigation assistant. How can I help you today?", "action": null, "destination": null}' }] },
        ...history,
      ],
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
    });

    const result = await chat.sendMessage(message + contextStr);
    const rawText = result.response.text().trim();

    // Parse JSON response
    let parsed;
    try {
      // Handle markdown code blocks
      const clean = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // If not valid JSON, wrap it
      parsed = { text: rawText, action: null, destination: null };
    }

    // Update session history
    history.push(
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text: rawText }] }
    );
    // Keep last 10 exchanges
    if (history.length > 20) history.splice(0, 2);

    res.json(parsed);
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ 
      text: "I'm having trouble connecting right now. Please try again!", 
      action: null, 
      destination: null,
      error: err.message 
    });
  }
});

// Clear session history
router.delete('/chat/:sessionId', (req, res) => {
  delete sessions[req.params.sessionId];
  res.json({ success: true });
});

module.exports = router;
