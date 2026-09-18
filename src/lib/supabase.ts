import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { Database } from './database.types';

export const SUPABASE_URL =
  'https://bxwlaohlyeexfhqyfkkw.supabase.co';

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

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
