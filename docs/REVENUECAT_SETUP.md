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

The client identifies RevenueCat customers using the authenticated Supabase `user.id`. This keeps the RevenueCat App User ID stable across sessions and lets the webhook map each RevenueCat event back to the correct Supabase user.

## RevenueCat webhook -> Supabase sync

Paid Premium is server-authoritative. The mobile client never writes paid access directly into `public.premium_entitlements`.

The Edge Function is:

```text
supabase/functions/revenuecat-webhook/index.ts
```

The database sync migration is:

```text
supabase/migrations/202609130108_revenuecat_webhook_sync.sql
```

The webhook accepts only Apple App Store and Google Play Store subscription events for the `premium` entitlement. Every RevenueCat event id is recorded for idempotency, and `provider_event_at` prevents an older delayed webhook from overwriting newer Premium state.

Set one private random webhook token as a Supabase Edge Function secret:

```powershell
supabase secrets set REVENUECAT_WEBHOOK_AUTH_TOKEN="<long-random-secret>"
```

Deploy the external webhook without Supabase JWT verification because RevenueCat is not a Supabase-authenticated client. Authentication is instead enforced by the private RevenueCat bearer token:

```powershell
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

In RevenueCat Dashboard, create a webhook pointing to:

```text
https://<your-project-ref>.supabase.co/functions/v1/revenuecat-webhook
```

Configure its Authorization header exactly as:

```text
Bearer <same REVENUECAT_WEBHOOK_AUTH_TOKEN>
```

Never put `REVENUECAT_WEBHOOK_AUTH_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY` in `EXPO_PUBLIC_*` variables or inside the mobile app.

Supported paid-state events include initial purchase, renewal, product change, cancellation/uncancellation, billing issue, expiration, subscription pause and subscription extension. Cancellation does not immediately remove access; the stored expiry continues to control access until RevenueCat sends expiration or a later state event.

## Access authority

RevenueCat `CustomerInfo` is useful for immediate purchase UI confirmation, but effective Premium feature access comes from `public.premium_entitlements` in Supabase. The webhook writes Apple/Google paid state into that table with the service role. Admin-granted Premium stays in its own independent `admin_grant` rows.

This prevents a client-only purchase result from becoming the source of truth.

## Expo testing

RevenueCat can run in preview/mock mode in Expo Go, but real App Store / Google Play purchases require an Expo development build containing the native RevenueCat SDK.
