import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Action, ui } from './ReaderUI';
export default function StoryActions({ storyId, ownerId, onDeleted, onClose }: { storyId: string; ownerId?: string | null; onDeleted: () => void; onClose: () => void }) {
  const router = useRouter(); const lock = useRef(false);
  const [userId, setUserId] = useState(''); const [liked, setLiked] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let alive = true; void (async () => { try {
    const auth = await supabase.auth.getUser(); if (!auth.data.user) return;
    const result = await supabase.from('story_likes').select('story_id').eq('story_id', storyId).eq('user_id', auth.data.user.id).maybeSingle();
    if (alive) { setUserId(auth.data.user.id); setLiked(!!result.data); }
  } catch { if (alive) setError('Hikâye işlemleri yüklenemedi.'); } })(); return () => { alive = false; }; }, [storyId]);
  async function act(remove = false) {
    if (lock.current || !userId) return;
    lock.current = true; setBusy(true);
    try {
      const result = remove ? await supabase.from('stories').delete().eq('id', storyId).eq('user_id', userId) : liked ? await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId) : await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId });
      if (result.error) throw result.error;
      if (remove) onDeleted(); else setLiked(!liked);
    } catch { setError('İşlem tamamlanamadı.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <View style={{ padding: 10, gap: 4 }}><View style={ui.row}>
    {!!userId && <Action disabled={busy} label={liked ? '♥ Beğenildi' : '♡ Beğen'} onPress={() => void act()} />}
    {userId && userId === ownerId ? <Action disabled={busy} label="Hikâyemi sil" onPress={() => void act(true)} /> : ownerId && <Action label="Yanıtla" onPress={() => { onClose(); router.push({ pathname: '/chat', params: { userId: ownerId, reply: `Hikâyene yanıt (${storyId}): ` } }); }} />}
    </View>{!!error && <Text style={ui.error}>{error}</Text>}</View>;
}
