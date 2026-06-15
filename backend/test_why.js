const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5001/api/ai/chat', {
      message: 'Take me to boys hostel',
      sessionId: 'test_' + Date.now(),
      campusId: '675da785c49b0eb24fbb5444' // Provide valid campusId so it uses campusKnowledge
    });
    console.log(res.data);
  } catch (err) {
    console.error(err);
  }
}
test();
