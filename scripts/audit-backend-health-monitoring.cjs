const fs = require('node:fs');

const network = fs.readFileSync('src/providers/NetworkProvider.tsx', 'utf8');
const monitoring = fs.readFileSync('src/lib/error-monitoring.ts', 'utf8');

const failures = [];

for (const [label, ok] of [
  ['5xx backend unhealthy', network.includes('return response.status < 500')],
  ['queued error flush on backend recovery', network.includes('flushQueuedAppErrors')],
  ['user-scoped error queue', monitoring.includes('offline:v1:\${userId}:client-error-queue')],
  ['bounded queued errors', monitoring.includes('MAX_QUEUED_ERRORS')],
  ['RPC result error checked', monitoring.includes('if (error) throw error')],
  ['queued error flush function', monitoring.includes('flushQueuedAppErrors')],
  ['queue mutations serialized', monitoring.includes('withKeyedAsyncLock')],
]) {
  if (!ok) failures.push(label);
}

if (failures.length) {
  console.error('Backend health/monitoring audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Backend health/monitoring audit passed.');
