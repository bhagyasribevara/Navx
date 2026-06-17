const axios = require('axios');

async function testEndpoint(query, campusId) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `http://localhost:5001/api/rooms/search/${encoded}?campusId=${campusId}`;
    console.log(`GET ${url}`);
    const res = await axios.get(url);
    console.log(`Found: ${res.data.length} rooms`);
    res.data.forEach(r => {
      console.log(`  - Name: "${r.name}", Block: "${r.blockId?.name || ''}", Floor: "${r.floorId?.name || ''}"`);
    });
  } catch (err) {
    console.error(`Failed: ${err.message}`);
  }
}

async function main() {
  const campusId = '69f5b53806b69be1479267c7'; // GMRIT campus ID
  
  await testEndpoint('digital library', campusId);
  await testEndpoint('digital library ', campusId); // trailing space
  await testEndpoint('library digital', campusId);  // swap order
  
  process.exit(0);
}

main();
