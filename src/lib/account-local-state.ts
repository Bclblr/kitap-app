import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_ACCOUNT_KEYS = new Set([
  'reviews',
  'quotes',
  'books',
  'myBooks',
  'profile',
  'story-seen-ids',
  'notifications',
]);

const GLOBAL_ACCOUNT_PREFIXES = [
  'account:',
  'offline:v1:',
  'user:',
  'work-editor:',
];

function isSupabaseAuthKey(key: string) {
  return /^sb-[a-z0-9]+-auth-token(?:-code-verifier)?$/i.test(key);
}

export type ClearAccountLocalStateOptions = {
  includeLegacyKeys?: boolean;
  includeAuthSessionKeys?: boolean;
};

export async function clearAccountLocalState(
  userId?: string | null,
  options: ClearAccountLocalStateOptions = {}
) {
  const keys = await AsyncStorage.getAllKeys();

  const includeLegacyKeys = options.includeLegacyKeys ?? true;
  const includeAuthSessionKeys =
    options.includeAuthSessionKeys ?? !userId;

  const scopedPrefixes = userId
    ? [
        `account:${userId}:`,
        `offline:v1:${userId}:`,
        `user:${userId}:`,
        `work-editor:${userId}:`,
      ]
    : [];

  const keysToRemove = keys.filter((key) => {
    if (includeLegacyKeys && LEGACY_ACCOUNT_KEYS.has(key)) return true;
    if (includeAuthSessionKeys && isSupabaseAuthKey(key)) return true;

    if (userId) {
      return scopedPrefixes.some((prefix) => key.startsWith(prefix));
    }

    return GLOBAL_ACCOUNT_PREFIXES.some((prefix) => key.startsWith(prefix));
  });

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
}
