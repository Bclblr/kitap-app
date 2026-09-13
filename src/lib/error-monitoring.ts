import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const MAX_MESSAGE = 1000;
const MAX_STACK = 8000;

function redact(value: string, maxLength: number) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/([?&](?:token|access_token|refresh_token|code)=)[^&\s]+/gi, '$1[redacted]')
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

  try {
    await supabase.rpc('report_client_error', {
      p_error_kind: (options?.kind ?? 'unknown').slice(0, 80),
      p_message: message,
      p_stack: stack,
      p_component_stack: componentStack,
      p_platform: Platform.OS,
      p_app_version: Constants.expoConfig?.version ?? 'unknown',
    });
  } catch {
    // Monitoring must never create a second application failure.
  }
}
