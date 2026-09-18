const fs = require('node:fs');

const source = fs.readFileSync('src/components/ReadersList.tsx', 'utf8');
const failures = [];

if (!source.includes('requestSequenceRef')) {
  failures.push('Reader directory must track request sequence.');
}

if (!source.includes('if (!reset && pageLoadingRef.current) return;')) {
  failures.push('Only pagination, not reset searches, may be blocked by an active request.');
}

if (!source.includes('const requestSequence = ++requestSequenceRef.current;')) {
  failures.push('Every reader request must receive a monotonic request sequence.');
}

if (!source.includes('requestSequence !== requestSequenceRef.current')) {
  failures.push('Stale reader requests must be ignored.');
}

if (
  !source.includes('requestSequence === requestSequenceRef.current') ||
  !source.includes('pageLoadingRef.current = false')
) {
  failures.push('Only the latest reader request may release loading state.');
}

if (failures.length) {
  console.error('Reader request race audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Reader request race audit passed.');
