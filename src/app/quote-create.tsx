import BookCover from '@/components/BookCover';
import BookPickerModal, { ComposerBook } from '@/components/BookPickerModal';
import { QUOTE_CARD_LABELS, QuoteCardTemplate } from '@/lib/quote-card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const TOPICS = ['Edebiyat', 'Karakterler', 'Yazar ve Üslup', 'Fikirler', 'Tarih ve Toplum', 'Kişisel Okuma'];
const TEMPLATES: QuoteCardTemplate[] = ['classic', 'editorial', 'noir', 'minimal'];

export default function QuoteCreate() {
  const router = useRouter();
  const premium = usePremium();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ book?: string; key?: string; author?: string; coverUrl?: string; text?: string }>();
  const lock = useRef(false);

  const [bookKey, setBookKey] = useState(params.key ?? '');
  const [book, setBook] = useState(params.book ?? '');
  const [author, setAuthor] = useState(params.author ?? '');
  const [coverUrl, setCoverUrl] = useState(params.coverUrl ?? '');
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState(params.text ?? '');
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState('');
  const [note, setNote] = useState('');
  const [template, setTemplate] = useState<QuoteCardTemplate>('classic');
  const [topicOpen, setTopicOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const metadata = session?.user?.user_metadata ?? {};
  const displayName = useMemo(
    () => metadata.full_name || metadata.name || metadata.username || session?.user?.email?.split('@')[0] || 'Kitap Okuru',
    [metadata, session?.user?.email]
  );
  const avatarUrl = metadata.avatar_url || metadata.picture || '';

  function selectBook(selected: ComposerBook) {
    setBookKey(selected.key);
    setBook(selected.title);
    setAuthor(selected.author);
    setCoverUrl(selected.coverUrl ?? '');
  }

  async function save() {
    if (lock.current || !text.trim() || !book.trim() || !bookKey.trim()) return;
    lock.current = true;
    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error('AUTH_REQUIRED');

      const safeTemplate = template !== 'classic' && !premium.isPremium ? 'classic' : template;
      const parsedPage = page.trim() ? Number(page) : null;
      const result = await supabase.from('quotes').insert({
        user_id: data.user.id,
        book_title: book.trim(),
        book_key: bookKey,
        text: text.trim(),
        title: title.trim() || null,
        topic: topic || null,
        page_number: Number.isInteger(parsedPage) && parsedPage && parsedPage > 0 ? parsedPage : null,
        note: note.trim() || null,
        card_template_key: safeTemplate,
      });
      if (result.error) throw result.error;
      router.replace('/');
    } catch (error) {
      console.error('Alıntı paylaşma hatası:', error);
      Alert.alert('Alıntı paylaşılamadı', 'Metnin korunuyor. Lütfen tekrar dene.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function preview() {
    router.push({ pathname: '/premium-quote-cards', params: { text, book, template } });
  }

  function closeComposer() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const canPublish = !!text.trim() && !!book.trim() && !!bookKey.trim();

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={closeComposer} style={styles.headerButton} accessibilityLabel="Kapat">
          <Feather name="x" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Alıntı Ekle</Text>
        <Pressable onPress={() => setOptionsOpen(true)} style={styles.headerButton} accessibilityLabel="Seçenekler">
          <Feather name="more-vertical" size={25} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.userRow}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="user" size={25} color={colors.textMuted} />
            </View>
          )}
          <Text style={[styles.userName, { color: colors.text }]}>{displayName}</Text>
        </View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Başlık (isteğe bağlı)"
          placeholderTextColor={colors.textMuted}
          maxLength={120}
          style={[styles.titleInput, { color: colors.text }]}
        />

        <View style={styles.quoteEditorRow}>
          <View style={[styles.quoteRail, { backgroundColor: colors.primary }]} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Kitaptan cümleler…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
            textAlignVertical="top"
            style={[styles.quoteInput, { color: colors.text }]}
          />
        </View>

        <Pressable onPress={() => setTopicOpen(true)} style={styles.topicButton}>
          <Feather name="tag" size={19} color={colors.textMuted} />
          <Text style={[styles.topicText, { color: topic ? colors.text : colors.textMuted }]}>{topic || 'Konu seç'}</Text>
          <Feather name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable onPress={() => setBookPickerOpen(true)} style={[styles.bookRow, { borderBottomColor: colors.border }]}>
          {coverUrl ? (
            <BookCover uri={coverUrl} style={styles.cover}><View /></BookCover>
          ) : (
            <View style={[styles.coverFallback, { backgroundColor: colors.surface }]}><Feather name="book-open" size={20} color={colors.textMuted} /></View>
          )}
          <View style={styles.bookCopy}>
            <Text style={[styles.bookTitle, { color: book ? colors.text : colors.textMuted }]} numberOfLines={2}>
              {book || 'Kitap seç'}
            </Text>
            <Text style={[styles.author, { color: colors.textMuted }]} numberOfLines={1}>
              {author || 'Kitap veya yazar adıyla ara'}
            </Text>
          </View>
          <View style={styles.changeWrap}>
            <Text style={[styles.changeText, { color: colors.primary }]}>{book ? 'Değiştir' : 'Seç'}</Text>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </View>
        </Pressable>

        <TextInput
          value={page}
          onChangeText={(value) => setPage(value.replace(/[^0-9]/g, ''))}
          placeholder="Alıntı kaçıncı sayfada?"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          style={[styles.metaInput, { color: colors.text, borderBottomColor: colors.border }]}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Yayınevi, karakter adı veya kısa not…"
          placeholderTextColor={colors.textMuted}
          maxLength={300}
          style={[styles.metaInput, { color: colors.text, borderBottomColor: colors.border }]}
        />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable onPress={() => setOptionsOpen(true)} style={styles.footerOption}>
          <Feather name="sliders" size={21} color={colors.textMuted} />
          <Text style={[styles.footerOptionText, { color: colors.textMuted }]}>Gönderi seçenekleri</Text>
        </Pressable>
        <Pressable onPress={preview} disabled={!canPublish} style={styles.previewButton} accessibilityLabel="Önizleme">
          <Feather name="eye" size={24} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => void save()}
          disabled={busy || !canPublish}
          style={[styles.publishButton, { backgroundColor: colors.primary }, (busy || !canPublish) && styles.disabled]}
        >
          <Text style={styles.publishText}>{busy ? 'Yayınlanıyor…' : 'Yayınla'}</Text>
        </Pressable>
      </View>

      <BookPickerModal
        visible={bookPickerOpen}
        onClose={() => setBookPickerOpen(false)}
        onSelect={selectBook}
        title="Alıntı için kitap seç"
      />

      <Modal visible={topicOpen} transparent animationType="slide" onRequestClose={() => setTopicOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTopicOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => undefined}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Konu seç</Text>
            {TOPICS.map((item) => (
              <Pressable key={item} onPress={() => { setTopic(item); setTopicOpen(false); }} style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.sheetRowText, { color: colors.text }]}>{item}</Text>
                {topic === item && <Feather name="check" size={20} color={colors.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={optionsOpen} transparent animationType="slide" onRequestClose={() => setOptionsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOptionsOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => undefined}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Alıntı görünümü</Text>
            {TEMPLATES.map((item) => {
              const locked = item !== 'classic' && !premium.isPremium;
              return (
                <Pressable key={item} onPress={() => { if (locked) { setOptionsOpen(false); router.push('/premium'); return; } setTemplate(item); }} style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
                  <View><Text style={[styles.sheetRowText, { color: colors.text }]}>{QUOTE_CARD_LABELS[item]}</Text>{locked && <Text style={[styles.premiumLabel, { color: colors.primary }]}>Premium</Text>}</View>
                  {template === item && <Feather name="check" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 21, fontWeight: '900' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 28 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 17, fontWeight: '800' },
  titleInput: { fontSize: 23, fontWeight: '800', paddingVertical: 8, marginBottom: 10 },
  quoteEditorRow: { minHeight: 190, flexDirection: 'row', marginBottom: 16 },
  quoteRail: { width: 4, borderRadius: 4, marginRight: 17 },
  quoteInput: { flex: 1, minHeight: 190, paddingTop: 10, fontSize: 20, lineHeight: 30 },
  topicButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  topicText: { fontSize: 16, fontWeight: '700' },
  bookRow: { minHeight: 102, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 13 },
  cover: { width: 48, height: 70, borderRadius: 6, overflow: 'hidden' },
  coverFallback: { width: 48, height: 70, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  bookCopy: { flex: 1, marginHorizontal: 14 },
  bookTitle: { fontSize: 17, fontWeight: '800', padding: 0 },
  author: { fontSize: 15, marginTop: 5 },
  changeWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  changeText: { fontSize: 15, fontWeight: '800' },
  metaInput: { minHeight: 66, borderBottomWidth: StyleSheet.hairlineWidth, fontSize: 16, paddingHorizontal: 0 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 82, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  footerOptionText: { fontSize: 14, fontWeight: '700' },
  previewButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  publishButton: { minWidth: 112, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  publishText: { color: '#0B0C0F', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' },
  sheet: { borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  sheetRow: { minHeight: 55, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetRowText: { fontSize: 16, fontWeight: '700' },
  premiumLabel: { fontSize: 11, fontWeight: '800', marginTop: 2 },
});