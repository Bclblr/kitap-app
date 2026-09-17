import BookCover from '@/components/BookCover';
import BookPickerModal, { ComposerBook } from '@/components/BookPickerModal';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Profile = {
  full_name: string | null;
  username: string | null;
  profile_image: string | null;
};

type Topic = {
  name: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
};

const TOPICS: Topic[] = [
  { name: 'Edebiyat', description: 'Romanlar, öyküler ve edebiyat üzerine', icon: 'book-open' },
  { name: 'Karakterler', description: 'Karakterler ve ilişkiler üzerine', icon: 'users' },
  { name: 'Yazar ve Üslup', description: 'Dil, anlatım ve yazarın yaklaşımı', icon: 'edit-3' },
  { name: 'Fikirler', description: 'Kitabın düşündürdükleri ve ana fikirleri', icon: 'message-circle' },
  { name: 'Tarih ve Toplum', description: 'Tarihsel ve toplumsal okumalar', icon: 'globe' },
  { name: 'Kişisel Okuma', description: 'Sende bıraktığı his ve deneyim', icon: 'heart' },
];

const TAG_SUGGESTIONS = ['klasik', 'roman', 'edebiyat', 'karakter', 'psikoloji', 'tarih', 'felsefe', 'toplum'];

export default function ReviewScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { key, title, author, coverUrl } = useLocalSearchParams<{
    key?: string;
    title?: string;
    author?: string;
    coverUrl?: string;
  }>();

  const [selectedBookKey, setSelectedBookKey] = useState(key ?? '');
  const [selectedBookTitle, setSelectedBookTitle] = useState(title ?? '');
  const [selectedBookAuthor, setSelectedBookAuthor] = useState(author ?? '');
  const [selectedBookCover, setSelectedBookCover] = useState(coverUrl ?? '');
  const [bookPickerOpen, setBookPickerOpen] = useState(false);

  const [rating, setRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [topic, setTopic] = useState('');
  const [topicQuery, setTopicQuery] = useState('');
  const [topicSheet, setTopicSheet] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  const [tagSheet, setTagSheet] = useState(false);

  const [optionsSheet, setOptionsSheet] = useState(false);
  const [previewSheet, setPreviewSheet] = useState(false);
  const [containsSpoiler, setContainsSpoiler] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name, username, profile_image')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (active) setProfile((data as Profile | null) ?? null);
    }

    void loadProfile();
    return () => { active = false; };
  }, []);

  const filteredTopics = useMemo(() => {
    const query = topicQuery.trim().toLocaleLowerCase('tr-TR');
    if (!query) return TOPICS;
    return TOPICS.filter((item) =>
      `${item.name} ${item.description}`.toLocaleLowerCase('tr-TR').includes(query)
    );
  }, [topicQuery]);

  const filteredTags = useMemo(() => {
    const query = tagQuery.trim().toLocaleLowerCase('tr-TR').replace(/^#/, '');
    const pool = Array.from(new Set([...TAG_SUGGESTIONS, topic && topic.toLocaleLowerCase('tr-TR')].filter(Boolean)));
    return query ? pool.filter((item) => item.includes(query)) : pool;
  }, [tagQuery, topic]);

  const displayName = profile?.full_name?.trim() || profile?.username?.trim() || 'Kitap Okuru';
  const username = profile?.username?.trim() || 'okur';
  const initial = displayName.charAt(0).toLocaleUpperCase('tr-TR') || 'K';

  function closeComposer() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function addTag(rawTag: string) {
    const clean = rawTag.trim().replace(/^#/, '').toLocaleLowerCase('tr-TR').replace(/\s+/g, '-');
    if (!clean) return;
    if (tags.includes(clean)) return;
    if (tags.length >= 8) {
      Alert.alert('Etiket sınırı', 'Bir incelemeye en fazla 8 etiket ekleyebilirsin.');
      return;
    }
    setTags((current) => [...current, clean]);
    setTagQuery('');
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  async function saveReview() {
    const cleanText = reviewText.trim();
    const cleanTitle = reviewTitle.trim();

    if (!selectedBookKey) {
      Alert.alert('Kitap gerekli', 'İnceleme için önce bir kitap seçmelisin.');
      setBookPickerOpen(true);
      return;
    }
    if (rating === 0) {
      Alert.alert('Puan gerekli', 'Yayınlamadan önce kitaba 1 ile 5 arasında bir puan ver.');
      return;
    }
    if (!cleanText) {
      Alert.alert('İnceleme gerekli', 'Kitap hakkındaki düşüncelerini yazmalısın.');
      return;
    }

    try {
      setSaving(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError && userError.name !== 'AuthSessionMissingError') throw userError;
      if (!user) {
        Alert.alert('Giriş gerekli', 'İnceleme yazmak için önce hesabına giriş yapmalısın.');
        return;
      }

      const { error } = await supabase.from('reviews').insert({
        user_id: user.id,
        book_key: selectedBookKey,
        book_title: selectedBookTitle || 'Bilinmeyen kitap',
        rating,
        text: cleanText,
        title: cleanTitle || null,
        topic: topic || null,
        tags,
        contains_spoiler: containsSpoiler,
      });

      if (error) throw error;

      Alert.alert('Yayınlandı', 'İncelemen okurlarla paylaşıldı.', [
        { text: 'Tamam', onPress: closeComposer },
      ]);
    } catch (error: any) {
      console.error('İnceleme kaydetme hatası:', error);
      Alert.alert('İnceleme yayınlanamadı', error?.message || 'Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable onPress={closeComposer} style={styles.headerIcon} accessibilityLabel="İncelemeyi kapat">
          <Feather name="x" size={25} color="#F5F5F7" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>İnceleme Yaz</Text>
          <Text style={styles.headerSubtitle}>Düşüncelerini okurlarla paylaş</Text>
        </View>
        <Pressable onPress={() => setPreviewSheet(true)} style={styles.headerIcon} accessibilityLabel="Önizleme">
          <Feather name="eye" size={21} color="#C8B6FF" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: 150 + insets.bottom }]}
      >
        <Pressable onPress={() => setRating((current) => current || 5)} style={styles.ratingCard}>
          <View style={styles.ratingTopRow}>
            <View style={styles.ratingIconWrap}>
              <Feather name="star" size={18} color="#D9CBFF" />
            </View>
            <View style={styles.ratingCopy}>
              <Text style={styles.ratingTitle}>{rating ? `${rating}/5 puan verdin` : 'Kitabı puanla'}</Text>
              <Text style={styles.ratingHint}>{rating ? 'Puanını değiştirmek için yıldızlara dokun' : 'İncelemenin yanında görünecek'}</Text>
            </View>
          </View>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} style={styles.starButton}>
                <Feather name="star" size={29} color={star <= rating ? '#A985FF' : '#555A66'} />
              </Pressable>
            ))}
          </View>
        </Pressable>

        <View style={styles.authorRow}>
          {profile?.profile_image ? (
            <Image source={{ uri: profile.profile_image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initial}</Text></View>
          )}
          <View style={styles.authorCopy}>
            <Text style={styles.authorName}>{displayName}</Text>
            <Text style={styles.authorHandle}>@{username}</Text>
          </View>
          <View style={styles.publicPill}>
            <Feather name="globe" size={13} color="#A9AFBB" />
            <Text style={styles.publicText}>Herkese açık</Text>
          </View>
        </View>

        <View style={styles.editorCard}>
          <TextInput
            value={reviewTitle}
            onChangeText={setReviewTitle}
            placeholder="İncelemene bir başlık ekle"
            placeholderTextColor="#656B76"
            maxLength={120}
            style={styles.titleInput}
          />
          <View style={styles.editorDivider} />
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Bu kitap sende ne bıraktı? Beğendiğin, eleştirdiğin veya üzerinde düşündüğün noktaları yaz..."
            placeholderTextColor="#656B76"
            multiline
            maxLength={4000}
            textAlignVertical="top"
            style={styles.reviewInput}
          />
          <View style={styles.editorFooter}>
            <View style={styles.quickActions}>
              <Pressable onPress={() => setTagSheet(true)} style={styles.quickAction}>
                <Feather name="at-sign" size={20} color="#B9A4F7" />
              </Pressable>
              <Pressable onPress={() => setTagSheet(true)} style={styles.quickAction}>
                <Feather name="hash" size={20} color="#B9A4F7" />
              </Pressable>
            </View>
            <Text style={styles.characterCount}>{reviewText.length}/4000</Text>
          </View>
        </View>

        <Pressable onPress={() => setTopicSheet(true)} style={styles.selectionCard}>
          <View style={styles.selectionIcon}><Feather name="layers" size={19} color="#C8B6FF" /></View>
          <View style={styles.selectionCopy}>
            <Text style={styles.selectionLabel}>Konu</Text>
            <Text style={[styles.selectionValue, !topic && styles.selectionPlaceholder]}>{topic || 'İncelemenin konusunu seç'}</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#717784" />
        </Pressable>

        <Pressable onPress={() => setTagSheet(true)} style={styles.selectionCard}>
          <View style={styles.selectionIcon}><Feather name="tag" size={19} color="#C8B6FF" /></View>
          <View style={styles.selectionCopy}>
            <Text style={styles.selectionLabel}>Etiketler</Text>
            <Text style={[styles.selectionValue, tags.length === 0 && styles.selectionPlaceholder]} numberOfLines={1}>
              {tags.length ? tags.map((item) => `#${item}`).join('  ') : 'Okur, kitap veya tema ekle'}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#717784" />
        </Pressable>

        <Pressable onPress={() => setBookPickerOpen(true)} style={styles.bookCard}>
          <BookCover uri={selectedBookCover || null} style={styles.bookCover}>
            <View style={styles.bookCoverFallback}><Feather name="book-open" size={22} color="#797F8B" /></View>
          </BookCover>
          <View style={styles.bookCopy}>
            <Text style={styles.bookEyebrow}>İNCELEME YAPILAN KİTAP</Text>
            <Text style={styles.bookTitle} numberOfLines={2}>{selectedBookTitle || 'Kitap seç'}</Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>{selectedBookAuthor || 'Kitap veya yazar adıyla ara'}</Text>
          </View>
          <Feather name={selectedBookKey ? "check-circle" : "plus-circle"} size={20} color="#8C70E8" />
        </Pressable>

        {containsSpoiler ? (
          <View style={styles.spoilerNotice}>
            <Feather name="alert-triangle" size={16} color="#F2B36C" />
            <Text style={styles.spoilerNoticeText}>Bu inceleme spoiler içeriyor olarak işaretlenecek.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable onPress={() => setOptionsSheet(true)} style={styles.optionsButton}>
          <Feather name="sliders" size={19} color="#B4BBC6" />
          <Text style={styles.optionsText}>Gönderi seçenekleri</Text>
        </Pressable>
        <Pressable onPress={() => setPreviewSheet(true)} style={styles.previewButton} accessibilityLabel="Önizleme">
          <Feather name="eye" size={21} color="#A9AFBB" />
        </Pressable>
        <Pressable onPress={saveReview} disabled={saving} style={[styles.publishButton, saving && styles.disabledButton]}>
          <Text style={styles.publishText}>{saving ? 'Yayınlanıyor...' : 'Yayınla'}</Text>
          {!saving ? <Feather name="arrow-up-right" size={17} color="#0A0910" /> : null}
        </Pressable>
      </View>

      <BookPickerModal
        visible={bookPickerOpen}
        onClose={() => setBookPickerOpen(false)}
        title="İnceleme için kitap seç"
        onSelect={(selected: ComposerBook) => {
          setSelectedBookKey(selected.key);
          setSelectedBookTitle(selected.title);
          setSelectedBookAuthor(selected.author);
          setSelectedBookCover(selected.coverUrl ?? '');
        }}
      />

      <Modal visible={topicSheet} transparent animationType="slide" onRequestClose={() => setTopicSheet(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setTopicSheet(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 22) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View><Text style={styles.sheetTitle}>Konu Seçimi</Text><Text style={styles.sheetSubtitle}>İncelemenin keşfedilmesini kolaylaştır</Text></View>
              <Pressable onPress={() => setTopicSheet(false)} style={styles.sheetClose}><Feather name="x" size={20} color="#D7DBE2" /></Pressable>
            </View>
            <View style={styles.searchBox}>
              <Feather name="search" size={19} color="#7D8490" />
              <TextInput value={topicQuery} onChangeText={setTopicQuery} placeholder="Konularda ara" placeholderTextColor="#676D78" style={styles.searchInput} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
              {filteredTopics.map((item) => (
                <Pressable key={item.name} onPress={() => { setTopic(item.name); setTopicSheet(false); }} style={[styles.topicRow, topic === item.name && styles.topicRowSelected]}>
                  <View style={styles.topicIcon}><Feather name={item.icon} size={18} color="#BDAAF8" /></View>
                  <View style={styles.topicCopy}><Text style={styles.topicName}>{item.name}</Text><Text style={styles.topicDescription}>{item.description}</Text></View>
                  {topic === item.name ? <Feather name="check" size={19} color="#A985FF" /> : <Feather name="chevron-right" size={18} color="#606672" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={tagSheet} transparent animationType="slide" onRequestClose={() => setTagSheet(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setTagSheet(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 22) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View><Text style={styles.sheetTitle}>Etiket Ekle</Text><Text style={styles.sheetSubtitle}>İncelemeni doğru okurlarla buluştur</Text></View>
              <Pressable onPress={() => setTagSheet(false)} style={styles.sheetClose}><Feather name="x" size={20} color="#D7DBE2" /></Pressable>
            </View>
            <View style={styles.searchBox}>
              <Feather name="search" size={19} color="#7D8490" />
              <TextInput
                value={tagQuery}
                onChangeText={setTagQuery}
                onSubmitEditing={() => addTag(tagQuery)}
                placeholder="Etiket ara veya yeni etiket yaz"
                placeholderTextColor="#676D78"
                style={styles.searchInput}
                returnKeyType="done"
              />
            </View>
            {tagQuery.trim() ? (
              <Pressable onPress={() => addTag(tagQuery)} style={styles.createTagRow}>
                <View style={styles.tagHash}><Text style={styles.tagHashText}>#</Text></View>
                <Text style={styles.createTagText}>“{tagQuery.trim().replace(/^#/, '')}” etiketini ekle</Text>
                <Feather name="plus" size={19} color="#BDAAF8" />
              </Pressable>
            ) : null}
            {tags.length ? (
              <View style={styles.selectedTags}>
                {tags.map((item) => (
                  <Pressable key={item} onPress={() => removeTag(item)} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>#{item}</Text><Feather name="x" size={14} color="#CFC4ED" />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Text style={styles.listEyebrow}>ÖNERİLEN ETİKETLER</Text>
            <View style={styles.tagSuggestions}>
              {filteredTags.map((item) => (
                <Pressable key={item} onPress={() => addTag(item)} style={styles.suggestionChip}>
                  <Text style={styles.suggestionText}>#{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={optionsSheet} transparent animationType="slide" onRequestClose={() => setOptionsSheet(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setOptionsSheet(false)} />
          <View style={[styles.sheet, styles.smallSheet, { paddingBottom: Math.max(insets.bottom, 22) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View><Text style={styles.sheetTitle}>Gönderi Seçenekleri</Text><Text style={styles.sheetSubtitle}>İncelemenin nasıl gösterileceğini belirle</Text></View>
              <Pressable onPress={() => setOptionsSheet(false)} style={styles.sheetClose}><Feather name="x" size={20} color="#D7DBE2" /></Pressable>
            </View>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}><Feather name="alert-triangle" size={19} color="#E8B475" /></View>
              <View style={styles.optionCopy}><Text style={styles.optionTitle}>Spoiler içeriyor</Text><Text style={styles.optionDescription}>Okurlar incelemeyi açmadan önce uyarı görür.</Text></View>
              <Switch value={containsSpoiler} onValueChange={setContainsSpoiler} trackColor={{ false: '#353A44', true: '#7656D7' }} thumbColor="#F4F1FA" />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={previewSheet} transparent animationType="fade" onRequestClose={() => setPreviewSheet(false)}>
        <View style={styles.previewOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewSheet(false)} />
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Yayın Önizlemesi</Text>
              <Pressable onPress={() => setPreviewSheet(false)}><Feather name="x" size={22} color="#F0F1F4" /></Pressable>
            </View>
            <View style={styles.previewUserRow}>
              {profile?.profile_image ? <Image source={{ uri: profile.profile_image }} style={styles.previewAvatar} /> : <View style={styles.previewAvatarFallback}><Text style={styles.previewAvatarText}>{initial}</Text></View>}
              <View><Text style={styles.previewUser}>{displayName}</Text><Text style={styles.previewMeta}>{rating ? `${rating}/5` : 'Puan verilmedi'} · İnceleme</Text></View>
            </View>
            {containsSpoiler ? <View style={styles.previewSpoiler}><Feather name="alert-triangle" size={14} color="#E8B475" /><Text style={styles.previewSpoilerText}>Spoiler içeriyor</Text></View> : null}
            {reviewTitle.trim() ? <Text style={styles.previewReviewTitle}>{reviewTitle.trim()}</Text> : null}
            <Text style={styles.previewBody}>{reviewText.trim() || 'İnceleme metnin burada görünecek.'}</Text>
            {topic ? <Text style={styles.previewTopic}>{topic}</Text> : null}
            {tags.length ? <Text style={styles.previewTags}>{tags.map((item) => `#${item}`).join('  ')}</Text> : null}
            <View style={styles.previewBook}><Feather name="book" size={16} color="#BDAAF8" /><Text style={styles.previewBookText} numberOfLines={1}>{title || 'Bilinmeyen kitap'}</Text></View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090D' },
  header: { minHeight: 82, paddingHorizontal: 16, paddingBottom: 13, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#1D2028' },
  headerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#13151B', borderWidth: 1, borderColor: '#252934', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { color: '#F5F5F7', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: '#777E8A', fontSize: 10, fontWeight: '600' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16 },
  ratingCard: { borderRadius: 20, borderWidth: 1, borderColor: '#2B2D38', backgroundColor: '#111219', padding: 15 },
  ratingTopRow: { flexDirection: 'row', alignItems: 'center' },
  ratingIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#21192E', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  ratingCopy: { flex: 1 },
  ratingTitle: { color: '#F1F2F5', fontSize: 14, fontWeight: '800' },
  ratingHint: { color: '#777E8A', fontSize: 11, marginTop: 3 },
  starsRow: { marginTop: 13, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0B0C11', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 8 },
  starButton: { width: 48, height: 42, alignItems: 'center', justifyContent: 'center' },
  authorRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3 },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 11 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, marginRight: 11, backgroundColor: '#302447', borderWidth: 1, borderColor: '#674D95', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#F2EBFF', fontSize: 17, fontWeight: '900' },
  authorCopy: { flex: 1 },
  authorName: { color: '#F1F2F4', fontSize: 14, fontWeight: '800' },
  authorHandle: { marginTop: 2, color: '#777E8A', fontSize: 11 },
  publicPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 30, borderRadius: 15, backgroundColor: '#12141A', borderWidth: 1, borderColor: '#242832' },
  publicText: { color: '#9AA1AD', fontSize: 10, fontWeight: '700' },
  editorCard: { marginTop: 18, backgroundColor: '#101117', borderRadius: 20, borderWidth: 1, borderColor: '#282B35', overflow: 'hidden' },
  titleInput: { minHeight: 58, paddingHorizontal: 16, color: '#F3F4F6', fontSize: 18, fontWeight: '800' },
  editorDivider: { height: 1, backgroundColor: '#23262E', marginHorizontal: 16 },
  reviewInput: { minHeight: 230, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, color: '#E7E9ED', fontSize: 15, lineHeight: 23 },
  editorFooter: { minHeight: 52, borderTopWidth: 1, borderTopColor: '#23262E', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickActions: { flexDirection: 'row', gap: 4 },
  quickAction: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  characterCount: { color: '#666D79', fontSize: 10, fontWeight: '700' },
  selectionCard: { marginTop: 11, minHeight: 70, borderRadius: 18, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: '#101117', borderWidth: 1, borderColor: '#252832' },
  selectionIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#1C1726', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  selectionCopy: { flex: 1, minWidth: 0 },
  selectionLabel: { color: '#8A919D', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  selectionValue: { marginTop: 4, color: '#E9EAF0', fontSize: 13, fontWeight: '700' },
  selectionPlaceholder: { color: '#676E7A', fontWeight: '600' },
  bookCard: { marginTop: 16, borderRadius: 20, padding: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: '#12131A', borderWidth: 1, borderColor: '#292C36' },
  bookCover: { width: 54, height: 76, borderRadius: 8, overflow: 'hidden' },
  bookCoverFallback: { flex: 1, backgroundColor: '#1C1F27', alignItems: 'center', justifyContent: 'center' },
  bookCopy: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  bookEyebrow: { color: '#8C70E8', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  bookTitle: { color: '#F3F4F6', marginTop: 5, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  bookAuthor: { color: '#858C98', marginTop: 4, fontSize: 12 },
  spoilerNotice: { marginTop: 12, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#211A13', borderWidth: 1, borderColor: '#44311C', flexDirection: 'row', alignItems: 'center', gap: 8 },
  spoilerNoticeText: { flex: 1, color: '#CBAA82', fontSize: 11, lineHeight: 16 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 82, paddingTop: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(11,12,16,0.98)', borderTopWidth: 1, borderTopColor: '#252832' },
  optionsButton: { flex: 1, minWidth: 0, height: 50, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#15171D', borderWidth: 1, borderColor: '#292D37' },
  optionsText: { color: '#AEB4BF', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  previewButton: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15171D', borderWidth: 1, borderColor: '#292D37' },
  publishButton: { minWidth: 112, height: 50, borderRadius: 16, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#A985FF' },
  publishText: { color: '#0A0910', fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.46)' },
  sheetBackdrop: StyleSheet.absoluteFill,
  sheet: { maxHeight: '80%', backgroundColor: '#101115', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 10, borderWidth: 1, borderColor: '#252832' },
  smallSheet: { maxHeight: '55%' },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#555B65', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sheetTitle: { color: '#F4F5F7', fontSize: 21, fontWeight: '900' },
  sheetSubtitle: { color: '#777E8A', fontSize: 11, marginTop: 4 },
  sheetClose: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#191B22', alignItems: 'center', justifyContent: 'center' },
  searchBox: { marginTop: 18, height: 50, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#1A1C22', borderWidth: 1, borderColor: '#292D36' },
  searchInput: { flex: 1, color: '#ECEEF2', fontSize: 14 },
  sheetList: { marginTop: 12 },
  topicRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#23262D', paddingVertical: 10 },
  topicRowSelected: { backgroundColor: '#17131F', borderRadius: 14, paddingHorizontal: 8, borderBottomColor: 'transparent' },
  topicIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1D1827', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  topicCopy: { flex: 1 },
  topicName: { color: '#F1F2F5', fontSize: 14, fontWeight: '800' },
  topicDescription: { color: '#737A86', fontSize: 11, marginTop: 4 },
  createTagRow: { marginTop: 10, minHeight: 52, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#17131F' },
  tagHash: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#2A2040', alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  tagHashText: { color: '#CBB8FF', fontSize: 17, fontWeight: '900' },
  createTagText: { flex: 1, color: '#DADCE2', fontSize: 12, fontWeight: '700' },
  selectedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  tagChip: { minHeight: 34, borderRadius: 17, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2A2040', borderWidth: 1, borderColor: '#4A386D' },
  tagChipText: { color: '#D5C7F7', fontSize: 11, fontWeight: '800' },
  listEyebrow: { color: '#686F7B', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 22, marginBottom: 10 },
  tagSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10 },
  suggestionChip: { minHeight: 36, borderRadius: 18, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#171920', borderWidth: 1, borderColor: '#2C3039' },
  suggestionText: { color: '#AEB5C0', fontSize: 11, fontWeight: '700' },
  optionRow: { marginTop: 18, minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 17, backgroundColor: '#171920', borderWidth: 1, borderColor: '#292D36' },
  optionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2A2118', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  optionCopy: { flex: 1, marginRight: 8 },
  optionTitle: { color: '#ECEEF2', fontSize: 13, fontWeight: '800' },
  optionDescription: { color: '#737A86', fontSize: 10, marginTop: 4, lineHeight: 14 },
  previewOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, backgroundColor: 'rgba(0,0,0,0.72)' },
  previewCard: { borderRadius: 24, padding: 17, backgroundColor: '#111219', borderWidth: 1, borderColor: '#313540' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: '#282B34' },
  previewTitle: { color: '#F3F4F7', fontSize: 16, fontWeight: '900' },
  previewUserRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  previewAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  previewAvatarFallback: { width: 40, height: 40, borderRadius: 20, marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#302447' },
  previewAvatarText: { color: '#F2EAFF', fontWeight: '900' },
  previewUser: { color: '#ECEEF2', fontSize: 13, fontWeight: '800' },
  previewMeta: { color: '#787F8B', fontSize: 10, marginTop: 2 },
  previewSpoiler: { alignSelf: 'flex-start', marginTop: 13, paddingHorizontal: 9, height: 28, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#271F16' },
  previewSpoilerText: { color: '#D6B080', fontSize: 10, fontWeight: '800' },
  previewReviewTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '900', marginTop: 16 },
  previewBody: { color: '#D5D8DE', fontSize: 14, lineHeight: 22, marginTop: 10 },
  previewTopic: { color: '#BBA6F8', fontSize: 11, fontWeight: '800', marginTop: 13 },
  previewTags: { color: '#8D95A2', fontSize: 11, marginTop: 7 },
  previewBook: { marginTop: 16, minHeight: 42, borderRadius: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#181A21' },
  previewBookText: { flex: 1, color: '#C8CDD6', fontSize: 11, fontWeight: '700' },
});
