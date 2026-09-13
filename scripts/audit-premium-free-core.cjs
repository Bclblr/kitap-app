const fs = require('fs');
const path = require('path');

const root = process.cwd();
const failures = [];

const coreScreens = [
  'src/app/index.tsx',
  'src/app/profile.tsx',
  'src/app/chat.tsx',
  'src/app/messages.tsx',
];

for (const relative of coreScreens) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) {
    failures.push(`${relative}: core social screen is missing`);
    continue;
  }

  const source = fs.readFileSync(full, 'utf8');

  // Premium may be read here only for presentation (badges/profile decoration).
  // Core social actions must never depend on the PremiumProvider gate.
  if (/\busePremium\s*\(/.test(source) || /from\s+['"]@\/providers\/PremiumProvider['"]/.test(source)) {
    failures.push(`${relative}: imports/uses PremiumProvider in a core social screen`);
  }

  if (/Premium required/i.test(source)) {
    failures.push(`${relative}: contains a Premium-required gate in a core social screen`);
  }
}

const requiredFreeActions = [
  ['src/app/index.tsx', /(?:from\(|from\s*)['"](?:post_likes|likes)['"]|\.from\(['"](?:post_likes|likes)['"]\)/, 'like'],
  ['src/app/index.tsx', /\.from\(['"](?:post_comments|comments)['"]\)/, 'comment'],
  ['src/app/index.tsx', /\.from\(['"](?:post_reposts|reposts)['"]\)/, 'repost'],
  ['src/app/profile.tsx', /\.from\(['"]follows['"]\)|\.rpc\(['"]request_follow['"]\)/, 'follow'],
  ['src/app/chat.tsx', /\.from\(['"]messages['"]\)/, 'message'],
];

for (const [relative, pattern, label] of requiredFreeActions) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) continue;
  const source = fs.readFileSync(full, 'utf8');
  if (!pattern.test(source)) {
    failures.push(`${relative}: expected free ${label} action wiring was not found`);
  }
}

const migrationDir = path.join(root, 'supabase', 'migrations');
const coreTables = [
  'likes',
  'comments',
  'reposts',
  'post_likes',
  'post_comments',
  'post_reposts',
  'follows',
  'messages',
  'conversations',
];

if (fs.existsSync(migrationDir)) {
  for (const entry of fs.readdirSync(migrationDir)) {
    if (!entry.endsWith('.sql')) continue;
    const full = path.join(migrationDir, entry);
    const sql = fs.readFileSync(full, 'utf8');
    if (!/premium_entitlements/i.test(sql)) continue;

    for (const table of coreTables) {
      const tableRef = new RegExp(`(?:public\\.)?${table}\\b`, 'i');
      if (tableRef.test(sql)) {
        failures.push(`${entry}: references premium_entitlements and core social table ${table}; review for accidental paywalling`);
      }
    }
  }
}

if (failures.length) {
  console.error('Premium free-core audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Premium free-core audit passed.');
console.log('Likes, comments, reposts, follows and messaging remain outside Premium gating.');
