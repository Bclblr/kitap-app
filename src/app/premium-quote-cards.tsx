import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  PREMIUM_QUOTE_CARD_TEMPLATES,
  QUOTE_CARD_LABELS,
  QuoteCardTemplate,
  quoteCardPalette,
} from '@/lib/quote-card';
import { safeBack } from '@/lib/navigation';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

const TEMPLATES: QuoteCardTemplate[] = ['classic', ...PREMIUM_QUOTE_CARD_TEMPLATES];

export default function PremiumQuoteCardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ text?: string; book?: string; template?: string }>();
  const { colors } = useAppTheme();
  const premium = usePremium();

  const [quote, setQuote] = useState(typeof params.text === 'string' ? params.text : 'İyi bir kitap, okurunu yalnız bırakmaz.');
  const [book, setBook] = useState(typeof params.book === 'string' ? params.book : 'Kitap adı');
  const initialTemplate: QuoteCardTemplate = params.template === 'editorial' || params.template === 'noir' || params.template === 'minimal' ? params.template : 'classic';
  const [template, setTemplate] = useState<QuoteCardTemplate>(initialTemplate);
  const [sharing, setSharing] = useState(false);
  const previewRef = useRef<View>(null);

  const selectedTemplate = template !== 'classic' && !premium.isPremium ? 'classic' : template;
  const palette = useMemo(() => quoteCardPalette(selectedTemplate, colors), [colors, selectedTemplate]);

  async function shareTextFallback() {
    const body = `“${quote.trim()}”\n\n— ${book.trim()}\n\nKitap`;
    await Share.share({ message: body });
  }

  async function shareCardImage() {
    if (sharing || !previewRef.current) return;

    setSharing(true);
    try {
      if (Platform.OS === 'web') {
        await shareTextFallback();
        return;
      }

      const uri = await captureRef(previewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await shareTextFallback();
        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: 'Alıntı kartını paylaş',
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error) {
      console.warn('Alıntı kartı görsel paylaşım hatası:', error);
      Alert.alert(
        'Kart paylaşılamadı',
        'Alıntı kartı görseli hazırlanamadı. Tekrar deneyebilirsin.'
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={() => (router.canGoBack() ? safeBack(router, '/premium') : router.replace('/premium'))} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Alıntı Kartları</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.eyebrow, { color: colors.primary }]}>PREMIUM KARTLAR</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Alıntılarını farklı kart stilleriyle öne çıkar.</Text>
          <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Klasik şablon ücretsizdir. Editoryal, Gece ve Minimal şablonlar aktif Premium üyelikle kullanılabilir.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Kart içeriği</Text>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Alıntı</Text>
          <TextInput value={quote} onChangeText={setQuote} multiline maxLength={700} style={[styles.textArea, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} placeholder="Alıntını yaz" placeholderTextColor={colors.textMuted} />
          <Text style={[styles.inputLabel, { color: colors.text }]}>Kitap</Text>
          <TextInput value={book} onChangeText={setBook} maxLength={160} style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} placeholder="Kitap adı" placeholderTextColor={colors.textMuted} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Şablon</Text>
          <View style={styles.templateGrid}>
            {TEMPLATES.map((key) => {
              const locked = key !== 'classic' && !premium.isPremium;
              const active = selectedTemplate === key;
              return (
                <Pressable key={key} onPress={() => { if (locked) { router.push('/premium'); return; } setTemplate(key); }} style={[styles.templateChoice, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.background, opacity: locked ? 0.6 : 1 }]}>
                  <Text style={[styles.templateName, { color: colors.text }]}>{QUOTE_CARD_LABELS[key]}</Text>
                  <Text style={[styles.templateMeta, { color: locked ? colors.textMuted : colors.primary }]}>{locked ? 'Premium' : active ? 'Seçili' : 'Seç'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          ref={previewRef}
          collapsable={false}
          style={[styles.preview, { backgroundColor: palette.background, borderColor: palette.border }]}
        > 
          <View style={[styles.previewAccent, { backgroundColor: palette.accent }]} />
          <Text style={[styles.previewMark, { color: palette.accent }]}>“</Text>
          <Text style={[styles.previewQuote, { color: palette.text }]}>{quote.trim() || 'Alıntı metni'}</Text>
          <View style={[styles.previewDivider, { backgroundColor: palette.border }]} />
          <Text style={[styles.previewBook, { color: palette.secondary }]}>{book.trim() || 'Kitap adı'}</Text>
          <Text style={[styles.previewBrand, { color: palette.accent }]}>KİTAP · {QUOTE_CARD_LABELS[selectedTemplate].toUpperCase()}</Text>
        </View>

        <Pressable
          onPress={() => void shareCardImage()}
          disabled={sharing || !quote.trim() || !book.trim()}
          accessibilityRole="button"
          accessibilityLabel="Alıntı kartını görsel olarak paylaş"
          style={[
            styles.primaryButton,
            {
              backgroundColor: colors.primary,
              opacity: sharing || !quote.trim() || !book.trim() ? 0.45 : 1,
            },
          ]}
        >
          <Feather name="image" size={18} color={colors.onPrimary} />
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
            {sharing ? 'Görsel hazırlanıyor…' : 'Kartı Görsel Olarak Paylaş'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { paddingHorizontal: 18, paddingBottom: 56 }, header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, headerTitle: { fontSize: 19, fontWeight: '800' }, headerSpacer: { width: 42 }, hero: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 8 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900' }, heroBody: { fontSize: 13, lineHeight: 19 }, card: { marginTop: 14, borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 }, sectionTitle: { fontSize: 16, fontWeight: '900' }, inputLabel: { fontSize: 13, fontWeight: '800', marginTop: 2 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15 }, textArea: { minHeight: 110, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, textAlignVertical: 'top' }, templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, templateChoice: { width: '47%', minHeight: 72, borderWidth: 1, borderRadius: 14, padding: 12, justifyContent: 'center', gap: 5 }, templateName: { fontSize: 14, fontWeight: '900' }, templateMeta: { fontSize: 11, fontWeight: '800' }, preview: { marginTop: 16, minHeight: 310, borderWidth: 1, borderRadius: 24, padding: 24, overflow: 'hidden', justifyContent: 'center' }, previewAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 }, previewMark: { fontSize: 54, fontWeight: '900', lineHeight: 56 }, previewQuote: { fontSize: 24, lineHeight: 34, fontWeight: '800' }, previewDivider: { height: 1, marginVertical: 20 }, previewBook: { fontSize: 15, fontWeight: '700' }, previewBrand: { marginTop: 18, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, primaryButton: { marginTop: 16, minHeight: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 18 }, primaryButtonText: { fontSize: 14, fontWeight: '900' },
});
