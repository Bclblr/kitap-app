import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { notifySocialChanged, useReaderSocial } from '@/hooks/use-reader-social';
import { Action, Busy, ui } from './ReaderUI';
type Reader = { id: string; username: string; full_name: string | null; profile_image: string | null };
export default function ReadersList({ targetId, mode, query, limit = 8 }: { targetId?: string; mode?: 'followers' | 'following'; query?: string; limit?: number }) {
  const router = useRouter();
  const social = useReaderSocial();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const lock = useRef(false);
  useFocusEffect(useCallback(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError('');
      try {
        let ids: string[] | undefined;
        if (targetId && mode) {
          const rows = await supabase.from('follows').select('follower_id,following_id').eq(mode === 'followers' ? 'following_id' : 'follower_id', targetId).limit(200);
          if (rows.error) throw rows.error;
          ids = (rows.data ?? []).map(row => mode === 'followers' ? row.follower_id : row.following_id);
          if (!ids.length) { if (alive) setReaders([]); return; }
        }
        let request = supabase.from('profiles').select('id,username,full_name,profile_image').order('id').limit(100);
        if (ids) request = request.in('id', ids);
        if (query?.trim()) {
          const term = query.trim().replace(/[%_,().]/g, '');
          if (!term) { if (alive) setReaders([]); return; }
          request = request.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`);
        }
        const result = await request;
        if (result.error) throw result.error;
        let ranked = result.data ?? [];
        if (!mode && !query) {
          const activity = await supabase.from('posts').select('user_id,created_at').order('created_at', { ascending: false }).limit(100);
          const recent = new Map<string, number>();
          for (const post of activity.data ?? []) if (!recent.has(post.user_id)) recent.set(post.user_id, Date.parse(post.created_at));
          ranked = [...ranked].sort((a, b) => (recent.get(b.id) ?? 0) - (recent.get(a.id) ?? 0) || a.id.localeCompare(b.id));
        }
        if (alive) setReaders(ranked);
      } catch { if (alive) setError('Okurlar yüklenemedi.'); }
      finally { if (alive) setLoading(false); }
    }
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [targetId, mode, query]));
  async function follow(reader: Reader) {
    if (!social.userId) { router.push('/login'); return; }
    if (lock.current) return;
    lock.current = true; setPending(reader.id); setError('');
    try {
      const result = social.following.includes(reader.id) ? await supabase.from('follows').delete().eq('follower_id', social.userId).eq('following_id', reader.id) : await supabase.from('follows').insert({ follower_id: social.userId, following_id: reader.id });
      if (result.error) throw result.error;
      social.setFollowing(current => current.includes(reader.id) ? current.filter(id => id !== reader.id) : [...current, reader.id]);
      notifySocialChanged();
    } catch { setError('Takip işlemi tamamlanamadı.'); }
    finally { lock.current = false; setPending(null); }
  }
  const visible = readers.filter(reader => !social.blocked.includes(reader.id) && (mode || reader.id !== social.userId)).slice(0, mode || query ? 100 : limit);
  return <View style={{ gap: 10 }}><Text style={ui.title}>{mode === 'followers' ? 'Takipçiler' : mode === 'following' ? 'Takip edilenler' : query ? 'Okur ara' : 'Keşfedilecek Okurlar'}</Text>
    {!!(error || social.error) && <Text style={ui.error}>{error || social.error}</Text>}
    {loading || social.loading ? <Busy /> : !social.error && <>
      {!visible.length && <Text style={ui.muted}>Gösterilecek okur bulunamadı.</Text>}
      {visible.map(reader => <View key={reader.id} style={[ui.card, { flexDirection: 'row', alignItems: 'center' }]}>
        {reader.profile_image && <Image source={{ uri: reader.profile_image }} style={{ width: 40, height: 40, borderRadius: 20 }} />}
        <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={ui.text}>{reader.full_name || reader.username}</Text><Text numberOfLines={1} style={ui.muted}>@{reader.username}</Text>
        <Action label={query ? 'Mesaj gönder' : 'Profili gör'} onPress={() => router.push(query ? { pathname: '/chat', params: { userId: reader.id, username: reader.username } } : { pathname: '/profile', params: { userId: reader.id } })} /></View>
        {reader.id !== social.userId && <Action disabled={pending !== null} label={pending === reader.id ? '…' : social.following.includes(reader.id) ? 'Takipten çık' : 'Takip et'} onPress={() => void follow(reader)} />}
      </View>)}
    </>}
  </View>;
}
