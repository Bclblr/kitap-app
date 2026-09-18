import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { safeBack } from '@/lib/navigation';
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type AnnouncementKind = 'info' | 'warning' | 'maintenance' | 'feature' | 'event';

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  kind: AnnouncementKind;
  action_route: string | null;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const KINDS: { key: AnnouncementKind; label: string }[] = [
  { key: 'info', label: 'Bilgi' },
  { key: 'warning', label: 'Uyarı' },
  { key: 'maintenance', label: 'Bakım' },
  { key: 'feature', label: 'Özellik' },
  { key: 'event', label: 'Etkinlik' },
];

export default function AdminAnnouncementsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<AnnouncementKind>('info');
  const [route, setRoute] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [active, setActive] = useState(true);
  const [summaryNow] = useState(() => Date.now());

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!(access.role === 'admin' || access.role === 'super_admin')) {
        router.replace('/admin');
        return;
      }

      const { data, error } = await supabase.rpc('admin_list_announcements', { p_limit: 150 });
      if (error) throw error;
      setItems((data ?? []) as AnnouncementRow[]);
    } catch (error) {
      console.error('Duyurular yüklenemedi:', error);
      Alert.alert('Hata', 'Duyurular yüklenemedi. SQL migrationını çalıştırdığından emin ol.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems])
  );

  const summary = useMemo(() => {
    const now = summaryNow;
    return {
      total: items.length,
      active: items.filter((x) => x.active && new Date(x.starts_at).getTime() <= now && (!x.ends_at || new Date(x.ends_at).getTime() > now)).length,
      scheduled: items.filter((x) => new Date(x.starts_at).getTime() > now).length,
      passive: items.filter((x) => !x.active).length,
    };
  }, [items, summaryNow]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setBody('');
    setKind('info');
    setRoute('');
    setStartsAt('');
    setEndsAt('');
    setActive(true);
  }

  function edit(item: AnnouncementRow) {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setKind(item.kind);
    setRoute(item.action_route ?? '');
    setStartsAt(item.starts_at ? item.starts_at.slice(0, 16) : '');
    setEndsAt(item.ends_at ? item.ends_at.slice(0, 16) : '');
    setActive(item.active);
  }

  function parseDate(value: string, fallbackNow = false) {
    if (!value.trim()) return fallbackNow ? new Date().toISOString() : null;
    const d = new Date(value.trim());
    if (Number.isNaN(d.getTime())) throw new Error('Geçersiz tarih');
    return d.toISOString();
  }

  async function save() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Eksik bilgi', 'Başlık ve duyuru metni gerekli.');
      return;
    }

    setSaving(true);
    try {
      const start = parseDate(startsAt, true);
      const end = parseDate(endsAt, false);
      if (end && start && new Date(end).getTime() <= new Date(start).getTime()) {
        Alert.alert('Geçersiz tarih', 'Bitiş tarihi başlangıç tarihinden sonra olmalı.');
        return;
      }

      const { error } = await supabase.rpc('admin_save_announcement', {
        ...(editingId ? { p_id: editingId } : {}),
        p_title: title.trim(),
        p_body: body.trim(),
        p_kind: kind,
        ...(route.trim() ? { p_action_route: route.trim() } : {}),
        ...(start ? { p_starts_at: start } : {}),
        ...(end ? { p_ends_at: end } : {}),
        p_active: active,
      });
      if (error) throw error;
      resetForm();
      await loadItems();
    } catch (error) {
      console.error('Duyuru kaydedilemedi:', error);
      Alert.alert('Hata', 'Duyuru kaydedilemedi. Tarih biçimini ve SQL migrationını kontrol et.');
    } finally {
      setSaving(false);
    }
  }

  function remove(item: AnnouncementRow) {
    Alert.alert('Duyuruyu sil', `“${item.title}” kalıcı olarak silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('admin_delete_announcement', { p_id: item.id });
          if (error) {
            Alert.alert('Hata', 'Duyuru silinemedi.');
            return;
          }
          if (editingId === item.id) resetForm();
          await loadItems();
        },
      },
    ]);
  }

  async function toggle(item: AnnouncementRow) {
    const { error } = await supabase.rpc('admin_save_announcement', {
      p_id: item.id,
      p_title: item.title,
      p_body: item.body,
      p_kind: item.kind,
      ...(item.action_route ? { p_action_route: item.action_route } : {}),
      p_starts_at: item.starts_at,
      ...(item.ends_at ? { p_ends_at: item.ends_at } : {}),
      p_active: !item.active,
    });
    if (error) {
      Alert.alert('Hata', 'Duyuru durumu değiştirilemedi.');
      return;
    }
    await loadItems();
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Duyurular yükleniyor...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/admin')} style={styles.iconButton}><Feather name="chevron-left" size={23} color={colors.textPrimary} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>YÖNETİM</Text><Text style={styles.title}>Duyurular</Text></View>
          <Pressable onPress={() => void loadItems()} style={styles.iconButton}><Feather name="refresh-cw" size={18} color={colors.textSecondary} /></Pressable>
        </View>

        <View style={styles.summaryRow}>
          {[
            ['Toplam', summary.total],
            ['Aktif', summary.active],
            ['Planlı', summary.scheduled],
            ['Pasif', summary.passive],
          ].map(([label, value]) => <View key={String(label)} style={styles.summaryCard}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>)}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingId ? 'Duyuruyu düzenle' : 'Yeni duyuru'}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Başlık" placeholderTextColor="#747483" style={styles.input} maxLength={120} />
          <TextInput value={body} onChangeText={setBody} placeholder="Duyuru metni" placeholderTextColor="#747483" style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={2000} />

          <Text style={styles.label}>Tür</Text>
          <View style={styles.chips}>{KINDS.map((x) => <Pressable key={x.key} onPress={() => setKind(x.key)} style={[styles.chip, kind === x.key && styles.chipActive]}><Text style={[styles.chipText, kind === x.key && styles.chipTextActive]}>{x.label}</Text></Pressable>)}</View>

          <TextInput value={route} onChangeText={setRoute} placeholder="Yönlendirme yolu (isteğe bağlı), örn. /community" placeholderTextColor="#747483" style={styles.input} autoCapitalize="none" />
          <TextInput value={startsAt} onChangeText={setStartsAt} placeholder="Başlangıç: 2026-09-12T20:00 (boş = şimdi)" placeholderTextColor="#747483" style={styles.input} autoCapitalize="none" />
          <TextInput value={endsAt} onChangeText={setEndsAt} placeholder="Bitiş: 2026-09-15T20:00 (isteğe bağlı)" placeholderTextColor="#747483" style={styles.input} autoCapitalize="none" />

          <Pressable onPress={() => setActive((v) => !v)} style={styles.switchRow}>
            <View><Text style={styles.switchTitle}>Aktif</Text><Text style={styles.switchText}>Kapalıysa kullanıcılara görünmez.</Text></View>
            <Feather name={active ? 'check-circle' : 'circle'} size={22} color={active ? colors.primary : colors.textMuted} />
          </Pressable>

          <View style={styles.formActions}>
            {editingId ? <Pressable onPress={resetForm} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Vazgeç</Text></Pressable> : null}
            <Pressable disabled={saving} onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Duyuru oluştur'}</Text></Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Tüm duyurular</Text>
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.meta}>{KINDS.find((x) => x.key === item.kind)?.label ?? item.kind} · {item.active ? 'Aktif' : 'Pasif'}</Text>
                </View>
                <Feather name={item.active ? 'eye' : 'eye-off'} size={18} color={item.active ? colors.primary : colors.textMuted} />
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>Başlangıç: {new Date(item.starts_at).toLocaleString('tr-TR')}</Text>
              {item.ends_at ? <Text style={styles.meta}>Bitiş: {new Date(item.ends_at).toLocaleString('tr-TR')}</Text> : null}
              {item.action_route ? <Text style={styles.route}>Yol: {item.action_route}</Text> : null}
              <View style={styles.actions}>
                <Pressable onPress={() => edit(item)} style={styles.actionButton}><Text style={styles.actionText}>Düzenle</Text></Pressable>
                <Pressable onPress={() => void toggle(item)} style={styles.actionButton}><Text style={styles.actionText}>{item.active ? 'Pasife al' : 'Aktifleştir'}</Text></Pressable>
                <Pressable onPress={() => remove(item)} style={[styles.actionButton, styles.deleteButton]}><Text style={styles.deleteText}>Sil</Text></Pressable>
              </View>
            </View>
          ))}
          {items.length === 0 ? <View style={styles.empty}><Feather name="volume-2" size={24} color={colors.textMuted} /><Text style={styles.emptyText}>Henüz duyuru yok.</Text></View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  center: { flex: 1, backgroundColor: '#0A0A0E', alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#A5A5B3' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F5F5F8', fontSize: 25, fontWeight: '900' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 },
  summaryCard: { flexGrow: 1, minWidth: 130, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934', padding: 14 },
  summaryValue: { color: '#F5F5F8', fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: '#8E8E9D', marginTop: 4, fontSize: 12 },
  formCard: { backgroundColor: '#15151D', borderRadius: 18, borderWidth: 1, borderColor: '#30303D', padding: 16, marginBottom: 22 },
  formTitle: { color: '#F5F5F8', fontSize: 17, fontWeight: '900', marginBottom: 12 },
  input: { backgroundColor: '#101016', borderWidth: 1, borderColor: '#30303D', borderRadius: 12, color: '#F5F5F8', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10 },
  multiline: { minHeight: 110 },
  label: { color: '#A5A5B3', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#30303D', paddingHorizontal: 11, paddingVertical: 7 },
  chipActive: { backgroundColor: '#21182F', borderColor: '#6C3CC5' },
  chipText: { color: '#9A9AAA', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#C9B5FF' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  switchTitle: { color: '#F5F5F8', fontSize: 14, fontWeight: '800' },
  switchText: { color: '#7F7F8E', fontSize: 11, marginTop: 2 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 12 },
  primaryButton: { backgroundColor: '#6C3CC5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  primaryButtonText: { color: '#FFF', fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#393946', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  secondaryButtonText: { color: '#B4B4C2', fontWeight: '800' },
  sectionTitle: { color: '#F5F5F8', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  list: { gap: 10 },
  card: { backgroundColor: '#15151D', borderRadius: 16, borderWidth: 1, borderColor: '#292934', padding: 15 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardCopy: { flex: 1, marginRight: 10 },
  cardTitle: { color: '#F5F5F8', fontSize: 16, fontWeight: '900' },
  body: { color: '#B3B3BF', fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 10 },
  meta: { color: '#7F7F8E', fontSize: 11, marginTop: 3 },
  route: { color: '#A985FF', fontSize: 11, marginTop: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  actionButton: { borderWidth: 1, borderColor: '#343442', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  actionText: { color: '#C4C4CF', fontSize: 12, fontWeight: '800' },
  deleteButton: { borderColor: '#5A2B35' },
  deleteText: { color: '#FF899C', fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', padding: 28, backgroundColor: '#15151D', borderRadius: 16, borderWidth: 1, borderColor: '#292934' },
  emptyText: { color: '#858594', marginTop: 9 },
});
