import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import { Action, Busy, ReaderScreen, useReaderStyles } from '@/components/ReaderUI';
import { supabase } from '@/lib/supabase';
import { Chapter, Work } from '@/lib/works';
import { useAuth } from '@/providers/AuthProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
export default function WorkReader() {
  const ui = useReaderStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [author, setAuthor] = useState('Yazar');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [lastChapterId, setLastChapterId] = useState<string | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; async function load() {
    try {
      const [book, parts] = await Promise.all([supabase.from('works').select('*').eq('id', id).single(), supabase.from('work_chapters').select('*').eq('work_id', id).eq('status', 'published').order('position')]);
      if (book.error || parts.error) throw Error();
      const [profile, bookmark, progress] = await Promise.all([
        supabase.from('profiles').select('username,full_name').eq('id', book.data.author_id).maybeSingle(),
        supabase.from('saved_works').select('work_id').eq('work_id', id).eq('user_id', session!.user.id).maybeSingle(),
        AsyncStorage.getItem(`work-progress:${session!.user.id}:${id}`).catch(() => null),
      ]);
      if (alive) { setAuthor(profile.data?.full_name || profile.data?.username || 'Yazar'); setSaved(!!bookmark.data); setLastChapterId(progress); }
      if (alive) { setWork(book.data); setChapters(parts.data ?? []); }
    } catch { if (alive) setError('Eser bulunamadı veya okumak için yetkin yok.'); }
    finally { if (alive) setLoading(false); }
  } if (session) void load(); return () => { alive = false; }; }, [id, session]);
  useEffect(() => {
    if (!session || selected === null || !chapters[selected]) return;
    const chapterId = chapters[selected].id;
    void AsyncStorage.setItem(`work-progress:${session.user.id}:${id}`, chapterId).then(() => setLastChapterId(chapterId)).catch(() => {});
  }, [selected, chapters, session, id]);
  async function toggleSaved() {
    if (!session || saving) return;
    setSaving(true); setSaveError('');
    try {
      const result = saved ? await supabase.from('saved_works').delete().eq('user_id', session.user.id).eq('work_id', id) : await supabase.from('saved_works').insert({ user_id: session.user.id, work_id: id });
      if (result.error) throw result.error;
      setSaved(!saved);
    } catch { setSaveError('Kaydetme işlemi tamamlanamadı. Tekrar deneyebilirsin.'); }
    finally { setSaving(false); }
  }
  const chapter = selected === null ? null : chapters[selected];
  return <ReaderScreen key={`${id}-${selected}`} title={chapter?.title ?? work?.title ?? 'Kitap'}>{loading ? <Busy /> : error ? <Text style={ui.error}>{error}</Text> : work && <>
    {chapter ? <><Text selectable style={[ui.text, { fontSize: 19, lineHeight: 31 }]}>{chapter.content}</Text><View style={ui.row}><Action label="Bölümler" onPress={() => setSelected(null)} /><Action label="Önceki" disabled={selected === 0} onPress={() => setSelected(i => Math.max(0, (i ?? 0)-1))} /><Action label="Sonraki" disabled={selected === chapters.length-1} onPress={() => setSelected(i => Math.min(chapters.length-1, (i ?? 0)+1))} /></View></> : <>
    {work.cover_url && <Image source={{ uri: work.cover_url }} resizeMode="contain" style={{ width: '100%', height: 260 }} />}
    <Action label={author} onPress={() => router.push({ pathname: '/profile', params: { userId: work.author_id } })} />
    <Text style={ui.text}>{work.description}</Text><Text style={ui.muted}>{work.genre} · {work.tags.join(', ')}</Text>
    <Text style={ui.muted}>{chapters.length} bölüm · {work.language} · {work.completed ? 'Tamamlandı' : 'Devam ediyor'} · {work.audience === 'mature' ? 'Yetişkin' : work.audience === 'teen' ? 'Genç' : 'Genel'}</Text>
    <View style={ui.row}><Action label="Okumaya başla" disabled={!chapters.length} onPress={() => setSelected(0)} />{chapters.some(part => part.id === lastChapterId) && <Action label="Kaldığın bölümden devam et" onPress={() => setSelected(chapters.findIndex(part => part.id === lastChapterId))} />}<Action label={saved ? '✓ Kaydedildi · Kaldır' : 'Eseri kaydet'} disabled={saving} onPress={() => void toggleSaved()} /></View>
    {!!saveError && <Text style={ui.error}>{saveError}</Text>}
    <Text style={ui.title}>Bölümler</Text>{!chapters.length && <Text style={ui.muted}>Henüz yayınlanmış bölüm yok.</Text>}
    {chapters.map((part, i) => <Action key={part.id} label={`${part.position}. ${part.title}`} onPress={() => setSelected(i)} />)}
    </>}
  </>}</ReaderScreen>;
}
