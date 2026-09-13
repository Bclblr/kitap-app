# V1 Offline Strategy

## Goal

Keep the app predictable under weak or missing connectivity without creating conflict-prone offline writes.

## V1 policy

1. **Read-first, no offline mutation queue.**
   - Content already visible in memory can remain on screen when the backend becomes unreachable.
   - V1 does not queue likes, comments, posts, messages, follows, event attendance, uploads, or profile edits for later delivery.
   - Server mutations should be retried by the user after connectivity returns instead of being silently replayed.

2. **Global connectivity state.**
   - `NetworkProvider` checks whether the Supabase backend is reachable.
   - A global banner explains that open content may remain visible while new operations need a connection.

3. **Reconnect refresh.**
   - `retrySignal` is emitted only after a real offline -> online transition.
   - Screens using `useScreenRefresh` automatically refresh while focused after reconnect.
   - This prevents stale state from surviving after connectivity returns.

4. **Manual recovery remains available.**
   - Pull-to-refresh and explicit retry controls continue to work.
   - Network-aware retry checks connectivity before repeating a request.

5. **Local persistence is scoped and intentional.**
   - AsyncStorage remains appropriate for device preferences, theme settings, auth/session support, and explicitly device-local state.
   - Server-owned social data should not gain a second AsyncStorage source of truth.

6. **Media and uploads require online connectivity.**
   - Image/file uploads are not queued offline in V1.
   - Failed uploads should remain user-visible failures and can be retried after reconnect.

## Why V1 does not queue writes

Offline write queues require durable operation IDs, idempotency, conflict handling, ordering, account isolation, logout cleanup, and duplicate-submit protection. Adding a partial queue would be riskier than requiring connectivity for mutations.

## Future expansion

A later version may add cache-backed read-only screens and selected idempotent offline actions after per-operation conflict rules are defined. Any future queue must be user-scoped and cleared or migrated safely on account changes.
