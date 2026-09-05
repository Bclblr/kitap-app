import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Action, Busy, Field, ReaderScreen, ui } from '@/components/ReaderUI';
import { supabase } from '@/lib/supabase';
import { Chapter, Work } from '@/lib/works';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function WorkEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [work, setWork] = useState<Partial<Work>>({ title: '', description: '', genre: '', cover_url: '', tags: [], status: 'draft' });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState<Partial<Chapter> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const [authorized, setAuthorized] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [backup, setBackup] = useState<{ work: Partial<Work>; chapter: Partial<Chapter> | null } | null>(null);
  const [localStatus, setLocalStatus] = useState('');
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw Error('Devam etmek için giriş yapmalısın.');
        if (id) {
          const result = await supabase.from('works').select('*').eq('id', id).eq('author_id', auth.user.id).single();
          if (result.error || !result.data) throw Error('Eser bulunamadı veya düzenleme yetkin yok.');
          const parts = await supabase.from('work_chapters').select('*').eq('work_id', id).order('position');
          if (parts.error) throw Error('Bölümler yüklenemedi.');
          if (alive) { setWork(result.data); setChapters(parts.data ?? []); }
        }
        const key = `work-editor:${auth.user.id}:${id ?? 'new'}`;
        const saved = await AsyncStorage.getItem(key).catch(() => null);
        if (alive) {
          if (saved) {
            try { const parsed = JSON.parse(saved); if (parsed.work && typeof parsed.work.title === 'string') setBackup(parsed); } catch { /* Ignore malformed device backup. */ }
          }
          setDraftKey(key); setAuthorized(true);
        }
      } catch (error) { if (alive) setMessage(error instanceof Error ? error.message : 'Eser yüklenemedi.'); }
      finally { if (alive) setLoading(false); }
    }
    void load(); return () => { alive = false; };
  }, [id]);
  useEffect(() => {
    if (!draftKey || !authorized || backup || busy) return;
    let alive = true;
    setLocalStatus('Cihaz taslağı kaydediliyor…');
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(draftKey, JSON.stringify({ work, chapter })).then(() => { if (alive) setLocalStatus('Cihaz taslağı kaydedildi. Yayınlamak için Kaydet/Yayınla düğmesini kullan.'); }).catch(() => { if (alive) setLocalStatus('Cihaz yedeği kaydedilemedi; sunucuya kaydetmeyi unutma.'); });
    }, 800);
    return () => { alive = false; clearTimeout(timer); };
  }, [work, chapter, draftKey, authorized, backup, busy]);
  async function save(status: 'draft' | 'published', part = false) {
    if (lock.current || !authorized) return;
    const title = (part ? chapter?.title : work.title)?.trim();
    if (!title) { setMessage('Lütfen bir başlık yaz.'); return; }
    if (!part && work.cover_url && !/^https:\/\//i.test(work.cover_url)) { setMessage('Kapak için geçerli bir HTTPS görsel adresi kullan.'); return; }
    lock.current = true; setBusy(true); setMessage('Kaydediliyor…');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw Error('Oturumun sona erdi.');
      if (part && chapter && work.id) {
        const payload = { work_id: work.id, title, content: chapter.content ?? '', position: chapter.position ?? 1, status };
        const result = chapter.id ? await supabase.from('work_chapters').update(payload).eq('id', chapter.id).select().single() : await supabase.from('work_chapters').insert(payload).select().single();
        if (result.error) throw result.error;
        setChapters(current => [...current.filter(item => item.id !== result.data.id), result.data].sort((a,b) => a.position-b.position));
        setChapter(current => current === chapter ? result.data : current ? { ...current, id: result.data.id, status: result.data.status } : current);
      } else {
        const payload = { author_id: auth.user.id, title, description: work.description, cover_url: work.cover_url || null, genre: work.genre, tags: work.tags, status };
        const result = work.id ? await supabase.from('works').update(payload).eq('id', work.id).eq('author_id', auth.user.id).select().single() : await supabase.from('works').insert(payload).select().single();
        if (result.error) throw result.error;
        setWork(current => current === work ? result.data : { ...current, id: result.data.id, author_id: result.data.author_id, status: result.data.status });
      }
      setMessage(status === 'published' ? 'Yayınlandı.' : 'Taslak kaydedildi.');
    } catch { setMessage('Kaydedilemedi. Oturumunu ve bağlantını kontrol et. Bölüm sırası başka bir bölümle aynı olmamalı. Metnin bu ekranda korunuyor.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <ReaderScreen title="Eser editörü">{loading ? <Busy /> : <>
    {!!message && <Text accessibilityLiveRegion="polite" style={ui.muted}>{message}</Text>}
    {!!localStatus && <Text style={ui.muted}>{localStatus}</Text>}
    {backup && <View style={ui.card}><Text style={ui.text}>Bu cihazda bir yazı taslağı bulundu.</Text><Action label="Cihaz taslağından devam et" onPress={() => { setWork(backup.work); setChapter(backup.chapter); setBackup(null); }} /><Action label="Açılan sürümle devam et" onPress={() => setBackup(null)} /></View>}
    {authorized && <><Field label="Kitap adı" maxLength={160} value={work.title} onChangeText={title => setWork(w => ({ ...w, title }))} />
    <Field label="Açıklama" multiline value={work.description} onChangeText={description => setWork(w => ({ ...w, description }))} />
    <Field label="Kapak görseli (HTTPS adresi)" autoCapitalize="none" value={work.cover_url ?? ''} onChangeText={cover_url => setWork(w => ({ ...w, cover_url }))} />
    <Field label="Tür" value={work.genre} onChangeText={genre => setWork(w => ({ ...w, genre }))} />
    <Field label="Etiketler (virgülle ayır)" value={work.tags?.join(',')} onChangeText={tags => setWork(w => ({ ...w, tags: tags.split(',') }))} />
    <View style={ui.row}><Action disabled={busy} label="Taslak kaydet" onPress={() => void save('draft')} /><Action disabled={busy} label="Yayınla" onPress={() => void save('published')} /></View>
    {work.id && <><Action label="Okuma sayfası" onPress={() => router.push({ pathname: '/work', params: { id: work.id! } })} /><Text style={ui.title}>Bölümler</Text>
    {chapters.map(item => <Action key={item.id} label={`${item.position}. ${item.title} · ${item.status === 'draft' ? 'Taslak' : 'Yayında'}`} onPress={() => setChapter(item)} />)}
    <Action label="Bölüm ekle" onPress={() => setChapter({ title: '', content: '', position: Math.max(0, ...chapters.map(c => c.position)) + 1, status: 'draft' })} />
    {chapter && <View style={ui.card}><Field label="Bölüm başlığı" maxLength={160} value={chapter.title} onChangeText={title => setChapter(c => ({ ...c, title }))} /><Field label="Bölüm sırası" keyboardType="number-pad" value={String(chapter.position ?? 1)} onChangeText={position => setChapter(c => ({ ...c, position: Math.max(1, Number(position) || 1) }))} />
    <Field label="Bölüm metni" multiline value={chapter.content} onChangeText={content => setChapter(c => ({ ...c, content }))} style={{ minHeight: 300 }} />
    <Text style={ui.muted}>Değişikliklerini bölümden ayrılmadan önce kaydet.</Text>
    <View style={ui.row}><Action disabled={busy} label="Bölümü taslak kaydet" onPress={() => void save('draft', true)} /><Action disabled={busy} label="Bölümü yayınla" onPress={() => void save('published', true)} /></View></View>}</>}
    </>}
  </>}</ReaderScreen>;
}
