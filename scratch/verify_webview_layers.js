const fs = require('fs');
const path = require('path');

function verifyFiles() {
  console.log('=== Verifying NavigationScreen.js and MapScreen.js ===');

  const navScreenPath = path.join(__dirname, '../user/src/screens/NavigationScreen.js');
  const mapScreenPath = path.join(__dirname, '../user/src/screens/MapScreen.js');

  const navContent = fs.readFileSync(navScreenPath, 'utf8');
  const mapContent = fs.readFileSync(mapScreenPath, 'utf8');

  const checks = [
    { name: 'NavigationScreen: campus-rooms-corridor', pattern: /id['"]?:\s*['"]campus-rooms-corridor['"]/ },
    { name: 'NavigationScreen: campus-rooms-base', pattern: /id['"]?:\s*['"]campus-rooms-base['"]/ },
    { name: 'NavigationScreen: campus-rooms-upper', pattern: /id['"]?:\s*['"]campus-rooms-upper['"]/ },
    { name: 'NavigationScreen: campus-rooms-parapet', pattern: /id['"]?:\s*['"]campus-rooms-parapet['"]/ },
    { name: 'NavigationScreen: campus-room-labels', pattern: /id['"]?:\s*['"]campus-room-labels['"]/ },
    { name: 'NavigationScreen: target highlight #f43f5e', pattern: /#f43f5e/ },
    { name: 'NavigationScreen: translucent blocks 0.25', pattern: /0\.25/ },
    { name: 'NavigationScreen: ROOM_CLICK postMessage', pattern: /type:\s*['"]ROOM_CLICK['"]/ },
    { name: 'NavigationScreen: handleWebViewMessage ROOM_CLICK', pattern: /data\.type\s*===\s*['"]ROOM_CLICK['"]/ },
    { name: 'MapScreen: campus-rooms-corridor', pattern: /id['"]?:\s*['"]campus-rooms-corridor['"]/ },
    { name: 'MapScreen: campus-rooms-base', pattern: /id['"]?:\s*['"]campus-rooms-base['"]/ },
    { name: 'MapScreen: campus-rooms-upper', pattern: /id['"]?:\s*['"]campus-rooms-upper['"]/ },
    { name: 'MapScreen: campus-rooms-parapet', pattern: /id['"]?:\s*['"]campus-rooms-parapet['"]/ },
    { name: 'MapScreen: campus-room-labels', pattern: /id['"]?:\s*['"]campus-room-labels['"]/ },
    { name: 'MapScreen: translucent blocks 0.25', pattern: /0\.25/ },
    { name: 'MapScreen: ROOM_CLICK postMessage', pattern: /type:\s*['"]ROOM_CLICK['"]/ },
    { name: 'MapScreen: handleWebViewMessage ROOM_CLICK', pattern: /data\.type\s*===\s*['"]ROOM_CLICK['"]/ }
  ];

  let passed = 0;
  for (const c of checks) {
    const content = c.name.startsWith('NavigationScreen') ? navContent : mapContent;
    if (c.pattern.test(content)) {
      console.log(`✔ ${c.name}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${c.name}`);
    }
  }

  if (passed === checks.length) {
    console.log(`\nAll ${passed}/${checks.length} checks passed!`);
  } else {
    throw new Error(`Only ${passed}/${checks.length} checks passed!`);
  }
}

verifyFiles();
