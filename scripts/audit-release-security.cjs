const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceRoots = ['src', 'app.json', 'eas.json'];
const failures = [];

function walk(target) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  return fs.readdirSync(full).flatMap((name) => walk(path.relative(root, path.join(full, name))));
}

const files = sourceRoots.flatMap(walk).filter((file) => /\.(?:ts|tsx|js|cjs|json)$/.test(file));

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const text = fs.readFileSync(file, 'utf8');

  const forbidden = [
    ['Supabase service-role secret', /SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/i],
    ['Supabase admin API in client', /\.auth\.admin\./],
    ['Private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ];

  for (const [label, pattern] of forbidden) {
    if (pattern.test(text)) failures.push(`${rel}: ${label}`);
  }

  const httpMatches = text.match(/http:\/\/[^'"\s)]+/g) || [];
  for (const url of httpMatches) {
    if (!/localhost|127\.0\.0\.1/.test(url)) failures.push(`${rel}: insecure HTTP URL ${url}`);
  }
}

const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
if (!layout.includes('name="account-deletion"')) failures.push('Public account-deletion route is not registered.');

const deletionPage = path.join(root, 'src/app/account-deletion.tsx');
if (!fs.existsSync(deletionPage)) failures.push('External account deletion screen is missing.');
else {
  const text = fs.readFileSync(deletionPage, 'utf8');
  if (!text.includes("functions.invoke('delete-account'")) failures.push('Account deletion page does not invoke the server deletion function.');
}

const adsNative = path.join(root, 'src/components/AdSlot.native.tsx');
const adsLifecycle = path.join(root, 'src/lib/ads.native.ts');
if (fs.existsSync(adsNative) && fs.existsSync(adsLifecycle)) {
  const adSlotText = fs.readFileSync(adsNative, 'utf8');
  const lifecycleText = fs.readFileSync(adsLifecycle, 'utf8');

  if (!lifecycleText.includes('AdsConsent.gatherConsent')) {
    failures.push('Ad consent gate is missing.');
  }
  if (!lifecycleText.includes('consentInfo.canRequestAds')) {
    failures.push('Ads may initialize without consent eligibility.');
  }
  if (!adSlotText.includes('EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID')) {
    failures.push('Android production AdMob banner ID must come from environment configuration.');
  }
  if (!adSlotText.includes('EXPO_PUBLIC_ADMOB_IOS_BANNER_ID')) {
    failures.push('iOS production AdMob banner ID must come from environment configuration.');
  }
}

const rlsCleanupMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260918173500_remove_legacy_permissive_core_policies.sql'),
  'utf8'
);
for (const policyName of [
  'authenticated users can create posts',
  'authenticated users can view saved posts',
  'authenticated users can save posts',
]) {
  if (!rlsCleanupMigration.includes(`drop policy if exists "${policyName}"`)) {
    failures.push(`Legacy permissive RLS policy cleanup missing: ${policyName}`);
  }
}

const rpcExposureMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260918173000_release_rpc_exposure_hardening.sql'),
  'utf8'
);
if (
  !rpcExposureMigration.includes(
    'revoke all on function public.get_event_attendees(uuid)'
  )
) {
  failures.push('Anonymous event attendee RPC exposure is not hardened.');
}
if (
  !rpcExposureMigration.includes(
    'revoke all on function public.should_deliver_notification(uuid, text)'
  )
) {
  failures.push('Notification preference helper RPC exposure is not hardened.');
}

const productionEnvAudit = fs.readFileSync(
  path.join(root, 'scripts/audit-production-env.cjs'),
  'utf8'
);
if (!productionEnvAudit.includes('EAS_BUILD_PROFILE')) {
  failures.push('Production EAS environment gate is missing.');
}
if (!productionEnvAudit.includes('TEST_ADMOB_PREFIX')) {
  failures.push('Production environment audit does not reject sample AdMob IDs.');
}

const supabaseClient = fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8');
if (!supabaseClient.includes('process.env.EXPO_PUBLIC_SUPABASE_URL')) {
  failures.push('Supabase URL must come from EXPO_PUBLIC_SUPABASE_URL.');
}
if (!supabaseClient.includes('process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) {
  failures.push('Supabase publishable key must come from environment configuration.');
}
if (/https:\/\/[a-z0-9]+\.supabase\.co/i.test(supabaseClient)) {
  failures.push('Supabase project URL must not be hardcoded in the client.');
}

if (failures.length) {
  console.error('Release security audit failed:');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Release security audit passed (${files.length} client/config files scanned).`);
