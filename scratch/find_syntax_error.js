const fs = require('fs');
const path = require('path');

// Run temp_test_nav.js to get the script content and pinpoint the syntax error
const navScreenContent = fs.readFileSync(path.join(__dirname, '../user/src/screens/NavigationScreen.js'), 'utf8');
const lines = navScreenContent.split('\n');
const funcLines = lines.slice(107, 1303);
const fullFunc = funcLines.join('\n') + '\n';

const sampleGeo = { type: 'FeatureCollection', features: [] };
const samplePoints = [{ x: 18.465, y: 83.662, floorLevel: 0 }];
const sampleRoom = { _id: 'room_abc', name: 'Seminar hall Entrance', shape: { points: [{ x: 18.465, y: 83.662 }] } };

const fn = new Function('geoJSONData', 'pathPoints', 'initialPos', 'targetRoom', 'mapboxUrl', 'floors', 'mapMode', fullFunc + 'return buildNavMapHTML(geoJSONData, pathPoints, initialPos, targetRoom, mapboxUrl, floors, mapMode);');
const html = fn(sampleGeo, samplePoints, null, sampleRoom, 'https://api.mapbox.com', []);

const scriptStart = html.indexOf('<script>') + 8;
const scriptEnd = html.lastIndexOf('</script>');
const scriptContent = html.substring(scriptStart, scriptEnd);

const scriptLines = scriptContent.split('\n');

// Find which line causes syntax error by testing prefix lines
let errorLine = -1;
for (let i = 1; i <= scriptLines.length; i++) {
  const chunk = scriptLines.slice(0, i).join('\n');
  try {
    new Function(chunk);
  } catch (err) {
    if (err.message.includes("Unexpected token ')'")) {
      console.log('Error found at script line:', i);
      console.log('Surrounding lines:');
      for (let j = Math.max(0, i - 5); j <= Math.min(scriptLines.length - 1, i + 5); j++) {
        console.log(`${j + 1}: ${scriptLines[j]}`);
      }
      break;
    }
  }
}
