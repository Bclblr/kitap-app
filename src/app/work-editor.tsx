import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import Image from '@/components/SafeImage';
import { requirePermanentImage } from '@/lib/image-policy';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { pickWorkCover } from '@/lib/upload-cover';
import { Chapter, Work } from '@/lib/works';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type EditorTab = 'details' | 'chapters';

const AUDIENCES = [
  { value: 'general', label: 'Genel' },
  { value: 'teen', label: 'Genç' },
  { value: 'mature', label: 'Yetişkin' },
] as const;

function wordCount(value: string | undefined) {
  return value?.trim().split(/\s+/u).filter(Boolean).length ?? 0;
}

export default function WorkEditor() {
  const { id, addChapter } = useLocalSearchParams<{ id?: string; addChapter?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, scheme } = useAppTheme();
  const styles = useThemedStyles(baseStyles);

  const [tab, setTab] = useState<EditorTab>(addChapter === '1' ? 'chapters' : 'details');
  const [work, setWork] = useState<Partial<Work>>({
    title: '',
    description: '',
    genre: '',
    cover_url: '',
    tags: [],
    language: 'tr',
    audience: 'general',
    completed: false,
    status: 'draft',
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState<Partial<Chapter> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [backup, setBackup] = useState<{ work: Partial<Work>; chapter: Partial<Chapter> | null } | null>(null);
  const [localStatus, setLocalStatus] = useState('');
  const [savedWork, setSavedWork] = useState(JSON.stringify(work));
  const [savedChapter, setSavedChapter] = useState('null');
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null);
  const [preview, setPreview] = useState(false);
  const lock = useRef(false);

  const dirty = authorized && (
    JSON.stringify(work) !== savedWork ||
    JSON.stringify(chapter) !== savedChapter
  );

  const publishedChapterCount = useMemo(
    () => chapters.filter((item) => item.status === 'published').length,
    [chapters]
  );

  usePreventRemove(dirty, ({ data }) => {
    setPendingExit(() => () => navigation.dispatch(data.action));
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw Error('Devam etmek için giriş yapmalısın.');

        if (id) {
          const result = await supabase
            .from('works')
            .select('*')
            .eq('id', id)
            .eq('author_id', auth.user.id)
            .single();

          if (result.error || !result.data) {
            throw Error('Eser bulunamadı veya düzenleme yetkin yok.');
          }

          const parts = await supabase
            .from('work_chapters')
            .select('*')
            .eq('work_id', id)
            .order('position');

          if (parts.error) throw Error('Bölümler yüklenemedi.');

          if (alive) {
            setWork(result.data);
            setSavedWork(JSON.stringify(result.data));
            setChapters(parts.data ?? []);

            if (addChapter === '1') {
              const nextChapter: Partial<Chapter> = {
                title: '',
                content: '',
                position: Math.max(0, ...(parts.data ?? []).map((item) => item.position)) + 1,
                status: 'draft',
              };
              setTab('chapters');
              setChapter(nextChapter);
              setSavedChapter(JSON.stringify(nextChapter));
            }
          }
        }

        const key = `work-editor:${auth.user.id}:${id ?? 'new'}`;
        const saved = await AsyncStorage.getItem(key).catch(() => null);

        if (alive) {
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.work && typeof parsed.work.title === 'string') setBackup(parsed);
            } catch {
              // Ignore malformed device backup.
            }
          }
          setDraftKey(key);
          setAuthorized(true);
        }
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : 'Eser yüklenemedi.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [addChapter, id]);

  useEffect(() => {
    if (!draftKey || !authorized || backup || busy) return;
    let alive = true;
    const timer = setTimeout(() => {
      setLocalStatus('Cihaz taslağı kaydediliyor…');
      void AsyncStorage.setItem(draftKey, JSON.stringify({ work, chapter }))
        .then(() => {
          if (alive) setLocalStatus('Cihaz taslağı kaydedildi.');
        })
        .catch(() => {
          if (alive) setLocalStatus('Cihaz yedeği kaydedilemedi.');
        });
    }, 800);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [authorized, backup, busy, chapter, draftKey, work]);

  function newChapter() {
    const nextChapter: Partial<Chapter> = {
      title: '',
      content: '',
      position: Math.max(0, ...chapters.map((item) => item.position)) + 1,
      status: 'draft',
    };
    selectChapter(nextChapter);
    setTab('chapters');
  }

  function selectChapter(next: Partial<Chapter>) {
    const select = () => {
      setChapter(next);
      setSavedChapter(JSON.stringify(next));
    };

    if (JSON.stringify(chapter) !== savedChapter) {
      setPendingExit(() => select);
    } else {
      select();
    }
  }

  async function chooseCover() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const url = await pickWorkCover();
      if (url) setWork((current) => ({ ...current, cover_url: url }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kapak yüklenemedi.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function moveChapter(first: Chapter, second: Chapter) {
    if (lock.current || JSON.stringify(chapter) !== savedChapter) return;
    lock.current = true;
    setBusy(true);

    try {
      const result = await supabase.rpc('swap_work_chapters', {
        first_id: first.id,
        second_id: second.id,
      });
      if (result.error) throw result.error;

      const ordered = result.data as Chapter[];
      setChapters(ordered);
      const selected = ordered.find((item) => item.id === chapter?.id);
      if (selected) {
        setChapter(selected);
        setSavedChapter(JSON.stringify(selected));
      }
      setMessage('Bölüm sırası kaydedildi.');
    } catch {
      setMessage('Sıra değiştirilemedi. Bölümleri yeniden açıp tekrar deneyebilirsin.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function save(status: 'draft' | 'published', part = false) {
    if (lock.current || !authorized) return;

    const title = (part ? chapter?.title : work.title)?.trim();
    if (!title) {
      setMessage(part ? 'Bölüm başlığı yazmalısın.' : 'Kitap adı yazmalısın.');
      return;
    }

    if (!part && work.cover_url && !/^https:\/\//i.test(work.cover_url)) {
      setMessage('Kapak için geçerli bir HTTPS görsel adresi kullan.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setMessage('Kaydediliyor…');

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw Error('Oturumun sona erdi.');

      if (part && chapter && work.id) {
        const payload = {
          work_id: work.id,
          title,
          content: chapter.content ?? '',
          position: chapter.position ?? 1,
          status,
        };

        const result = chapter.id
          ? await supabase.from('work_chapters').update(payload).eq('id', chapter.id).select().single()
          : await supabase.from('work_chapters').insert(payload).select().single();

        if (result.error) throw result.error;

        setSavedChapter(JSON.stringify(result.data));
        setChapters((current) =>
          [...current.filter((item) => item.id !== result.data.id), result.data]
            .sort((a, b) => a.position - b.position)
        );
        setChapter(result.data);
      } else {
        const payload = {
          author_id: auth.user.id,
          title,
          description: work.description,
          cover_url: requirePermanentImage(work.cover_url),
          genre: work.genre,
          tags: work.tags?.map((tag) => tag.trim()).filter(Boolean),
          language: work.language || 'tr',
          audience: work.audience || 'general',
          completed: work.completed ?? false,
          status,
        };

        const result = work.id
          ? await supabase
              .from('works')
              .update(payload)
              .eq('id', work.id)
              .eq('author_id', auth.user.id)
              .select()
              .single()
          : await supabase.from('works').insert(payload).select().single();

        if (result.error) throw result.error;

        setSavedWork(JSON.stringify(result.data));
        setWork(result.data);
      }

      setMessage(status === 'published' ? 'Yayınlandı.' : 'Taslak kaydedildi.');
    } catch (error) {
      console.error('Eser kaydetme hatası:', error);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Kaydedilemedi. Oturumunu ve bağlantını kontrol et.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Eser editörü hazırlanıyor...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? safeBack(router, '/my-works') : router.replace('/my-works'))}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{id ? 'ESER YÖNETİMİ' : 'YENİ ESER'}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {work.title?.trim() || 'İsimsiz kitap'}
          </Text>
        </View>

        <View style={[styles.statusBadge, work.status === 'published' && styles.statusBadgePublished]}>
          <Text style={[styles.statusBadgeText, work.status === 'published' && styles.statusBadgeTextPublished]}>
            {work.status === 'published' ? 'YAYINDA' : 'TASLAK'}
          </Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setTab('details')}
          style={[styles.tab, tab === 'details' && styles.tabActive]}
        >
          <Feather name="book" size={17} color={tab === 'details' ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'details' && styles.tabTextActive]}>Kitap Bilgileri</Text>
        </Pressable>

        <Pressable
          onPress={() => setTab('chapters')}
          style={[styles.tab, tab === 'chapters' && styles.tabActive]}
        >
          <Feather name="list" size={17} color={tab === 'chapters' ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'chapters' && styles.tabTextActive]}>
            Bölümler{id ? ` (${chapters.length})` : ''}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!!message && (
          <View style={styles.notice}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{message}</Text>
          </View>
        )}

        {!!localStatus && dirty && (
          <View style={styles.autoSaveRow}>
            <Feather name="cloud" size={14} color={colors.textMuted} />
            <Text style={styles.autoSaveText}>{localStatus}</Text>
          </View>
        )}

        {backup && (
          <View style={styles.backupCard}>
            <View style={styles.backupIcon}>
              <Feather name="clock" size={20} color={colors.primary} />
            </View>
            <View style={styles.backupCopy}>
              <Text style={styles.cardTitle}>Cihaz taslağı bulundu</Text>
              <Text style={styles.cardDescription}>
                Bu cihazda daha önce kaydedilmiş bir çalışma var.
              </Text>
            </View>
            <View style={styles.backupActions}>
              <Pressable
                onPress={() => {
                  setWork(backup.work);
                  setChapter(backup.chapter);
                  setBackup(null);
                }}
                style={styles.smallPrimaryButton}
              >
                <Text style={styles.smallPrimaryButtonText}>Taslağı Aç</Text>
              </Pressable>
              <Pressable onPress={() => setBackup(null)} style={styles.smallGhostButton}>
                <Text style={styles.smallGhostButtonText}>Atla</Text>
              </Pressable>
            </View>
          </View>
        )}

        {authorized && tab === 'details' && (
          <>
            <View style={styles.heroCard}>
              <Pressable
                onPress={() => void chooseCover()}
                disabled={busy}
                style={styles.coverPicker}
              >
                {work.cover_url ? (
                  <Image source={{ uri: work.cover_url }} resizeMode="cover" style={styles.coverImage} />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Feather name="image" size={28} color={colors.primary} />
                    <Text style={styles.coverPlaceholderTitle}>Kapak ekle</Text>
                    <Text style={styles.coverPlaceholderText}>Galeriden seç</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.heroFields}>
                <EditorField
                  label="Kitap adı"
                  value={work.title ?? ''}
                  onChangeText={(title) => setWork((current) => ({ ...current, title }))}
                  placeholder="Kitabının adını yaz"
                  maxLength={160}
                  colors={colors}
                  scheme={scheme}
                />
                <EditorField
                  label="Kısa açıklama"
                  value={work.description ?? ''}
                  onChangeText={(description) => setWork((current) => ({ ...current, description }))}
                  placeholder="Okura kitabını birkaç cümleyle anlat"
                  multiline
                  colors={colors}
                  scheme={scheme}
                />
              </View>
            </View>

            {work.cover_url ? (
              <Pressable
                onPress={() => setWork((current) => ({ ...current, cover_url: null }))}
                style={styles.removeCoverButton}
                disabled={busy}
              >
                <Feather name="trash-2" size={14} color="#FF9BA7" />
                <Text style={styles.removeCoverText}>Kapağı kaldır</Text>
              </Pressable>
            ) : null}

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Feather name="tag" size={17} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Yayın bilgileri</Text>
                  <Text style={styles.sectionDescription}>Kitabın keşfedilmesini kolaylaştır.</Text>
                </View>
              </View>

              <EditorField
                label="Tür"
                value={work.genre ?? ''}
                onChangeText={(genre) => setWork((current) => ({ ...current, genre }))}
                placeholder="Örn. Roman, Tarih, Bilim Kurgu"
                colors={colors}
                scheme={scheme}
              />
              <EditorField
                label="Etiketler"
                value={work.tags?.join(', ') ?? ''}
                onChangeText={(tags) => setWork((current) => ({ ...current, tags: tags.split(',') }))}
                placeholder="Örn. tarih, macera, istanbul"
                helper="Etiketleri virgülle ayır."
                colors={colors}
                scheme={scheme}
              />
              <EditorField
                label="Dil"
                value={work.language ?? 'tr'}
                onChangeText={(language) => setWork((current) => ({ ...current, language }))}
                placeholder="tr"
                maxLength={20}
                autoCapitalize="none"
                colors={colors}
                scheme={scheme}
              />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Feather name="users" size={17} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>İçerik ayarları</Text>
                  <Text style={styles.sectionDescription}>Hedef kitle ve eser durumunu belirle.</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>İçerik sınıflaması</Text>
              <View style={styles.choiceRow}>
                {AUDIENCES.map((item) => {
                  const active = (work.audience ?? 'general') === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setWork((current) => ({ ...current, audience: item.value }))}
                      style={[styles.choiceChip, active && styles.choiceChipActive]}
                    >
                      {active ? <Feather name="check" size={13} color={colors.primary} /> : null}
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => setWork((current) => ({ ...current, completed: !current.completed }))}
                style={styles.toggleRow}
              >
                <View style={[styles.toggleBox, work.completed && styles.toggleBoxActive]}>
                  {work.completed ? <Feather name="check" size={15} color="#FFF" /> : null}
                </View>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>Kitap tamamlandı</Text>
                  <Text style={styles.toggleDescription}>
                    İşaretlenmezse eser “Devam ediyor” olarak gösterilir.
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.stickyActionsCard}>
              <Pressable
                disabled={busy}
                onPress={() => void save('draft')}
                style={[styles.secondarySaveButton, busy && styles.disabled]}
              >
                <Feather name="save" size={17} color={colors.primary} />
                <Text style={styles.secondarySaveText}>Taslak Kaydet</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => void save('published')}
                style={[styles.primarySaveButton, busy && styles.disabled]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Feather name="send" size={17} color="#FFF" />
                )}
                <Text style={styles.primarySaveText}>
                  {work.status === 'published' ? 'Değişiklikleri Yayınla' : 'Kitabı Yayınla'}
                </Text>
              </Pressable>
            </View>

            {work.id ? (
              <Pressable
                onPress={() => router.push({ pathname: '/work', params: { id: work.id! } })}
                style={styles.previewBookButton}
              >
                <Feather name="eye" size={16} color={colors.primary} />
                <Text style={styles.previewBookText}>Okur görünümünü aç</Text>
              </Pressable>
            ) : null}
          </>
        )}

        {authorized && tab === 'chapters' && (
          <>
            {!work.id ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Feather name="book-open" size={25} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Önce kitabı kaydet</Text>
                <Text style={styles.emptyText}>
                  Bölüm ekleyebilmek için önce Kitap Bilgileri sekmesinden kitabı taslak olarak kaydet.
                </Text>
                <Pressable onPress={() => setTab('details')} style={styles.primaryInlineButton}>
                  <Text style={styles.primaryInlineButtonText}>Kitap Bilgilerine Git</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.chapterSummary}>
                  <View style={styles.chapterMetric}>
                    <Text style={styles.chapterMetricValue}>{chapters.length}</Text>
                    <Text style={styles.chapterMetricLabel}>Toplam bölüm</Text>
                  </View>
                  <View style={styles.chapterMetric}>
                    <Text style={styles.chapterMetricValue}>{publishedChapterCount}</Text>
                    <Text style={styles.chapterMetricLabel}>Yayında</Text>
                  </View>
                  <View style={styles.chapterMetric}>
                    <Text style={styles.chapterMetricValue}>{chapters.length - publishedChapterCount}</Text>
                    <Text style={styles.chapterMetricLabel}>Taslak</Text>
                  </View>
                </View>

                <View style={styles.chapterHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Bölümler</Text>
                    <Text style={styles.sectionDescription}>Bölümleri düzenle, sırala ve yayınla.</Text>
                  </View>
                  <Pressable onPress={newChapter} style={styles.addChapterButton}>
                    <Feather name="plus" size={16} color="#FFF" />
                    <Text style={styles.addChapterButtonText}>Yeni Bölüm</Text>
                  </Pressable>
                </View>

                {chapters.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                      <Feather name="file-text" size={25} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>Henüz bölüm yok</Text>
                    <Text style={styles.emptyText}>İlk bölümünü oluşturarak yazmaya başlayabilirsin.</Text>
                    <Pressable onPress={newChapter} style={styles.primaryInlineButton}>
                      <Text style={styles.primaryInlineButtonText}>İlk Bölümü Yaz</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.chapterList}>
                    {chapters.map((item, index) => {
                      const selected = chapter?.id === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => selectChapter(item)}
                          style={[styles.chapterCard, selected && styles.chapterCardActive]}
                        >
                          <View style={styles.chapterNumber}>
                            <Text style={styles.chapterNumberText}>{item.position}</Text>
                          </View>
                          <View style={styles.chapterCardCopy}>
                            <Text style={styles.chapterTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.chapterMeta}>
                              {item.status === 'published' ? 'Yayında' : 'Taslak'} · {wordCount(item.content)} kelime
                            </Text>
                          </View>
                          <View style={styles.reorderActions}>
                            <Pressable
                              disabled={busy || index === 0 || JSON.stringify(chapter) !== savedChapter}
                              onPress={() => void moveChapter(item, chapters[index - 1])}
                              style={styles.reorderButton}
                            >
                              <Feather name="chevron-up" size={17} color={colors.textSecondary} />
                            </Pressable>
                            <Pressable
                              disabled={busy || index === chapters.length - 1 || JSON.stringify(chapter) !== savedChapter}
                              onPress={() => void moveChapter(item, chapters[index + 1])}
                              style={styles.reorderButton}
                            >
                              <Feather name="chevron-down" size={17} color={colors.textSecondary} />
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {chapter && (
                  <View style={styles.chapterEditor}>
                    <View style={styles.chapterEditorHeader}>
                      <View>
                        <Text style={styles.eyebrow}>{chapter.id ? 'BÖLÜMÜ DÜZENLE' : 'YENİ BÖLÜM'}</Text>
                        <Text style={styles.chapterEditorTitle}>{chapter.title?.trim() || 'İsimsiz bölüm'}</Text>
                      </View>
                      <Pressable onPress={() => setChapter(null)} style={styles.closeChapterButton}>
                        <Feather name="x" size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>

                    <EditorField
                      label="Bölüm başlığı"
                      value={chapter.title ?? ''}
                      onChangeText={(title) => setChapter((current) => ({ ...current, title }))}
                      placeholder="Bölüm başlığını yaz"
                      maxLength={160}
                      colors={colors}
                      scheme={scheme}
                    />

                    <EditorField
                      label="Bölüm sırası"
                      value={String(chapter.position ?? 1)}
                      onChangeText={(position) =>
                        setChapter((current) => ({
                          ...current,
                          position: Math.max(1, Number(position) || 1),
                        }))
                      }
                      keyboardType="number-pad"
                      colors={colors}
                      scheme={scheme}
                    />

                    <View style={styles.editorField}>
                      <View style={styles.editorLabelRow}>
                        <Text style={styles.fieldLabel}>Bölüm metni</Text>
                        <Text style={styles.counterText}>
                          {wordCount(chapter.content)} kelime · {Array.from(chapter.content ?? '').length} karakter
                        </Text>
                      </View>
                      <TextInput
                        value={chapter.content ?? ''}
                        onChangeText={(content) => setChapter((current) => ({ ...current, content }))}
                        placeholder="Bölümünü burada yazmaya başla..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        textAlignVertical="top"
                        keyboardAppearance={scheme}
                        style={styles.chapterTextInput}
                      />
                    </View>

                    <View style={styles.chapterActionRow}>
                      <Pressable onPress={() => setPreview(true)} style={styles.previewButton}>
                        <Feather name="eye" size={16} color={colors.primary} />
                        <Text style={styles.previewButtonText}>Önizle</Text>
                      </Pressable>
                      <Pressable
                        disabled={busy}
                        onPress={() => void save('draft', true)}
                        style={[styles.chapterDraftButton, busy && styles.disabled]}
                      >
                        <Feather name="save" size={16} color={colors.primary} />
                        <Text style={styles.chapterDraftText}>Taslak Kaydet</Text>
                      </Pressable>
                      <Pressable
                        disabled={busy}
                        onPress={() => void save('published', true)}
                        style={[styles.chapterPublishButton, busy && styles.disabled]}
                      >
                        {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="send" size={16} color="#FFF" />}
                        <Text style={styles.chapterPublishText}>Bölümü Yayınla</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={preview} animationType="slide" onRequestClose={() => setPreview(false)}>
        <View style={styles.previewScreen}>
          <View style={styles.previewHeader}>
            <Pressable onPress={() => setPreview(false)} style={styles.headerButton}>
              <Feather name="x" size={21} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.previewHeaderTitle}>Bölüm Önizlemesi</Text>
            <View style={styles.previewSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.previewContent}>
            <Text style={styles.previewTitle}>{chapter?.title || 'İsimsiz bölüm'}</Text>
            <Text selectable style={styles.previewText}>{chapter?.content || 'Henüz metin yok.'}</Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        transparent
        visible={!!pendingExit}
        animationType="fade"
        onRequestClose={() => setPendingExit(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Feather name="alert-circle" size={22} color="#F4B86A" />
            </View>
            <Text style={styles.confirmTitle}>Kaydedilmemiş değişiklikler</Text>
            <Text style={styles.confirmText}>
              Bu bölümde yaptığın değişiklikler henüz sunucuya kaydedilmedi.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable onPress={() => setPendingExit(null)} style={styles.confirmSecondary}>
                <Text style={styles.confirmSecondaryText}>Yazmaya Devam Et</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const action = pendingExit;
                  setPendingExit(null);
                  action?.();
                }}
                style={styles.confirmDanger}
              >
                <Text style={styles.confirmDangerText}>Kaydetmeden Çık</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

type EditorFieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  helper?: string;
  colors: {
    textMuted: string;
  };
  scheme: 'light' | 'dark';
};

function EditorField({ label, helper, colors, scheme, multiline, style, ...props }: EditorFieldProps) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.editorField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        keyboardAppearance={scheme}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.multilineInput, style]}
      />
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090D' },
  loadingScreen: { flex: 1, backgroundColor: '#08090D', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#858791', fontSize: 12 },

  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#20212A', backgroundColor: '#0B0C11' },
  headerButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15161D', borderWidth: 1, borderColor: '#292A33' },
  headerCopy: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  eyebrow: { color: '#A985FF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '900', marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#5B4B38', backgroundColor: '#2A241C' },
  statusBadgePublished: { borderColor: '#3B6A4F', backgroundColor: '#17291E' },
  statusBadgeText: { color: '#E8BB79', fontSize: 8, fontWeight: '900' },
  statusBadgeTextPublished: { color: '#8DD5A5' },

  tabBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, backgroundColor: '#0B0C11' },
  tab: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#252630', backgroundColor: '#111218', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  tabActive: { backgroundColor: '#21172F', borderColor: '#583E80' },
  tabText: { color: '#777983', fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: '#D9CAFF' },

  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 80, gap: 14 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: '#3A2A54', backgroundColor: '#181221', padding: 11 },
  noticeText: { flex: 1, color: '#C9B8ED', fontSize: 11, lineHeight: 17 },
  autoSaveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
  autoSaveText: { color: '#70727C', fontSize: 9 },

  backupCard: { borderRadius: 16, borderWidth: 1, borderColor: '#3A2A54', backgroundColor: '#14111B', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' },
  backupIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#221833', alignItems: 'center', justifyContent: 'center' },
  backupCopy: { flex: 1, minWidth: 180 },
  backupActions: { flexDirection: 'row', gap: 7 },
  cardTitle: { color: '#F1F1F4', fontSize: 13, fontWeight: '900' },
  cardDescription: { color: '#858791', fontSize: 10, marginTop: 3 },
  smallPrimaryButton: { borderRadius: 10, backgroundColor: '#6232B5', paddingHorizontal: 11, paddingVertical: 9 },
  smallPrimaryButtonText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  smallGhostButton: { borderRadius: 10, borderWidth: 1, borderColor: '#30313B', backgroundColor: '#171820', paddingHorizontal: 11, paddingVertical: 9 },
  smallGhostButtonText: { color: '#A0A1AA', fontSize: 9, fontWeight: '800' },

  heroCard: { flexDirection: 'row', alignItems: 'stretch', gap: 15, borderRadius: 20, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 15 },
  coverPicker: { width: 142, minHeight: 202, borderRadius: 14, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%', minHeight: 202, borderRadius: 14, backgroundColor: '#171820' },
  coverPlaceholder: { flex: 1, minHeight: 202, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#503B72', backgroundColor: '#181320', alignItems: 'center', justifyContent: 'center', padding: 12 },
  coverPlaceholderTitle: { color: '#D8C8FF', fontSize: 12, fontWeight: '900', marginTop: 8 },
  coverPlaceholderText: { color: '#757781', fontSize: 9, marginTop: 3 },
  heroFields: { flex: 1, minWidth: 0, gap: 13 },
  removeCoverButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: '#241519', borderWidth: 1, borderColor: '#593039' },
  removeCoverText: { color: '#FF9BA7', fontSize: 9, fontWeight: '800' },

  sectionCard: { borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 15, gap: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  sectionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#21172F', borderWidth: 1, borderColor: '#3B2B52', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: '#F1F1F4', fontSize: 15, fontWeight: '900' },
  sectionDescription: { color: '#747680', fontSize: 10, marginTop: 2 },

  editorField: { gap: 6 },
  fieldLabel: { color: '#A9AAB3', fontSize: 10, fontWeight: '800' },
  editorLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fieldHelper: { color: '#666873', fontSize: 9 },
  input: { minHeight: 46, width: '100%', borderRadius: 12, borderWidth: 1, borderColor: '#30313B', backgroundColor: '#171820', color: '#F4F4F6', paddingHorizontal: 12, paddingVertical: 10, fontSize: 12 },
  multilineInput: { minHeight: 112, textAlignVertical: 'top' },

  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceChip: { minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: '#30313B', backgroundColor: '#171820', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  choiceChipActive: { borderColor: '#5E4486', backgroundColor: '#231831' },
  choiceText: { color: '#7F818B', fontSize: 10, fontWeight: '800' },
  choiceTextActive: { color: '#D7C8FA' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#15161D', padding: 11 },
  toggleBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: '#454650', alignItems: 'center', justifyContent: 'center' },
  toggleBoxActive: { backgroundColor: '#6232B5', borderColor: '#8056C8' },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: '#E8E8EC', fontSize: 11, fontWeight: '800' },
  toggleDescription: { color: '#6F717B', fontSize: 9, marginTop: 2 },

  stickyActionsCard: { flexDirection: 'row', gap: 9, borderRadius: 17, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 10 },
  secondarySaveButton: { flex: 1, minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#4A3568', backgroundColor: '#1C1527', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondarySaveText: { color: '#CFBCF5', fontSize: 10, fontWeight: '900' },
  primarySaveButton: { flex: 1.3, minHeight: 45, borderRadius: 12, backgroundColor: '#6232B5', borderWidth: 1, borderColor: '#8056C8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primarySaveText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  previewBookButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  previewBookText: { color: '#BBA2EA', fontSize: 10, fontWeight: '800' },

  chapterSummary: { flexDirection: 'row', gap: 8 },
  chapterMetric: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 12 },
  chapterMetricValue: { color: '#F1F1F4', fontSize: 18, fontWeight: '900' },
  chapterMetricLabel: { color: '#777983', fontSize: 9, marginTop: 3 },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  addChapterButton: { minHeight: 39, borderRadius: 11, backgroundColor: '#6232B5', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addChapterButtonText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  chapterList: { gap: 8 },
  chapterCard: { minHeight: 66, borderRadius: 15, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chapterCardActive: { borderColor: '#60458A', backgroundColor: '#171220' },
  chapterNumber: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#21172F', alignItems: 'center', justifyContent: 'center' },
  chapterNumberText: { color: '#CDB8F6', fontSize: 12, fontWeight: '900' },
  chapterCardCopy: { flex: 1, minWidth: 0 },
  chapterTitle: { color: '#EFEFF2', fontSize: 12, fontWeight: '900' },
  chapterMeta: { color: '#747680', fontSize: 9, marginTop: 4 },
  reorderActions: { flexDirection: 'row', gap: 4 },
  reorderButton: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#171820', alignItems: 'center', justifyContent: 'center' },

  chapterEditor: { borderRadius: 20, borderWidth: 1, borderColor: '#43305F', backgroundColor: '#111018', padding: 15, gap: 13, marginTop: 4 },
  chapterEditorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  chapterEditorTitle: { color: '#F4F4F6', fontSize: 18, fontWeight: '900', marginTop: 3 },
  closeChapterButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#191A21', borderWidth: 1, borderColor: '#2E2F38', alignItems: 'center', justifyContent: 'center' },
  counterText: { color: '#686A74', fontSize: 9 },
  chapterTextInput: { minHeight: 360, borderRadius: 14, borderWidth: 1, borderColor: '#30313B', backgroundColor: '#0E0F14', color: '#F0F0F3', padding: 15, fontSize: 15, lineHeight: 25 },
  chapterActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewButton: { minHeight: 41, borderRadius: 11, borderWidth: 1, borderColor: '#3E2F55', backgroundColor: '#1A1522', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewButtonText: { color: '#CBB6F0', fontSize: 9, fontWeight: '900' },
  chapterDraftButton: { minHeight: 41, borderRadius: 11, borderWidth: 1, borderColor: '#4A3568', backgroundColor: '#1C1527', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chapterDraftText: { color: '#CFBCF5', fontSize: 9, fontWeight: '900' },
  chapterPublishButton: { flex: 1, minHeight: 41, borderRadius: 11, backgroundColor: '#6232B5', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  chapterPublishText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  emptyCard: { minHeight: 220, borderRadius: 18, borderWidth: 1, borderColor: '#292A33', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#21172F', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#F1F1F4', fontSize: 15, fontWeight: '900', marginTop: 12 },
  emptyText: { color: '#777983', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 5, maxWidth: 420 },
  primaryInlineButton: { marginTop: 14, borderRadius: 11, backgroundColor: '#6232B5', paddingHorizontal: 14, paddingVertical: 10 },
  primaryInlineButtonText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  previewScreen: { flex: 1, backgroundColor: '#0A0A0E' },
  previewHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#20212A' },
  previewHeaderTitle: { flex: 1, textAlign: 'center', color: '#F4F4F6', fontSize: 15, fontWeight: '900' },
  previewSpacer: { width: 40 },
  previewContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 22, paddingBottom: 60 },
  previewTitle: { color: '#F4F4F6', fontSize: 26, lineHeight: 34, fontWeight: '900', marginBottom: 20 },
  previewText: { color: '#D4D4DA', fontSize: 17, lineHeight: 29 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.65)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  confirmCard: { width: '100%', maxWidth: 430, borderRadius: 20, borderWidth: 1, borderColor: '#34313A', backgroundColor: '#15151D', padding: 20 },
  confirmIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#2A2118', borderWidth: 1, borderColor: '#5B4732', alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { color: '#F4F4F6', fontSize: 17, fontWeight: '900', marginTop: 13 },
  confirmText: { color: '#9698A2', fontSize: 11, lineHeight: 17, marginTop: 6 },
  confirmActions: { flexDirection: 'row', gap: 8, marginTop: 17 },
  confirmSecondary: { flex: 1, minHeight: 43, borderRadius: 11, backgroundColor: '#20212A', borderWidth: 1, borderColor: '#30313B', alignItems: 'center', justifyContent: 'center' },
  confirmSecondaryText: { color: '#D1D2D8', fontSize: 9, fontWeight: '900' },
  confirmDanger: { flex: 1, minHeight: 43, borderRadius: 11, backgroundColor: '#8B3947', alignItems: 'center', justifyContent: 'center' },
  confirmDangerText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
});
