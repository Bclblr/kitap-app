import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Action, Field, ReaderScreen, ui } from '@/components/ReaderUI';
import { supabase } from '@/lib/supabase';
export default function QuoteCreate() {
  const router = useRouter(); const lock = useRef(false);
  const [book, setBook] = useState(''); const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save() {
    if (lock.current || !text.trim() || !book.trim()) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setError('Paylaşmak için giriş yapmalısın.'); return; }
      const result = await supabase.from('quotes').insert({ user_id: data.user.id, book_title: book.trim(), book_key: '', text: text.trim() });
      if (result.error) throw result.error;
      router.replace('/');
    } catch { setError('Alıntı paylaşılamadı. Metnin korunuyor; yeniden deneyebilirsin.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <ReaderScreen title="Alıntı paylaş"><Field label="Kitap adı" value={book} onChangeText={setBook} maxLength={200} /><Field label="Alıntı" multiline value={text} onChangeText={setText} maxLength={4000} /><Text style={ui.error}>{error}</Text><Action label={busy ? 'Paylaşılıyor…' : 'Paylaş'} disabled={busy || !text.trim() || !book.trim()} onPress={() => void save()} /></ReaderScreen>;
}
