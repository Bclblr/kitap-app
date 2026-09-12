# Real-device acceptance checklist

This checklist covers the critical user journeys that must be verified on a physical device before release. Static checks and CI cannot replace these tests.

## 1. Authentication and account lifecycle
- [ ] Register a new account with email/password.
- [ ] Confirm the verification email and return to the app.
- [ ] Sign in with the verified account.
- [ ] Request a password reset, open the reset link, set a new password, and sign in with it.
- [ ] Sign out and sign back in.
- [ ] Delete a disposable test account and confirm it can no longer sign in.

## 2. Profile and social graph
- [ ] Update full name, username, bio, profile image, and cover image.
- [ ] Open another user's profile.
- [ ] Follow and unfollow that user.
- [ ] Block the user and confirm the relationship is removed.
- [ ] Confirm the blocked user's content disappears from the home feed and stories.
- [ ] Open Blocked Users from profile settings and unblock the user.
- [ ] Confirm following can work again only after unblocking.

## 3. Content creation and moderation
- [ ] Create a normal text post.
- [ ] Create a post with an image.
- [ ] Create a book review and confirm it appears on Home and Profile.
- [ ] Create a quote and confirm it appears on Home and Profile under the correct account.
- [ ] Add a comment, like, repost, and save where supported.
- [ ] Open the ••• menu on another user's post/review/quote and submit a report.
- [ ] Submit a profile report.
- [ ] Confirm the same unresolved content report cannot be submitted repeatedly.

## 4. Shelves and reading
- [ ] Add a book to Want to Read.
- [ ] Move it to Reading.
- [ ] Confirm it appears on the Reading screen.
- [ ] Update reading progress and confirm page totals/streak data update.
- [ ] Move the book to Read.
- [ ] Remove it from shelves and confirm it disappears everywhere.
- [ ] Sign out and sign in with a second account; confirm shelf data does not leak between accounts.

## 5. Messaging and blocking
- [ ] Start or open a conversation with another account.
- [ ] Send and receive a message.
- [ ] Block the other account.
- [ ] Confirm new messages cannot be sent across the blocked relationship.

## 6. Stories
- [ ] Create a story with text and/or image.
- [ ] Open it in the story viewer.
- [ ] Confirm seen state behaves correctly.
- [ ] Confirm blocked users' stories are not shown.
- [ ] Delete your own story if that action is available.

## 7. Navigation and deep links
- [ ] Open forgot-password/reset-password links from email on the device.
- [ ] Open email-verification links from email on the device.
- [ ] Confirm app navigation returns to the expected screen without an unmatched route.
- [ ] Test Home, Explore, Shelves, Profile, Notifications, Community, Events, Readers, and Book routes.

## 8. Resilience
- [ ] Repeat key actions on a slow connection.
- [ ] Disable network temporarily and confirm the app shows an understandable error instead of crashing.
- [ ] Background and foreground the app during an active session.
- [ ] Force-close and reopen; confirm auth/session state is sensible.

## Acceptance rule
A release candidate passes this checklist only when every critical item above has been completed on at least one physical iOS device and one physical Android device, or the missing platform is explicitly recorded as unverified.
