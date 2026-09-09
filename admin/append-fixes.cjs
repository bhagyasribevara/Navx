const fs = require('fs');

const cssFixes = `

/* Fix toggle button */
.sidebar-toggle {
  right: 15px;
}

.campus-sidebar.collapsed .sidebar-toggle {
  right: -15px;
}

/* Faculty Light Mode text fix */
[data-theme="light"] .venues-table th,
[data-theme="light"] .venues-table td,
[data-theme="light"] .page-subtitle,
[data-theme="light"] .card-title {
  color: #0f172a !important;
}
`;

fs.appendFileSync('src/index.css', cssFixes, 'utf8');

let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace('.campus-sidebar.collapsed .sidebar-toggle {\n  margin: 0 auto;\n}', '/* margin removed */');
fs.writeFileSync('src/index.css', css, 'utf8');

console.log('Fixes appended');
