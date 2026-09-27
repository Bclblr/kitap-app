import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Image from '@/components/SafeImage';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { getRuntimeControls, hasActiveRestriction, settingBoolean } from '@/lib/runtime-controls';
import { requirePermanentImage } from '@/lib/image-policy';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type CommunityForm = {
  name: string;
  description: string;
  image_url: string;
  kind: string;
  visibility: string;
  rules: string;
  tags: string[];
  current_book: string;
};

const EMPTY_FORM: CommunityForm = {
  name: '',
  description: '',
  image_url: '',
  kind: 'community',
  visibility: 'public',
  rules: '',
  tags: [],
  current_book: '',
};

export default function CommunityEditor() {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const lock = useRef(false);
  const [form, setForm] = useState<CommunityForm>(EMPTY_FORM);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const auth = await supabase.auth.getUser();
        if (!auth.data.user) throw Error('Topluluk oluşturmak için giriş yapmalısın.');

        const controls = await getRuntimeControls();
        if (hasActiveRestriction(controls, 'ban', 'suspension', 'community_restriction')) {
          throw Error('Topluluk işlemleri hesabın için kısıtlandı.');
        }
        if (!id && !settingBoolean(controls, 'community_creation_enabled', true)) {
          throw Error('Yeni topluluk oluşturma geçici olarak kapalı.');
        }

        if (id) {
          const permission = await supabase.rpc('community_admin', { cid: id });
          if (permission.error || !permission.data) throw Error('Bu topluluğu düzenleme yetkin yok.');
          const result = await supabase
            .from('communities')
            .select('name,description,image_url,kind,visibility,rules,tags,current_book')
            .eq('id', id)
            .single();
          if (result.error) throw Error('Topluluk yüklenemedi.');
          if (alive) {
            setForm({
              ...result.data,
              description: result.data.description ?? '',
              image_url: result.data.image_url ?? '',
              current_book: result.data.current_book ?? '',
              tags: result.data.tags ?? [],
            });
          }
        }
        if (alive) setReady(true);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [id]);

  async function save() {
    if (lock.current || !ready || !form.name.trim()) return;
    if (form.image_url && !/^https:\/\//i.test(form.image_url)) {
      setError('Görsel için bir HTTPS adresi kullan.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const auth = await supabase.auth.getUser();
      if (!auth.data.user) throw Error();

      const controls = await getRuntimeControls();
      if (hasActiveRestriction(controls, 'ban', 'suspension', 'community_restriction')) {
        throw Error('Topluluk işlemleri hesabın için kısıtlandı.');
      }
      if (!id && !settingBoolean(controls, 'community_creation_enabled', true)) {
        throw Error('Yeni topluluk oluşturma geçici olarak kapalı.');
      }

      const payload = {
        ...form,
        name: form.name.trim(),
        image_url: requirePermanentImage(form.image_url),
        tags: form.tags.map((tag) => tag.trim()).filter(Boolean),
      };

      const result = id
        ? await supabase.from('communities').update(payload).eq('id', id).select('id').single()
        : await supabase
            .from('communities')
            .insert({ ...payload, created_by: auth.data.user.id })
            .select('id')
            .single();

      if (result.error) throw result.error;
      router.replace({ pathname: '/community', params: { id: result.data.id } });
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Topluluk kaydedilemedi. Bağlantını ve yetkilerini kontrol et.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function goBack() {
    if (router.canGoBack()) safeBack(router, '/explore');
    else router.replace('/explore');
  }

  const initial = form.name.trim().charAt(0).toLocaleUpperCase('tr-TR') || 'T';

  if (loading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.headerButton} accessibilityLabel="Geri dön">
          <Feather name="chevron-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{id ? 'TOPLULUK AYARLARI' : 'YENİ TOPLULUK'}</Text>
          <Text style={styles.headerTitle}>{id ? 'Topluluğu Düzenle' : 'Topluluk Oluştur'}</Text>
        </View>
        <Pressable
          disabled={busy || !ready || !form.name.trim()}
          onPress={() => void save()}
          style={[styles.saveTop, (busy || !ready || !form.name.trim()) && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveTopText}>{id ? 'Kaydet' : 'Oluştur'}</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!!error && (
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={18} color="#FF8795" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {ready ? (
          <>
            <View style={styles.previewCard}>
              {form.image_url ? (
                <Image source={{ uri: form.image_url }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewFallback}>
                  <Text style={styles.previewInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.previewShade} />
              <View style={styles.previewCopy}>
                <View style={styles.previewBadge}>
                  <Feather name={form.kind === 'book_club' ? 'book-open' : 'users'} size={12} color="#E7DBFF" />
                  <Text style={styles.previewBadgeText}>
                    {form.kind === 'book_club' ? 'Kitap Kulübü' : 'Topluluk'}
                  </Text>
                </View>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {form.name.trim() || 'Topluluğunun adı'}
                </Text>
                <Text style={styles.previewDescription} numberOfLines={2}>
                  {form.description.trim() || 'İnsanların neden bu topluluğa katılması gerektiğini kısaca anlat.'}
                </Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Feather name="edit-3" size={17} color={colors.primary} /></View>
                <View>
                  <Text style={styles.sectionTitle}>Temel bilgiler</Text>
                  <Text style={styles.sectionSubtitle}>Topluluğunun kimliğini oluştur.</Text>
                </View>
              </View>

              <Text style={styles.label}>Topluluk adı</Text>
              <TextInput
                value={form.name}
                onChangeText={(name) => setForm((current) => ({ ...current, name }))}
                maxLength={100}
                placeholder="Örn. Modern Roman Okurları"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>Açıklama</Text>
              <TextInput
                value={form.description}
                onChangeText={(description) => setForm((current) => ({ ...current, description }))}
                placeholder="Topluluğun amacını ve kimler için olduğunu anlat..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                style={[styles.input, styles.textarea]}
              />
              <Text style={styles.counter}>{form.description.length}/500</Text>

              <Text style={styles.label}>Kapak / profil görseli</Text>
              <View style={styles.iconInput}>
                <Feather name="image" size={17} color={colors.textMuted} />
                <TextInput
                  value={form.image_url}
                  onChangeText={(image_url) => setForm((current) => ({ ...current, image_url }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.iconInputField}
                />
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Feather name="sliders" size={17} color={colors.primary} /></View>
                <View>
                  <Text style={styles.sectionTitle}>Topluluk yapısı</Text>
                  <Text style={styles.sectionSubtitle}>Türünü ve görünürlüğünü belirle.</Text>
                </View>
              </View>

              <Text style={styles.label}>Tür</Text>
              <View style={styles.choiceRow}>
                {[
                  { value: 'community', label: 'Genel', icon: 'users' as const },
                  { value: 'book_club', label: 'Kitap Kulübü', icon: 'book-open' as const },
                ].map((item) => {
                  const selected = form.kind === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setForm((current) => ({ ...current, kind: item.value }))}
                      style={[styles.choice, selected && styles.choiceSelected]}
                    >
                      <Feather name={item.icon} size={18} color={selected ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{item.label}</Text>
                      {selected ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Görünürlük</Text>
              <View style={styles.choiceRow}>
                {[
                  { value: 'public', label: 'Açık', icon: 'globe' as const },
                  { value: 'private', label: 'Özel', icon: 'lock' as const },
                ].map((item) => {
                  const selected = form.visibility === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setForm((current) => ({ ...current, visibility: item.value }))}
                      style={[styles.choice, selected && styles.choiceSelected]}
                    >
                      <Feather name={item.icon} size={18} color={selected ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{item.label}</Text>
                      {selected ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              {form.visibility === 'private' ? (
                <View style={styles.infoBox}>
                  <Feather name="info" size={16} color={colors.primary} />
                  <Text style={styles.infoText}>Özel topluluğa yalnızca mevcut üyeler erişebilir.</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Feather name="shield" size={17} color={colors.primary} /></View>
                <View>
                  <Text style={styles.sectionTitle}>İçerik ve düzen</Text>
                  <Text style={styles.sectionSubtitle}>Kurallar ve keşfedilebilirlik ayarları.</Text>
                </View>
              </View>

              <Text style={styles.label}>Topluluk kuralları</Text>
              <TextInput
                value={form.rules}
                onChangeText={(rules) => setForm((current) => ({ ...current, rules }))}
                placeholder="Üyelerin uymasını istediğin temel kuralları yaz..."
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.input, styles.textarea]}
              />

              <Text style={styles.label}>Etiketler</Text>
              <TextInput
                value={form.tags.join(', ')}
                onChangeText={(tags) =>
                  setForm((current) => ({ ...current, tags: tags.split(',').map((tag) => tag.trimStart()) }))
                }
                placeholder="roman, tarih, bilim kurgu"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <Text style={styles.helper}>Etiketleri virgülle ayır. Keşfet bölümünde bulunmayı kolaylaştırır.</Text>

              {form.kind === 'book_club' ? (
                <>
                  <Text style={styles.label}>Şu an okunan kitap</Text>
                  <View style={styles.iconInput}>
                    <Feather name="book" size={17} color={colors.textMuted} />
                    <TextInput
                      value={form.current_book}
                      onChangeText={(current_book) => setForm((current) => ({ ...current, current_book }))}
                      placeholder="İsteğe bağlı"
                      placeholderTextColor={colors.textMuted}
                      style={styles.iconInputField}
                    />
                  </View>
                </>
              ) : null}
            </View>

            <Pressable
              disabled={busy || !form.name.trim()}
              onPress={() => void save()}
              style={[styles.primaryButton, (busy || !form.name.trim()) && styles.disabled]}
            >
              {busy ? <ActivityIndicator color="#FFF" /> : <Feather name={id ? 'check' : 'users'} size={19} color="#FFF" />}
              <Text style={styles.primaryButtonText}>{id ? 'Değişiklikleri Kaydet' : 'Topluluğu Oluştur'}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090D' },
  loading: { marginTop: 100 },
  header: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#20212A' },
  headerButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#2C2D36', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#9B72F2', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  headerTitle: { color: '#F5F5F7', fontSize: 18, fontWeight: '900', marginTop: 2 },
  saveTop: { minWidth: 72, height: 40, borderRadius: 13, backgroundColor: '#6232B5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  saveTopText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 70, gap: 14 },
  errorCard: { borderRadius: 15, borderWidth: 1, borderColor: '#57313A', backgroundColor: '#24151A', padding: 13, flexDirection: 'row', gap: 10, alignItems: 'center' },
  errorText: { color: '#FFB4BD', fontSize: 11, lineHeight: 17, flex: 1 },
  previewCard: { height: 210, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#34303F', backgroundColor: '#17141F' },
  previewImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  previewFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#241737' },
  previewInitial: { color: '#DCCBFF', fontSize: 70, fontWeight: '900' },
  previewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,9,0.48)' },
  previewCopy: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  previewBadge: { alignSelf: 'flex-start', minHeight: 27, borderRadius: 999, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(31,20,47,0.88)' },
  previewBadgeText: { color: '#E7DBFF', fontSize: 9, fontWeight: '900' },
  previewTitle: { color: '#FFF', fontSize: 25, fontWeight: '900', marginTop: 9 },
  previewDescription: { color: '#D0CED6', fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 560 },
  sectionCard: { borderRadius: 20, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 17 },
  sectionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#21172F', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: '#F1F1F4', fontSize: 14, fontWeight: '900' },
  sectionSubtitle: { color: '#737580', fontSize: 9, marginTop: 2 },
  label: { color: '#C9C9D0', fontSize: 10, fontWeight: '800', marginBottom: 7, marginTop: 11 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#30313A', backgroundColor: '#17181E', color: '#F3F3F5', paddingHorizontal: 13, fontSize: 12 },
  textarea: { minHeight: 105, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  counter: { color: '#666873', fontSize: 8, textAlign: 'right', marginTop: 5 },
  iconInput: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#30313A', backgroundColor: '#17181E', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconInputField: { flex: 1, minHeight: 46, color: '#F3F3F5', fontSize: 12 },
  choiceRow: { flexDirection: 'row', gap: 9 },
  choice: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#30313A', backgroundColor: '#17181E', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceSelected: { borderColor: '#6945A9', backgroundColor: '#1E1628' },
  choiceText: { color: '#A6A7B0', fontSize: 10, fontWeight: '800', flex: 1 },
  choiceTextSelected: { color: '#DCCBFF' },
  infoBox: { borderRadius: 12, backgroundColor: '#191522', padding: 11, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { color: '#9C95A8', fontSize: 9, lineHeight: 14, flex: 1 },
  helper: { color: '#666873', fontSize: 8, lineHeight: 13, marginTop: 6 },
  primaryButton: { minHeight: 54, borderRadius: 17, backgroundColor: '#6232B5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
