import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

export const SUPABASE_URL =
  'https://bxwlaohlyeexfhqyfkkw.supabase.co';

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(
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
