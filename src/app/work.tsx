import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { Action, Busy, ReaderScreen, ui } from '@/components/ReaderUI';
import { supabase } from '@/lib/supabase';
import { Chapter, Work } from '@/lib/works';
export default function WorkReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [work, setWork] = useState<Work | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; async function load() {
    try {
      const [book, parts] = await Promise.all([supabase.from('works').select('*').eq('id', id).single(), supabase.from('work_chapters').select('*').eq('work_id', id).eq('status', 'published').order('position')]);
      if (book.error || parts.error) throw Error();
      if (alive) { setWork(book.data); setChapters(parts.data ?? []); }
    } catch { if (alive) setError('Eser bulunamadı veya okumak için yetkin yok.'); }
    finally { if (alive) setLoading(false); }
  } void load(); return () => { alive = false; }; }, [id]);
  const chapter = selected === null ? null : chapters[selected];
  return <ReaderScreen key={`${id}-${selected}`} title={chapter?.title ?? work?.title ?? 'Kitap'}>{loading ? <Busy /> : error ? <Text style={ui.error}>{error}</Text> : work && <>
    {chapter ? <><Text selectable style={[ui.text, { fontSize: 19, lineHeight: 31 }]}>{chapter.content}</Text><View style={ui.row}><Action label="Bölümler" onPress={() => setSelected(null)} /><Action label="Önceki" disabled={selected === 0} onPress={() => setSelected(i => Math.max(0, (i ?? 0)-1))} /><Action label="Sonraki" disabled={selected === chapters.length-1} onPress={() => setSelected(i => Math.min(chapters.length-1, (i ?? 0)+1))} /></View></> : <>
    {work.cover_url && <Image source={{ uri: work.cover_url }} resizeMode="contain" style={{ width: '100%', height: 260 }} />}
    <Action label="Yazarın profili" onPress={() => router.push({ pathname: '/profile', params: { userId: work.author_id } })} />
    <Text style={ui.text}>{work.description}</Text><Text style={ui.muted}>{work.genre} · {work.tags.join(', ')}</Text>
    <Text style={ui.title}>Bölümler</Text>{!chapters.length && <Text style={ui.muted}>Henüz yayınlanmış bölüm yok.</Text>}
    {chapters.map((part, i) => <Action key={part.id} label={`${part.position}. ${part.title}`} onPress={() => setSelected(i)} />)}
    </>}
  </>}</ReaderScreen>;
}
