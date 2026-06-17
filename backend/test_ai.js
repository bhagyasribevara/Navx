const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5001/api/ai/chat', {
      message: '5 G 3 room',
      sessionId: 'test_session_123',
      campusId: '69f5b53806b69be1479267c7'
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
