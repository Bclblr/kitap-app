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

export async function clearAccountLocalState(userId?: string | null) {
  const keys = await AsyncStorage.getAllKeys();

  const accountPrefixes = userId
    ? [
        `account:${userId}:`,
        `offline:v1:${userId}:`,
        `user:${userId}:`,
      ]
    : [];

  const keysToRemove = keys.filter(
    (key) =>
      LEGACY_ACCOUNT_KEYS.has(key) ||
      accountPrefixes.some((prefix) => key.startsWith(prefix))
  );

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
}
