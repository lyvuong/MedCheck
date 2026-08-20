import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, '../package.json');

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version || '0.1.0';
  const parts = currentVersion.split('.').map(Number);

  const major = isNaN(parts[0]) ? 0 : parts[0];
  const minor = isNaN(parts[1]) ? 1 : parts[1];

  // Bump minor number (e.g., 0.1.0 -> 0.2.0)
  const newVersion = `${major}.${minor + 1}.0`;
  pkg.version = newVersion;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`🚀 Version auto-bumped: ${currentVersion} -> ${newVersion}`);
} catch (err) {
  console.error('Failed to bump version:', err);
  process.exit(1);
}
