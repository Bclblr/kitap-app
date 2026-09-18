# Production Acceptance Chain

This checklist is the release-critical production verification for roadmap step 8/48.

## A. Live Supabase schema
- [ ] `npx supabase migration list` shows local and remote versions aligned.
- [ ] Live RLS policies are present for private/user-owned tables.
- [ ] Security-definer RPCs exist with expected grants.
- [ ] Critical triggers are present.
- [ ] Private Storage buckets and policies are present.
- [ ] Required Realtime publication tables are present, including `premium_entitlements`.
- [ ] No pending migration exists before release.

## B. Edge Functions
- [ ] `delete-account` is deployed.
- [ ] `revenuecat-webhook` is deployed with `--no-verify-jwt`.
- [ ] Function environment secrets are present.
- [ ] `REVENUECAT_WEBHOOK_AUTH_TOKEN` is configured.
- [ ] No private secret is exposed through `EXPO_PUBLIC_*`.

## C. RevenueCat production path
- [ ] RevenueCat webhook URL points to the live Supabase project.
- [ ] Authorization header matches the Supabase webhook secret.
- [ ] A RevenueCat webhook test receives HTTP 2xx.
- [ ] SANDBOX event is stored as SANDBOX.
- [ ] PRODUCTION event is stored as PRODUCTION.
- [ ] INITIAL_PURCHASE updates Premium access.
- [ ] RENEWAL keeps access active.
- [ ] CANCELLATION preserves access until expiry unless refunded.
- [ ] CUSTOMER_SUPPORT refund revokes paid access.
- [ ] BILLING_ISSUE honors grace-period expiry.
- [ ] SUBSCRIPTION_PAUSED preserves access until later expiration.
- [ ] EXPIRATION removes access.
- [ ] TRANSFER moves effective paid access to the destination account.

## D. Store purchase acceptance
### Apple
- [ ] Real iPhone build contains RevenueCat native SDK.
- [ ] Apple sandbox monthly purchase succeeds.
- [ ] Apple sandbox annual purchase succeeds.
- [ ] Restore succeeds.
- [ ] Cancellation/expiry state reaches Supabase through webhook.

### Google Play
- [ ] Android internal/closed-test build contains RevenueCat native SDK.
- [ ] Google Play test monthly purchase succeeds.
- [ ] Google Play test annual purchase succeeds.
- [ ] Restore succeeds.
- [ ] Cancellation/expiry state reaches Supabase through webhook.

## E. Real-device release acceptance
- [ ] iPhone acceptance checklist completed.
- [ ] Android acceptance checklist completed.
- [ ] Login/register verified.
- [ ] Profile/feed/story/camera verified.
- [ ] Messaging/notifications/shelves/reviews/quotes verified.
- [ ] Premium verified.
- [ ] Admin verified where applicable.
- [ ] Account deletion verified.
- [ ] Offline/network failure verified.
- [ ] Deep links verified.
- [ ] Cold start verified.

## Acceptance rule

Roadmap step 8/48 is complete only when the live backend checks, deployed functions/secrets, RevenueCat webhook, Apple sandbox purchase, Google Play test purchase, and real-device acceptance checks above have all been explicitly verified.
