const fs = require('fs');
const history = JSON.parse(fs.readFileSync('css_history.json', 'utf8'));
let newCSS = history[0].ReplacementContent;
if(newCSS.startsWith('"')) {
    newCSS = JSON.parse(newCSS);
}
let currentCSS = fs.readFileSync('src/index.css', 'utf8');
const startIdx = currentCSS.indexOf('/* Collapsed sidebar tooltips */');
if (startIdx > -1) {
    currentCSS = currentCSS.substring(0, startIdx) + newCSS;
    fs.writeFileSync('src/index.css', currentCSS, 'utf8');
    console.log('Successfully applied Light Theme overrides!');
} else {
    console.log('Could not find marker in index.css');
}
