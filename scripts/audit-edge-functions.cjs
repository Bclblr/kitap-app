const fs = require('node:fs');

const files = {
  deleteAccount: 'supabase/functions/delete-account/index.ts',
  storyCleanup: 'supabase/functions/story-media-cleanup/index.ts',
  revenueCat: 'supabase/functions/revenuecat-webhook/index.ts',
};

const source = {};
const failures = [];

for (const [key, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    failures.push(`Missing critical Edge Function: ${file}`);
    continue;
  }
  source[key] = fs.readFileSync(file, 'utf8');
}

function requirePattern(key, label, pattern) {
  const text = source[key] ?? '';
  if (!pattern.test(text)) failures.push(`${files[key]}: ${label}`);
}

requirePattern('deleteAccount', 'must enumerate user storage before deletion', /get_my_storage_objects/);
requirePattern('deleteAccount', 'must delete Storage through Storage API', /\.storage\.from\([\s\S]*?\.remove\(/);
requirePattern('deleteAccount', 'must delete Auth identity server-side', /auth\.admin\.deleteUser/);

if (source.deleteAccount) {
  const storageDelete = source.deleteAccount.indexOf('.remove(');
  const authDelete = source.deleteAccount.indexOf('auth.admin.deleteUser');
  if (storageDelete < 0 || authDelete < 0 || storageDelete > authDelete) {
    failures.push(`${files.deleteAccount}: Storage deletion must occur before Auth deletion`);
  }
}

requirePattern('storyCleanup', 'must require scheduler secret header', /x-story-cleanup-secret/i);
requirePattern('storyCleanup', 'must validate scheduler token server-side', /validate_story_cleanup_token/);
requirePattern('storyCleanup', 'must use server-validated cleanup candidates', /get_expired_story_cleanup_candidates/);

requirePattern('revenueCat', 'must reject missing webhook authorization', /authorization/i);
requirePattern('revenueCat', 'must process lifecycle events through hardened RPC', /process_revenuecat_(?:subscription|transfer)_event/);

if (failures.length) {
  console.error('Edge Function behavior audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Edge Function behavior audit passed.');
