import { useEffect, useRef } from 'react';

import { deleteStoryWithMedia } from '@/lib/story-media';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useNetworkStatus } from '@/providers/NetworkProvider';

const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

type ExpiredStory = {
  id: string;
  image_url: string | null;
};

export default function StoryMediaMaintenance() {
  const { session } = useAuth();
  const { isOnline, retrySignal } = useNetworkStatus();
  const running = useRef(false);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !isOnline) return;

    let cancelled = false;

    async function cleanup() {
      if (running.current || cancelled) return;
      running.current = true;

      try {
        const { data, error } = await supabase
          .from('stories')
          .select('id, image_url')
          .eq('user_id', userId)
          .lte('expires_at', new Date().toISOString())
          .limit(100);

        if (error) throw error;

        for (const story of (data ?? []) as ExpiredStory[]) {
          if (cancelled) break;
          try {
            await deleteStoryWithMedia(story.id, userId, story.image_url);
          } catch (storyError) {
            console.warn('Süresi dolan hikâye temizlenemedi:', story.id, storyError);
          }
        }
      } catch (error) {
        console.warn('Hikâye medya bakımı başarısız:', error);
      } finally {
        running.current = false;
      }
    }

    void cleanup();
    const interval = setInterval(() => void cleanup(), CLEANUP_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOnline, retrySignal, session?.user?.id]);

  return null;
}
