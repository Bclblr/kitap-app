const fs = require('fs');

const file = 'src/lib/supabase.ts';

const content = `import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl =
  'https://bxwlaohlyeexfhqyfkkw.supabase.co';

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
`;

fs.writeFileSync(file, content, 'utf8');

console.log('TAMAM: Supabase mobil oturum ayarlari eklendi.');
