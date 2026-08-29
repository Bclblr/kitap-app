import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  'https://bxwlaohlyeexfhqyfkkw.supabase.co';

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);