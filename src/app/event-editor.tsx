import Image from '@/components/SafeImage';
import { Action, Field, ReaderScreen, useReaderStyles } from '@/components/ReaderUI';
import { requirePermanentImage } from '@/lib/image-policy';
import { getRuntimeControls, hasActiveRestriction, settingBoolean } from '@/lib/runtime-controls';
import { supabase } from '@/lib/supabase';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type PickerMode = 'date' | 'time' | null;

function createInitialEventDate() {
  const value = new Date(Date.now() + 24 * 60 * 60 * 1000);
  value.setHours(19, 0, 0, 0);
  return value;
}

export default function EventEditorScreen() {
  const router = useRouter();
  const ui = useReaderStyles();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState('');
  const [eventDate, setEventDate] = useState(createInitialEventDate);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [form, setForm] = useState({ title: '', description: '', location: '', image_url: '' });

  async function pickEventImage() {
    if (imageUploading || busy) return;
    setError('');

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Etkinlik görseli seçmek için galeri izni gerekli.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Görsel yüklemek için giriş yapmalısın.');

      const mime = asset.mimeType ?? 'image/jpeg';
      const ext = ({
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      } as Record<string, string>)[mime];

      if (!ext) throw new Error('Lütfen JPEG, PNG veya WebP görsel seç.');

      setImageUploading(true);
      const bytes = await (await fetch(asset.uri)).arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) {
        throw new Error('Etkinlik görseli 10 MB’dan küçük olmalı.');
      }

      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const upload = await supabase.storage.from('event-images').upload(path, bytes, {
        contentType: mime,
        upsert: false,
      });
      if (upload.error) throw new Error('Etkinlik görseli yüklenemedi. Lütfen yeniden dene.');

      const publicUrl = supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;
      const authenticatedUrl = publicUrl.replace('/object/public/', '/object/authenticated/');
      setForm((current) => ({ ...current, image_url: requirePermanentImage(authenticatedUrl) ?? '' }));
    } catch (e) {
      console.error('Event image upload error:', e);
      setError(e instanceof Error && e.message ? e.message : 'Etkinlik görseli yüklenemedi.');
    } finally {
      setImageUploading(false);
    }
  }

  function updatePickedDate(mode: Exclude<PickerMode, null>, selectedDate: Date) {
    setEventDate((current) => {
      const next = new Date(current);
      if (mode === 'date') {
        next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      } else {
        next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      }
      return next;
    });

    if (Platform.OS === 'android') setPickerMode(null);
  }

  async function save() {
    if (lock.current || busy || imageUploading) return;
    const title = form.title.trim();
    if (!title) { setError('Etkinlik adı gerekli.'); return; }
    if (Number.isNaN(eventDate.getTime())) { setError('Geçerli bir tarih ve saat seç.'); return; }
    if (eventDate.getTime() <= Date.now()) { setError('Etkinlik tarihi gelecekte olmalı.'); return; }

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
        image_url: requirePermanentImage(form.image_url),
        created_by: user.id,
      }).select('id').single();
      if (insertError) throw insertError;
      router.replace({ pathname: '/event', params: { id: data.id } });
    } catch (e) {
      console.error('Event create error:', e);
      setError(e instanceof Error && e.message ? e.message : 'Etkinlik kaydedilemedi. Bağlantını ve yetkilerini kontrol et.');
    } finally { lock.current = false; setBusy(false); }
  }

  const dateLabel = eventDate.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = eventDate.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return <ReaderScreen title="Etkinlik oluştur">
    {!!error && <Text style={ui.error}>{error}</Text>}
    <Field label="Etkinlik adı" maxLength={120} value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} />
    <Field label="Açıklama" multiline value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} />

    <View style={styles.dateTimeSection}>
      <Text style={styles.inputLabel}>Tarih ve saat</Text>
      <View style={styles.dateTimeRow}>
        <Pressable
          disabled={busy}
          onPress={() => setPickerMode((current) => current === 'date' ? null : 'date')}
          style={[styles.dateTimeButton, busy && styles.controlDisabled]}
          accessibilityRole="button"
          accessibilityLabel={`Etkinlik tarihini seç. Seçili tarih ${dateLabel}`}
        >
          <Text style={styles.dateTimeCaption}>Tarih</Text>
          <Text style={styles.dateTimeValue}>{dateLabel}</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => setPickerMode((current) => current === 'time' ? null : 'time')}
          style={[styles.dateTimeButton, busy && styles.controlDisabled]}
          accessibilityRole="button"
          accessibilityLabel={`Etkinlik saatini seç. Seçili saat ${timeLabel}`}
        >
          <Text style={styles.dateTimeCaption}>Saat</Text>
          <Text style={styles.dateTimeValue}>{timeLabel}</Text>
        </Pressable>
      </View>

      {pickerMode && Platform.OS !== 'web' ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={eventDate}
            mode={pickerMode}
            minimumDate={pickerMode === 'date' ? new Date() : undefined}
            is24Hour
            locale="tr_TR"
            presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            onValueChange={(_event, selectedDate) => updatePickedDate(pickerMode, selectedDate)}
            onDismiss={() => setPickerMode(null)}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setPickerMode(null)} style={styles.pickerDoneButton}>
              <Text style={styles.pickerDoneText}>Tamam</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {pickerMode && Platform.OS === 'web' ? (
        <Text style={styles.webNotice}>Tarih ve saat seçimi mobil uygulamada sistem seçicisiyle yapılır.</Text>
      ) : null}
    </View>

    <Field label="Konum" placeholder="Kadıköy, İstanbul veya Online" value={form.location} onChangeText={(location) => setForm((current) => ({ ...current, location }))} />

    <View style={styles.imageSection}>
      <Text style={styles.inputLabel}>Etkinlik görseli</Text>
      {form.image_url ? (
        <Image source={{ uri: form.image_url }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Henüz görsel seçilmedi.</Text>
        </View>
      )}
      <Pressable
        disabled={busy || imageUploading}
        onPress={() => void pickEventImage()}
        style={[styles.imageButton, (busy || imageUploading) && styles.controlDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Galeriden etkinlik görseli seç"
      >
        <Text style={styles.imageButtonText}>
          {imageUploading ? 'Görsel yükleniyor…' : form.image_url ? 'Görseli Değiştir' : 'Galeriden Görsel Seç'}
        </Text>
      </Pressable>
      {form.image_url ? (
        <Pressable
          disabled={busy || imageUploading}
          onPress={() => setForm((current) => ({ ...current, image_url: '' }))}
          style={styles.removeImageButton}
        >
          <Text style={styles.removeImageText}>Görseli kaldır</Text>
        </Pressable>
      ) : null}
    </View>

    <Action disabled={busy || imageUploading || !form.title.trim()} label={busy ? 'Oluşturuluyor…' : 'Etkinliği oluştur'} onPress={() => void save()} />
  </ReaderScreen>;
}

const styles = StyleSheet.create({
  inputLabel: { color: '#DADAE0', fontSize: 13, fontWeight: '700' },
  dateTimeSection: { gap: 10, marginBottom: 14 },
  dateTimeRow: { flexDirection: 'row', gap: 10 },
  dateTimeButton: { flex: 1, minHeight: 66, borderRadius: 14, borderWidth: 1, borderColor: '#2D2E37', backgroundColor: '#111218', justifyContent: 'center', paddingHorizontal: 14 },
  dateTimeCaption: { color: '#8E8F98', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  dateTimeValue: { color: '#F5F5F7', fontSize: 14, fontWeight: '800' },
  pickerWrap: { borderRadius: 16, borderWidth: 1, borderColor: '#2D2E37', backgroundColor: '#111218', padding: 10, overflow: 'hidden' },
  pickerDoneButton: { alignSelf: 'flex-end', minHeight: 38, justifyContent: 'center', paddingHorizontal: 14 },
  pickerDoneText: { color: '#B58AF6', fontSize: 13, fontWeight: '900' },
  webNotice: { color: '#8E8F98', fontSize: 12, lineHeight: 18 },
  imageSection: { gap: 10, marginBottom: 14 },
  preview: { width: '100%', height: 180, borderRadius: 16, backgroundColor: '#17181F' },
  placeholder: { height: 110, borderRadius: 16, borderWidth: 1, borderColor: '#2D2E37', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center', padding: 18 },
  placeholderText: { color: '#8E8F98', fontSize: 13 },
  imageButton: { minHeight: 46, borderRadius: 13, backgroundColor: '#8058D9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  controlDisabled: { opacity: 0.5 },
  imageButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  removeImageButton: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  removeImageText: { color: '#D88A8A', fontSize: 12, fontWeight: '700' },
});
