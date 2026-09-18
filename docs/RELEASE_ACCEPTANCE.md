# Native / Store Release Acceptance

This checklist contains acceptance tests that cannot be proven by static CI alone.
Run it on production-profile release candidates before public store rollout.

## Build identity

- [ ] iOS production build installs and launches on a physical iPhone.
- [ ] Android production build installs and launches on a physical Android device.
- [ ] App name, icon, splash screen, version and build number are correct.
- [ ] Deep links using the `kitapapp://` scheme open the app correctly.

## Authentication and account lifecycle

- [ ] Register a disposable account and complete email verification.
- [ ] Sign out, then sign in with a different account; no previous-account cached data appears.
- [ ] Background/foreground transitions keep the active session valid.
- [ ] Delete a disposable account that owns uploaded media.
- [ ] Repeat account deletion for a disposable account that created an event/community; deletion completes and historical objects remain valid where designed.

## Media

- [ ] Upload/change avatar and confirm the new signed image appears immediately.
- [ ] Upload/change cover image and verify it survives app restart.
- [ ] Create a post/story with media and verify upload + display.
- [ ] Force or simulate a failed database write after media upload in a QA build and confirm the cleanup candidate is eventually processed.
- [ ] Export a quote card and confirm the shared PNG matches the visible preview.

## Feed / profile / directory

- [ ] Scroll the mixed feed through multiple pages; no gaps or duplicate content are observed.
- [ ] Test equal/near-equal timestamp content if QA fixtures are available.
- [ ] Scroll each profile tab (posts, reviews, quotes, reposts) through multiple pages.
- [ ] Type rapidly in follower/following reader search and confirm stale results never replace the latest query.

## Offline / reconnect

- [ ] Disable connectivity while viewing notifications.
- [ ] Mark several notifications as read while offline.
- [ ] Restore connectivity and verify queued read states sync without data loss.
- [ ] Confirm the UI distinguishes no internet from backend unavailable.
- [ ] Confirm queued production error reports flush after backend recovery in a QA/release-candidate environment.

## Premium / RevenueCat

- [ ] RevenueCat current Offering exposes monthly and annual packages on iOS.
- [ ] RevenueCat current Offering exposes monthly and annual packages on Android.
- [ ] Store-provided test purchase flow returns success on a physical device.
- [ ] Store-provided restore flow completes on a physical device.
- [ ] A test/sandbox transaction is recorded as SANDBOX and does not grant PRODUCTION paid access.
- [ ] RevenueCat alias/login/restore events map to the intended Supabase user and never a second account.
- [ ] Cancellation/expiration/grace-period webhook events update server state as expected in the test environment.
- [ ] Subscription-management link opens the platform subscription-management surface.

## Ads / consent

- [ ] Production-profile build contains the intended platform AdMob app ID and banner unit ID.
- [ ] Consent UI appears when required.
- [ ] Privacy options can be reopened from settings independently of an ad slot.
- [ ] Non-Premium users can load a banner after consent.
- [ ] Temporary banner load failure retries without restarting the app.
- [ ] Premium users do not see ad UI.

## Store-facing requirements

- [ ] Privacy Policy URL opens over HTTPS and describes the released app.
- [ ] Support URL opens over HTTPS and provides a usable support path.
- [ ] Account deletion is reachable from the app and completes server-side.
- [ ] iOS App Store Connect subscription products are mapped to the RevenueCat `premium` entitlement.
- [ ] Google Play subscription/base plans are mapped to the same RevenueCat `premium` entitlement.
- [ ] Store listing data/privacy declarations match the actual SDKs and app behavior.

## Acceptance rule

Release acceptance is complete only when every applicable item above is checked on the actual
release candidate. CI passing is necessary but does not substitute for physical-device and
store-provider testing.
