const fs = require('node:fs');
const path = require('node:path');

const appDir = path.join('src', 'app');
const layout = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf8');

function listRoutes(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('_')) return [];
    const full = path.join(dir, entry.name);
    const route = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listRoutes(full, route);
    if (!entry.name.endsWith('.tsx')) return [];
    return [route.replace(/\.tsx$/, '')];
  });
}

function readConst(name) {
  const match = layout.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) throw new Error(`${name} not found in _layout.tsx`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

const authenticated = new Set(readConst('AUTHENTICATED_ROUTES'));
const admin = new Set(readConst('ADMIN_ROUTES'));
const publicRoutes = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'account-deletion',
  'auth/callback',
]);

const routes = listRoutes(appDir);
const unclassified = routes.filter(
  (route) => !authenticated.has(route) && !admin.has(route) && !publicRoutes.has(route)
);
const missingFiles = [...authenticated, ...admin, ...publicRoutes].filter(
  (route) => !routes.includes(route)
);

if (unclassified.length) {
  console.error('Unclassified routes:', unclassified.join(', '));
}
if (missingFiles.length) {
  console.error('Guard registry points to missing routes:', missingFiles.join(', '));
}

console.log(
  `${routes.length} routes checked; ${unclassified.length} unclassified; ${missingFiles.length} missing registry targets.`
);

process.exitCode = unclassified.length || missingFiles.length ? 1 : 0;
