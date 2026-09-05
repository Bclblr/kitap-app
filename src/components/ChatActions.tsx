import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, ScrollView, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { notifySocialChanged } from '@/hooks/use-reader-social';
import { Action, Field, ui } from './ReaderUI';
export default function ChatActions({ conversationId, onBlocked }: { conversationId: string | null; onBlocked: (blocked: boolean) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [report, setReport] = useState(false);
  const [userId, setUserId] = useState(''); const [otherId, setOtherId] = useState('');
  const [mine, setMine] = useState(false); const [error, setError] = useState('');
  const [description, setDescription] = useState(''); const [category, setCategory] = useState('spam');
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      onBlocked(true);
      try {
        if (!conversationId) return;
        const auth = await supabase.auth.getUser(); const uid = auth.data.user?.id;
        if (!uid) return;
        const conversation = await supabase.from('conversations').select('user1_id,user2_id').eq('id', conversationId).single();
        if (conversation.error) throw conversation.error;
        if (![conversation.data.user1_id, conversation.data.user2_id].includes(uid)) throw Error();
        const other = conversation.data.user1_id === uid ? conversation.data.user2_id : conversation.data.user1_id;
        const blocks = await supabase.from('user_blocks').select('blocker_id,blocked_id');
        if (blocks.error) throw blocks.error;
        const related = (blocks.data ?? []).filter(row => (row.blocker_id === uid && row.blocked_id === other) || (row.blocker_id === other && row.blocked_id === uid));
        if (alive) { setUserId(uid); setOtherId(other); setMine(related.some(row => row.blocker_id === uid)); onBlocked(related.length > 0); setError(''); }
      } catch { if (alive) setError('Sohbet izinleri doğrulanamadı. Bağlantını kontrol et.'); }
    }
    void load();
    const channel = supabase.channel(`chat-blocks-${conversationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, () => void load()).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [conversationId, onBlocked, mine]);
  async function perform(action: 'block' | 'hide' | 'report') {
    if (lock.current || !userId || !otherId) return;
    lock.current = true; setBusy(true);
    try {
      const result = action === 'block' ? mine ? await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', otherId) : await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: otherId }) : action === 'hide' ? await supabase.from('conversation_hidden').upsert({ user_id: userId, conversation_id: conversationId, hidden_at: new Date().toISOString() }) : await supabase.from('user_reports').insert({ reporter_id: userId, reported_id: otherId, category, description });
      if (result.error) throw result.error;
      if (action === 'block') { setMine(!mine); onBlocked(true); notifySocialChanged(); }
      if (action === 'hide') router.replace('/messages');
      if (action === 'report') { setReport(false); setDescription(''); }
      setError(action === 'report' ? 'Şikâyetin kaydedildi.' : '');
      if (action !== 'report') setOpen(false);
    } catch { setError('İşlem tamamlanamadı. Lütfen yeniden dene.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><Action label="•••" onPress={() => setOpen(true)} /><Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, backgroundColor: '#000B', justifyContent: 'center', padding: 20 }}><ScrollView style={{ maxHeight: '85%' }} contentContainerStyle={ui.card}>
    {!!error && <Text style={ui.error}>{error}</Text>}
    {report ? <><Text style={ui.title}>Kullanıcıyı şikâyet et</Text>{[['spam','Spam'],['harassment','Taciz'],['inappropriate','Uygunsuz içerik'],['impersonation','Sahte hesap'],['other','Diğer']].map(([value,label]) => <Action key={value} label={`${category === value ? '✓ ' : ''}${label}`} onPress={() => setCategory(value)} />)}<Field label="Açıklama (isteğe bağlı)" multiline maxLength={2000} value={description} onChangeText={setDescription} /><Action label="Şikâyeti gönder" disabled={busy} onPress={() => void perform('report')} /></> : <>
    <Action label="Profili gör" disabled={!otherId} onPress={() => { setOpen(false); router.push({ pathname: '/profile', params: { userId: otherId } }); }} />
    <Text style={ui.muted}>Sohbeti silmek yalnızca senin listenden gizler. Yeni mesaj geldiğinde tekrar görünür.</Text>
    <Action label="Sohbeti sil" disabled={busy || !userId} onPress={() => void perform('hide')} />
    <Action label={mine ? 'Engeli kaldır' : 'Kullanıcıyı engelle'} disabled={busy || !userId} onPress={() => void perform('block')} />
    <Action label="Şikâyet et" disabled={!userId} onPress={() => setReport(true)} /></>}
    <Action label="Kapat" onPress={() => { setOpen(false); setReport(false); }} />
  </ScrollView></View></Modal></>;
}
