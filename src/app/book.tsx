import { safeBack } from '@/lib/navigation';
import BookCover from '@/components/BookCover';
import BookDiscoveryRecommendations from '@/components/BookDiscoveryRecommendations';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { BookCoverData, existingBookCover, loadOpenLibraryBookMetadata, openLibraryUrl } from '@/lib/open-library-cover';

// BOOK_DARK_PREMIUM_V1

type Author = string | { name?: string };

type BookStatus = 'reading' | 'read' | 'want' | 'abandoned';

type Book = BookCoverData & {
  key?: string;
  title?: string;
  authors?: Author[];
  description?: string | { value?: string } | null;
  covers?: (number | string)[] | null;
  first_publish_year?: number | null;
  status?: BookStatus;
};

type BookNote = {
  id: string;
  content: string;
  page_number: number | null;
  created_at: string;
};

async function saveBookStatusToSupabase(
  bookKey: string,
  bookTitle: string,
  status: BookStatus
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && userError.name !== 'AuthSessionMissingError') {
    throw userError;
  }

  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }

  const { error } = await supabase.rpc('set_user_book_status', {
    p_book_key: bookKey,
    p_book_title: bookTitle,
    p_status: status,
  });

  if (error) throw error;
}

export default function BookScreen() {
  const styles = useThemedStyles(baseStyles);
  const { key, author, title, description: routeDescription, coverUrl: routeCoverUrl,
    cover_url: routeCover, cover_i: routeCoverId, isbn, edition_key: editionKey } = useLocalSearchParams<{
    key?: string; author?: string; title?: string; description?: string;
    coverUrl?: string; cover_url?: string; cover_i?: string; isbn?: string; edition_key?: string;
  }>();

  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [status, setStatus] = useState<BookStatus>('want');

  const [showQuoteBox, setShowQuoteBox] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteSaved, setQuoteSaved] = useState(false);

  const [showNoteBox, setShowNoteBox] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notePageInput, setNotePageInput] = useState('');
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function getBook() {
      const bookKey = key;
      const url = openLibraryUrl(bookKey);
      let shelfStatus: BookStatus | null = null;

      setAdded(false);
      setStatus('want');

      let availableBook: Book | null = url || title ? {
        key: bookKey,
        title: title || 'Bilinmeyen kitap',
        authors: author ? [author] : [],
        description: routeDescription,
        coverUrl: routeCoverUrl,
        cover_url: routeCover,
        cover_i: routeCoverId,
        isbn,
        edition_key: editionKey,
      } : null;

      setBook(availableBook);
      setLoading(true);

      try {
        if (bookKey) {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError && userError.name !== 'AuthSessionMissingError') {
            throw userError;
          }

          if (user) {
            const { data: shelfRow, error: shelfError } = await supabase
              .from('user_book_status')
              .select('book_title, status')
              .eq('user_id', user.id)
              .eq('book_key', bookKey)
              .maybeSingle();

            if (shelfError) throw shelfError;
            if (!active) return;

            if (shelfRow) {
              shelfStatus = shelfRow.status as BookStatus;
              setAdded(true);
              setStatus(shelfStatus);
              availableBook = {
                ...availableBook,
                key: bookKey,
                title: availableBook?.title || shelfRow.book_title || 'Bilinmeyen kitap',
                status: shelfStatus,
              };
              setBook(availableBook);
            }
          }
        }

        if (!active || !url) return;

        const hasDescription = typeof availableBook?.description === 'string'
          ? !!availableBook.description.trim()
          : !!availableBook?.description?.value;

        if (
          availableBook?.title &&
          availableBook.title !== 'Bilinmeyen kitap' &&
          availableBook.authors?.length &&
          existingBookCover(availableBook) &&
          hasDescription
        ) {
          return;
        }

        const metadata = await loadOpenLibraryBookMetadata(bookKey ?? '', availableBook);

        if (active && metadata) {
          setBook((current) => ({
            ...current,
            ...metadata,
            key: bookKey,
            title: metadata.title ?? current?.title ?? availableBook?.title,
            authors: metadata.authors?.length
              ? metadata.authors
              : current?.authors ?? availableBook?.authors,
            status: shelfStatus ?? current?.status,
          }));
        }
      } catch (error) {
        if (!active) return;
        if (
          error instanceof TypeError ||
          (error instanceof Error && error.message.startsWith('Open Library HTTP'))
        ) {
          console.warn('Kitap detay isteği tamamlanamadı:', url, error);
        } else {
          console.error('Kitap detay hatası:', error);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void getBook();
    return () => {
      active = false;
      controller.abort();
    };
  }, [author, editionKey, isbn, key, routeCover, routeCoverId, routeCoverUrl, routeDescription, title]);

  async function loadBookNotes(bookKey: string) {
    try {
      setNotesLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError && authError.name !== 'AuthSessionMissingError') {
        throw authError;
      }

      if (!user) {
        setNotes([]);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('book_notes')
        .select('id, content, page_number, created_at')
        .eq('user_id', user.id)
        .eq('book_key', bookKey)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes((data ?? []) as BookNote[]);
    } catch (error) {
      console.error('Kitap notları yüklenemedi:', error);
    } finally {
      setNotesLoading(false);
    }
  }


  useEffect(() => {
    if (!key) return;
    void loadBookNotes(key);
  }, [key]);

  async function addToShelf() {
    if (!book || !key) return;

    try {
      await saveBookStatusToSupabase(
        key,
        book.title ?? '',
        status
      );
      setAdded(true);
      setBook((current) => current ? { ...current, status } : current);
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
        Alert.alert('Giriş gerekli', 'Kitabı rafına eklemek için giriş yapmalısın.');
        return;
      }
      console.error('Rafa ekleme hatası:', error);
      Alert.alert('Rafa eklenemedi', 'Lütfen tekrar dene.');
    }
  }

  async function changeStatus(newStatus: BookStatus) {
    if (!book || !key) return;

    try {
      await saveBookStatusToSupabase(
        key,
        book.title ?? '',
        newStatus
      );
      setStatus(newStatus);
      setAdded(true);
      setBook((current) => current ? { ...current, status: newStatus } : current);
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
        Alert.alert('Giriş gerekli', 'Okuma durumunu kaydetmek için giriş yapmalısın.');
        return;
      }
      console.error('Durum kaydetme hatası:', error);
      Alert.alert('Durum kaydedilemedi', 'Lütfen tekrar dene.');
    }
  }

  async function saveQuote() {
    const cleanQuote = quoteText.trim();

    if (savingQuote || !cleanQuote || !book || !key) {
      return;
    }

    setSavingQuote(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        Alert.alert('Giriş gerekli', 'Alıntı paylaşmak için giriş yapmalısın.');
        return;
      }
      const { error } = await supabase.from('quotes').insert({
        user_id: user.id,
        book_key: key,
        book_title: book.title ?? 'Bilinmeyen kitap',
        text: cleanQuote,
      });
      if (error) throw error;

      setQuoteText('');
      setShowQuoteBox(false);
      setQuoteSaved(true);

      setTimeout(() => {
        setQuoteSaved(false);
      }, 2500);
    } catch (error) {
      console.error('Alıntı kaydedilemedi:', error);
    } finally {
      setSavingQuote(false);
    }
  }


  async function saveNote() {
    const cleanNote = noteText.trim();
    if (!cleanNote || !book || !key || savingNote) return;

    const cleanPage = notePageInput.trim();
    let pageNumber: number | null = null;

    if (cleanPage) {
      if (!/^\d+$/.test(cleanPage) || Number(cleanPage) <= 0) {
        Alert.alert('Geçersiz sayfa', 'Sayfa numarası pozitif bir tam sayı olmalı.');
        return;
      }
      pageNumber = Number(cleanPage);
    }

    try {
      setSavingNote(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) {
        Alert.alert('Giriş gerekli', 'Kitaba özel not eklemek için giriş yapmalısın.');
        return;
      }

      const { data, error } = await (supabase as any)
        .from('book_notes')
        .insert({
          user_id: user.id,
          book_key: key,
          book_title: book.title ?? 'Bilinmeyen kitap',
          content: cleanNote,
          page_number: pageNumber,
        })
        .select('id, content, page_number, created_at')
        .single();

      if (error) throw error;

      setNotes((current) => [data as BookNote, ...current]);
      setNoteText('');
      setNotePageInput('');
      setShowNoteBox(false);
      Alert.alert('Not kaydedildi', 'Bu not yalnızca senin hesabında görünür.');
    } catch (error) {
      console.error('Kitap notu kaydedilemedi:', error);
      Alert.alert('Not kaydedilemedi', 'Lütfen tekrar dene.');
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) return;

      const { error } = await (supabase as any)
        .from('book_notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) throw error;
      setNotes((current) => current.filter((note) => note.id !== noteId));
    } catch (error) {
      console.error('Kitap notu silinemedi:', error);
      Alert.alert('Not silinemedi', 'Lütfen tekrar dene.');
    }
  }

  function openReview() {
    if (!key) {
      console.log('İnceleme açılamadı: kitap key yok');
      return;
    }

    router.push({
      pathname: '/review',
      params: {
        key,
        title: book?.title ?? 'Bilinmeyen kitap',
        author: book?.authors
          ?.map((item) => typeof item === 'string' ? item : item.name)
          .filter(Boolean)
          .join(', ') || author || 'Bilinmeyen yazar',
        coverUrl: existingBookCover(book ?? {}) ?? undefined,
      },
    });
  }

  if (loading && !book) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#A985FF" />
        <Text style={styles.loadingText}>Kitap bilgileri yükleniyor...</Text>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Feather name="book" size={24} color="#A985FF" />
        </View>
        <Text style={styles.errorTitle}>Kitap bulunamadı</Text>
        <Text style={styles.errorText}>Kitap bilgilerine şu anda ulaşılamıyor.</Text>
        <Pressable onPress={() => router.replace('/explore')} style={styles.backButton}>
          <Feather name="arrow-left" size={17} color="#F4F5F7" />
          <Text style={styles.backButtonText}>Keşfet’e dön</Text>
        </Pressable>
      </View>
    );
  }

  const coverUrl = existingBookCover(book);

  const description =
    typeof book.description === 'string'
      ? book.description
      : book.description?.value;

  const authorNames =
    book.authors
      ?.map((item) => {
        if (typeof item === 'string') return item;
        return item.name;
      })
      .filter(Boolean)
      .join(', ') ||
    author ||
    'Bilinmeyen yazar';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.topBar}>
            <Pressable onPress={() => safeBack(router, '/explore')} style={styles.iconButton}>
              <Feather name="arrow-left" size={21} color="#F4F5F7" />
            </Pressable>
            <Text style={styles.pageTitle}>Kitap Detayı</Text>
            <View style={styles.iconButtonPlaceholder} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.coverShadow}>
              <BookCover uri={coverUrl} style={styles.cover}>
                <View style={styles.noCover}>
                  <Feather name="book-open" size={34} color="#717784" />
                  <Text style={styles.noCoverText}>Kapak yok</Text>
                </View>
              </BookCover>
            </View>

            <View style={styles.bookInfo}>
              <View style={styles.eyebrow}>
                <Feather name="book" size={13} color="#A985FF" />
                <Text style={styles.eyebrowText}>KİTAP</Text>
              </View>
              <Text style={styles.title}>{book.title ?? 'Bilinmeyen kitap'}</Text>
              <Text style={styles.author}>{authorNames}</Text>
              {book.first_publish_year ? (
                <View style={styles.metaRow}>
                  <Feather name="calendar" size={14} color="#8F96A3" />
                  <Text style={styles.metaText}>İlk yayın {book.first_publish_year}</Text>
                </View>
              ) : null}
              {added ? (
                <View style={styles.shelfBadge}>
                  <Feather name="check" size={13} color="#C8B6FF" />
                  <Text style={styles.shelfBadgeText}>Rafında</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Okuma Durumu</Text>
              <Text style={styles.sectionHint}>Durumunu seç</Text>
            </View>

            <View style={styles.statusRow}>
              <Pressable onPress={() => void changeStatus('want')} style={[styles.statusButton, status === 'want' && styles.statusButtonSelected]}>
                <View style={[styles.statusIcon, status === 'want' && styles.statusIconSelected]}>
                  <Feather name="bookmark" size={17} color={status === 'want' ? '#F4F5F7' : '#8F96A3'} />
                </View>
                <Text style={[styles.statusText, status === 'want' && styles.statusTextSelected]}>Okuyacağım</Text>
              </Pressable>

              <Pressable onPress={() => void changeStatus('reading')} style={[styles.statusButton, status === 'reading' && styles.statusButtonSelected]}>
                <View style={[styles.statusIcon, status === 'reading' && styles.statusIconSelected]}>
                  <Feather name="book-open" size={17} color={status === 'reading' ? '#F4F5F7' : '#8F96A3'} />
                </View>
                <Text style={[styles.statusText, status === 'reading' && styles.statusTextSelected]}>Okuyorum</Text>
              </Pressable>

              <Pressable onPress={() => void changeStatus('read')} style={[styles.statusButton, status === 'read' && styles.statusButtonSelected]}>
                <View style={[styles.statusIcon, status === 'read' && styles.statusIconSelected]}>
                  <Feather name="check-circle" size={17} color={status === 'read' ? '#F4F5F7' : '#8F96A3'} />
                </View>
                <Text style={[styles.statusText, status === 'read' && styles.statusTextSelected]}>Okudum</Text>
              </Pressable>

              <Pressable onPress={() => void changeStatus('abandoned')} style={[styles.statusButton, status === 'abandoned' && styles.statusButtonSelected]}>
                <View style={[styles.statusIcon, status === 'abandoned' && styles.statusIconSelected]}>
                  <Feather name="pause-circle" size={17} color={status === 'abandoned' ? '#F4F5F7' : '#8F96A3'} />
                </View>
                <Text style={[styles.statusText, status === 'abandoned' && styles.statusTextSelected]}>Yarım Bıraktım</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.actionGrid}>
            <Pressable onPress={openReview} style={styles.actionCard}>
              <View style={styles.actionIcon}>
                <Feather name="edit-3" size={20} color="#C8B6FF" />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>İnceleme Yaz</Text>
                <Text style={styles.actionSubtitle}>Kitap hakkındaki düşüncelerini paylaş</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#707784" />
            </Pressable>

            <Pressable
              onPress={() => router.push({
                pathname: '/quote-create',
                params: {
                  key,
                  book: book.title ?? 'Bilinmeyen kitap',
                  author: authorNames,
                  coverUrl: coverUrl ?? undefined,
                },
              })}
              style={styles.actionCard}
            >
              <View style={styles.actionIcon}>
                <Feather name="type" size={20} color="#C8B6FF" />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Alıntı Ekle</Text>
                <Text style={styles.actionSubtitle}>Altını çizdiğin bir bölümü paylaş</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#707784" />
            </Pressable>

            <Pressable onPress={() => setShowNoteBox((value) => !value)} style={styles.actionCard}>
              <View style={styles.actionIcon}>
                <Feather name="file-text" size={20} color="#C8B6FF" />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Not Ekle</Text>
                <Text style={styles.actionSubtitle}>Sadece sana özel kitap notu kaydet</Text>
              </View>
              <Feather name={showNoteBox ? 'chevron-up' : 'chevron-right'} size={20} color="#707784" />
            </Pressable>
          </View>

          {showNoteBox ? (
            <View style={styles.noteBox}>
              <View style={styles.noteHeader}>
                <View style={styles.noteHeaderCopy}>
                  <Text style={styles.noteTitle}>Yeni Not</Text>
                  <Text style={styles.noteSubtitle}>Bu not gizlidir; yalnızca sen görebilirsin.</Text>
                </View>
                <Text style={styles.characterCount}>{noteText.length}/5000</Text>
              </View>

              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Kitapla ilgili notunu yaz..."
                placeholderTextColor="#676E7A"
                multiline
                maxLength={5000}
                textAlignVertical="top"
                style={styles.noteInput}
              />

              <View style={styles.notePageRow}>
                <View style={styles.notePageInputWrap}>
                  <Feather name="bookmark" size={14} color="#8574B8" />
                  <TextInput
                    value={notePageInput}
                    onChangeText={setNotePageInput}
                    placeholder="Sayfa (isteğe bağlı)"
                    placeholderTextColor="#676E7A"
                    keyboardType="number-pad"
                    style={styles.notePageInput}
                  />
                </View>
              </View>

              <View style={styles.quoteActions}>
                <Pressable
                  onPress={() => {
                    setShowNoteBox(false);
                    setNoteText('');
                    setNotePageInput('');
                  }}
                  style={styles.cancelQuoteButton}
                >
                  <Text style={styles.cancelQuoteText}>Vazgeç</Text>
                </Pressable>
                <Pressable
                  onPress={() => void saveNote()}
                  disabled={savingNote || !noteText.trim()}
                  style={[styles.saveQuoteButton, (savingNote || !noteText.trim()) && styles.disabledButton]}
                >
                  {savingNote ? (
                    <ActivityIndicator size="small" color="#0B0C0F" />
                  ) : (
                    <Feather name="check" size={16} color="#0B0C0F" />
                  )}
                  <Text style={styles.saveQuoteText}>{savingNote ? 'Kaydediliyor...' : 'Notu Kaydet'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {notesLoading || notes.length > 0 ? (
            <View style={styles.notesSection}>
              <View style={styles.notesSectionHeader}>
                <View>
                  <Text style={styles.notesSectionTitle}>Notlarım</Text>
                  <Text style={styles.notesSectionSubtitle}>Bu kitaba kaydettiğin özel notlar</Text>
                </View>
                <View style={styles.notesCountBadge}>
                  <Text style={styles.notesCountText}>{notes.length}</Text>
                </View>
              </View>

              {notesLoading ? (
                <View style={styles.notesLoading}>
                  <ActivityIndicator size="small" color="#A985FF" />
                  <Text style={styles.notesLoadingText}>Notların yükleniyor...</Text>
                </View>
              ) : (
                notes.map((note) => (
                  <View key={note.id} style={styles.noteItem}>
                    <View style={styles.noteItemTop}>
                      <View style={styles.noteMetaRow}>
                        {note.page_number ? (
                          <View style={styles.notePageBadge}>
                            <Feather name="bookmark" size={11} color="#BCA8F6" />
                            <Text style={styles.notePageBadgeText}>s. {note.page_number}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.noteDate}>
                          {new Date(note.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => Alert.alert(
                          'Notu sil',
                          'Bu not kalıcı olarak silinsin mi?',
                          [
                            { text: 'Vazgeç', style: 'cancel' },
                            { text: 'Sil', style: 'destructive', onPress: () => void deleteNote(note.id) },
                          ]
                        )}
                        hitSlop={10}
                        style={styles.noteDeleteButton}
                      >
                        <Feather name="trash-2" size={16} color="#A96C76" />
                      </Pressable>
                    </View>
                    <Text style={styles.noteContent}>{note.content}</Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {showQuoteBox ? (
            <View style={styles.quoteBox}>
              <View style={styles.quoteHeader}>
                <View>
                  <Text style={styles.quoteTitle}>Yeni Alıntı</Text>
                  <Text style={styles.quoteSubtitle}>Bu kitaptan kaydetmek istediğin bölüm</Text>
                </View>
                <Text style={styles.characterCount}>{quoteText.length}/1000</Text>
              </View>

              <TextInput
                value={quoteText}
                onChangeText={setQuoteText}
                placeholder="Alıntıyı buraya yaz..."
                placeholderTextColor="#676E7A"
                multiline
                maxLength={1000}
                textAlignVertical="top"
                style={styles.quoteInput}
              />

              <View style={styles.quoteActions}>
                <Pressable onPress={() => { setQuoteText(''); setShowQuoteBox(false); }} style={styles.cancelQuoteButton}>
                  <Text style={styles.cancelQuoteText}>Vazgeç</Text>
                </Pressable>
                <Pressable
                  onPress={saveQuote}
                  disabled={savingQuote || !quoteText.trim()}
                  style={[styles.saveQuoteButton, (!quoteText.trim() || savingQuote) && styles.disabledButton]}
                >
                  <Feather name="check" size={16} color="#0B0C0F" />
                  <Text style={styles.saveQuoteText}>{savingQuote ? 'Kaydediliyor...' : 'Kaydet'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {quoteSaved ? (
            <View style={styles.successBox}>
              <View style={styles.successIcon}>
                <Feather name="check" size={15} color="#B8F3D1" />
              </View>
              <Text style={styles.successText}>Alıntı kaydedildi</Text>
            </View>
          ) : null}

          {description ? (
            <View style={styles.descriptionBox}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>Kitap Hakkında</Text>
                <Feather name="align-left" size={17} color="#747B88" />
              </View>
              <Text style={styles.description}>{description}</Text>
            </View>
          ) : null}

          {key ? (
            <BookDiscoveryRecommendations
              bookKey={key}
              title={book.title ?? 'Bilinmeyen kitap'}
              author={authorNames}
            />
          ) : null}

          <Pressable onPress={() => void addToShelf()} style={[styles.addButton, added && styles.addedButton]}>
            <View style={styles.addButtonIcon}>
              <Feather name={added ? 'check' : 'plus'} size={19} color={added ? '#C8B6FF' : '#0B0C0F'} />
            </View>
            <View style={styles.addButtonCopy}>
              <Text style={[styles.addButtonText, added && styles.addedButtonText]}>
                {added ? 'Kitap Rafında' : 'Rafıma Ekle'}
              </Text>
              <Text style={[styles.addButtonSubtext, added && styles.addedButtonSubtext]}>
                {added ? 'Okuma durumun kaydedildi' : 'Kitabı kütüphanene kaydet'}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={added ? '#8673C8' : '#292C32'} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090C' },
  scrollContent: { paddingBottom: 42 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#08090C', paddingHorizontal: 28 },
  loadingText: { marginTop: 14, color: '#8F96A3', fontSize: 14 },
  errorIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17131F', borderWidth: 1, borderColor: '#2A2238', marginBottom: 16 },
  errorTitle: { color: '#F4F5F7', fontSize: 21, fontWeight: '800', marginBottom: 7 },
  errorText: { color: '#8F96A3', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  backButton: { minHeight: 46, paddingHorizontal: 17, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#15171C', borderWidth: 1, borderColor: '#252830' },
  backButtonText: { color: '#F4F5F7', fontSize: 14, fontWeight: '700' },
  topBar: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121419', borderWidth: 1, borderColor: '#22252C' },
  iconButtonPlaceholder: { width: 42, height: 42 },
  pageTitle: { color: '#F4F5F7', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  heroCard: { flexDirection: 'row', gap: 18, padding: 16, borderRadius: 24, backgroundColor: '#111318', borderWidth: 1, borderColor: '#23262D' },
  coverShadow: { borderRadius: 16, backgroundColor: '#1A1D23' },
  cover: { width: 126, height: 188, borderRadius: 15, backgroundColor: '#191C22' },
  noCover: { width: 126, height: 188, borderRadius: 15, backgroundColor: '#171A20', borderWidth: 1, borderColor: '#292D35', alignItems: 'center', justifyContent: 'center', gap: 9 },
  noCoverText: { color: '#747B88', fontSize: 12, fontWeight: '700' },
  bookInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  eyebrowText: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#F4F5F7', fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.3 },
  author: { color: '#B2B7C0', fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 },
  metaText: { color: '#8F96A3', fontSize: 12, fontWeight: '600' },
  shelfBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: 10, marginTop: 13, backgroundColor: '#1B1527', borderWidth: 1, borderColor: '#35274D' },
  shelfBadgeText: { color: '#C8B6FF', fontSize: 11, fontWeight: '800' },
  section: { marginTop: 24 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  sectionTitle: { color: '#F4F5F7', fontSize: 16, fontWeight: '800' },
  sectionHint: { color: '#747B88', fontSize: 12, fontWeight: '600' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusButton: { width: '48.5%', minHeight: 84, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111318', borderWidth: 1, borderColor: '#23262D' },
  statusButtonSelected: { backgroundColor: '#191424', borderColor: '#4A376B' },
  statusIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#191C22' },
  statusIconSelected: { backgroundColor: '#4A376B' },
  statusText: { color: '#8F96A3', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  statusTextSelected: { color: '#E8DEFF' },
  actionGrid: { gap: 10, marginTop: 22 },
  actionCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 20, backgroundColor: '#111318', borderWidth: 1, borderColor: '#23262D' },
  actionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1525', borderWidth: 1, borderColor: '#302541' },
  actionCopy: { flex: 1 },
  actionTitle: { color: '#F4F5F7', fontSize: 14, fontWeight: '800' },
  actionSubtitle: { color: '#7F8692', fontSize: 11, lineHeight: 16, marginTop: 4 },
  noteBox: { marginTop: 12, padding: 15, borderRadius: 21, backgroundColor: '#111318', borderWidth: 1, borderColor: '#302842' },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  noteHeaderCopy: { flex: 1 },
  noteTitle: { color: '#F4F5F7', fontSize: 15, fontWeight: '800' },
  noteSubtitle: { color: '#7B728B', fontSize: 11, lineHeight: 16, marginTop: 4 },
  noteInput: { minHeight: 126, maxHeight: 260, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, color: '#ECEEF2', fontSize: 14, lineHeight: 21, backgroundColor: '#0B0D11', borderWidth: 1, borderColor: '#29233A' },
  notePageRow: { marginTop: 10, flexDirection: 'row' },
  notePageInputWrap: { minHeight: 42, minWidth: 190, borderRadius: 13, backgroundColor: '#0D0F14', borderWidth: 1, borderColor: '#272A32', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  notePageInput: { flex: 1, color: '#E3E4E8', fontSize: 12.5, paddingVertical: 0 },
  notesSection: { marginTop: 14, padding: 15, borderRadius: 21, backgroundColor: '#111318', borderWidth: 1, borderColor: '#272A32' },
  notesSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  notesSectionTitle: { color: '#F4F5F7', fontSize: 15, fontWeight: '800' },
  notesSectionSubtitle: { color: '#727985', fontSize: 10.5, marginTop: 3 },
  notesCountBadge: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F', borderWidth: 1, borderColor: '#3B2A52' },
  notesCountText: { color: '#BDA8F8', fontSize: 11, fontWeight: '900' },
  notesLoading: { minHeight: 70, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  notesLoadingText: { color: '#777E89', fontSize: 11 },
  noteItem: { paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#262931' },
  noteItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  noteMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  notePageBadge: { minHeight: 25, borderRadius: 9, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#21182F', borderWidth: 1, borderColor: '#38284D' },
  notePageBadgeText: { color: '#BDA8F8', fontSize: 10, fontWeight: '800' },
  noteDate: { color: '#686F7A', fontSize: 9.5, fontWeight: '600' },
  noteDeleteButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1216', borderWidth: 1, borderColor: '#342027' },
  noteContent: { color: '#C4C7CE', fontSize: 13, lineHeight: 20, marginTop: 9 },
  quoteBox: { marginTop: 12, padding: 15, borderRadius: 21, backgroundColor: '#111318', borderWidth: 1, borderColor: '#292D35' },
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  quoteTitle: { color: '#F4F5F7', fontSize: 15, fontWeight: '800' },
  quoteSubtitle: { color: '#777E8A', fontSize: 11, marginTop: 4 },
  quoteInput: { minHeight: 132, maxHeight: 240, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, color: '#ECEEF2', fontSize: 14, lineHeight: 21, backgroundColor: '#0B0D11', borderWidth: 1, borderColor: '#242831' },
  characterCount: { color: '#626975', fontSize: 10, fontWeight: '700' },
  quoteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 12 },
  cancelQuoteButton: { height: 42, paddingHorizontal: 15, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17191F', borderWidth: 1, borderColor: '#292C34' },
  cancelQuoteText: { color: '#A4AAB4', fontSize: 13, fontWeight: '700' },
  saveQuoteButton: { minWidth: 108, flexShrink: 1, height: 42, paddingHorizontal: 15, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#B69AFF' },
  disabledButton: { opacity: 0.42 },
  saveQuoteText: { color: '#0B0C0F', fontSize: 13, fontWeight: '900' },
  successBox: { minHeight: 46, marginTop: 12, paddingHorizontal: 14, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#101B16', borderWidth: 1, borderColor: '#1E3B2C' },
  successIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#173224' },
  successText: { color: '#B8F3D1', fontSize: 13, fontWeight: '700' },
  descriptionBox: { marginTop: 22, padding: 17, borderRadius: 22, backgroundColor: '#111318', borderWidth: 1, borderColor: '#23262D' },
  description: { color: '#A6ACB6', fontSize: 14, lineHeight: 22 },
  addButton: { minHeight: 70, marginTop: 22, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#B69AFF' },
  addedButton: { backgroundColor: '#17131F', borderWidth: 1, borderColor: '#35274D' },
  addButtonIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10, 11, 14, 0.10)' },
  addButtonCopy: { flex: 1 },
  addButtonText: { color: '#0B0C0F', fontSize: 14, fontWeight: '900' },
  addedButtonText: { color: '#D6C8FF' },
  addButtonSubtext: { color: '#3D334D', fontSize: 10, fontWeight: '700', marginTop: 3 },
  addedButtonSubtext: { color: '#82749E' },
});
