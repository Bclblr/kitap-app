import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { Database } from './database.types';

function requiredPublicEnv(name: string, value: string | undefined) {
  const clean = value?.trim();
  if (!clean) {
    throw new Error(`${name} is required.`);
  }
  return clean;
}

export const SUPABASE_URL = requiredPublicEnv(
  'EXPO_PUBLIC_SUPABASE_URL',
  process.env.EXPO_PUBLIC_SUPABASE_URL
);

const supabasePublishableKey = requiredPublicEnv(
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

try {
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
    throw new Error('Supabase URL must use HTTPS and a supabase.co hostname.');
  }
} catch (error) {
  throw new Error(
    `EXPO_PUBLIC_SUPABASE_URL is invalid: ${error instanceof Error ? error.message : String(error)}`
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL,
  supabasePublishableKey,
  {
    auth: {
      storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
      autoRefreshToken: !(Platform.OS === 'web' && typeof window === 'undefined'),
      persistSession: !(Platform.OS === 'web' && typeof window === 'undefined'),
      detectSessionInUrl: false,
    },
  }
);
