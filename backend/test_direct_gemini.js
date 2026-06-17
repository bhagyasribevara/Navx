require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Services
const { buildContextString } = require('./services/campusKnowledge');
const { detectLanguage, detectIntent } = require('./services/intentDetector');

function buildSystemPrompt(campusContext) {
  return `You are NavX AI, the intelligent campus navigation assistant for the NavX platform.
ALWAYS respond in valid JSON format:
{
  "text": "friendly conversational response here",
  "action": "navigate|show_nearby|emergency|live_meet|event_info|accessibility|faq|info|null",
  "destination": "extracted single destination name or null",
  "locations": ["Location 1", "Location 2"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}

CAMPUS DATA:
${campusContext}
`;
}

async function testModel(modelName, systemPrompt, message) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemPrompt
    });

    console.log(`Calling ${modelName}...`);
    const result = await model.generateContent(message);
    const text = result.response.text();
    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message || err };
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const campusId = '69f5b53806b69be1479267c7'; // GMRIT campus ID
  const campusContext = await buildContextString(campusId);
  const systemPrompt = buildSystemPrompt(campusContext);
  const message = 'Where is the digital library?';

  console.log(`System Prompt Length: ${systemPrompt.length} chars`);

  const models = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
  for (const m of models) {
    console.log(`\nTesting model: ${m}`);
    const res = await testModel(m, systemPrompt, message);
    if (res.success) {
      console.log(`✅ Success for ${m}:`);
      console.log(res.text);
    } else {
      console.log(`❌ Failed for ${m}:`, res.error);
    }
  }

  process.exit(0);
}

main();
