import { supabase } from '@/lib/supabase';

export type PremiumShelfCustomization = {
  user_id: string;
  want_label: string;
  reading_label: string;
  read_label: string;
  layout_key: 'cozy' | 'compact';
  accent_key: 'purple' | 'gold' | 'midnight' | 'forest';
  show_counts: boolean;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_PREMIUM_SHELF_CUSTOMIZATION: Omit<PremiumShelfCustomization, 'user_id'> = {
  want_label: 'Okuyacağım',
  reading_label: 'Okuyorum',
  read_label: 'Okudum',
  layout_key: 'cozy',
  accent_key: 'purple',
  show_counts: true,
};

export const SHELF_ACCENTS: Record<PremiumShelfCustomization['accent_key'], string> = {
  purple: '#8B5CF6',
  gold: '#C58B2B',
  midnight: '#3B5CCC',
  forest: '#3E8A68',
};

export async function loadOwnShelfCustomization(userId: string) {
  const { data, error } = await supabase
    .from('premium_shelf_customizations')
    .select('user_id, want_label, reading_label, read_label, layout_key, accent_key, show_counts, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as PremiumShelfCustomization | null) ?? null;
}
