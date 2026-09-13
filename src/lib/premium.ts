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
  created_at: string;
  updated_at: string;
};

export type PremiumAccess = {
  isPremium: boolean;
  hasPaidPremium: boolean;
  hasAdminPremium: boolean;
  paidSources: Array<'apple' | 'google'>;
  activeEntitlements: PremiumEntitlement[];
  allEntitlements: PremiumEntitlement[];
  nextExpirationAt: string | null;
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

  const expirations = activeEntitlements
    .map((item) => item.expires_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value) && value > nowMs)
    .sort((a, b) => a - b);

  return {
    isPremium: activeEntitlements.length > 0,
    hasPaidPremium: paidEntitlements.length > 0,
    hasAdminPremium: adminEntitlements.length > 0,
    paidSources,
    activeEntitlements,
    allEntitlements: entitlements,
    nextExpirationAt:
      expirations.length > 0 ? new Date(expirations[0]).toISOString() : null,
  };
}

export async function loadCurrentUserPremiumAccess(): Promise<PremiumAccess> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return resolvePremiumAccess([]);

  const { data, error } = await supabase
    .from('premium_entitlements')
    .select(
      'id, user_id, source, status, product_id, entitlement_id, source_reference, starts_at, expires_at, revoked_at, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return resolvePremiumAccess((data ?? []) as PremiumEntitlement[]);
}
