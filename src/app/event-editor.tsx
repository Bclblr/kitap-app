import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Action, Field, ReaderScreen, useReaderStyles } from '@/components/ReaderUI';
import { supabase } from '@/lib/supabase';
import { getRuntimeControls, hasActiveRestriction, settingBoolean } from '@/lib/runtime-controls';
import { requirePermanentImage } from '@/lib/image-policy';

export default function EventEditorScreen() {
  const router = useRouter();
  const ui = useReaderStyles();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '', location: '', image_url: '' });

  async function save() {
    if (lock.current || busy) return;
    const title = form.title.trim(); const date = form.date.trim(); const time = form.time.trim();
    if (!title) { setError('Etkinlik adı gerekli.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Tarihi YYYY-AA-GG biçiminde yaz. Örnek: 2026-09-20'); return; }
    if (!/^\d{2}:\d{2}$/.test(time)) { setError('Saati SS:DD biçiminde yaz. Örnek: 19:30'); return; }
    const eventDate = new Date(`${date}T${time}:00`);
    if (Number.isNaN(eventDate.getTime())) { setError('Geçerli bir tarih ve saat gir.'); return; }
    if (eventDate.getTime() <= Date.now()) { setError('Etkinlik tarihi gelecekte olmalı.'); return; }
    if (form.image_url.trim() && !/^https:\/\//i.test(form.image_url.trim())) { setError('Görsel için HTTPS adresi kullan.'); return; }

    lock.current = true; setBusy(true); setError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Etkinlik oluşturmak için giriş yapmalısın.');
      const controls = await getRuntimeControls();
      if (hasActiveRestriction(controls,'ban','suspension','community_restriction')) throw new Error('Etkinlik oluşturma hesabın için kısıtlandı.');
      if (!settingBoolean(controls,'event_creation_enabled',true)) throw new Error('Yeni etkinlik oluşturma geçici olarak kapalı.');

      const { data, error: insertError } = await supabase.from('events').insert({
        title,
        description: form.description.trim() || null,
        event_date: eventDate.toISOString(),
        location: form.location.trim() || null,
        image_url: requirePermanentImage(form.image_url.trim()),
        created_by: user.id,
      }).select('id').single();
      if (insertError) throw insertError;
      router.replace({ pathname: '/event', params: { id: data.id } });
    } catch (e) {
      console.error('Event create error:', e);
      setError(e instanceof Error && e.message ? e.message : 'Etkinlik kaydedilemedi. Bağlantını ve yetkilerini kontrol et.');
    } finally { lock.current = false; setBusy(false); }
  }

  return <ReaderScreen title="Etkinlik oluştur">
    {!!error && <Text style={ui.error}>{error}</Text>}
    <Field label="Etkinlik adı" maxLength={120} value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} />
    <Field label="Açıklama" multiline value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} />
    <Field label="Tarih (YYYY-AA-GG)" placeholder="2026-09-20" value={form.date} onChangeText={(date) => setForm((current) => ({ ...current, date }))} />
    <Field label="Saat (SS:DD)" placeholder="19:30" value={form.time} onChangeText={(time) => setForm((current) => ({ ...current, time }))} />
    <Field label="Konum" placeholder="Kadıköy, İstanbul veya Online" value={form.location} onChangeText={(location) => setForm((current) => ({ ...current, location }))} />
    <Field label="Etkinlik görseli (HTTPS adresi, isteğe bağlı)" value={form.image_url} onChangeText={(image_url) => setForm((current) => ({ ...current, image_url }))} />
    <Action disabled={busy || !form.title.trim() || !form.date.trim() || !form.time.trim()} label={busy ? 'Oluşturuluyor…' : 'Etkinliği oluştur'} onPress={() => void save()} />
  </ReaderScreen>;
}
