const fs = require('fs');
const path = require('path');

const navScreenContent = fs.readFileSync(path.join(__dirname, '../user/src/screens/NavigationScreen.js'), 'utf8');

const lines = navScreenContent.split('\n');
// Line 108 is function buildNavMapHTML (0-indexed 107)
// Line 1302 is </script></body></html>`; (0-indexed 1301)

const funcLines = lines.slice(107, 1303);
const fullFunc = funcLines.join('\n') + '\n';

const testScript = fullFunc + `
const sampleGeo = { type: 'FeatureCollection', features: [] };
const samplePoints = [{ x: 18.465, y: 83.662, floorLevel: 0 }];
const sampleRoom = { _id: 'room_abc', name: 'Seminar hall Entrance', shape: { points: [{ x: 18.465, y: 83.662 }] } };
try {
  const html = buildNavMapHTML(sampleGeo, samplePoints, null, sampleRoom, 'https://api.mapbox.com', []);
  console.log('Generated HTML length:', html.length);
  // Check for syntax errors in embedded script
  const scriptStart = html.indexOf('<script>') + 8;
  const scriptEnd = html.lastIndexOf('</script>');
  const scriptContent = html.substring(scriptStart, scriptEnd);
  console.log('Script length:', scriptContent.length);
  // Try evaluating the script syntax
  new Function(scriptContent);
  console.log('✔ Script syntax is valid JavaScript!');
} catch (err) {
  console.error('❌ Error during build or script syntax check:', err);
}
`;

fs.writeFileSync(path.join(__dirname, 'temp_test_nav.js'), testScript);
console.log('Wrote temp_test_nav.js');
