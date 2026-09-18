const fs = require('node:fs');

const requiredFiles = [
  'app.config.js',
  'eas.json',
  'src/components/AdSlot.native.tsx',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`[ads-audit] Missing ${file}`);
    process.exit(1);
  }
}

const appConfig = fs.readFileSync('app.config.js', 'utf8');
const adSlot = fs.readFileSync('src/components/AdSlot.native.tsx', 'utf8');
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));

const checks = [
  ['dynamic Android App ID', appConfig.includes('ADMOB_ANDROID_APP_ID')],
  ['dynamic iOS App ID', appConfig.includes('ADMOB_IOS_APP_ID')],
  ['production Android banner ID', appConfig.includes('EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID')],
  ['production iOS banner ID', appConfig.includes('EXPO_PUBLIC_ADMOB_IOS_BANNER_ID')],
  ['delayed app measurement', appConfig.includes('delayAppMeasurementInit: true')],
  ['iOS tracking description', appConfig.includes('userTrackingUsageDescription')],
  ['UMP ProGuard rule', appConfig.includes('com.google.android.gms.internal.consent_sdk')],
  ['production AdMob gate', eas?.build?.production?.env?.ADMOB_REQUIRE_PRODUCTION === 'true'],
  ['production EAS environment', eas?.build?.production?.environment === 'production'],
  ['consent gathering', adSlot.includes('AdsConsent.gatherConsent()')],
  ['consent check before ads', adSlot.includes('consentInfo.canRequestAds')],
  ['platform-specific banner ID', adSlot.includes("Platform.OS === 'android'")],
  ['development test banner', adSlot.includes('sdk.TestIds.BANNER')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) {
  console.log(`[ads-audit] ${ok ? 'OK' : 'FAIL'} - ${label}`);
}

if (failed.length) process.exit(1);
console.log('[ads-audit] Production ads configuration structure is ready.');
