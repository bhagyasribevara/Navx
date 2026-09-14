// Check Mapbox GL JS symbol layer properties
const https = require('https');

https.get('https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Mapbox GL JS downloaded, length:', data.length);
    const matches = data.match(/symbol-z-[a-z-]+/g);
    console.log('symbol-z matches:', matches);
    const zElevMatches = data.match(/elevation|symbol-z-elevated|symbol-z-order/g);
    console.log('zElevMatches:', [...new Set(zElevMatches)]);
    const extrudeMatches = data.match(/fill-extrusion-[a-z-]+/g);
    console.log('extrude properties:', [...new Set(extrudeMatches)]);
  });
});
