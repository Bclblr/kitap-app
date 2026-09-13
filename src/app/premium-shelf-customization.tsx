import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  DEFAULT_PREMIUM_SHELF_CUSTOMIZATION,
  loadOwnShelfCustomization,
  PremiumShelfCustomization,
  SHELF_ACCENTS,
} from '@/lib/shelf-customization';
import { supabase } from '@/lib/supabase';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

type LayoutKey = PremiumShelfCustomization['layout_key'];
type AccentKey = PremiumShelfCustomization['accent_key'];

const ACCENTS: { key: AccentKey; label: string }[] = [
  { key: 'purple', label: 'Mor' },
  { key: 'gold', label: 'Altın' },
  { key: 'midnight', label: 'Gece Mavisi' },
  { key: 'forest', label: 'Orman' },
];

export default function PremiumShelfCustomizationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();

  const [wantLabel, setWantLabel] = useState(DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.want_label);
  const [readingLabel, setReadingLabel] = useState(DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.reading_label);
  const [readLabel, setReadLabel] = useState(DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.read_label);
  const [layoutKey, setLayoutKey] = useState<LayoutKey>('cozy');
  const [accentKey, setAccentKey] = useState<AccentKey>('purple');
  const [showCounts, setShowCounts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!premium.ready || !premium.isPremium) return;

    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const row = await loadOwnShelfCustomization(user.id);
      if (!row) return;

      setWantLabel(row.want_label);
      setReadingLabel(row.reading_label);
      setReadLabel(row.read_label);
      setLayoutKey(row.layout_key);
      setAccentKey(row.accent_key);
      setShowCounts(row.show_counts);
    } catch (error) {
      console.error('Premium raf ayarları yüklenemedi:', error);
      Alert.alert('Ayarlar yüklenemedi', 'Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  }, [premium.isPremium, premium.ready]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function validLabel(value: string) {
    const clean = value.trim();
    return clean.length >= 1 && clean.length <= 24 ? clean : null;
  }

  async function save() {
    const want = validLabel(wantLabel);
    const reading = validLabel(readingLabel);
    const read = validLabel(readLabel);

    if (!want || !reading || !read) {
      Alert.alert('Geçersiz raf adı', 'Raf adları 1 ile 24 karakter arasında olmalı.');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.rpc('set_premium_shelf_customization', {
        p_want_label: want,
        p_reading_label: reading,
        p_read_label: read,
        p_layout_key: layoutKey,
        p_accent_key: accentKey,
        p_show_counts: showCounts,
      });
      if (error) throw error;

      Alert.alert('Kaydedildi', 'Premium raf görünümün güncellendi.');
    } catch (error) {
      console.error('Premium raf ayarları kaydedilemedi:', error);
      Alert.alert('Kaydedilemedi', 'Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  if (premium.ready && !premium.isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <View style={[styles.lockedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Feather name="lock" size={26} color={colors.primary} />
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Raf kişiselleştirme Premium'a özel</Text>
            <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>Raf adlarını, düzenini ve vurgu rengini Premium üyelikle kişiselleştirebilirsin.</Text>
            <Pressable onPress={() => router.replace('/premium')} style={[styles.primaryButton, { backgroundColor: colors.primary }]}> 
              <Text style={styles.primaryButtonText}>Premium'u İncele</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const accent = SHELF_ACCENTS[accentKey];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/premium'))}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Raf Kişiselleştirme</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Ayarlar yükleniyor...</Text>
          </View>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.eyebrow, { color: accent }]}>PREMIUM RAFLAR</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Raflarını kendi okuma düzenine göre biçimlendir.</Text>
              <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Kitapların gerçek okuma durumları değişmez; yalnızca rafların adı ve görünümü kişiselleşir.</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Raf adları</Text>
              <LabelInput label="Okuyacağım rafı" value={wantLabel} onChangeText={setWantLabel} />
              <LabelInput label="Okuyorum rafı" value={readingLabel} onChangeText={setReadingLabel} />
              <LabelInput label="Okudum rafı" value={readLabel} onChangeText={setReadLabel} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Raf düzeni</Text>
              <View style={styles.choiceRow}>
                {(['cozy', 'compact'] as LayoutKey[]).map((key) => {
                  const selected = layoutKey === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setLayoutKey(key)}
                      style={[styles.choice, { borderColor: selected ? accent : colors.border, backgroundColor: colors.background }]}
                    >
                      <Feather name={key === 'cozy' ? 'square' : 'list'} size={18} color={selected ? accent : colors.textSecondary} />
                      <Text style={[styles.choiceTitle, { color: colors.text }]}>{key === 'cozy' ? 'Rahat' : 'Kompakt'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Vurgu rengi</Text>
              <View style={styles.accentGrid}>
                {ACCENTS.map((item) => {
                  const selected = accentKey === item.key;
                  const itemColor = SHELF_ACCENTS[item.key];
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setAccentKey(item.key)}
                      style={[styles.accentChoice, { borderColor: selected ? itemColor : colors.border, backgroundColor: colors.background }]}
                    >
                      <View style={[styles.colorDot, { backgroundColor: itemColor }]} />
                      <Text style={[styles.accentLabel, { color: colors.text }]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Raf sayaçlarını göster</Text>
                  <Text style={[styles.switchBody, { color: colors.textSecondary }]}>Her rafın yanında kaç kitap olduğunu göster.</Text>
                </View>
                <Switch value={showCounts} onValueChange={setShowCounts} trackColor={{ true: accent }} />
              </View>
            </View>

            <Pressable disabled={saving} onPress={() => void save()} style={[styles.primaryButton, { backgroundColor: accent, opacity: saving ? 0.6 : 1 }]}> 
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Raf Görünümünü Kaydet</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );

  function LabelInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          maxLength={24}
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
          placeholderTextColor={colors.textMuted}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 56 },
  centered: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 42 },
  loadingBox: { paddingVertical: 64, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13 },
  hero: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
  heroBody: { fontSize: 13, lineHeight: 19 },
  card: { marginTop: 14, borderWidth: 1, borderRadius: 20, padding: 16, gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  inputGroup: { gap: 7 },
  inputLabel: { fontSize: 13, fontWeight: '800' },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderWidth: 1, borderRadius: 15, minHeight: 74, alignItems: 'center', justifyContent: 'center', gap: 7 },
  choiceTitle: { fontSize: 13, fontWeight: '800' },
  accentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  accentChoice: { width: '47%', borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  colorDot: { width: 18, height: 18, borderRadius: 9 },
  accentLabel: { fontSize: 13, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  switchText: { flex: 1, gap: 5 },
  switchBody: { fontSize: 12, lineHeight: 17 },
  primaryButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  lockedCard: { borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center', gap: 12 },
  lockedTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  lockedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
