const http = require('http');

http.get('http://localhost:5001/api/blocks', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const blocks = JSON.parse(data);
    const himalaya = blocks.filter(b => b.name.toLowerCase().includes('himalaya'));
    console.log("Himalaya blocks count:", himalaya.length);
    himalaya.forEach(b => {
      console.log(`- ${b.name}: _id=${b._id}, shape.points.length=${b.shape?.points?.length}, shape.type=${b.shape?.type}, shape.x=${b.shape?.x}, shape.y=${b.shape?.y}`);
      if (b.shape?.points?.length > 0) {
        console.log("  First point:", b.shape.points[0]);
      }
    });
    const nilgiri = blocks.filter(b => b.name.toLowerCase().includes('nilgiri'));
    console.log("Nilgiri blocks count:", nilgiri.length);
    nilgiri.forEach(b => {
      if (b.shape?.points?.length > 0) {
        console.log(`- ${b.name}: First point:`, b.shape.points[0]);
      }
    });
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
