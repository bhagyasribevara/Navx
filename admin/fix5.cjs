const fs = require('fs');
const execSync = require('child_process').execSync;

try {
  // 1. Restore the pristine main branch index.css
  execSync('git checkout src/index.css');

  // 2. Read it
  let currentCSS = fs.readFileSync('src/index.css', 'utf8');

  // 3. Apply the regex replacements to clear out rgba hardcodes in the body of index.css
  currentCSS = currentCSS.replace(/rgba\(13, 21, \d+, [\d.]+\)/g, 'var(--bg-card)');
  currentCSS = currentCSS.replace(/rgba\(8, 14, \d+, [\d.]+\)/g, 'var(--bg-primary)');
  currentCSS = currentCSS.replace(/rgba\(99, 102, 241, 0\.15\)/g, 'var(--border-color)');
  currentCSS = currentCSS.replace(/background: linear-gradient\(180deg, rgba\(8, 12, 28, [\d.]+\) 0%, rgba\(6, 10, 20, [\d.]+\) 100%\);/g, 'background: var(--gradient-dark);');
  currentCSS = currentCSS.replace(/background: linear-gradient\(180deg, rgba\(8, 12, 24, [\d.]+\) 0%, rgba\(6, 10, 20, [\d.]+\) 100%\);/g, 'background: var(--gradient-dark);');
  currentCSS = currentCSS.replace(/background: rgba\(8, 12, 24, [\d.]+\) !important;/g, 'background: var(--bg-card) !important;');

  // 4. Find the cut-off point where we should append the Light Theme block
  const startIdx = currentCSS.indexOf('/* Collapsed sidebar tooltips */');
  if (startIdx > -1) {
      currentCSS = currentCSS.substring(0, startIdx); // Remove original tooltips
  }

  // 5. Read the full untruncated history
  const history = JSON.parse(fs.readFileSync('css_history_full.json', 'utf8'));
  let lightThemeCSS = history[0].ReplacementContent;
  
  // The string in transcript_full might still be JSON encoded
  if (lightThemeCSS.startsWith('"')) {
      try {
          lightThemeCSS = JSON.parse(lightThemeCSS);
      } catch (e) {
          lightThemeCSS = lightThemeCSS.substring(1, lightThemeCSS.length - 1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
      }
  }

  // 6. Define the final button overrides
  const buttonOverrides = `
/* Global button light theme override */
[data-theme="light"] button:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn) {
  color: #000000 !important;
  box-shadow: var(--shadow-md) !important;
}

[data-theme="light"] button:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn):hover {
  box-shadow: var(--shadow-lg) !important;
}
`;

  // 7. Stitch it all together
  currentCSS = currentCSS + '\n' + lightThemeCSS + '\n' + buttonOverrides;

  // 8. Write the final fixed CSS
  fs.writeFileSync('src/index.css', currentCSS, 'utf8');
  console.log('Successfully rebuilt index.css from untruncated history!');

} catch (err) {
  console.error(err);
}
