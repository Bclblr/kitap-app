# RevenueCat setup

The app uses a single RevenueCat entitlement identifier:

- `premium`

Both Apple and Google subscription products must unlock this same entitlement.

## Client environment variables

Configure platform public SDK keys with Expo/EAS environment variables:

```text
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<RevenueCat Apple public SDK key>
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=<RevenueCat Google Play public SDK key>
```

Do not place RevenueCat secret/admin API keys in the mobile app. Only RevenueCat public SDK keys belong in `EXPO_PUBLIC_*` variables.

## User identity

The client identifies RevenueCat customers using the authenticated Supabase `user.id`. This keeps the RevenueCat App User ID stable across sessions and allows the later webhook sync to map RevenueCat events back to the correct Supabase user.

## Access authority

`CustomerInfo` is currently read only as SDK state. It does **not** directly unlock Premium features. Effective Premium access still comes from `public.premium_entitlements` in Supabase. The later RevenueCat webhook/sync step will write paid entitlement state into that table.

This prevents a client-only purchase status from becoming the source of truth.

## Expo testing

RevenueCat can run in preview/mock mode in Expo Go, but real App Store / Google Play purchases require an Expo development build containing the native RevenueCat SDK.
