require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testModel(modelName) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const response = await model.generateContent("Hello!");
    return { success: true, text: response.response.text().trim() };
  } catch (err) {
    return { success: false, error: err.message || err };
  }
}

async function run() {
  const models = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];
  for (const m of models) {
    console.log(`\nTesting ${m} 3 times...`);
    for (let i = 1; i <= 3; i++) {
      const res = await testModel(m);
      if (res.success) {
        console.log(`  Try ${i}: ✅ Success: ${res.text}`);
      } else {
        console.log(`  Try ${i}: ❌ Failed: ${res.error}`);
      }
    }
  }
}

run();
