const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const res = await model.generateContent('Hi');
    console.log(res.response.text());
  } catch (err) {
    console.error(err.message);
  }
}

test();
