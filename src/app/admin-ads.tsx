import { useLightColor, useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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

import HouseAd from '@/components/HouseAd';
import { getCurrentAdminAccess } from '@/lib/admin';
import type { HouseAdCampaign, HouseAdMediaType, HouseAdPlacement } from '@/lib/house-ads';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';

const PLACEMENTS: { key: Extract<HouseAdPlacement, 'story_top' | 'feed'>; label: string }[] = [
  { key: 'story_top', label: 'Hikâye üstü tek reklam' },
  { key: 'feed', label: 'Akış içi reklamlar' },
];

function fileExtension(fileName: string | null | undefined, mimeType: string | null | undefined, mediaType: HouseAdMediaType) {
  const fromName = fileName?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (fromName && fromName.length <= 5) return fromName;
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'video/webm') return 'webm';
  return mediaType === 'video' ? 'mp4' : 'jpg';
}

export default function AdminAdsScreen() {
  const lightColor = useLightColor();
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [items, setItems] = useState<HouseAdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [placement, setPlacement] = useState<HouseAdPlacement>('feed');
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [feedInterval, setFeedInterval] = useState('6');
  const [priority, setPriority] = useState('0');
  const [mediaType, setMediaType] = useState<HouseAdMediaType>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [pickedAsset, setPickedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!(access.role === 'admin' || access.role === 'super_admin')) {
        router.replace('/admin');
        return;
      }
      const { data, error } = await supabase.rpc('admin_list_ad_campaigns', { p_limit: 150 });
      if (error) throw error;
      setItems((data ?? []) as HouseAdCampaign[]);
    } catch (error) {
      console.error('Reklamlar yüklenemedi:', error);
      Alert.alert('Hata', 'Reklam kampanyaları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { void loadItems(); }, [loadItems]));

  const storyTopSlot = useMemo(
    () => items.find((item) => item.placement === 'story_top' || item.placement === 'both') ?? null,
    [items]
  );

  const preview = useMemo<HouseAdCampaign | null>(() => {
    if (!mediaUrl) return null;
    return {
      id: editingId ?? 'preview',
      title: title.trim() || 'Reklam başlığı',
      subtitle: subtitle.trim() || null,
      media_type: mediaType,
      media_url: mediaUrl,
      storage_path: storagePath,
      target_url: targetUrl.trim() || 'https://example.com',
      placement,
      active,
      starts_at: new Date().toISOString(),
      ends_at: null,
      feed_interval: Number(feedInterval) || 6,
      priority: Number(priority) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [active, editingId, feedInterval, mediaType, mediaUrl, placement, priority, storagePath, subtitle, targetUrl, title]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setTargetUrl('');
    setPlacement('feed');
    setActive(true);
    setStartsAt('');
    setEndsAt('');
    setFeedInterval('6');
    setPriority('0');
    setMediaType('image');
    setMediaUrl('');
    setStoragePath(null);
    setPickedAsset(null);
  }

  function edit(item: HouseAdCampaign) {
    setEditingId(item.id);
    setTitle(item.title);
    setSubtitle(item.subtitle ?? '');
    setTargetUrl(item.target_url);
    setPlacement(item.placement === 'both' ? 'story_top' : item.placement);
    setActive(item.active);
    setStartsAt(item.starts_at ? item.starts_at.slice(0, 16) : '');
    setEndsAt(item.ends_at ? item.ends_at.slice(0, 16) : '');
    setFeedInterval(String(item.feed_interval));
    setPriority(String(item.priority));
    setMediaType(item.media_type);
    setMediaUrl(item.media_url);
    setStoragePath(item.storage_path);
    setPickedAsset(null);
  }

  function choosePlacement(next: Extract<HouseAdPlacement, 'story_top' | 'feed'>) {
    if (next === 'story_top' && storyTopSlot) {
      edit(storyTopSlot);
      setPlacement('story_top');
      return;
    }
    resetForm();
    setPlacement(next);
  }

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin gerekli', 'Reklam görseli veya videosu seçmek için fotoğraf arşivi izni gerekli.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.9,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const nextType: HouseAdMediaType = asset.type === 'video' ? 'video' : 'image';
    if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
      Alert.alert('Dosya çok büyük', 'Reklam medyası en fazla 50 MB olabilir.');
      return;
    }
    setPickedAsset(asset);
    setMediaType(nextType);
    setMediaUrl(asset.uri);
  }

  function parseDate(value: string, fallbackNow = false) {
    if (!value.trim()) return fallbackNow ? new Date().toISOString() : null;
    const date = new Date(value.trim());
    if (Number.isNaN(date.getTime())) throw new Error('Geçersiz tarih');
    return date.toISOString();
  }

  async function uploadPickedAsset() {
    if (!pickedAsset) return { url: mediaUrl, path: storagePath, uploadedPath: null as string | null };
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Admin oturumu bulunamadı.');

    const response = await fetch(pickedAsset.uri);
    if (!response.ok) throw new Error('Seçilen medya okunamadı.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 50 * 1024 * 1024) throw new Error('Dosya 50 MB sınırını aşıyor.');

    const ext = fileExtension(pickedAsset.fileName, pickedAsset.mimeType, mediaType);
    const path = `${authData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const contentType = pickedAsset.mimeType || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
    const { error } = await supabase.storage.from('ad-media').upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (error) throw error;
    const url = supabase.storage.from('ad-media').getPublicUrl(path).data.publicUrl;
    return { url, path, uploadedPath: path };
  }

  async function save() {
    if (saving) return;
    if (!title.trim() || !targetUrl.trim() || (!mediaUrl && !pickedAsset)) {
      Alert.alert('Eksik bilgi', 'Başlık, reklam medyası ve hedef bağlantı gerekli.');
      return;
    }
    if (!/^https:\/\//i.test(targetUrl.trim())) {
      Alert.alert('Geçersiz bağlantı', 'Reklam hedef bağlantısı https:// ile başlamalı.');
      return;
    }
    const interval = placement === 'feed' ? Number(feedInterval) : 6;
    const priorityNumber = placement === 'feed' ? Number(priority) : 0;
    if (placement === 'feed' && (!Number.isInteger(interval) || interval < 3 || interval > 20)) {
      Alert.alert('Geçersiz sıklık', 'Akış reklam aralığı 3 ile 20 gönderi arasında olmalı.');
      return;
    }
    if (placement === 'feed' && (!Number.isInteger(priorityNumber) || priorityNumber < -100 || priorityNumber > 100)) {
      Alert.alert('Geçersiz öncelik', 'Öncelik -100 ile 100 arasında olmalı.');
      return;
    }

    setSaving(true);
    let newUploadedPath: string | null = null;
    try {
      const start = parseDate(startsAt, true);
      const end = parseDate(endsAt, false);
      if (end && start && new Date(end).getTime() <= new Date(start).getTime()) {
        throw new Error('Bitiş tarihi başlangıç tarihinden sonra olmalı.');
      }

      const effectiveEditingId =
        editingId ?? (placement === 'story_top' ? storyTopSlot?.id ?? null : null);
      const previous = effectiveEditingId ? items.find((item) => item.id === effectiveEditingId) : null;
      const uploaded = await uploadPickedAsset();
      newUploadedPath = uploaded.uploadedPath;

      const { error } = await supabase.rpc('admin_save_ad_campaign', {
        ...(effectiveEditingId ? { p_id: effectiveEditingId } : {}),
        p_title: title.trim(),
        ...(subtitle.trim() ? { p_subtitle: subtitle.trim() } : {}),
        p_media_type: mediaType,
        p_media_url: uploaded.url,
        ...(uploaded.path ? { p_storage_path: uploaded.path } : {}),
        p_target_url: targetUrl.trim(),
        p_placement: placement,
        p_active: active,
        ...(start ? { p_starts_at: start } : {}),
        ...(end ? { p_ends_at: end } : {}),
        p_feed_interval: interval,
        p_priority: priorityNumber,
      });
      if (error) throw error;

      if (newUploadedPath && previous?.storage_path && previous.storage_path !== newUploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('ad-media').remove([previous.storage_path]);
        if (cleanupError) console.warn('Eski reklam medyası temizlenemedi:', cleanupError);
      }

      resetForm();
      await loadItems();
    } catch (error) {
      if (newUploadedPath) {
        await supabase.storage.from('ad-media').remove([newUploadedPath]).catch(() => undefined);
      }
      console.error('Reklam kaydedilemedi:', error);
      Alert.alert('Reklam kaydedilemedi', error instanceof Error ? error.message : 'Lütfen bilgileri kontrol edip tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: HouseAdCampaign) {
    const { error } = await supabase.rpc('admin_save_ad_campaign', {
      p_id: item.id,
      p_title: item.title,
      ...(item.subtitle ? { p_subtitle: item.subtitle } : {}),
      p_media_type: item.media_type,
      p_media_url: item.media_url,
      ...(item.storage_path ? { p_storage_path: item.storage_path } : {}),
      p_target_url: item.target_url,
      p_placement: item.placement,
      p_active: !item.active,
      p_starts_at: item.starts_at,
      ...(item.ends_at ? { p_ends_at: item.ends_at } : {}),
      p_feed_interval: item.feed_interval,
      p_priority: item.priority,
    });
    if (error) {
      Alert.alert('Hata', 'Reklam durumu değiştirilemedi.');
      return;
    }
    await loadItems();
  }

  function remove(item: HouseAdCampaign) {
    Alert.alert('Reklamı sil', `“${item.title}” kalıcı olarak silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('admin_delete_ad_campaign', { p_id: item.id });
          if (error) {
            Alert.alert('Hata', 'Reklam silinemedi.');
            return;
          }
          if (item.storage_path) {
            const { error: storageError } = await supabase.storage.from('ad-media').remove([item.storage_path]);
            if (storageError) console.warn('Reklam medyası silinemedi:', storageError);
          }
          if (editingId === item.id) resetForm();
          await loadItems();
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Reklamlar yükleniyor...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/admin')} style={styles.iconButton}><Feather name="chevron-left" size={23} color={colors.textPrimary} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>YÖNETİM</Text><Text style={styles.title}>Kendi Reklamlarımız</Text></View>
          <Pressable onPress={() => void loadItems()} style={styles.iconButton}><Feather name="refresh-cw" size={18} color={colors.textSecondary} /></Pressable>
        </View>

        <View style={styles.infoCard}>
          <Feather name="monitor" size={20} color={colors.primary} />
          <Text style={styles.infoText}>Hikâyelerin üstünde tek bir sabit reklam alanı vardır. Bu alanı buradan değiştirip açıp kapatabilirsin. Akış içi reklamlar ise ayrı kampanyalar olarak belirlediğin gönderi aralığında gösterilir.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{placement === 'story_top' ? (storyTopSlot ? 'Üst reklamı düzenle' : 'Üst reklamı oluştur') : (editingId ? 'Akış reklamını düzenle' : 'Yeni akış reklamı')}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Reklam / marka başlığı" placeholderTextColor={lightColor('textMuted','#747483')} style={styles.input} maxLength={120} />
          <TextInput value={subtitle} onChangeText={setSubtitle} placeholder="Kısa açıklama (isteğe bağlı)" placeholderTextColor={lightColor('textMuted','#747483')} style={styles.input} maxLength={240} />
          <TextInput value={targetUrl} onChangeText={setTargetUrl} placeholder="https://hedef-sayfa.com" placeholderTextColor={lightColor('textMuted','#747483')} style={styles.input} autoCapitalize="none" keyboardType="url" />

          <Text style={styles.label}>Gösterim alanı</Text>
          <View style={styles.chips}>
            {PLACEMENTS.map((item) => (
              <Pressable key={item.key} onPress={() => choosePlacement(item.key)} style={[styles.chip, placement === item.key && styles.chipActive]}>
                <Text style={[styles.chipText, placement === item.key && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => void pickMedia()} style={styles.mediaPicker}>
            <Feather name={mediaType === 'video' ? 'video' : 'image'} size={21} color={colors.primary} />
            <View style={{ flex: 1 }}><Text style={styles.mediaPickerTitle}>{mediaUrl ? 'Medyayı değiştir' : 'Fotoğraf veya video seç'}</Text><Text style={styles.mediaPickerText}>Fotoğraf veya en fazla 60 sn / 50 MB video</Text></View>
            <Feather name="chevron-right" size={19} color={colors.textMuted} />
          </Pressable>

          {preview ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Önizleme</Text>
              <HouseAd ad={preview} variant={placement === 'story_top' ? 'banner' : 'feed'} ignorePremium />
            </View>
          ) : null}

          {placement === 'feed' ? (
            <View style={styles.twoColumns}>
              <View style={styles.column}><Text style={styles.label}>Kaç gönderide bir?</Text><TextInput value={feedInterval} onChangeText={setFeedInterval} style={styles.input} keyboardType="number-pad" placeholder="6" placeholderTextColor={lightColor('textMuted','#747483')} /></View>
              <View style={styles.column}><Text style={styles.label}>Öncelik</Text><TextInput value={priority} onChangeText={setPriority} style={styles.input} keyboardType="numbers-and-punctuation" placeholder="0" placeholderTextColor={lightColor('textMuted','#747483')} /></View>
            </View>
          ) : (
            <View style={styles.slotNotice}>
              <Feather name="layout" size={17} color={colors.primary} />
              <Text style={styles.slotNoticeText}>Bu tek reklam slotudur. Yeni bir üst reklam kaydettiğinde mevcut üst reklam güncellenir; ikinci bir üst reklam oluşturulmaz.</Text>
            </View>
          )}

          <TextInput value={startsAt} onChangeText={setStartsAt} placeholder="Başlangıç: 2026-09-29T12:00 (boş = şimdi)" placeholderTextColor={lightColor('textMuted','#747483')} style={styles.input} autoCapitalize="none" />
          <TextInput value={endsAt} onChangeText={setEndsAt} placeholder="Bitiş (isteğe bağlı)" placeholderTextColor={lightColor('textMuted','#747483')} style={styles.input} autoCapitalize="none" />

          <Pressable onPress={() => setActive((value) => !value)} style={styles.switchRow}>
            <View style={{ flex: 1 }}><Text style={styles.switchTitle}>Aktif</Text><Text style={styles.switchText}>Kapalıysa reklam hiçbir yerde gösterilmez.</Text></View>
            <Feather name={active ? 'check-circle' : 'circle'} size={22} color={active ? colors.primary : colors.textMuted} />
          </Pressable>

          <View style={styles.formActions}>
            {editingId ? <Pressable onPress={resetForm} style={styles.secondaryButton}><Text style={styles.secondaryText}>Vazgeç</Text></Pressable> : null}
            <Pressable disabled={saving} onPress={() => void save()} style={[styles.primaryButton, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>{editingId ? 'Güncelle' : 'Reklamı oluştur'}</Text>}
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Kampanyalar</Text>
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.meta}>{PLACEMENTS.find((x) => x.key === item.placement)?.label} · {item.media_type === 'video' ? 'Video' : 'Fotoğraf'} · {item.active ? 'Aktif' : 'Pasif'}</Text></View>
                <Feather name={item.active ? 'eye' : 'eye-off'} size={18} color={item.active ? colors.primary : colors.textMuted} />
              </View>
              <HouseAd ad={item} variant={item.placement === 'story_top' ? 'banner' : 'feed'} ignorePremium />
              <View style={styles.actions}>
                <Pressable onPress={() => edit(item)} style={styles.actionButton}><Text style={styles.actionText}>Düzenle</Text></Pressable>
                <Pressable onPress={() => void toggle(item)} style={styles.actionButton}><Text style={styles.actionText}>{item.active ? 'Pasife al' : 'Aktifleştir'}</Text></Pressable>
                <Pressable onPress={() => remove(item)} style={[styles.actionButton, styles.deleteButton]}><Text style={styles.deleteText}>Sil</Text></Pressable>
              </View>
            </View>
          ))}
          {items.length === 0 ? <View style={styles.empty}><Feather name="monitor" size={25} color={colors.textMuted} /><Text style={styles.emptyText}>Henüz kendi reklam kampanyan yok.</Text></View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0A0A0E'},
  center:{flex:1,backgroundColor:'#0A0A0E',alignItems:'center',justifyContent:'center'},
  loadingText:{marginTop:10,color:'#8E8E9D'},
  content:{width:'100%',maxWidth:760,alignSelf:'center',padding:18,paddingBottom:60},
  header:{flexDirection:'row',alignItems:'center',marginBottom:18},
  iconButton:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},
  headerCopy:{flex:1,marginHorizontal:14},
  eyebrow:{color:'#A985FF',fontSize:11,fontWeight:'900',letterSpacing:1.2},
  title:{color:'#F5F5F8',fontSize:24,fontWeight:'900'},
  infoCard:{flexDirection:'row',gap:11,padding:14,borderRadius:16,backgroundColor:'#15121D',borderWidth:1,borderColor:'#302540',marginBottom:16},
  infoText:{flex:1,color:'#B5ADBF',fontSize:12,lineHeight:18},
  formCard:{padding:16,borderRadius:18,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},
  formTitle:{color:'#F5F5F8',fontSize:17,fontWeight:'900',marginBottom:13},
  input:{minHeight:46,borderRadius:12,backgroundColor:'#0D0D13',borderWidth:1,borderColor:'#2C2C38',paddingHorizontal:12,color:'#F5F5F8',fontSize:13,marginBottom:10},
  label:{color:'#9B9BA8',fontSize:11,fontWeight:'800',marginBottom:7},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12},
  chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:11,backgroundColor:'#0D0D13',borderWidth:1,borderColor:'#30303B'},
  chipActive:{backgroundColor:'#2A1D3E',borderColor:'#6D4AA0'},
  chipText:{color:'#8E8E9D',fontSize:11,fontWeight:'800'},
  chipTextActive:{color:'#D7C8FF'},
  mediaPicker:{minHeight:64,borderRadius:14,borderWidth:1,borderColor:'#342A43',backgroundColor:'#111017',paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:11,marginBottom:12},
  mediaPickerTitle:{color:'#F1F1F5',fontSize:13,fontWeight:'800'},
  mediaPickerText:{color:'#777784',fontSize:10,marginTop:3},
  previewBox:{borderRadius:15,overflow:'hidden',borderWidth:1,borderColor:'#292934',paddingVertical:10,marginBottom:12},
  previewLabel:{color:'#858593',fontSize:10,fontWeight:'800',paddingHorizontal:12,marginBottom:6},
  twoColumns:{flexDirection:'row',gap:10},
  column:{flex:1,minWidth:0},
  slotNotice:{minHeight:58,borderRadius:14,backgroundColor:'#111017',borderWidth:1,borderColor:'#342A43',padding:13,flexDirection:'row',alignItems:'center',gap:10,marginBottom:10},
  slotNoticeText:{flex:1,color:'#9B93A5',fontSize:11,lineHeight:16},
  switchRow:{minHeight:60,borderRadius:14,backgroundColor:'#101016',borderWidth:1,borderColor:'#292934',padding:13,flexDirection:'row',alignItems:'center',marginTop:2},
  switchTitle:{color:'#F3F3F6',fontSize:13,fontWeight:'800'},
  switchText:{color:'#777784',fontSize:10,marginTop:3},
  formActions:{flexDirection:'row',gap:9,marginTop:14},
  secondaryButton:{flex:1,minHeight:46,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#1B1B23'},
  secondaryText:{color:'#C5C5CE',fontWeight:'800'},
  primaryButton:{flex:1,minHeight:46,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#6232B5'},
  primaryText:{color:'#FFF',fontWeight:'900'},
  sectionTitle:{color:'#F5F5F8',fontSize:17,fontWeight:'900',marginTop:22,marginBottom:10},
  list:{gap:12},
  card:{borderRadius:18,overflow:'hidden',backgroundColor:'#111117',borderWidth:1,borderColor:'#292934',paddingTop:13},
  cardTop:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,paddingBottom:10},
  cardTitle:{color:'#F5F5F8',fontSize:14,fontWeight:'900'},
  meta:{color:'#7F7F8B',fontSize:10,marginTop:3},
  actions:{flexDirection:'row',gap:7,padding:12},
  actionButton:{flex:1,minHeight:38,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#1B1B23',borderWidth:1,borderColor:'#30303B'},
  actionText:{color:'#C9C9D2',fontSize:11,fontWeight:'800'},
  deleteButton:{borderColor:'#54272F',backgroundColor:'#211216'},
  deleteText:{color:'#FF8F9B',fontSize:11,fontWeight:'800'},
  empty:{alignItems:'center',padding:28,borderRadius:16,backgroundColor:'#111117',borderWidth:1,borderColor:'#292934'},
  emptyText:{color:'#7F7F8B',fontSize:12,marginTop:9},
});
