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

## Apple monthly Premium product

For the iOS monthly plan:

1. Create one auto-renewable monthly subscription in App Store Connect.
2. Import/map that Apple product in RevenueCat.
3. Attach it to the `premium` entitlement.
4. Put it in the current RevenueCat Offering using the standard monthly package.
5. Optionally set the expected public product identifier in Expo/EAS:

```text
EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID=<App Store Connect monthly product id>
```

The app reads the monthly package through `offerings.current.monthly`. Price, currency, title and subscription period come from the store/RevenueCat response; they are never hard-coded in the app.

If `EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID` is set, the app validates that RevenueCat returned the expected Apple product. This variable is a public product identifier, not a secret.

## Apple annual Premium product

For the iOS annual plan:

1. Create one auto-renewable annual subscription in App Store Connect.
2. Import/map that Apple product in RevenueCat.
3. Attach it to the same `premium` entitlement used by the monthly plan.
4. Put it in the current RevenueCat Offering using the standard annual package.
5. Optionally set the expected public product identifier in Expo/EAS:

```text
EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID=<App Store Connect annual product id>
```

The app reads the annual package through `offerings.current.annual`. Price, currency, title and subscription period come from the store/RevenueCat response; they are never hard-coded in the app.

If `EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID` is set, the app validates that RevenueCat returned the expected Apple product. This variable is a public product identifier, not a secret.

## Google Play monthly Premium product

For the Android monthly plan:

1. Create one subscription product in Google Play Console with an auto-renewing monthly base plan.
2. Import/map that Google Play product/base plan in RevenueCat.
3. Attach it to the same `premium` entitlement used by Apple.
4. Put it in the current RevenueCat Offering using the standard monthly package.
5. Optionally set the expected public product identifier in Expo/EAS:

```text
EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID=<Google Play subscription product id>
```

The app reads the Android monthly package through `offerings.current.monthly`. Price, currency, title and subscription period come from the Play Store/RevenueCat response; they are never hard-coded in the app.

If `EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID` is set, the app validates that RevenueCat returned the expected Google Play product identifier. This value is a public product identifier, not a secret.

## Google Play annual Premium product

For the Android annual plan:

1. Create one subscription product in Google Play Console with an auto-renewing annual base plan, or an annual base plan on the same subscription product used for Premium.
2. Import/map the Google Play product/base plan in RevenueCat.
3. Attach it to the same `premium` entitlement used by the other Premium plans.
4. Put it in the current RevenueCat Offering using the standard annual package.
5. Optionally set the expected public product identifier in Expo/EAS:

```text
EXPO_PUBLIC_REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID=<Google Play subscription product id>
```

The app reads the Android annual package through `offerings.current.annual`. Price, currency, title and subscription period come from the Play Store/RevenueCat response; they are never hard-coded in the app.

If `EXPO_PUBLIC_REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID` is set, the app validates that RevenueCat returned the expected Google Play product identifier. This value is a public product identifier, not a secret.

Google Play base-plan and offer configuration remains managed in Google Play Console and RevenueCat. The mobile client only consumes the packages exposed by the current RevenueCat Offering.

## User identity

The client identifies RevenueCat customers using the authenticated Supabase `user.id`. This keeps the RevenueCat App User ID stable across sessions and allows the later webhook sync to map RevenueCat events back to the correct Supabase user.

## Access authority

`CustomerInfo` is currently read only as SDK state. It does **not** directly unlock Premium features. Effective Premium access still comes from `public.premium_entitlements` in Supabase. The later RevenueCat webhook/sync step will write paid entitlement state into that table.

This prevents a client-only purchase status from becoming the source of truth.

## Expo testing

RevenueCat can run in preview/mock mode in Expo Go, but real App Store / Google Play purchases require an Expo development build containing the native RevenueCat SDK.
