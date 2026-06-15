const axios = require('axios');
require('dotenv').config();

async function test() {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const res = await axios.get(url);
  console.log(res.data.models.map(m => m.name));
}
test();
