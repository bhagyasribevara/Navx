const fs = require('fs');
let currentCSS = fs.readFileSync('src/index.css', 'utf8');

// Find the line where the broken string starts: '"\n/* Collapsed sidebar tooltips */'
const brokenStartIdx = currentCSS.indexOf('"\n/* Collapsed sidebar tooltips */');
if (brokenStartIdx > -1) {
    currentCSS = currentCSS.substring(0, brokenStartIdx); // Cut off the broken string
} else {
    // maybe it starts with '"\\n'
    const altIdx = currentCSS.indexOf('"\\n/* Collapsed sidebar tooltips */');
    if (altIdx > -1) currentCSS = currentCSS.substring(0, altIdx);
}

// Now read the history
const history = JSON.parse(fs.readFileSync('css_history.json', 'utf8'));
let newCSS = history[0].ReplacementContent;

// It's a string that starts with a double quote.
if (newCSS.startsWith('"')) {
    newCSS = newCSS.substring(1, newCSS.length - 1); // remove outer quotes
    // Replace literal escaped "\n" with actual newlines
    newCSS = newCSS.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
}

// Append correctly
currentCSS += '\n' + newCSS;

fs.writeFileSync('src/index.css', currentCSS, 'utf8');
console.log('Successfully fixed index.css!');
