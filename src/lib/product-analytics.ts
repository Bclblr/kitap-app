import { supabase } from '@/lib/supabase';

export type ProductAnalyticsEvent =
  | 'app_open'
  | 'onboarding_completed'
  | 'book_opened'
  | 'shelf_updated'
  | 'content_created';

const SAFE_METADATA_KEYS = new Set([
  'source',
  'status',
  'content_type',
  'skip_details',
]);

function sanitizeMetadata(metadata: Record<string, unknown> = {}) {
  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      safe[key] = value;
    }
  }

  return safe;
}

export async function trackProductEvent(
  eventName: ProductAnalyticsEvent,
  metadata: Record<string, unknown> = {}
) {
  try {
    const { error } = await supabase.rpc('track_product_event', {
      p_event_name: eventName,
      p_metadata: sanitizeMetadata(metadata),
    });

    if (error && __DEV__) {
      console.warn('Product analytics event gönderilemedi:', eventName, error.message);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Product analytics event hatası:', eventName, error);
    }
  }
}
