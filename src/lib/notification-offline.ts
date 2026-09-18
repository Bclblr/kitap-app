import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

export type OfflineNotificationSource = 'interaction' | 'social' | 'admin';

export type OfflineNotificationReadTarget = {
  source: OfflineNotificationSource;
  id: string;
};

function cacheKey(userId: string) {
  return `offline:v1:${userId}:notifications-cache`;
}

function queueKey(userId: string) {
  return `offline:v1:${userId}:notification-read-queue`;
}

export async function loadNotificationCache<T>(userId: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function saveNotificationCache<T>(
  userId: string,
  items: T[]
) {
  await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(items));
}

export async function queueNotificationRead(
  userId: string,
  target: OfflineNotificationReadTarget
) {
  const key = queueKey(userId);
  const raw = await AsyncStorage.getItem(key);
  let current: OfflineNotificationReadTarget[] = [];

  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) current = parsed;
  } catch {
    current = [];
  }

  const dedupeKey = `${target.source}:${target.id}`;
  const next = [
    ...current.filter(
      (item) => `${item.source}:${item.id}` !== dedupeKey
    ),
    target,
  ];

  await AsyncStorage.setItem(key, JSON.stringify(next));
}

async function applyReadTarget(target: OfflineNotificationReadTarget) {
  if (target.source === 'admin') {
    return supabase.rpc('mark_admin_notification_read', {
      p_notification_id: target.id,
    });
  }

  const table =
    target.source === 'social'
      ? 'social_notifications'
      : 'notifications';

  return supabase
    .from(table)
    .update({ read: true })
    .eq('id', target.id);
}

export async function flushNotificationReadQueue(userId: string) {
  const key = queueKey(userId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return 0;

  let queued: OfflineNotificationReadTarget[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) queued = parsed;
  } catch {
    await AsyncStorage.removeItem(key);
    return 0;
  }

  const remaining: OfflineNotificationReadTarget[] = [];
  let flushed = 0;

  for (const target of queued) {
    try {
      const result = await applyReadTarget(target);
      if (result.error) {
        remaining.push(target);
      } else {
        flushed += 1;
      }
    } catch {
      remaining.push(target);
    }
  }

  if (remaining.length) {
    await AsyncStorage.setItem(key, JSON.stringify(remaining));
  } else {
    await AsyncStorage.removeItem(key);
  }

  return flushed;
}
