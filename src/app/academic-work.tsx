import AcademicWorkCard from '@/components/AcademicWorkCard';
import { safeBack } from '@/lib/navigation';
import {
  AcademicWork,
  CrossrefWork,
  academicAuthorLine,
  getAcademicWork,
  getCrossrefWorkByDoi,
  getRelatedAcademicWorks,
} from '@/lib/academic';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type AcademicStatus = 'want' | 'reading' | 'read';

type Note = {
  id: string;
  content: string;
  created_at: string;
};

export default function AcademicWorkScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [work, setWork] = useState<AcademicWork | null>(null);
  const [crossref, setCrossref] = useState<CrossrefWork | null>(null);
  const [related, setRelated] = useState<AcademicWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<AcademicStatus | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const workId = typeof id === 'string' ? id : '';
    if (!workId) {
      setLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const loaded = await getAcademicWork(workId, controller.signal);
        if (!active || !loaded) return;
        setWork(loaded);

        const [crossrefData, relatedData] = await Promise.all([
          getCrossrefWorkByDoi(loaded.doi, controller.signal),
          getRelatedAcademicWorks(loaded.id, 6, controller.signal).catch(() => []),
        ]);
        if (!active) return;
        setCrossref(crossrefData);
        setRelated(relatedData);

        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) return;

        const db = supabase as any;
        const [savedResult, statusResult, noteResult] = await Promise.all([
          db.from('saved_academic_works').select('work_openalex_id').eq('user_id', user.id).eq('work_openalex_id', loaded.id).maybeSingle(),
          db.from('academic_reading_status').select('status').eq('user_id', user.id).eq('work_openalex_id', loaded.id).maybeSingle(),
          db.from('academic_work_notes').select('id,content,created_at').eq('user_id', user.id).eq('work_openalex_id', loaded.id).order('created_at', { ascending: false }),
        ]);

        if (!active) return;
        setSaved(!!savedResult.data);
        setStatus((statusResult.data?.status as AcademicStatus | undefined) ?? null);
        setNotes((noteResult.data ?? []) as Note[]);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') console.warn('Akademik çalışma yüklenemedi:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);

  async function requireUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      Alert.alert('Giriş gerekli', 'Bu özelliği kullanmak için giriş yapmalısın.');
      return null;
    }
    return data.user;
  }

  async function toggleSaved() {
    if (!work) return;
    const user = await requireUser();
    if (!user) return;
    const db = supabase as any;

    if (saved) {
      const { error } = await db.from('saved_academic_works').delete().eq('user_id', user.id).eq('work_openalex_id', work.id);
      if (error) return Alert.alert('Hata', error.message);
      setSaved(false);
      return;
    }

    const { error } = await db.from('saved_academic_works').upsert({
      user_id: user.id,
      work_openalex_id: work.id,
      title: work.title,
      author_summary: academicAuthorLine(work),
      journal_name: work.journal?.name ?? null,
      publication_year: work.publicationYear,
      doi: work.doi,
    }, { onConflict: 'user_id,work_openalex_id' });
    if (error) return Alert.alert('Hata', error.message);
    setSaved(true);
  }

  async function changeStatus(next: AcademicStatus) {
    if (!work) return;
    const user = await requireUser();
    if (!user) return;
    const { error } = await (supabase as any).from('academic_reading_status').upsert({
      user_id: user.id,
      work_openalex_id: work.id,
      title: work.title,
      author_summary: academicAuthorLine(work),
      journal_name: work.journal?.name ?? null,
      publication_year: work.publicationYear,
      status: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,work_openalex_id' });
    if (error) return Alert.alert('Hata', error.message);
    setStatus(next);
  }

  async function saveNote() {
    const clean = noteText.trim();
    if (!clean || !work || savingNote) return;
    const user = await requireUser();
    if (!user) return;
    setSavingNote(true);
    try {
      const { data, error } = await (supabase as any).from('academic_work_notes').insert({
        user_id: user.id,
        work_openalex_id: work.id,
        work_title: work.title,
        content: clean,
      }).select('id,content,created_at').single();
      if (error) throw error;
      setNotes((current) => [data as Note, ...current]);
      setNoteText('');
    } catch (error) {
      Alert.alert('Not kaydedilemedi', error instanceof Error ? error.message : 'Lütfen tekrar dene.');
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    const user = await requireUser();
    if (!user) return;
    const { error } = await (supabase as any).from('academic_work_notes').delete().eq('id', noteId).eq('user_id', user.id);
    if (error) return Alert.alert('Hata', error.message);
    setNotes((current) => current.filter((note) => note.id !== noteId));
  }

  async function openExternal(url: string | null) {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Makale yükleniyor...</Text></View>;
  }

  if (!work) {
    return <View style={styles.center}><Text style={styles.errorTitle}>Çalışma bulunamadı</Text><Pressable onPress={() => safeBack(router, '/academic-search' as any)}><Text style={styles.linkText}>Akademik aramaya dön</Text></Pressable></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => safeBack(router, '/academic-search' as any)} style={styles.iconButton}><Feather name="arrow-left" size={21} color={colors.text} /></Pressable>
          <Text style={styles.pageTitle}>Makale Detayı</Text>
          <Pressable onPress={() => void toggleSaved()} style={styles.iconButton}><Feather name={saved ? 'bookmark' : 'bookmark'} size={20} color={saved ? colors.primary : colors.textMuted} /></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.eyebrow}><Feather name="file-text" size={14} color={colors.primary} /><Text style={styles.eyebrowText}>AKADEMİK ÇALIŞMA</Text></View>
          <Text style={styles.title}>{work.title}</Text>
          <View style={styles.authorLinks}>
            {work.authors.map((author, index) => (
              <Pressable key={author.id || String(index)} onPress={() => author.id && router.push({ pathname: '/academic-author' as any, params: { id: author.id } })}>
                <Text style={styles.authorLink}>{author.name}{index < work.authors.length - 1 ? ', ' : ''}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>{[work.publicationYear, work.journal?.name, work.primaryTopic].filter(Boolean).join(' · ')}</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{work.citedByCount}</Text><Text style={styles.metricLabel}>Atıf</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{work.doi ? 'DOI' : '—'}</Text><Text style={styles.metricLabel}>{work.doi || 'DOI yok'}</Text></View>
            <View style={styles.metric}><Text style={[styles.metricValue, work.isOpenAccess && styles.oaValue]}>{work.isOpenAccess ? 'Açık' : 'Standart'}</Text><Text style={styles.metricLabel}>Erişim</Text></View>
          </View>
        </View>

        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Okuma Durumu</Text>
          <View style={styles.statusRow}>
            {([
              ['want', 'Okuyacağım', 'bookmark'],
              ['reading', 'Okuyorum', 'book-open'],
              ['read', 'Okudum', 'check-circle'],
            ] as const).map(([value, label, icon]) => (
              <Pressable key={value} onPress={() => void changeStatus(value)} style={[styles.statusButton, status === value && styles.statusSelected]}>
                <Feather name={icon} size={16} color={status === value ? colors.primary : colors.textMuted} />
                <Text style={[styles.statusText, status === value && styles.statusTextSelected]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {work.abstract ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Özet</Text>
            <Text style={styles.body}>{work.abstract}</Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Yayın Bilgileri</Text>
          {work.journal ? <Pressable onPress={() => router.push({ pathname: '/journal' as any, params: { id: work.journal!.id } })}><Text style={styles.infoLink}>{work.journal.name}</Text></Pressable> : null}
          {crossref?.publisher || work.journal?.publisher ? <Text style={styles.infoText}>Yayıncı: {crossref?.publisher || work.journal?.publisher}</Text> : null}
          {crossref?.volume ? <Text style={styles.infoText}>Cilt: {crossref.volume}{crossref.issue ? ` · Sayı: ${crossref.issue}` : ''}</Text> : null}
          {crossref?.pages ? <Text style={styles.infoText}>Sayfalar: {crossref.pages}</Text> : null}
          {work.doi ? <Text style={styles.infoText}>DOI: {work.doi}</Text> : null}
          {work.language ? <Text style={styles.infoText}>Dil: {work.language.toUpperCase()}</Text> : null}
        </View>

        {(work.openAccessUrl || work.pdfUrl || work.externalUrl || crossref?.url) ? (
          <View style={styles.actionRow}>
            {work.openAccessUrl || work.externalUrl || crossref?.url ? (
              <Pressable onPress={() => void openExternal(work.openAccessUrl || work.externalUrl || crossref?.url || null)} style={styles.primaryButton}>
                <Feather name="external-link" size={16} color="#FFF" /><Text style={styles.primaryButtonText}>Kaynağı Aç</Text>
              </Pressable>
            ) : null}
            {work.pdfUrl ? (
              <Pressable onPress={() => void openExternal(work.pdfUrl)} style={styles.secondaryButton}>
                <Feather name="file" size={16} color={colors.primary} /><Text style={styles.secondaryButtonText}>PDF</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Özel Notlarım</Text>
          <TextInput value={noteText} onChangeText={setNoteText} multiline maxLength={5000} placeholder="Bu makale hakkında özel not ekle..." placeholderTextColor={colors.textMuted} style={[styles.noteInput, { color: colors.text }]} />
          <Pressable onPress={() => void saveNote()} disabled={!noteText.trim() || savingNote} style={[styles.noteSave, (!noteText.trim() || savingNote) && styles.disabled]}>
            {savingNote ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.noteSaveText}>Notu Kaydet</Text>}
          </Pressable>
          {notes.map((note) => (
            <View key={note.id} style={styles.noteItem}>
              <View style={styles.noteTop}><Text style={styles.noteDate}>{new Date(note.created_at).toLocaleDateString('tr-TR')}</Text><Pressable onPress={() => void deleteNote(note.id)}><Feather name="trash-2" size={15} color={colors.danger} /></Pressable></View>
              <Text style={styles.noteText}>{note.content}</Text>
            </View>
          ))}
        </View>

        {related.length ? (
          <View style={styles.relatedSection}>
            <Text style={styles.sectionTitle}>Benzer Makaleler</Text>
            {related.map((item) => <AcademicWorkCard key={item.id} work={item} compact onPress={() => router.push({ pathname: '/academic-work' as any, params: { id: item.id } })} />)}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090D' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#08090D', gap: 12, padding: 24 },
  loadingText: { color: '#858791', fontSize: 12 },
  errorTitle: { color: '#F2F2F5', fontSize: 18, fontWeight: '900' },
  linkText: { color: '#A985FF', fontWeight: '800' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: '#2A2B34', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: '#F2F2F5', fontSize: 16, fontWeight: '900' },
  hero: { borderRadius: 20, borderWidth: 1, borderColor: '#34284F', backgroundColor: '#111018', padding: 18 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrowText: { color: '#A985FF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: '#F5F5F7', fontSize: 22, lineHeight: 30, fontWeight: '900', marginTop: 12 },
  authorLinks: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  authorLink: { color: '#CBB8F7', fontSize: 12, fontWeight: '700' },
  meta: { color: '#838590', fontSize: 11, lineHeight: 17, marginTop: 9 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metric: { flex: 1, borderRadius: 13, backgroundColor: '#171820', borderWidth: 1, borderColor: '#2A2B34', padding: 10, alignItems: 'center' },
  metricValue: { color: '#F2F2F5', fontSize: 13, fontWeight: '900' },
  oaValue: { color: '#72D09C' },
  metricLabel: { color: '#737681', fontSize: 8.5, marginTop: 3, textAlign: 'center' },
  statusSection: { marginTop: 16 },
  sectionTitle: { color: '#F0F0F3', fontSize: 15, fontWeight: '900', marginBottom: 11 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusButton: { flex: 1, minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#2B2C35', backgroundColor: '#111218', alignItems: 'center', justifyContent: 'center', gap: 5 },
  statusSelected: { borderColor: '#6232B5', backgroundColor: '#211733' },
  statusText: { color: '#898B95', fontSize: 9.5, fontWeight: '800' },
  statusTextSelected: { color: '#D8C8FF' },
  sectionCard: { marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: '#2A2B34', backgroundColor: '#111218', padding: 16 },
  body: { color: '#B9BBC3', fontSize: 13, lineHeight: 21 },
  infoText: { color: '#93959F', fontSize: 11, lineHeight: 18, marginTop: 3 },
  infoLink: { color: '#BCA2F6', fontSize: 12, fontWeight: '800', marginBottom: 5 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 16 },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#6232B5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  secondaryButton: { minWidth: 92, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#4A3470', backgroundColor: '#171321', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryButtonText: { color: '#CDB8FF', fontSize: 12, fontWeight: '900' },
  noteInput: { minHeight: 90, borderRadius: 13, borderWidth: 1, borderColor: '#30313A', backgroundColor: '#0B0C11', padding: 12, textAlignVertical: 'top', fontSize: 12 },
  noteSave: { alignSelf: 'flex-end', marginTop: 9, minHeight: 38, paddingHorizontal: 15, borderRadius: 11, backgroundColor: '#6232B5', alignItems: 'center', justifyContent: 'center' },
  noteSaveText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  noteItem: { borderTopWidth: 1, borderTopColor: '#272832', paddingTop: 12, marginTop: 12 },
  noteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteDate: { color: '#737681', fontSize: 9.5 },
  noteText: { color: '#C4C5CB', fontSize: 12, lineHeight: 18, marginTop: 7 },
  relatedSection: { marginTop: 20 },
});
