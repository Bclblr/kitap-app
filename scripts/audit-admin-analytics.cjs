const fs = require('node:fs');

const screen = fs.readFileSync('src/app/admin-analytics.tsx', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/202609120012_admin_analytics.sql',
  'utf8'
);

const rpcNames = [
  ...screen.matchAll(/supabase\.rpc\(['"]([^'"]+)['"]/g),
].map((match) => match[1]);

const expected = ['admin_analytics_daily', 'admin_analytics_overview'];
const unique = [...new Set(rpcNames)].sort();

const failures = [];

if (JSON.stringify(unique) !== JSON.stringify(expected)) {
  failures.push(
    `Admin analytics screen RPC scope changed: ${JSON.stringify(unique)}`
  );
}

const guardMatches =
  migration.match(/has_admin_role\(array\['admin','super_admin'\]\)/g) ?? [];

if (guardMatches.length < 2) {
  failures.push('Both analytics RPCs must enforce admin/super_admin role guards.');
}

if (
  !migration.includes(
    'revoke all on function public.admin_analytics_overview() from public;'
  )
) {
  failures.push('Overview RPC PUBLIC execute revoke is missing.');
}

if (
  !migration.includes(
    'revoke all on function public.admin_analytics_daily(integer) from public;'
  )
) {
  failures.push('Daily RPC PUBLIC execute revoke is missing.');
}

if (failures.length) {
  console.error('Admin analytics audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Admin analytics RPC scope audit passed.');
