const axios = require('axios');
require('dotenv').config();

async function test() {
  try {
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const res = await axios.get(url);
    console.log(res.data);
  } catch (err) {
    if (err.response) {
      console.error(err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
  }
}
test();
