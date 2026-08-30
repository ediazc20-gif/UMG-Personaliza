const fs = require('fs');

const filePath = './routes/dashboard.js';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix 1: Update first header forEach (line 371-378) to use headerDisplayNames
content = content.replace(
  /displayHeaders\.forEach\(\(h, i\) => \{\s+const headerText = sanitize\(h\)\.substring\(0, 12\)\.toUpperCase\(\);/,
  "displayHeaders.forEach((h, i) => {\n         const headerText = headerDisplayNames[h] || h.replace(/_/g, ' ').toUpperCase();"
);

// Fix 2: Update data row forEach to check for 'exitoso' instead of 'estado'
content = content.replace(
  /if \(h === 'estado'\) \{\s+val = row\['exitoso'\] == 1 \? 'OK' : 'FALLO';\s+\}/,
  "if (h === 'exitoso') {\n             val = val == 1 ? 'OK' : 'FALLO';\n           }"
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('✓ Fixed dashboard.js');
