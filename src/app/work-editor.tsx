import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Modal, Platform, ScrollView, Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import { pickWorkCover } from '@/lib/upload-cover';
import { requirePermanentImage } from '@/lib/image-policy';
import { Action, Busy, Field, ReaderScreen, useReaderStyles } from '@/components/ReaderUI';
import { supabase } from '@/lib/supabase';
import { Chapter, Work } from '@/lib/works';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function WorkEditor() {
  const ui = useReaderStyles();
  const { id, addChapter } = useLocalSearchParams<{ id?: string; addChapter?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
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
  const [savedWork, setSavedWork] = useState(JSON.stringify(work));
  const [savedChapter, setSavedChapter] = useState('null');
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null);
  const [preview, setPreview] = useState(false);
  const dirty = authorized && (JSON.stringify(work) !== savedWork || JSON.stringify(chapter) !== savedChapter);
  usePreventRemove(dirty, ({ data }) => setPendingExit(() => () => navigation.dispatch(data.action)));
  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function selectChapter(next: Partial<Chapter>) {
    const select = () => { setChapter(next); setSavedChapter(JSON.stringify(next)); };
    if (JSON.stringify(chapter) !== savedChapter) setPendingExit(() => select); else select();
  }
  async function chooseCover() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { const url = await pickWorkCover(); if (url) setWork(current => ({ ...current, cover_url: url })); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Kapak yüklenemedi.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function moveChapter(first: Chapter, second: Chapter) {
    if (lock.current || JSON.stringify(chapter) !== savedChapter) return;
    lock.current = true; setBusy(true);
    try {
      const result = await supabase.rpc('swap_work_chapters', { first_id: first.id, second_id: second.id });
      if (result.error) throw result.error;
      const ordered = result.data as Chapter[]; setChapters(ordered);
      const selected = ordered.find(item => item.id === chapter?.id);
      if (selected) { setChapter(selected); setSavedChapter(JSON.stringify(selected)); }
      setMessage('Bölüm sırası kaydedildi.');
    } catch { setMessage('Sıra değiştirilemedi. Bölümleri yeniden açıp tekrar deneyebilirsin.'); }
    finally { lock.current = false; setBusy(false); }
  }
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
          if (alive) {
            setWork(result.data);
            setSavedWork(JSON.stringify(result.data));
            setChapters(parts.data ?? []);
            if (addChapter === '1') {
              const nextChapter = {
                title: '',
                content: '',
                position: Math.max(0, ...(parts.data ?? []).map((item) => item.position)) + 1,
                status: 'draft',
              } as Partial<Chapter>;
              setChapter(nextChapter);
              setSavedChapter(JSON.stringify(nextChapter));
            }
          }
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
  }, [id, addChapter]);
  useEffect(() => {
    if (!draftKey || !authorized || backup || busy) return;
    let alive = true;
    const timer = setTimeout(() => {
      setLocalStatus('Cihaz taslağı kaydediliyor…');
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
        setSavedChapter(JSON.stringify(result.data));
        setChapters(current => [...current.filter(item => item.id !== result.data.id), result.data].sort((a,b) => a.position-b.position));
        setChapter(current => current === chapter ? result.data : current ? { ...current, id: result.data.id, status: result.data.status } : current);
      } else {
        const payload = { author_id: auth.user.id, title, description: work.description, cover_url: requirePermanentImage(work.cover_url), genre: work.genre, tags: work.tags?.map(tag => tag.trim()).filter(Boolean), language: work.language || 'tr', audience: work.audience || 'general', completed: work.completed ?? false, status };
        const result = work.id ? await supabase.from('works').update(payload).eq('id', work.id).eq('author_id', auth.user.id).select().single() : await supabase.from('works').insert(payload).select().single();
        if (result.error) throw result.error;
        setSavedWork(JSON.stringify(result.data));
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
    {work.cover_url && <Image accessibilityLabel="Eser kapağı" source={{ uri: work.cover_url }} resizeMode="contain" style={{ width: '100%', height: 240 }} />}
    <View style={ui.row}><Action disabled={busy} label={work.cover_url ? 'Kapağı değiştir' : 'Galeriden kapak seç'} onPress={() => void chooseCover()} />{work.cover_url && <Action disabled={busy} label="Kapağı kaldır" onPress={() => setWork(w => ({ ...w, cover_url: null }))} />}</View>
    <Field label="Tür" value={work.genre} onChangeText={genre => setWork(w => ({ ...w, genre }))} />
    <Field label="Etiketler (virgülle ayır)" value={work.tags?.join(',')} onChangeText={tags => setWork(w => ({ ...w, tags: tags.split(',') }))} />
    <Field label="Dil (ör. tr, en)" maxLength={20} autoCapitalize="none" value={work.language ?? 'tr'} onChangeText={language => setWork(w => ({ ...w, language }))} />
    <Text style={ui.muted}>İçerik sınıflaması</Text><View style={ui.row}>{[['general','Genel'],['teen','Genç'],['mature','Yetişkin']].map(([value,label]) => <Action key={value} label={`${(work.audience ?? 'general') === value ? '✓ ' : ''}${label}`} onPress={() => setWork(w => ({ ...w, audience: value }))} />)}</View>
    <Action label={work.completed ? '✓ Tamamlandı' : 'Devam ediyor'} onPress={() => setWork(w => ({ ...w, completed: !w.completed }))} />
    <View style={ui.row}><Action disabled={busy} label="Taslak kaydet" onPress={() => void save('draft')} /><Action disabled={busy} label="Yayınla" onPress={() => void save('published')} /></View>
    {work.id && <>
    <View style={ui.card}>
      <Text style={ui.title}>Eser Yönetimi</Text>
      <Text style={ui.muted}>Kitap bilgilerini düzenleyebilir, yeni bölüm ekleyebilir ve mevcut bölümleri yönetebilirsin.</Text>
      <View style={ui.row}>
        <Action label="Okuma sayfası" onPress={() => router.push({ pathname: '/work', params: { id: work.id! } })} />
        <Action label="Yeni Bölüm Ekle" onPress={() => selectChapter({ title: '', content: '', position: Math.max(0, ...chapters.map(c => c.position)) + 1, status: 'draft' })} />
      </View>
    </View>
    <Text style={ui.title}>Bölümler</Text>
    {chapters.map((item,index) => <View key={item.id} style={ui.card}><Action label={`${item.position}. ${item.title} · ${item.status === 'draft' ? 'Taslak' : 'Yayında'}`} onPress={() => selectChapter(item)} /><View style={ui.row}><Action label="Yukarı taşı" disabled={busy || index === 0 || JSON.stringify(chapter) !== savedChapter} onPress={() => void moveChapter(item,chapters[index-1])} /><Action label="Aşağı taşı" disabled={busy || index === chapters.length-1 || JSON.stringify(chapter) !== savedChapter} onPress={() => void moveChapter(item,chapters[index+1])} /></View></View>)}
    <Action label="Yeni Bölüm Ekle" onPress={() => selectChapter({ title: '', content: '', position: Math.max(0, ...chapters.map(c => c.position)) + 1, status: 'draft' })} />
    {chapter && <View style={ui.card}><Field label="Bölüm başlığı" maxLength={160} value={chapter.title} onChangeText={title => setChapter(c => ({ ...c, title }))} /><Field label="Bölüm sırası" keyboardType="number-pad" value={String(chapter.position ?? 1)} onChangeText={position => setChapter(c => ({ ...c, position: Math.max(1, Number(position) || 1) }))} />
    <Field label="Bölüm metni" multiline value={chapter.content} onChangeText={content => setChapter(c => ({ ...c, content }))} style={{ minHeight: 300 }} />
    <Text style={ui.muted}>{chapter.content?.trim().split(/\s+/u).filter(Boolean).length ?? 0} kelime · {Array.from(chapter.content ?? '').length} karakter</Text>
    <Action label="Önizle" onPress={() => setPreview(true)} />
    <Text style={ui.muted}>Değişikliklerini bölümden ayrılmadan önce kaydet.</Text>
    <View style={ui.row}><Action disabled={busy} label="Bölümü taslak kaydet" onPress={() => void save('draft', true)} /><Action disabled={busy} label="Bölümü yayınla" onPress={() => void save('published', true)} /></View></View>}</>}
    </>}
  </>}
    <Modal visible={preview} animationType="slide" onRequestClose={() => setPreview(false)}><ReaderScreen fullSafeArea title="Bölüm önizlemesi" onBack={() => setPreview(false)}><Text style={ui.title}>{chapter?.title}</Text><Text selectable style={[ui.text, { fontSize: 19, lineHeight: 31 }]}>{chapter?.content || 'Henüz metin yok.'}</Text></ReaderScreen></Modal>
    <Modal transparent visible={!!pendingExit} animationType="fade" onRequestClose={() => setPendingExit(null)}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.65)', justifyContent: 'center', padding: 20 }}><ScrollView style={{ flexGrow: 0 }} contentContainerStyle={ui.card}><Text style={ui.title}>Kaydedilmemiş değişiklikler</Text><Text style={ui.text}>Değişiklikler henüz sunucuya kaydedilmedi. Kaydetmek için editöre dönebilirsin.</Text><Action label="Yazmaya devam et" onPress={() => setPendingExit(null)} /><Action label="Kaydetmeden devam et" onPress={() => { const action = pendingExit; setPendingExit(null); action?.(); }} /></ScrollView></View></Modal>
  </ReaderScreen>;
}
