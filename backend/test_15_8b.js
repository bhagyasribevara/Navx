const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: 'c:\\Users\\Punit\\OneDrive\\Desktop\\NavX_main\\Navx\\backend\\.env' });

async function test(modelName) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent('Hi');
    console.log(modelName, 'SUCCESS:', res.response.text());
  } catch (err) {
    console.error(modelName, 'ERROR:', err.message);
  }
}

async function run() {
  await test('gemini-1.5-flash-8b');
  await test('gemini-1.5-flash-8b-latest');
}
run();
