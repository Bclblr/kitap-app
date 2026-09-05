import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Action, Busy, Field, ReaderScreen, ui } from '@/components/ReaderUI';
import { supabase } from '@/lib/supabase';
export default function CommunityEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const router = useRouter(); const lock = useRef(false);
  const [form, setForm] = useState({ name: '', description: '', image_url: '', kind: 'community', visibility: 'public', rules: '', tags: [] as string[], current_book: '' });
  const [ready, setReady] = useState(false); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let alive = true; async function load() { try {
    const auth = await supabase.auth.getUser(); if (!auth.data.user) throw Error('Topluluk oluşturmak için giriş yapmalısın.');
    if (id) {
      const permission = await supabase.rpc('community_admin', { cid: id });
      if (permission.error || !permission.data) throw Error('Bu topluluğu düzenleme yetkin yok.');
      const result = await supabase.from('communities').select('name,description,image_url,kind,visibility,rules,tags,current_book').eq('id', id).single();
      if (result.error) throw Error('Topluluk yüklenemedi.');
      if (alive) setForm({ ...result.data, description: result.data.description ?? '', image_url: result.data.image_url ?? '', current_book: result.data.current_book ?? '' });
    }
    if (alive) setReady(true);
  } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.'); } finally { if (alive) setLoading(false); } } void load(); return () => { alive = false; }; }, [id]);
  async function save() {
    if (lock.current || !ready || !form.name.trim()) return;
    if (form.image_url && !/^https:\/\//i.test(form.image_url)) { setError('Görsel için bir HTTPS adresi kullan.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const auth = await supabase.auth.getUser(); if (!auth.data.user) throw Error();
      const payload = { ...form, name: form.name.trim(), image_url: form.image_url || null, tags: form.tags.map(tag => tag.trim()).filter(Boolean) };
      const result = id ? await supabase.from('communities').update(payload).eq('id', id).select('id').single() : await supabase.from('communities').insert({ ...payload, created_by: auth.data.user.id }).select('id').single();
      if (result.error) throw result.error;
      router.replace({ pathname: '/community', params: { id: result.data.id } });
    } catch { setError('Topluluk kaydedilemedi. Bağlantını ve yetkilerini kontrol et.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <ReaderScreen title={id ? 'Topluluğu düzenle' : 'Topluluk oluştur'}>{loading ? <Busy /> : <>
    {!!error && <Text style={ui.error}>{error}</Text>}{ready && <>
    <Field label="İsim" maxLength={100} value={form.name} onChangeText={name => setForm(f => ({ ...f, name }))} /><Field label="Açıklama" multiline value={form.description} onChangeText={description => setForm(f => ({ ...f, description }))} />
    <Field label="Kapak / profil görseli (HTTPS adresi)" value={form.image_url} onChangeText={image_url => setForm(f => ({ ...f, image_url }))} />
    <View style={ui.row}>{[['community','Genel Topluluk'],['book_club','Kitap Kulübü']].map(([kind,label]) => <Action key={kind} label={`${form.kind === kind ? '✓ ' : ''}${label}`} onPress={() => setForm(f => ({ ...f, kind }))} />)}</View>
    <View style={ui.row}>{[['public','Açık'],['private','Özel']].map(([visibility,label]) => <Action key={visibility} label={`${form.visibility === visibility ? '✓ ' : ''}${label}`} onPress={() => setForm(f => ({ ...f, visibility }))} />)}</View>
    {form.visibility === 'private' && <Text style={ui.muted}>Özel topluluğa yalnızca mevcut üyeler erişebilir. Bu sürümde davet akışı bulunmuyor.</Text>}
    <Field label="Kurallar" multiline value={form.rules} onChangeText={rules => setForm(f => ({ ...f, rules }))} /><Field label="Etiketler (virgülle ayır)" value={form.tags.join(',')} onChangeText={tags => setForm(f => ({ ...f, tags: tags.split(',') }))} />
    {form.kind === 'book_club' && <Field label="Şu an okunan kitap (isteğe bağlı)" value={form.current_book} onChangeText={current_book => setForm(f => ({ ...f, current_book }))} />}
    <Action disabled={busy || !form.name.trim()} label={busy ? 'Kaydediliyor…' : 'Kaydet'} onPress={() => void save()} /></>}
  </>}</ReaderScreen>;
}
