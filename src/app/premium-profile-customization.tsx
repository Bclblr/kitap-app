import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  PROFILE_THEME_ACCENTS,
  PROFILE_THEME_LABELS,
  PremiumProfileLayout,
  PremiumProfileTheme,
  loadProfileCustomization,
} from '@/lib/profile-customization';
import { supabase } from '@/lib/supabase';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

const THEMES: PremiumProfileTheme[] = ['purple', 'gold', 'midnight', 'forest'];
const LAYOUTS: { key: PremiumProfileLayout; label: string; description: string }[] = [
  { key: 'classic', label: 'Klasik', description: 'Mevcut profil düzenini Premium çerçeveyle kullan.' },
  { key: 'spotlight', label: 'Spotlight', description: 'Profil kartını daha belirgin ve vurgulu göster.' },
];

export default function PremiumProfileCustomizationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();
  const [themeKey, setThemeKey] = useState<PremiumProfileTheme>('purple');
  const [layoutKey, setLayoutKey] = useState<PremiumProfileLayout>('classic');
  const [highlightText, setHighlightText] = useState('');
  const [showFrame, setShowFrame] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!premium.ready || !premium.isPremium) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      const customization = await loadProfileCustomization(userId);
      if (!customization) return;
      setThemeKey(customization.theme_key);
      setLayoutKey(customization.layout_key);
      setHighlightText(customization.highlight_text ?? '');
      setShowFrame(customization.show_premium_frame !== false);
    } catch (error) {
      console.error('Premium profil ayarları yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, [premium.isPremium, premium.ready]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (highlightText.trim().length > 80) {
      Alert.alert('Metin çok uzun', 'Profil vurgusu en fazla 80 karakter olabilir.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('set_premium_profile_customization', {
        p_theme_key: themeKey,
        p_layout_key: layoutKey,
        p_highlight_text: highlightText.trim(),
        p_show_premium_frame: showFrame,
      });
      if (error) throw error;
      Alert.alert('Kaydedildi', 'Premium profil görünümün güncellendi.');
    } catch (error) {
      console.error('Premium profil ayarları kaydedilemedi:', error);
      Alert.alert('Kaydedilemedi', 'Profil görünümü güncellenemedi. Lütfen tekrar dene.');
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
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Profil kişiselleştirme Premium'a özel</Text>
            <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>Tema, profil düzeni ve Premium çerçeve seçenekleri aktif Premium üyelik gerektirir.</Text>
            <Pressable onPress={() => router.replace('/premium')} style={[styles.primaryButton, { backgroundColor: colors.primary }]}> 
              <Text style={styles.primaryButtonText}>Premium'u İncele</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const accent = PROFILE_THEME_ACCENTS[themeKey];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/premium'))} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profil Kişiselleştirme</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <>
            <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: showFrame ? accent : colors.border, borderWidth: showFrame ? 2 : 1 }]}> 
              <View style={[styles.previewAccent, { backgroundColor: accent }]} />
              <Text style={[styles.previewEyebrow, { color: accent }]}>PREMIUM PROFİL</Text>
              <Text style={[styles.previewTitle, { color: colors.text }]}>Profil önizlemesi</Text>
              <Text style={[styles.previewBody, { color: colors.textSecondary }]}>{highlightText.trim() || 'Kitaplarla kurduğun dünyayı burada öne çıkarabilirsin.'}</Text>
              <Text style={[styles.previewLayout, { color: colors.textMuted }]}>{layoutKey === 'spotlight' ? 'Spotlight düzeni' : 'Klasik düzen'}</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profil teması</Text>
            <View style={styles.themeGrid}>
              {THEMES.map((key) => {
                const selected = key === themeKey;
                return (
                  <Pressable key={key} onPress={() => setThemeKey(key)} style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: selected ? PROFILE_THEME_ACCENTS[key] : colors.border, borderWidth: selected ? 2 : 1 }]}> 
                    <View style={[styles.swatch, { backgroundColor: PROFILE_THEME_ACCENTS[key] }]} />
                    <Text style={[styles.themeLabel, { color: colors.text }]}>{PROFILE_THEME_LABELS[key]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profil düzeni</Text>
            <View style={styles.layoutList}>
              {LAYOUTS.map((layout) => {
                const selected = layout.key === layoutKey;
                return (
                  <Pressable key={layout.key} onPress={() => setLayoutKey(layout.key)} style={[styles.layoutCard, { backgroundColor: colors.surface, borderColor: selected ? accent : colors.border }]}> 
                    <View style={styles.layoutText}>
                      <Text style={[styles.layoutTitle, { color: colors.text }]}>{layout.label}</Text>
                      <Text style={[styles.layoutBody, { color: colors.textSecondary }]}>{layout.description}</Text>
                    </View>
                    <Feather name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? accent : colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.formLabel, { color: colors.text }]}>Profil vurgusu</Text>
              <TextInput
                value={highlightText}
                onChangeText={setHighlightText}
                maxLength={80}
                placeholder="Örn. Bu yıl 24 kitap hedefi"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              />
              <Text style={[styles.counter, { color: colors.textMuted }]}>{highlightText.length}/80</Text>

              <Pressable onPress={() => setShowFrame((value) => !value)} style={[styles.toggleRow, { borderColor: colors.border }]}> 
                <View style={styles.layoutText}>
                  <Text style={[styles.layoutTitle, { color: colors.text }]}>Premium çerçeve</Text>
                  <Text style={[styles.layoutBody, { color: colors.textSecondary }]}>Seçtiğin tema rengini profil kartında göster.</Text>
                </View>
                <View style={[styles.toggle, { backgroundColor: showFrame ? accent : colors.border }]}><View style={[styles.toggleKnob, { alignSelf: showFrame ? 'flex-end' : 'flex-start' }]} /></View>
              </Pressable>

              <Pressable disabled={saving} onPress={() => void save()} style={[styles.primaryButton, { backgroundColor: accent, opacity: saving ? 0.6 : 1 }]}> 
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Profil Görünümünü Kaydet</Text>}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 56 },
  centered: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 42 },
  loadingBox: { paddingVertical: 72, alignItems: 'center' },
  preview: { borderRadius: 22, padding: 18, overflow: 'hidden', gap: 7 },
  previewAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  previewEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginTop: 4 },
  previewTitle: { fontSize: 22, fontWeight: '900' },
  previewBody: { fontSize: 14, lineHeight: 20 },
  previewLayout: { fontSize: 12, marginTop: 4 },
  sectionTitle: { marginTop: 24, marginBottom: 10, fontSize: 17, fontWeight: '900' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeCard: { width: '48%', flexGrow: 1, borderRadius: 16, padding: 13, gap: 9 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  themeLabel: { fontSize: 13, fontWeight: '800' },
  layoutList: { gap: 10 },
  layoutCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  layoutText: { flex: 1, gap: 3 },
  layoutTitle: { fontSize: 14, fontWeight: '800' },
  layoutBody: { fontSize: 12, lineHeight: 17 },
  formCard: { marginTop: 18, borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  formLabel: { fontSize: 14, fontWeight: '800' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 14 },
  counter: { fontSize: 11, textAlign: 'right', marginTop: -7 },
  toggleRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggle: { width: 46, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4, paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  lockedCard: { borderWidth: 1, borderRadius: 22, padding: 22, alignItems: 'center', gap: 12 },
  lockedTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  lockedBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
