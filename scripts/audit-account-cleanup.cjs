const fs = require('node:fs');

const account = fs.readFileSync('src/lib/account-local-state.ts', 'utf8');
const auth = fs.readFileSync('src/providers/AuthProvider.tsx', 'utf8');
const profile = fs.readFileSync('src/app/profile-settings.tsx', 'utf8');

const failures = [];

if (!account.includes('includeAuthSessionKeys')) {
  failures.push('Account cleanup must separate auth session keys from app-scoped state.');
}

if (!account.includes('options.includeAuthSessionKeys ?? !userId')) {
  failures.push('User-scoped cleanup must not clear Supabase auth keys by default.');
}

if (
  !auth.includes('includeLegacyKeys: false') ||
  !auth.includes('includeAuthSessionKeys: false')
) {
  failures.push('SIGNED_OUT cleanup must be scoped and must not clear auth session keys.');
}

if (
  !profile.includes('includeAuthSessionKeys: false') ||
  !profile.includes('includeAuthSessionKeys: true')
) {
  failures.push('Logout and account deletion must use distinct auth-key cleanup modes.');
}

if (failures.length) {
  console.error('Account cleanup audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Account cleanup audit passed.');
