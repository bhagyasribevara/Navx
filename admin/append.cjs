const fs = require('fs');
const css = `
/* Global button light theme override */
[data-theme="light"] button:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn) {
  color: #000000 !important;
  box-shadow: var(--shadow-md) !important;
}

[data-theme="light"] button:not(.theme-btn):not(.sidebar-toggle):not(.btn-logout):not(.sidebar-logout-btn):hover {
  box-shadow: var(--shadow-lg) !important;
}
`;
fs.appendFileSync('src/index.css', '\n' + css, 'utf8');
console.log('Appended button overrides');
