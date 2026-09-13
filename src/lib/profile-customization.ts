import { supabase } from '@/lib/supabase';

export type PremiumProfileTheme = 'purple' | 'gold' | 'midnight' | 'forest';
export type PremiumProfileLayout = 'classic' | 'spotlight';

export type PremiumProfileCustomization = {
  user_id: string;
  theme_key: PremiumProfileTheme;
  layout_key: PremiumProfileLayout;
  highlight_text: string;
  show_premium_frame: boolean;
  created_at?: string;
  updated_at?: string;
};

export const PROFILE_THEME_ACCENTS: Record<PremiumProfileTheme, string> = {
  purple: '#8B5CF6',
  gold: '#C8922D',
  midnight: '#4F6FBF',
  forest: '#3F7A5A',
};

export const PROFILE_THEME_LABELS: Record<PremiumProfileTheme, string> = {
  purple: 'Mor',
  gold: 'Altın',
  midnight: 'Gece Mavisi',
  forest: 'Orman',
};

export async function loadProfileCustomization(userId: string) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('premium_profile_customizations')
    .select('user_id, theme_key, layout_key, highlight_text, show_premium_frame, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as PremiumProfileCustomization | null) ?? null;
}
