const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Wait, listModels is not easily available in the old SDK without making a REST call.
    // Let's just try gemini-pro instead.
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const res = await model.generateContent('Hi');
    console.log(res.response.text());
  } catch (err) {
    console.error(err);
  }
}

test();
