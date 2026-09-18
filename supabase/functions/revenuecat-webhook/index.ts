import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RevenueCatEnvironment = 'SANDBOX' | 'PRODUCTION';

type RevenueCatWebhook = {
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  if (!validEnvironment(event.environment)) {
    return jsonResponse(400, { error: 'invalid_environment' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === 'TRANSFER') {
    const transferredFrom = (event.transferred_from ?? []).filter(isUuid);
    const transferredTo = (event.transferred_to ?? []).filter(isUuid);

    if (
      transferredFrom.length !== (event.transferred_from ?? []).length ||
      transferredTo.length !== (event.transferred_to ?? []).length ||
      transferredFrom.length === 0 ||
      transferredTo.length === 0
    ) {
      return jsonResponse(400, { error: 'invalid_transfer_users' });
    }

    const { data, error } = await admin.rpc('process_revenuecat_transfer_event', {
      p_event_id: event.id,
      p_transferred_from: transferredFrom,
      p_transferred_to: transferredTo,
      p_provider_event_at: providerEventAt,
      p_environment: event.environment,
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
      environment: event.environment,
    });
  }

  if (!event.app_user_id) {
    return jsonResponse(400, { error: 'missing_app_user_id' });
  }

  if (!isUuid(event.app_user_id)) {
    return jsonResponse(400, { error: 'invalid_app_user_id' });
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
    p_user_id: event.app_user_id,
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
