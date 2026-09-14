const fs = require('fs');
const path = require('path');

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

let balance = 0;
for (let i = 0; i < scriptLines.length; i++) {
  const line = scriptLines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') balance++;
    if (line[j] === '}') balance--;
  }
}
console.log('Final brace balance (should be 0):', balance);

// Let's trace where balance increases and doesn't decrease
// Let's check around renderGeoJSONLayers
for (let i = 0; i < scriptLines.length; i++) {
  if (scriptLines[i].includes('renderGeoJSONLayers') || scriptLines[i].includes('campus-rooms')) {
    console.log(`Line ${i + 1}: ${scriptLines[i]}`);
  }
}
