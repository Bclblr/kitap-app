const TEST_ADMOB_PREFIX = 'ca-app-pub-3940256099942544';

const isProduction =
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.ADMOB_REQUIRE_PRODUCTION === 'true';

if (!isProduction) {
  console.log('[production-env] Non-production build; strict environment validation skipped.');
  process.exit(0);
}

const required = [
  'ADMOB_ANDROID_APP_ID',
  'ADMOB_IOS_APP_ID',
  'EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID',
  'EXPO_PUBLIC_ADMOB_IOS_BANNER_ID',
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID',
  'EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_SUPPORT_URL',
];

const failures = [];

function value(name) {
  return process.env[name]?.trim() ?? '';
}

for (const name of required) {
  if (!value(name)) failures.push(`${name}: missing`);
}

if (value('EXPO_PUBLIC_ADS_ENABLED') !== 'true') {
  failures.push('EXPO_PUBLIC_ADS_ENABLED must be true for production.');
}

for (const name of [
  'ADMOB_ANDROID_APP_ID',
  'ADMOB_IOS_APP_ID',
  'EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID',
  'EXPO_PUBLIC_ADMOB_IOS_BANNER_ID',
]) {
  if (value(name).startsWith(TEST_ADMOB_PREFIX)) {
    failures.push(`${name}: Google sample/test ID is not allowed in production.`);
  }
}

const appIdPattern = /^ca-app-pub-\d{16}~\d+$/;
const unitIdPattern = /^ca-app-pub-\d{16}\/\d+$/;

if (value('ADMOB_ANDROID_APP_ID') && !appIdPattern.test(value('ADMOB_ANDROID_APP_ID'))) {
  failures.push('ADMOB_ANDROID_APP_ID: invalid AdMob app ID format.');
}
if (value('ADMOB_IOS_APP_ID') && !appIdPattern.test(value('ADMOB_IOS_APP_ID'))) {
  failures.push('ADMOB_IOS_APP_ID: invalid AdMob app ID format.');
}
if (
  value('EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID') &&
  !unitIdPattern.test(value('EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID'))
) {
  failures.push('EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID: invalid banner unit format.');
}
if (
  value('EXPO_PUBLIC_ADMOB_IOS_BANNER_ID') &&
  !unitIdPattern.test(value('EXPO_PUBLIC_ADMOB_IOS_BANNER_ID'))
) {
  failures.push('EXPO_PUBLIC_ADMOB_IOS_BANNER_ID: invalid banner unit format.');
}

for (const name of [
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID',
  'EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID',
]) {
  const current = value(name).toLowerCase();
  if (
    current &&
    (
      current.startsWith('test_') ||
      current.includes('placeholder') ||
      current.includes('changeme') ||
      current.includes('replace_me') ||
      current === 'example'
    )
  ) {
    failures.push(`${name}: test/placeholder value is not allowed in production.`);
  }
}

const supabaseUrl = value('EXPO_PUBLIC_SUPABASE_URL');
if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname.endsWith('.supabase.co') ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/'
    ) {
      failures.push('EXPO_PUBLIC_SUPABASE_URL: must be a root https://*.supabase.co URL.');
    }
  } catch {
    failures.push('EXPO_PUBLIC_SUPABASE_URL: invalid URL.');
  }
}

const publishableKey = value('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (publishableKey && !publishableKey.startsWith('sb_publishable_')) {
  failures.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: modern sb_publishable_ key required.');
}

for (const name of ['EXPO_PUBLIC_PRIVACY_POLICY_URL', 'EXPO_PUBLIC_SUPPORT_URL']) {
  const current = value(name);
  if (!current) continue;

  try {
    const parsed = new URL(current);
    if (
      parsed.protocol !== 'https:' ||
      /(^|\.)localhost$|(^|\.)example\.(com|org|net)$/i.test(parsed.hostname)
    ) {
      failures.push(`${name}: public HTTPS production URL required.`);
    }
  } catch {
    failures.push(`${name}: invalid URL.`);
  }
}

if (
  process.env.EAS_BUILD === 'true' &&
  process.env.EAS_BUILD_PROJECT_ID &&
  process.env.EAS_BUILD_PROJECT_ID !== '2719ef09-5240-4dc4-ae78-5221653ba802'
) {
  failures.push('EAS_BUILD_PROJECT_ID does not match the Kitap EAS project.');
}

if (failures.length) {
  console.error('[production-env] Production environment validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[production-env] Production environment validation passed.');
