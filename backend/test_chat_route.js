const axios = require('axios');

async function testChat() {
  try {
    const res = await axios.post('http://localhost:5001/api/adminAi/chat', {
      message: 'where can I add new room for block 5',
      adminData: { role: 'SuperAdmin' }
    });
    console.log('STATUS:', res.status);
    console.log('RESPONSE:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

testChat();
