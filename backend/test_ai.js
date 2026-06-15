const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5001/api/ai/chat', {
      message: 'Where is the library?',
      sessionId: 'test_session_123',
      campusId: null
    });
    console.log(res.data);
  } catch (err) {
    if (err.response) {
      console.error('500 Error Data:', err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

test();
