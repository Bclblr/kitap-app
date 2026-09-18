const fs = require('node:fs');

const profile = fs.readFileSync('src/app/profile.tsx', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20260918171000_profile_keyset_indexes.sql',
  'utf8'
);

const failures = [];

for (const [label, ok] of [
  ['profile cursor ref', profile.includes('profileCursorRef')],
  ['keyset filter', profile.includes('feedCursorFilter(cursor)')],
  ['deterministic id ordering', profile.includes(".order('id', { ascending: false })")],
  ['cursor from raw source rows', profile.includes('pageCursorRows')],
  ['post keyset index', migration.includes('posts_user_created_id_idx')],
  ['review keyset index', migration.includes('reviews_user_created_id_idx')],
  ['quote keyset index', migration.includes('quotes_user_created_id_idx')],
  ['repost keyset index', migration.includes('post_reposts_user_created_id_idx')],
]) {
  if (!ok) failures.push(label);
}

if (/\.range\((reviews|quotes|posts)\.length/.test(profile)) {
  failures.push('profile content still uses offset pagination');
}

if (failures.length) {
  console.error('Profile pagination audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Profile keyset pagination audit passed.');
