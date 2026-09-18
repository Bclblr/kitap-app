const fs = require('node:fs');

const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const appConfig = fs.readFileSync('app.config.js', 'utf8');
const revenueCat = fs.readFileSync('src/lib/revenuecat.ts', 'utf8');
const failures = [];

function check(label, ok) {
  if (!ok) failures.push(label);
}

check(
  'iOS bundle identifier',
  app?.ios?.bundleIdentifier === 'com.burukancelebiler.kitapapp'
);
check(
  'Android package identifier',
  app?.android?.package === 'com.burukancelebiler.kitapapp'
);
check('custom URL scheme', app?.scheme === 'kitapapp');
check('Apple Sign In enabled', app?.ios?.usesAppleSignIn === true);
check(
  'Apple auth plugin',
  Array.isArray(app?.plugins) && app.plugins.includes('expo-apple-authentication')
);
check(
  'microphone permission blocked on Android',
  app?.android?.blockedPermissions?.includes('android.permission.RECORD_AUDIO')
);
check(
  'production EAS environment selected',
  eas?.build?.production?.environment === 'production'
);
check('production build auto-increments', eas?.build?.production?.autoIncrement === true);
check('production submit profile exists', Boolean(eas?.submit?.production));
check(
  'production env is mandatory in app config',
  appConfig.includes('ADMOB_REQUIRE_PRODUCTION') &&
    appConfig.includes('Production store configuration is incomplete')
);
check(
  'EAS production pre-install environment gate',
  pkg?.scripts?.['eas-build-pre-install'] ===
    'node scripts/audit-production-env.cjs'
);
check(
  'RevenueCat stable Supabase user identity',
  revenueCat.includes('appUserID: cleanUserId') &&
    revenueCat.includes('Purchases.logIn(cleanUserId)')
);
check(
  'RevenueCat monthly and annual offerings',
  revenueCat.includes("offerings.current?.monthly") &&
    revenueCat.includes("offerings.current?.annual")
);
check(
  'purchase entitlement confirmation',
  revenueCat.includes('premiumEntitlementActive')
);
check(
  'restore purchases support',
  revenueCat.includes('Purchases.restorePurchases()')
);
check(
  'native quote-card export dependency',
  Boolean(pkg?.dependencies?.['react-native-view-shot']) &&
    Boolean(pkg?.dependencies?.['expo-sharing'])
);

if (failures.length) {
  console.error('Native release preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Native release structural preflight passed.');
