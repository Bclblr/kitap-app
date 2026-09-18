const fs = require('node:fs');

const fn = fs.readFileSync('supabase/functions/story-media-cleanup/index.ts', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20260918170000_storage_cleanup_worker.sql',
  'utf8'
);

const failures = [];

for (const needle of [
  'get_automatic_storage_cleanup_candidates',
  'record_automatic_storage_cleanup_result',
  'AUTO_CLEANUP_BUCKETS',
  'queued_cleanup_deleted',
  'queued_cleanup_failed',
]) {
  if (!fn.includes(needle)) failures.push(`Worker missing: ${needle}`);
}

for (const needle of [
  'auto_cleanup',
  'attempt_count',
  'last_attempt_at',
  'last_error',
  'attempt_count < 5',
  "status = 'deleted'",
  "status = case when attempt_count + 1 >= 5 then 'rejected' else 'pending' end",
]) {
  if (!migration.includes(needle)) failures.push(`Migration missing: ${needle}`);
}

if (
  !migration.includes(
    'grant execute on function public.get_automatic_storage_cleanup_candidates(integer)'
  ) ||
  !migration.includes(
    'grant execute on function public.record_automatic_storage_cleanup_result(uuid[], boolean, text)'
  )
) {
  failures.push('Automatic cleanup worker RPCs must be service-role executable.');
}

if (failures.length) {
  console.error('Storage cleanup worker audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Storage cleanup worker audit passed.');
