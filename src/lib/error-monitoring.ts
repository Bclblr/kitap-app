import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { withKeyedAsyncLock } from '@/lib/async-key-lock';
import { supabase } from '@/lib/supabase';

const MAX_MESSAGE = 1000;
const MAX_STACK = 8000;
const MAX_QUEUED_ERRORS = 20;
let globalHandlerInstalled = false;

type ClientErrorPayload = {
  p_error_kind: string;
  p_message: string;
  p_stack: string;
  p_component_stack: string;
  p_platform: string;
  p_app_version: string;
};

function errorQueueKey(userId: string) {
  return `offline:v1:${userId}:client-error-queue`;
}

async function currentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id ?? null;
}

async function sendErrorPayload(payload: ClientErrorPayload) {
  const { error } = await supabase.rpc('report_client_error', payload);
  if (error) throw error;
}

async function queueErrorPayload(
  userId: string,
  payload: ClientErrorPayload
) {
  await withKeyedAsyncLock(`client-error:${userId}`, async () => {
    const key = errorQueueKey(userId);
    const raw = await AsyncStorage.getItem(key);

    let queued: ClientErrorPayload[] = [];
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) queued = parsed;
    } catch {
      queued = [];
    }

    const next = [...queued, payload].slice(-MAX_QUEUED_ERRORS);
    await AsyncStorage.setItem(key, JSON.stringify(next));
  });
}

function redact(value: string, maxLength: number) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[jwt]')
    .replace(/([?&](?:token|access_token|refresh_token|code|apikey|api_key|key)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/("(?:access_token|refresh_token|token|apikey|api_key|password)"\s*:\s*")[^"]+(")/gi, '$1[redacted]$2')
    .slice(0, maxLength);
}

export async function reportAppError(
  error: unknown,
  options?: {
    kind?: string;
    componentStack?: string | null;
  }
) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;

  const normalized = error instanceof Error ? error : new Error(String(error));
  const message = redact(normalized.message || normalized.name || 'Unknown error', MAX_MESSAGE);
  const stack = redact(normalized.stack ?? '', MAX_STACK);
  const componentStack = redact(options?.componentStack ?? '', MAX_STACK);

  const payload: ClientErrorPayload = {
    p_error_kind: (options?.kind ?? 'unknown').slice(0, 80),
    p_message: message,
    p_stack: stack,
    p_component_stack: componentStack,
    p_platform: Platform.OS,
    p_app_version: Constants.expoConfig?.version ?? 'unknown',
  };

  try {
    await sendErrorPayload(payload);
  } catch {
    try {
      const userId = await currentUserId();
      if (userId) await queueErrorPayload(userId, payload);
    } catch {
      // Monitoring must never create a second application failure.
    }
  }
}

export async function flushQueuedAppErrors() {
  const userId = await currentUserId();
  if (!userId) return 0;

  return withKeyedAsyncLock(`client-error:${userId}`, async () => {
    const key = errorQueueKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return 0;

    let queued: ClientErrorPayload[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) queued = parsed;
    } catch {
      await AsyncStorage.removeItem(key);
      return 0;
    }

    const remaining: ClientErrorPayload[] = [];
    let sent = 0;

    for (const payload of queued) {
      try {
        await sendErrorPayload(payload);
        sent += 1;
      } catch {
        remaining.push(payload);
      }
    }

    if (remaining.length) {
      await AsyncStorage.setItem(key, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(key);
    }

    return sent;
  });
}

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
};

export function installGlobalErrorMonitoring() {
  if (globalHandlerInstalled) return;
  globalHandlerInstalled = true;

  if (typeof __DEV__ !== 'undefined' && __DEV__) return;

  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error, isFatal) => {
    void reportAppError(error, {
      kind: isFatal ? 'global_fatal_js' : 'global_js',
    });

    previousHandler?.(error, isFatal);
  });
}
