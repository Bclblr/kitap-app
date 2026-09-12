import { supabase } from '@/lib/supabase';

export type RuntimeRestriction = {
  id: string;
  type: string;
  reason?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type RuntimeControls = {
  settings: Record<string, unknown>;
  announcement: null | {
    id: string;
    title: string;
    body: string;
    kind: string;
    action_route?: string | null;
  };
  restrictions: RuntimeRestriction[];
  feature_flags: { key: string; enabled: boolean }[];
  role: string;
  profile_control?: {
    verified?: boolean;
    follow_restricted?: boolean;
    content_filter_level?: 'standard' | 'strict' | 'off';
  } | null;
};

const DEFAULT_CONTROLS: RuntimeControls = {
  settings: {},
  announcement: null,
  restrictions: [],
  feature_flags: [],
  role: 'user',
  profile_control: null,
};

export async function getRuntimeControls(): Promise<RuntimeControls> {
  const { data, error } = await supabase.rpc('runtime_controls');
  if (error || !data || typeof data !== 'object') return DEFAULT_CONTROLS;
  return { ...DEFAULT_CONTROLS, ...(data as RuntimeControls) };
}

export function settingBoolean(controls: RuntimeControls, key: string, fallback = true) {
  const value = controls.settings?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function settingString(controls: RuntimeControls, key: string, fallback = '') {
  const value = controls.settings?.[key];
  return typeof value === 'string' ? value : fallback;
}

export function hasActiveRestriction(controls: RuntimeControls, ...types: string[]) {
  return controls.restrictions.some((item) => types.includes(item.type));
}
