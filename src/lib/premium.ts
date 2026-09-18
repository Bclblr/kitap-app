import { supabase } from '@/lib/supabase';

export type PremiumSource = 'apple' | 'google' | 'admin_grant';

export type PremiumStatus =
  | 'inactive'
  | 'active'
  | 'trialing'
  | 'grace_period'
  | 'expired'
  | 'revoked';

export type PremiumEntitlement = {
  id: string;
  user_id: string;
  source: PremiumSource;
  status: PremiumStatus;
  product_id: string | null;
  entitlement_id: string;
  source_reference: string | null;
  starts_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  provider_environment: 'SANDBOX' | 'PRODUCTION' | null;
  created_at: string;
  updated_at: string;
};

export type PremiumAccess = {
  isPremium: boolean;
  hasPaidPremium: boolean;
  hasAdminPremium: boolean;
  paidSources: ('apple' | 'google')[];
  activeEntitlements: PremiumEntitlement[];
  allEntitlements: PremiumEntitlement[];
  nextExpirationAt: string | null;
};

type PremiumAccessRpcRow = {
  is_premium?: boolean | null;
  has_paid_premium?: boolean | null;
  has_admin_premium?: boolean | null;
  paid_sources?: string[] | null;
  active_entitlements?: PremiumEntitlement[] | null;
  all_entitlements?: PremiumEntitlement[] | null;
  next_expiration_at?: string | null;
};

const ACTIVE_PREMIUM_STATUSES = new Set<PremiumStatus>([
  'active',
  'trialing',
  'grace_period',
]);

function isEntitlementCurrentlyActive(
  entitlement: PremiumEntitlement,
  nowMs = Date.now()
) {
  if (!ACTIVE_PREMIUM_STATUSES.has(entitlement.status)) return false;
  if (entitlement.revoked_at) return false;

  if (
    (entitlement.source === 'apple' || entitlement.source === 'google') &&
    entitlement.provider_environment !== 'PRODUCTION'
  ) {
    return false;
  }

  const startsAt = Date.parse(entitlement.starts_at);
  if (Number.isFinite(startsAt) && startsAt > nowMs) return false;

  if (!entitlement.expires_at) return true;

  const expiresAt = Date.parse(entitlement.expires_at);
  return !Number.isFinite(expiresAt) || expiresAt > nowMs;
}

export function resolvePremiumAccess(
  entitlements: PremiumEntitlement[],
  nowMs = Date.now()
): PremiumAccess {
  const activeEntitlements = entitlements.filter((item) =>
    isEntitlementCurrentlyActive(item, nowMs)
  );

  const paidEntitlements = activeEntitlements.filter(
    (item) => item.source === 'apple' || item.source === 'google'
  );
  const adminEntitlements = activeEntitlements.filter(
    (item) => item.source === 'admin_grant'
  );

  const paidSources = Array.from(
    new Set(
      paidEntitlements.map((item) => item.source as 'apple' | 'google')
    )
  );

  const hasIndefiniteAccess = activeEntitlements.some(
    (item) => !item.expires_at
  );

  const expirations = activeEntitlements
    .map((item) => item.expires_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value) && value > nowMs)
    .sort((a, b) => b - a);

  return {
    isPremium: activeEntitlements.length > 0,
    hasPaidPremium: paidEntitlements.length > 0,
    hasAdminPremium: adminEntitlements.length > 0,
    paidSources,
    activeEntitlements,
    allEntitlements: entitlements,
    nextExpirationAt:
      hasIndefiniteAccess || expirations.length === 0
        ? null
        : new Date(expirations[0]).toISOString(),
  };
}

function premiumAccessFromRpcRow(row: PremiumAccessRpcRow | undefined): PremiumAccess {
  if (!row) return resolvePremiumAccess([]);

  const activeEntitlements = Array.isArray(row.active_entitlements)
    ? row.active_entitlements
    : [];
  const allEntitlements = Array.isArray(row.all_entitlements)
    ? row.all_entitlements
    : [];
  const paidSources = (row.paid_sources ?? []).filter(
    (source): source is 'apple' | 'google' => source === 'apple' || source === 'google'
  );

  return {
    isPremium: row.is_premium === true,
    hasPaidPremium: row.has_paid_premium === true,
    hasAdminPremium: row.has_admin_premium === true,
    paidSources,
    activeEntitlements,
    allEntitlements,
    nextExpirationAt: row.next_expiration_at ?? null,
  };
}

export async function loadCurrentUserPremiumAccess(): Promise<PremiumAccess> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return resolvePremiumAccess([]);

  const { data, error } = await supabase.rpc('get_my_premium_access');
  if (error) throw error;

  const row = Array.isArray(data)
    ? (data[0] as PremiumAccessRpcRow | undefined)
    : (data as PremiumAccessRpcRow | null | undefined) ?? undefined;

  return premiumAccessFromRpcRow(row);
}

export async function loadPremiumUserIds(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Set<string>();

  const { data, error } = await supabase.rpc('get_premium_badge_user_ids', {
    p_user_ids: uniqueIds,
  });
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row: { user_id?: string | null }) => row.user_id)
      .filter((value: string | null | undefined): value is string => Boolean(value))
  );
}

export async function isUserPremium(userId: string): Promise<boolean> {
  if (!userId) return false;
  const ids = await loadPremiumUserIds([userId]);
  return ids.has(userId);
}
