const fs = require('fs');
const logs = fs.readFileSync('eas_build_logs_decoded.txt', 'utf8');
const lines = logs.split('\n');
fs.writeFileSync('error_snippet.txt', lines.slice(-100).join('\n'));
