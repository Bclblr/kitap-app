import { Feather } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Image from '@/components/SafeImage';
import { cleanupUploadedMedia } from '@/lib/media-cleanup';
import { safeBack } from '@/lib/navigation';
import { requirePermanentImage } from '@/lib/image-policy';
import { supabase } from '@/lib/supabase';

export default function StoryCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);
  const textInputRef = useRef<TextInput>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [textEditing, setTextEditing] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [allowLikes, setAllowLikes] = useState(true);
  const [allowReplies, setAllowReplies] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const stageSize = useMemo(() => {
    const stageWidth = Math.min(Math.max(280, width - 16), 520);
    const availableHeight = Math.max(360, height - insets.top - insets.bottom - 78);
    return {
      width: stageWidth,
      height: Math.min(availableHeight, stageWidth * (16 / 9)),
    };
  }, [height, insets.bottom, insets.top, width]);

  useEffect(() => {
    if (!textMode) return;
    const timer = setTimeout(() => {
      setTextEditing(true);
      textInputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, [textMode]);

  async function ensureCamera() {
    if (permission?.granted) return true;
    return (await requestPermission()).granted;
  }

  function dismissKeyboard() {
    Keyboard.dismiss();
    textInputRef.current?.blur();
    setTextEditing(false);
  }

  function startTextEditing() {
    setTextEditing(true);
    requestAnimationFrame(() => textInputRef.current?.focus());
  }

  async function takePhoto() {
    if (!(await ensureCamera())) {
      Alert.alert('Kamera izni gerekli', 'Hikâye çekebilmek için kamera izni vermelisin.');
      return;
    }
    if (!cameraReady) return;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.86 });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setTextMode(false);
        setTextEditing(false);
      }
    } catch {
      Alert.alert('Fotoğraf çekilemedi', 'Kamerayı tekrar açıp yeniden deneyebilirsin.');
    }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.88,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setCapturedUri(result.assets[0].uri);
      setTextMode(false);
      setTextEditing(false);
    }
  }

  function resetDraft() {
    dismissKeyboard();
    setCapturedUri(null);
    setTextMode(false);
    setStoryText('');
  }

  async function publish() {
    const cleanText = storyText.trim();
    if (!capturedUri && !cleanText) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Giriş gerekli', 'Hikâye paylaşmak için önce giriş yapmalısın.');
      return;
    }

    dismissKeyboard();
    setBusy(true);
    let uploadedPath: string | null = null;

    try {
      let imageUrl: string | null = null;
      if (capturedUri) {
        const response = await fetch(capturedUri);
        if (!response.ok) throw new Error('Hikâye görseli okunamadı.');
        const bytes = await response.arrayBuffer();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        uploadedPath = `${user.id}/${fileName}`;

        const upload = await supabase.storage
          .from('story-images')
          .upload(uploadedPath, bytes, { contentType: 'image/jpeg', upsert: false });
        if (upload.error) throw upload.error;

        imageUrl = supabase.storage.from('story-images').getPublicUrl(uploadedPath).data.publicUrl;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const result = await supabase.from('stories').insert({
        user_id: user.id,
        username: profile?.username || 'Kitap Okuru',
        text: cleanText || null,
        image_url: requirePermanentImage(imageUrl),
        storage_path: uploadedPath,
        allow_likes: allowLikes,
        allow_replies: allowReplies,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (result.error) throw result.error;

      uploadedPath = null;
      router.replace('/');
    } catch (error) {
      if (uploadedPath) await cleanupUploadedMedia('story-images', uploadedPath, 'story_insert_failed');
      console.error('Hikâye paylaşma hatası:', error);
      Alert.alert('Hikâye paylaşılamadı', error instanceof Error ? error.message : 'Tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  const readyToShare = !!capturedUri || !!storyText.trim();
  const editing = !!capturedUri || textMode;

  return (
    <Pressable style={styles.root} onPress={dismissKeyboard}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.stage,
            {
              width: stageSize.width,
              height: stageSize.height,
              marginTop: Math.max(insets.top, 8),
            },
          ]}
        >
          {!capturedUri && !textMode && permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
              mirror={facing === 'front'}
              onCameraReady={() => setCameraReady(true)}
            />
          ) : capturedUri ? (
            <Image localPreview source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={styles.blankStage} />
          )}

          {textMode ? <View style={styles.textCanvas} /> : null}

          <View style={styles.scrimTop} pointerEvents="none" />
          <View style={styles.scrimBottom} pointerEvents="none" />

          <View style={styles.topBar}>
            <Pressable
              onPress={(event) => { event.stopPropagation(); safeBack(router, '/'); }}
              style={styles.iconButton}
              accessibilityLabel="Hikâye oluşturmayı kapat"
            >
              <Feather name="x" size={25} color="#FFF" />
            </Pressable>

            <View style={styles.topTools}>
              {capturedUri ? (
                <Pressable
                  onPress={(event) => { event.stopPropagation(); startTextEditing(); }}
                  style={[styles.iconButton, textEditing && styles.iconButtonActive]}
                  accessibilityLabel="Hikâyeye yazı ekle"
                >
                  <Text style={styles.aaSmall}>Aa</Text>
                </Pressable>
              ) : null}
              {!capturedUri && !textMode ? (
                <Pressable
                  onPress={(event) => { event.stopPropagation(); setFlash(current => current === 'off' ? 'on' : 'off'); }}
                  style={styles.iconButton}
                  accessibilityLabel="Flaşı değiştir"
                >
                  <Feather name={flash === 'on' ? 'zap' : 'zap-off'} size={21} color="#FFF" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={(event) => { event.stopPropagation(); dismissKeyboard(); setSettingsVisible(true); }}
                style={styles.iconButton}
                accessibilityLabel="Hikâye ayarlarını aç"
              >
                <Feather name="settings" size={21} color="#FFF" />
              </Pressable>
            </View>
          </View>

          {!capturedUri && !textMode ? (
            <View style={styles.toolRail}>
              <Pressable
                onPress={(event) => { event.stopPropagation(); setTextMode(true); }}
                style={styles.toolPill}
              >
                <Text style={styles.aa}>Aa</Text>
                <Text style={styles.toolText}>Yazı</Text>
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setCameraReady(false);
                  setFacing(current => current === 'back' ? 'front' : 'back');
                }}
                style={styles.toolPill}
              >
                <Feather name="refresh-cw" size={20} color="#FFF" />
                <Text style={styles.toolText}>Çevir</Text>
              </Pressable>
            </View>
          ) : null}

          {editing ? (
            <View style={[styles.textEditorWrap, textMode && styles.textEditorTextOnly]}>
              <TextInput
                ref={textInputRef}
                value={storyText}
                onChangeText={setStoryText}
                onFocus={() => setTextEditing(true)}
                onBlur={() => setTextEditing(false)}
                onPressIn={(event) => event.stopPropagation()}
                placeholder={textMode ? 'Bir şeyler yaz…' : 'Hikâyene yazı ekle…'}
                placeholderTextColor={textMode ? '#A4A8B0' : '#D4D5DA'}
                multiline
                maxLength={1000}
                textAlign="center"
                textAlignVertical="center"
                style={[styles.storyTextInput, textMode && styles.storyTextInputLarge]}
              />
            </View>
          ) : null}

          {!capturedUri && !textMode ? (
            <View style={styles.captureRow}>
              <Pressable
                onPress={(event) => { event.stopPropagation(); void pickFromLibrary(); }}
                style={styles.galleryButton}
                accessibilityLabel="Galeriden fotoğraf seç"
              >
                <Feather name="image" size={23} color="#FFF" />
              </Pressable>
              <Pressable
                onPress={(event) => { event.stopPropagation(); void takePhoto(); }}
                style={styles.shutterOuter}
                accessibilityLabel="Fotoğraf çek"
              >
                <View style={styles.shutterInner} />
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setCameraReady(false);
                  setFacing(current => current === 'back' ? 'front' : 'back');
                }}
                style={styles.flipButton}
                accessibilityLabel="Kamerayı çevir"
              >
                <Feather name="refresh-cw" size={23} color="#FFF" />
              </Pressable>
            </View>
          ) : null}

          {editing ? (
            <View style={styles.editFooter}>
              <Pressable
                onPress={(event) => { event.stopPropagation(); resetDraft(); }}
                style={styles.retake}
              >
                <Text style={styles.retakeText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={(event) => { event.stopPropagation(); void publish(); }}
                disabled={!readyToShare || busy}
                style={[styles.share, (!readyToShare || busy) && styles.disabled]}
              >
                {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="send" size={17} color="#FFF" />}
                <Text style={styles.shareText}>{busy ? 'Paylaşılıyor…' : 'Hikâyeyi paylaş'}</Text>
              </Pressable>
            </View>
          ) : null}

          {!permission?.granted && !textMode ? (
            <View style={styles.permissionCard}>
              <View style={styles.permissionIcon}><Feather name="camera" size={24} color="#D9CCFF" /></View>
              <Text style={styles.permissionTitle}>Kameranı kullan</Text>
              <Text style={styles.permissionText}>Fotoğraf çekmek için kamera izni gerekiyor.</Text>
              <Pressable
                onPress={(event) => { event.stopPropagation(); void requestPermission(); }}
                style={styles.permissionButton}
              >
                <Text style={styles.permissionButtonText}>Kameraya izin ver</Text>
              </Pressable>
              <Pressable
                onPress={(event) => { event.stopPropagation(); setTextMode(true); }}
                style={styles.permissionTextButton}
              >
                <Text style={styles.permissionTextButtonLabel}>Yalnızca yazı paylaş</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={[styles.bottomLabel, { marginBottom: Math.max(insets.bottom, 8) }]}>
          {capturedUri ? 'ÖNİZLEME' : textMode ? 'YAZI HİKÂYESİ' : 'HİKÂYE'}
        </Text>
      </KeyboardAvoidingView>

      {settingsVisible ? (
        <View style={styles.settingsOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsVisible(false)} />
          <View style={[styles.settingsCard, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.settingsHandle} />
            <View style={styles.settingsHeader}>
              <View>
                <Text style={styles.settingsTitle}>Hikâye ayarları</Text>
                <Text style={styles.settingsSubtitle}>Etkileşim tercihlerini belirle</Text>
              </View>
              <Pressable onPress={() => setSettingsVisible(false)} style={styles.settingsClose}>
                <Feather name="x" size={19} color="#FFF" />
              </Pressable>
            </View>
            <View style={styles.settingsRow}>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsLabel}>Beğeniler</Text>
                <Text style={styles.settingsDescription}>Diğer kullanıcılar hikâyeni beğenebilir.</Text>
              </View>
              <Switch value={allowLikes} onValueChange={setAllowLikes} />
            </View>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsRow}>
              <View style={styles.settingsTextWrap}>
                <Text style={styles.settingsLabel}>Yanıtlar</Text>
                <Text style={styles.settingsDescription}>Hikâyenden doğrudan mesaj gönderebilirler.</Text>
              </View>
              <Switch value={allowReplies} onValueChange={setAllowReplies} />
            </View>
            <Pressable onPress={() => setSettingsVisible(false)} style={styles.settingsDone}>
              <Text style={styles.settingsDoneText}>Tamam</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050609' },
  keyboardRoot: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  stage: { alignSelf: 'center', borderRadius: 30, overflow: 'hidden', backgroundColor: '#090A0E', position: 'relative' },
  blankStage: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B0C11' },
  textCanvas: { ...StyleSheet.absoluteFillObject, backgroundColor: '#171120' },
  scrimTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 140, backgroundColor: 'rgba(0,0,0,0.16)' },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 180, backgroundColor: 'rgba(0,0,0,0.20)' },
  topBar: { position: 'absolute', left: 14, right: 14, top: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
  topTools: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(13,14,18,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  iconButtonActive: { backgroundColor: '#6F45C8', borderColor: '#A985FF' },
  aaSmall: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  toolRail: { position: 'absolute', right: 14, top: 74, gap: 9, zIndex: 18 },
  toolPill: { minWidth: 86, height: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: 'rgba(13,14,18,0.60)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  aa: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  toolText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  captureRow: { position: 'absolute', left: 22, right: 22, bottom: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFF', padding: 5, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: '100%', height: '100%', borderRadius: 32, backgroundColor: '#FFF' },
  galleryButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(16,17,22,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  flipButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16,17,22,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  textEditorWrap: { position: 'absolute', left: 18, right: 18, bottom: 92, zIndex: 16, alignItems: 'center' },
  textEditorTextOnly: { top: 92, bottom: 92, justifyContent: 'center' },
  storyTextInput: { width: '100%', maxHeight: 180, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, color: '#FFF', backgroundColor: 'rgba(0,0,0,0.46)', fontSize: 18, lineHeight: 25, fontWeight: '700' },
  storyTextInputLarge: { maxHeight: '72%', backgroundColor: 'transparent', fontSize: 30, lineHeight: 39, fontWeight: '900' },
  editFooter: { position: 'absolute', left: 14, right: 14, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 22 },
  retake: { height: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: 'rgba(14,15,20,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  retakeText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  share: { flex: 1, height: 50, borderRadius: 25, backgroundColor: '#6232B5', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.45 },
  permissionCard: { position: 'absolute', left: 24, right: 24, top: '28%', padding: 22, borderRadius: 24, backgroundColor: '#15131B', borderWidth: 1, borderColor: '#312640', alignItems: 'center' },
  permissionIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#241A33', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  permissionTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  permissionText: { color: '#8E919A', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  permissionButton: { minHeight: 44, alignSelf: 'stretch', borderRadius: 14, backgroundColor: '#6232B5', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  permissionButtonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  permissionTextButton: { padding: 10, marginTop: 4 },
  permissionTextButtonLabel: { color: '#BCA8F6', fontSize: 12, fontWeight: '800' },
  bottomLabel: { color: '#9A9DA7', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  settingsOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' },
  settingsCard: { margin: 10, padding: 18, borderRadius: 28, backgroundColor: '#15171E', borderWidth: 1, borderColor: '#2B2E38' },
  settingsHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#42454F', alignSelf: 'center', marginBottom: 16 },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  settingsTitle: { color: '#FFF', fontSize: 19, fontWeight: '900' },
  settingsSubtitle: { color: '#7F838D', fontSize: 11, marginTop: 3 },
  settingsClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#23262F' },
  settingsRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingsTextWrap: { flex: 1 },
  settingsLabel: { color: '#F7F7F8', fontSize: 14, fontWeight: '800' },
  settingsDescription: { color: '#858A95', fontSize: 11, lineHeight: 17, marginTop: 4 },
  settingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#30323A' },
  settingsDone: { height: 48, borderRadius: 24, backgroundColor: '#6232B5', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  settingsDoneText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});
