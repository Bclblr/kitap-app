import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

type TargetType = 'post' | 'review' | 'book' | 'author' | 'community' | 'event' | 'hashtag';

type ExploreItem = {
  id: string;
  target_type: TargetType;
  target_id: string;
  title: string | null;
  subtitle: string | null;
  priority: number;
  active: boolean;
  created_at: string;
};

const TYPES: { key: TargetType; label: string }[] = [
  { key: 'post', label: 'Gönderi' },
  { key: 'review', label: 'İnceleme' },
  { key: 'book', label: 'Kitap' },
  { key: 'author', label: 'Yazar' },
  { key: 'community', label: 'Topluluk' },
  { key: 'event', label: 'Etkinlik' },
  { key: 'hashtag', label: 'Hashtag' },
];

export default function AdminExploreScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetType, setTargetType] = useState<TargetType>('post');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [priority, setPriority] = useState('0');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canManageSystem) {
        router.replace('/');
        return;
      }

      const { data, error } = await supabase
        .from('explore_featured_items')
        .select('id,target_type,target_id,title,subtitle,priority,active,created_at')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data ?? []) as ExploreItem[]);
    } catch (error) {
      console.error('Explore admin load error:', error);
      Alert.alert('Hata', 'Keşfet öğeleri yüklenemedi.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems])
  );

  async function saveItem() {
    if (!targetId.trim()) {
      Alert.alert('Eksik bilgi', 'Hedef ID alanını doldur.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_upsert_explore_item', {
        p_target_type: targetType,
        p_target_id: targetId.trim(),
        ...(title.trim() ? { p_title: title.trim() } : {}),
        ...(subtitle.trim() ? { p_subtitle: subtitle.trim() } : {}),
        p_priority: Number(priority) || 0,
        p_active: true,
      });

      if (error) throw error;

      setTargetId('');
      setTitle('');
      setSubtitle('');
      setPriority('0');
      await loadItems();
    } catch (error: any) {
      console.error('Explore admin save error:', error);
      Alert.alert('Kaydedilemedi', error?.message || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: ExploreItem) {
    const { error } = await supabase.rpc('admin_upsert_explore_item', {
      p_target_type: item.target_type,
      p_target_id: item.target_id,
      ...(item.title ? { p_title: item.title } : {}),
      ...(item.subtitle ? { p_subtitle: item.subtitle } : {}),
      p_priority: item.priority,
      p_active: !item.active,
    });

    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    await loadItems();
  }

  async function removeItem(item: ExploreItem) {
    const { error } = await supabase.rpc('admin_delete_explore_item', { p_id: item.id });
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    setItems((current) => current.filter((row) => row.id !== item.id));
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/admin')} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YÖNETİM</Text>
            <Text style={styles.title}>Keşfet Yönetimi</Text>
          </View>
          <Pressable onPress={() => void loadItems()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Editör Seçimi Ekle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {TYPES.map((item) => {
              const active = item.key === targetType;
              return (
                <Pressable key={item.key} onPress={() => setTargetType(item.key)} style={[styles.typeButton, active && styles.typeButtonActive]}>
                  <Text style={[styles.typeText, active && styles.typeTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <TextInput value={targetId} onChangeText={setTargetId} placeholder="Hedef ID / kitap key / hashtag" placeholderTextColor="#666674" style={styles.input} autoCapitalize="none" />
          <TextInput value={title} onChangeText={setTitle} placeholder="Başlık (opsiyonel)" placeholderTextColor="#666674" style={styles.input} />
          <TextInput value={subtitle} onChangeText={setSubtitle} placeholder="Alt başlık (opsiyonel)" placeholderTextColor="#666674" style={styles.input} />
          <TextInput value={priority} onChangeText={setPriority} placeholder="Öncelik" placeholderTextColor="#666674" keyboardType="number-pad" style={styles.input} />

          <Pressable onPress={() => void saveItem()} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>
            <Feather name="plus" size={17} color="#0B0710" />
            <Text style={styles.saveText}>{saving ? 'Kaydediliyor...' : 'Keşfete Ekle'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Editör Seçimleri</Text>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Henüz seçim yok</Text>
            <Text style={styles.emptyText}>Keşfet için öne çıkarılan içerikler burada görünecek.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.target_type.toUpperCase()}</Text></View>
                <Text style={[styles.status, item.active ? styles.statusActive : styles.statusPassive]}>{item.active ? 'AKTİF' : 'PASİF'}</Text>
              </View>
              <Text style={styles.itemTitle}>{item.title || item.target_id}</Text>
              {item.subtitle ? <Text style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
              <Text style={styles.meta}>Hedef: {item.target_id}</Text>
              <Text style={styles.meta}>Öncelik: {item.priority}</Text>

              <View style={styles.actions}>
                <Pressable onPress={() => void toggleActive(item)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>{item.active ? 'Pasife Al' : 'Aktifleştir'}</Text>
                </Pressable>
                <Pressable onPress={() => void removeItem(item)} style={styles.deleteButton}>
                  <Feather name="trash-2" size={15} color="#FF7D86" />
                  <Text style={styles.deleteText}>Kaldır</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#F5F5F8', fontSize: 24, fontWeight: '900' },
  formCard: { backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 18, padding: 15, marginBottom: 22 },
  sectionTitle: { color: '#F5F5F8', fontSize: 17, fontWeight: '800', marginBottom: 11 },
  typeRow: { gap: 8, paddingBottom: 12 },
  typeButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: '#101015', borderWidth: 1, borderColor: '#292934' },
  typeButtonActive: { backgroundColor: '#2B1F3C', borderColor: '#654A8C' },
  typeText: { color: '#8E8E9D', fontSize: 12, fontWeight: '700' },
  typeTextActive: { color: '#F5F5F8' },
  input: { height: 48, borderRadius: 12, backgroundColor: '#101015', borderWidth: 1, borderColor: '#292934', color: '#F5F5F8', paddingHorizontal: 13, marginBottom: 10 },
  saveButton: { height: 48, borderRadius: 12, backgroundColor: '#A985FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#0B0710', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyCard: { padding: 24, borderRadius: 16, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', alignItems: 'center' },
  emptyTitle: { color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  emptyText: { color: '#7E7E8B', fontSize: 12, marginTop: 6, textAlign: 'center' },
  itemCard: { backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934', borderRadius: 16, padding: 15, marginBottom: 10 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { backgroundColor: '#21182F', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  badgeText: { color: '#BFA9F4', fontSize: 10, fontWeight: '900' },
  status: { fontSize: 10, fontWeight: '900' },
  statusActive: { color: '#78D49A' },
  statusPassive: { color: '#8E8E9D' },
  itemTitle: { marginTop: 12, color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  itemSubtitle: { marginTop: 5, color: '#B2B2BE', fontSize: 13, lineHeight: 18 },
  meta: { marginTop: 5, color: '#6F6F7E', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  secondaryButton: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#353543', backgroundColor: '#111117' },
  secondaryText: { color: '#CFCFD8', fontSize: 12, fontWeight: '800' },
  deleteButton: { minWidth: 105, minHeight: 40, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#54272E', backgroundColor: '#201317' },
  deleteText: { color: '#FF7D86', fontSize: 12, fontWeight: '800' },
});
