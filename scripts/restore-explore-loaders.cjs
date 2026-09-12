const fs = require('fs');
const cp = require('child_process');

const path = 'src/app/explore.tsx';

const current = fs.readFileSync(path, 'utf8');

const healthy = cp.execFileSync(
  'git',
  ['show', `HEAD:${path}`],
  { encoding: 'utf8' }
);

const startMarker = '  const loadActiveReaders = useCallback';
const endMarker = '  const searchAll = useCallback';

const currentStart = current.indexOf(startMarker);
const currentEnd = current.indexOf(endMarker);

const healthyStart = healthy.indexOf(startMarker);
const healthyEnd = healthy.indexOf(endMarker);

if (
  currentStart === -1 ||
  currentEnd === -1 ||
  healthyStart === -1 ||
  healthyEnd === -1
) {
  console.error('Gerekli bölüm bulunamadı. Dosya değiştirilmedi.');
  process.exit(1);
}

const healthyBlock = healthy.slice(healthyStart, healthyEnd);

const fixed =
  current.slice(0, currentStart) +
  healthyBlock +
  current.slice(currentEnd);

fs.writeFileSync(path, fixed, 'utf8');

console.log('Explore yükleme fonksiyonları sağlam sürümden geri getirildi.');
