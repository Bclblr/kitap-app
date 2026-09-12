import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { notifySocialChanged, useReaderSocial } from '@/hooks/use-reader-social';
import { Action, Busy, useReaderStyles } from './ReaderUI';
import ReaderSuggestions from './ReaderSuggestions';
type Reader = { id: string; username: string; full_name: string | null; profile_image: string | null };
export default function ReadersList({ targetId, mode, query, limit = 8 }: { targetId?: string; mode?: 'followers' | 'following'; query?: string; limit?: number }) {
  return !mode && !query ? <ReaderSuggestions limit={limit} /> : <ReaderDirectory targetId={targetId} mode={mode} query={query} limit={limit} />;
}
function ReaderDirectory({ targetId, mode, query, limit }: { targetId?: string; mode?: 'followers' | 'following'; query?: string; limit: number }) {
  const ui = useReaderStyles();
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
        if (alive) setReaders(result.data ?? []);
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
