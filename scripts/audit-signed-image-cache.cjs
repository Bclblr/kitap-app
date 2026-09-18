const fs = require('node:fs');

const imageCache = fs.readFileSync('src/lib/image-cache.ts', 'utf8');
const profile = fs.readFileSync('src/app/profile-settings.tsx', 'utf8');
const authProvider = fs.readFileSync('src/providers/AuthProvider.tsx', 'utf8');

const failures = [];

if (!/clearSignedImageUrlCache\(userId\?: string, bucket\?: string, path\?: string\)/.test(imageCache)) {
  failures.push('Signed image cache clear signature must remain user-scoped.');
}

if (!profile.includes("clearSignedImageUrlCache(user.id, 'avatars', filePath)")) {
  failures.push('Avatar upload must invalidate the current user avatar cache entry.');
}

if (!authProvider.includes('clearSignedImageUrlCache(previousUserId)')) {
  failures.push('Auth user changes must clear the previous user signed URL cache.');
}

if (!authProvider.includes('clearSignedImageUrlCache()')) {
  failures.push('Full auth teardown must be able to clear all signed URL cache entries.');
}

if (failures.length) {
  console.error('Signed image cache audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Signed image cache audit passed.');
