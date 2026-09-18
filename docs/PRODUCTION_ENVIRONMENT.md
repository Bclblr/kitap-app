# Production environment setup

The production EAS profile uses the EAS `production` environment. A production build
runs `npm run audit:production-env` automatically through the
`eas-build-pre-install` lifecycle hook.

## Verify the current EAS environment

```powershell
eas env:list --environment production
```

All values below must exist before a production build is accepted.

| Variable | Source | Client-visible |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project API URL | Yes |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Yes |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat Apple public SDK key | Yes |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat Google public SDK key | Yes |
| `EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID` | App Store / RevenueCat monthly product ID | Yes |
| `EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID` | App Store / RevenueCat annual product ID | Yes |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID` | Google Play / RevenueCat monthly product ID | Yes |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID` | Google Play / RevenueCat annual product ID | Yes |
| `ADMOB_ANDROID_APP_ID` | AdMob Android app ID | Build config |
| `ADMOB_IOS_APP_ID` | AdMob iOS app ID | Build config |
| `EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID` | AdMob Android banner unit ID | Yes |
| `EXPO_PUBLIC_ADMOB_IOS_BANNER_ID` | AdMob iOS banner unit ID | Yes |
| `EXPO_PUBLIC_ADS_ENABLED` | Must be `true` for the production profile | Yes |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Public HTTPS privacy-policy page | Yes |
| `EXPO_PUBLIC_SUPPORT_URL` | Public HTTPS support page | Yes |

These values are embedded in or used to configure the client build and must not be
treated as server secrets. The production audit rejects missing values, Google sample
AdMob IDs, obvious test/placeholder RevenueCat values, invalid URL formats and legacy
Supabase anon-key format.

## Server-only secrets

Do **not** put these in EAS `EXPO_PUBLIC_*` variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `REVENUECAT_WEBHOOK_AUTH_TOKEN`
- story cleanup scheduler/Vault secrets
- private signing keys or store credentials

The RevenueCat webhook secret belongs in Supabase Edge Function secrets. The mobile
app should only contain RevenueCat public SDK keys.

## Validate with the production EAS environment

After the production variables are configured:

```powershell
eas env:exec --environment production "npm run release:preflight"
```

Then create the release candidates:

```powershell
eas build --platform ios --profile production
eas build --platform android --profile production
```

Do not submit the builds until the physical-device/store checklist in
`docs/RELEASE_ACCEPTANCE.md` is complete.
