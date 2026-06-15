const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('http://localhost:5001/api/health');
    console.log(res.data);
  } catch (err) {
    console.error(err.message);
  }
}
test();
