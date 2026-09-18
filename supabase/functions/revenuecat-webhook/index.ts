import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isRevenueCatAppUuid,
  resolveMatchedTransferUsers,
  transferUuidCandidates,
} from './identity.ts';

type RevenueCatEnvironment = 'SANDBOX' | 'PRODUCTION';

type RevenueCatWebhook = {
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
    original_app_user_id?: string;
    aliases?: string[] | null;
    product_id?: string | null;
    entitlement_ids?: string[] | null;
    purchased_at_ms?: number | null;
    expiration_at_ms?: number | null;
    grace_period_expiration_at_ms?: number | null;
    event_timestamp_ms?: number | null;
    store?: string | null;
    transaction_id?: string | null;
    original_transaction_id?: string | null;
    period_type?: string | null;
    environment?: RevenueCatEnvironment | null;
    cancel_reason?: string | null;
    expiration_reason?: string | null;
    transferred_from?: string[] | null;
    transferred_to?: string[] | null;
  };
};

const PREMIUM_ENTITLEMENT_ID = 'premium';

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toIso(ms: number | null | undefined) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

const isUuid = isRevenueCatAppUuid;

function revenueCatUserCandidates(event: NonNullable<RevenueCatWebhook['event']>) {
  return [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(isUuid)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function mapSource(store: string | null | undefined): 'apple' | 'google' | null {
  if (store === 'APP_STORE') return 'apple';
  if (store === 'PLAY_STORE') return 'google';
  return null;
}

function validEnvironment(
  environment: string | null | undefined
): environment is RevenueCatEnvironment {
  return environment === 'SANDBOX' || environment === 'PRODUCTION';
}

function mapStatus(
  type: string,
  periodType: string | null | undefined,
  expiresAt: string | null,
  providerEventAt: string,
  cancelReason: string | null | undefined
) {
  const eventTime = Date.parse(providerEventAt);
  const expirationTime = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const hasFutureExpiration =
    Number.isFinite(expirationTime) && Number.isFinite(eventTime) && expirationTime > eventTime;

  if (type === 'EXPIRATION') return 'expired';

  // RevenueCat emits SUBSCRIPTION_PAUSED when the subscription is scheduled
  // to pause at the end of the paid period. Access remains valid until the
  // later EXPIRATION event.
  if (type === 'SUBSCRIPTION_PAUSED') {
    if (!hasFutureExpiration) return 'expired';
    return periodType === 'TRIAL' ? 'trialing' : 'active';
  }

  if (type === 'BILLING_ISSUE') {
    return hasFutureExpiration ? 'grace_period' : 'inactive';
  }

  // CUSTOMER_SUPPORT is RevenueCat's refund signal for subscription
  // cancellation/refund events. Revoke the current paid period immediately;
  // a later successful RENEWAL can reactivate it.
  if (type === 'CANCELLATION' && cancelReason === 'CUSTOMER_SUPPORT') {
    return 'inactive';
  }

  if (type === 'CANCELLATION') {
    if (!expiresAt) return 'inactive';
    return hasFutureExpiration
      ? periodType === 'TRIAL'
        ? 'trialing'
        : 'active'
      : 'expired';
  }

  if (periodType === 'TRIAL') return 'trialing';
  return 'active';
}

const supportedEvents = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'EXPIRATION',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_EXTENDED',
]);

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const webhookToken = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_TOKEN');
  const authorization = request.headers.get('Authorization');

  if (!webhookToken || authorization !== `Bearer ${webhookToken}`) {
    return jsonResponse(401, { error: 'invalid_webhook_authorization' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('revenuecat-webhook: required Supabase environment variables are missing');
    return jsonResponse(500, { error: 'server_configuration_error' });
  }

  let payload: RevenueCatWebhook;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  const event = payload.event;
  if (!event?.id || !event.type) {
    return jsonResponse(400, { error: 'missing_required_event_fields' });
  }

  const providerEventAt = toIso(event.event_timestamp_ms);
  if (!providerEventAt) {
    return jsonResponse(400, { error: 'invalid_event_timestamp' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === 'TRANSFER') {
    if (event.environment && !validEnvironment(event.environment)) {
      return jsonResponse(400, { error: 'invalid_environment' });
    }

    const transferredFromCandidates = transferUuidCandidates(
      event.transferred_from
    );
    const transferredToCandidates = transferUuidCandidates(
      event.transferred_to
    );

    if (
      transferredFromCandidates.length === 0 ||
      transferredToCandidates.length === 0
    ) {
      return jsonResponse(409, { error: 'unknown_transfer_identity' });
    }

    const [sourceProfiles, destinationProfiles] = await Promise.all([
      admin
        .from('profiles')
        .select('id')
        .in('id', transferredFromCandidates),
      admin
        .from('profiles')
        .select('id')
        .in('id', transferredToCandidates),
    ]);

    if (sourceProfiles.error || destinationProfiles.error) {
      console.error('revenuecat-webhook: transfer identity lookup failed', {
        eventId: event.id,
        sourceError: sourceProfiles.error,
        destinationError: destinationProfiles.error,
      });
      return jsonResponse(500, { error: 'transfer_identity_lookup_failed' });
    }

    const resolvedTransfer = resolveMatchedTransferUsers(
      (sourceProfiles.data ?? []).map((profile) => profile.id),
      (destinationProfiles.data ?? []).map((profile) => profile.id)
    );

    if (!resolvedTransfer.ok) {
      return jsonResponse(409, { error: resolvedTransfer.error });
    }

    const { data, error } = await admin.rpc('process_revenuecat_transfer_event', {
      p_event_id: event.id,
      p_transferred_from: resolvedTransfer.sourceUserIds,
      p_transferred_to: [resolvedTransfer.destinationUserId],
      p_provider_event_at: providerEventAt,
      p_environment: validEnvironment(event.environment) ? event.environment : null,
    });

    if (error) {
      console.error('revenuecat-webhook: transfer sync failed', {
        eventId: event.id,
        environment: event.environment,
        error,
      });
      return jsonResponse(500, { error: 'premium_transfer_sync_failed' });
    }

    return jsonResponse(200, {
      ok: true,
      processed: data === true,
      duplicate: data === false,
      environment: validEnvironment(event.environment) ? event.environment : null,
    });
  }

  if (!validEnvironment(event.environment)) {
    return jsonResponse(400, { error: 'invalid_environment' });
  }

  const source = mapSource(event.store);
  if (!source) {
    return jsonResponse(200, { ok: true, ignored: 'unsupported_store' });
  }

  if (!supportedEvents.has(event.type)) {
    return jsonResponse(200, { ok: true, ignored: 'unsupported_event_type' });
  }

  const entitlementIds = event.entitlement_ids ?? [];
  if (!entitlementIds.includes(PREMIUM_ENTITLEMENT_ID)) {
    return jsonResponse(200, { ok: true, ignored: 'non_premium_event' });
  }

  const sourceReference =
    event.original_transaction_id?.trim() || event.transaction_id?.trim() || null;

  if (!sourceReference) {
    return jsonResponse(400, { error: 'missing_source_reference' });
  }

  const userCandidates = revenueCatUserCandidates(event);
  if (userCandidates.length === 0) {
    return jsonResponse(400, { error: 'missing_valid_app_user_id' });
  }

  const { data: matchingProfiles, error: profileLookupError } = await admin
    .from('profiles')
    .select('id')
    .in('id', userCandidates);

  if (profileLookupError) {
    console.error('revenuecat-webhook: subscriber identity lookup failed', {
      eventId: event.id,
      error: profileLookupError,
    });
    return jsonResponse(500, { error: 'subscriber_identity_lookup_failed' });
  }

  const matchedUserIds = (matchingProfiles ?? []).map((profile) => profile.id);

  let resolvedUserId: string | null = null;
  if (
    event.app_user_id &&
    isUuid(event.app_user_id) &&
    matchedUserIds.includes(event.app_user_id)
  ) {
    resolvedUserId = event.app_user_id;
  } else if (matchedUserIds.length === 1) {
    resolvedUserId = matchedUserIds[0];
  }

  if (!resolvedUserId) {
    return jsonResponse(409, {
      error:
        matchedUserIds.length > 1
          ? 'ambiguous_subscriber_identity'
          : 'unknown_subscriber_identity',
    });
  }

  const startedAt = toIso(event.purchased_at_ms) ?? providerEventAt;

  // BILLING_ISSUE access lasts through RevenueCat's grace period, not merely
  // the original transaction expiration.
  const expiresAt =
    event.type === 'BILLING_ISSUE'
      ? toIso(event.grace_period_expiration_at_ms) ?? toIso(event.expiration_at_ms)
      : toIso(event.expiration_at_ms);

  const status = mapStatus(
    event.type,
    event.period_type,
    expiresAt,
    providerEventAt,
    event.cancel_reason
  );

  const { data, error } = await admin.rpc('process_revenuecat_premium_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_user_id: resolvedUserId,
    p_source: source,
    p_product_id: event.product_id ?? null,
    p_source_reference: sourceReference,
    p_status: status,
    p_started_at: startedAt,
    p_expires_at: expiresAt,
    p_provider_event_at: providerEventAt,
    p_environment: event.environment,
    p_cancel_reason: event.cancel_reason ?? null,
    p_expiration_reason: event.expiration_reason ?? null,
  });

  if (error) {
    console.error('revenuecat-webhook: sync failed', {
      eventId: event.id,
      eventType: event.type,
      source,
      environment: event.environment,
      error,
    });
    return jsonResponse(500, { error: 'premium_sync_failed' });
  }

  return jsonResponse(200, {
    ok: true,
    processed: data === true,
    duplicate: data === false,
    environment: event.environment,
  });
});
