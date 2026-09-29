import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const PUSH_TOKEN_STORAGE_KEY = 'kitap:expo-push-token';
export const PUSH_CHANNEL_ID = 'kitap-social';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function removeStoredPushToken() {
  const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!storedToken) return;

  try {
    await (supabase as any).rpc('unregister_push_token', { p_token: storedToken });
  } catch (error) {
    console.warn('Push token kaydı kaldırılamadı:', error);
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}

export async function registerPushNotifications(userId: string) {
  if (Platform.OS === 'web' || !userId || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Kitap bildirimleri',
      description: 'Beğeni, yorum, takip, mesaj ve uygulama bildirimleri',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 220, 120, 220],
      lightColor: '#6232B5',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    permissions = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  }

  if (!permissions.granted) {
    await removeStoredPushToken();
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('EAS projectId bulunamadığı için push token alınamadı.');
    return null;
  }

  try {
    const expoPushToken = (
      await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;

    const { error } = await (supabase as any).rpc('register_push_token', {
      p_token: expoPushToken,
      p_platform: Platform.OS,
      p_device_name: Device.modelName ?? null,
    });

    if (error) throw error;
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken);
    return expoPushToken;
  } catch (error) {
    console.warn('Push bildirim kaydı tamamlanamadı:', error);
    return null;
  }
}

export async function unregisterPushNotifications() {
  if (Platform.OS === 'web') return;
  await removeStoredPushToken();
}

export function notificationUrl(notification: Notifications.Notification): string | null {
  const value = notification.request.content.data?.url;
  if (typeof value !== 'string') return null;

  const url = value.trim();
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('://') || url.includes('..')) {
    return null;
  }

  const allowedRoots = new Set([
    'notifications',
    'content',
    'messages',
    'chat',
    'book',
    'profile',
    'community',
    'event',
    'premium',
    'follow-requests',
  ]);
  const root = url.split(/[/?#]/).filter(Boolean)[0] ?? '';
  return allowedRoots.has(root) ? url : null;
}
