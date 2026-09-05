import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
const listeners = new Set<() => void>();
export function notifySocialChanged() { listeners.forEach(listener => listener()); }
export function useReaderSocial() {
  const [userId, setUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let alive = true; let generation = 0;
    async function load() {
      const request = ++generation;
      try {
        const { data } = await supabase.auth.getUser();
        const id = data.user?.id ?? null;
        if (!alive || request !== generation) return;
        setUserId(id);
        if (!id) { setFollowing([]); setBlocked([]); setError(''); return; }
        const [follows, blocks] = await Promise.all([supabase.from('follows').select('following_id').eq('follower_id', id), supabase.from('user_blocks').select('blocker_id,blocked_id')]);
        if (follows.error || blocks.error) throw Error();
        if (alive && request === generation) { setFollowing((follows.data ?? []).map(row => row.following_id)); setBlocked((blocks.data ?? []).map(row => row.blocker_id === id ? row.blocked_id : row.blocker_id)); setError(''); }
      } catch { if (alive && request === generation) setError('Takip ve engel bilgileri yüklenemedi.'); }
      finally { if (alive && request === generation) setLoading(false); }
    }
    void load(); const refresh = () => { void load(); }; listeners.add(refresh);
    const channel = supabase.channel(`reader-social-${Math.random()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, refresh).on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, refresh).subscribe();
    return () => { alive = false; listeners.delete(refresh); void supabase.removeChannel(channel); };
  }, []));
  return { userId, following, setFollowing, blocked, loading, error };
}
