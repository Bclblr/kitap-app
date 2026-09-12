import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

const listeners = new Set<() => void>();

export function notifySocialChanged() {
  listeners.forEach((listener) => listener());
}

export function useReaderSocial() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [following, setFollowing] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let generation = 0;

      async function load() {
        const request = ++generation;
        const id = userId;

        if (!id) {
          if (alive && request === generation) {
            setFollowing([]);
            setBlocked([]);
            setError('');
            setLoading(false);
          }
          return;
        }

        if (alive && request === generation) setLoading(true);

        try {
          const [follows, blocks] = await Promise.all([
            supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', id),
            supabase
              .from('user_blocks')
              .select('blocker_id,blocked_id')
              .or(`blocker_id.eq.${id},blocked_id.eq.${id}`),
          ]);

          if (follows.error) throw follows.error;
          if (blocks.error) throw blocks.error;
          if (!alive || request !== generation) return;

          setFollowing(
            [...new Set((follows.data ?? []).map((row) => String(row.following_id)).filter(Boolean))]
          );
          setBlocked(
            [
              ...new Set(
                (blocks.data ?? [])
                  .map((row) => (row.blocker_id === id ? row.blocked_id : row.blocker_id))
                  .map(String)
                  .filter(Boolean)
              ),
            ]
          );
          setError('');
        } catch (loadError) {
          console.error('Reader social load error:', loadError);
          if (alive && request === generation) {
            setError('Takip ve engel bilgileri yüklenemedi.');
          }
        } finally {
          if (alive && request === generation) setLoading(false);
        }
      }

      void load();

      if (!userId) {
        return () => {
          alive = false;
          generation += 1;
        };
      }

      const refresh = () => {
        void load();
      };

      listeners.add(refresh);

      const channel = supabase
        .channel(`reader-social-${userId}-${Math.random()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'follows',
            filter: `follower_id=eq.${userId}`,
          },
          refresh
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_blocks',
            filter: `blocker_id=eq.${userId}`,
          },
          refresh
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_blocks',
            filter: `blocked_id=eq.${userId}`,
          },
          refresh
        )
        .subscribe();

      return () => {
        alive = false;
        generation += 1;
        listeners.delete(refresh);
        void supabase.removeChannel(channel);
      };
    }, [userId])
  );

  return { userId, following, setFollowing, blocked, loading, error };
}
