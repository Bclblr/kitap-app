const fs = require('node:fs');

const source = fs.readFileSync('src/app/notifications.tsx', 'utf8');
const failures = [];

function requireText(label, text) {
  if (!source.includes(text)) failures.push(label);
}

requireText('AuthProvider session identity must be used', "import { useAuth } from '@/providers/AuthProvider'");
requireText('Local user id must come from session', 'const userId = session?.user?.id ?? null');
requireText('Notification cache must load', 'loadNotificationCache<NotificationItem>(userId)');
requireText('Offline path must short-circuit backend work', 'if (!backendReachable)');
requireText('Offline reads must queue', 'queueNotificationRead(userId');
requireText('Local read state must persist to cache', 'saveNotificationCache(userId, next)');
requireText('Reconnect must flush read queue', 'flushNotificationReadQueue(userId)');

if (source.includes('supabase.auth.getUser()')) {
  failures.push('Notifications screen must not require network auth.getUser().');
}

const cacheIndex = source.indexOf('loadNotificationCache<NotificationItem>(userId)');
const offlineIndex = source.indexOf('if (!backendReachable)');
if (cacheIndex < 0 || offlineIndex < 0 || cacheIndex > offlineIndex) {
  failures.push('Notification cache must be loaded before backend reachability is required.');
}

if (failures.length) {
  console.error('Notification offline audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Notification offline cache-first audit passed.');
