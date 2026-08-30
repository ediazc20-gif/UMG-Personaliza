const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '../../frontend/src/umg.png');
const dest = path.join(__dirname, 'umg.png');

try {
  fs.copyFileSync(source, dest);
  console.log('✅ Logo copiado exitosamente a:', dest);
  process.exit(0);
} catch (e) {
  console.error('❌ Error copiando logo:', e.message);
  process.exit(1);
}
