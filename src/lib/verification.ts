import { supabase } from '@/lib/supabase';

export type VerifiedAccount = {
  user_id: string;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export async function isUserVerified(userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabase
    .from('verified_accounts')
    .select('is_verified')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.is_verified === true;
}

export async function loadVerifiedUserIds(userIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from('verified_accounts')
    .select('user_id')
    .in('user_id', ids)
    .eq('is_verified', true);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.user_id));
}

export async function loadVerifiedAccounts(): Promise<VerifiedAccount[]> {
  const { data, error } = await supabase
    .from('verified_accounts')
    .select(
      'user_id, is_verified, verified_at, verified_by, revoked_at, revoked_by, reason, created_at, updated_at'
    )
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VerifiedAccount[];
}
