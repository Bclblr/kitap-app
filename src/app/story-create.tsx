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
  PanResponder,
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

const STORY_TEXT_COLORS = ['#FFFFFF', '#FFE66D', '#FF7AA2', '#A985FF', '#69E3FF'] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches: readonly any[]) {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

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
  const [textColor, setTextColor] = useState<(typeof STORY_TEXT_COLORS)[number]>('#FFFFFF');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [textBackground, setTextBackground] = useState(false);
  const [textStyle, setTextStyle] = useState<'classic' | 'strong'>('classic');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [allowLikes, setAllowLikes] = useState(true);
  const [allowReplies, setAllowReplies] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [textOffset, setTextOffset] = useState({ x: 0, y: 0 });
  const imageScaleRef = useRef(1);
  const imageOffsetRef = useRef({ x: 0, y: 0 });
  const textOffsetRef = useRef({ x: 0, y: 0 });
  const imageGestureRef = useRef({ distance: 0, scale: 1, x: 0, y: 0 });
  const textGestureRef = useRef({ x: 0, y: 0 });

  const stageSize = useMemo(() => {
    const stageWidth = Math.min(Math.max(280, width), 520);
    const availableHeight = Math.max(360, height - insets.top - insets.bottom - 78);
    return {
      width: stageWidth,
      height: Math.min(availableHeight, stageWidth * (16 / 9)),
    };
  }, [height, insets.bottom, insets.top, width]);

  function setImageTransform(nextScale: number, nextX: number, nextY: number) {
    const scale = clamp(nextScale, 1, 4);
    const maxX = ((scale - 1) * stageSize.width) / 2;
    const maxY = ((scale - 1) * stageSize.height) / 2;
    const x = scale <= 1.001 ? 0 : clamp(nextX, -maxX, maxX);
    const y = scale <= 1.001 ? 0 : clamp(nextY, -maxY, maxY);
    imageScaleRef.current = scale;
    imageOffsetRef.current = { x, y };
    setImageScale(scale);
    setImageOffset({ x, y });
  }

  function setTextPosition(nextX: number, nextY: number) {
    const x = clamp(nextX, -stageSize.width * 0.42, stageSize.width * 0.42);
    const y = clamp(nextY, -stageSize.height * 0.42, stageSize.height * 0.42);
    textOffsetRef.current = { x, y };
    setTextOffset({ x, y });
  }

  function resetTransforms() {
    imageScaleRef.current = 1;
    imageOffsetRef.current = { x: 0, y: 0 };
    textOffsetRef.current = { x: 0, y: 0 };
    setImageScale(1);
    setImageOffset({ x: 0, y: 0 });
    setTextOffset({ x: 0, y: 0 });
  }

  const imagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => {
          const touches = event.nativeEvent.touches ?? [];
          return touches.length >= 2 || imageScaleRef.current > 1.01;
        },
        onMoveShouldSetPanResponder: (event, gesture) => {
          const touches = event.nativeEvent.touches ?? [];
          return touches.length >= 2 || (imageScaleRef.current > 1.01 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2);
        },
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches ?? [];
          imageGestureRef.current = {
            distance: touchDistance(touches),
            scale: imageScaleRef.current,
            x: imageOffsetRef.current.x,
            y: imageOffsetRef.current.y,
          };
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches ?? [];
          if (touches.length >= 2) {
            const distance = touchDistance(touches);
            const startDistance = imageGestureRef.current.distance || distance;
            if (!distance || !startDistance) return;
            const nextScale = imageGestureRef.current.scale * (distance / startDistance);
            setImageTransform(nextScale, imageOffsetRef.current.x, imageOffsetRef.current.y);
            return;
          }
          if (imageScaleRef.current <= 1.01) return;
          setImageTransform(
            imageScaleRef.current,
            imageGestureRef.current.x + gesture.dx,
            imageGestureRef.current.y + gesture.dy
          );
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [stageSize.height, stageSize.width]
  );

  const textPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!storyText.trim() && !textEditing,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !!storyText.trim() && !textEditing && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          textGestureRef.current = { ...textOffsetRef.current };
        },
        onPanResponderMove: (_event, gesture) => {
          setTextPosition(
            textGestureRef.current.x + gesture.dx,
            textGestureRef.current.y + gesture.dy
          );
        },
        onPanResponderRelease: (_event, gesture) => {
          if (Math.abs(gesture.dx) < 4 && Math.abs(gesture.dy) < 4) {
            setTextEditing(true);
            requestAnimationFrame(() => textInputRef.current?.focus());
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [storyText, textEditing, stageSize.height, stageSize.width]
  );

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
    if (capturing) return;

    if (!(await ensureCamera())) {
      Alert.alert('Kamera izni gerekli', 'Hikâye çekebilmek için kamera izni vermelisin.');
      return;
    }

    const camera = cameraRef.current;
    if (!camera) {
      Alert.alert('Kamera hazırlanıyor', 'Kamera henüz hazır değil. Birkaç saniye sonra tekrar dene.');
      return;
    }

    if (!cameraReady) {
      Alert.alert('Kamera hazırlanıyor', 'Kamera henüz hazır değil. Birkaç saniye sonra tekrar dene.');
      return;
    }

    setCapturing(true);
    try {
      const photo = await camera.takePictureAsync({
        quality: 0.86,
        skipProcessing: false,
      });

      if (!photo?.uri) throw new Error('Fotoğraf dosyası oluşturulamadı.');

      resetTransforms();
      setCapturedUri(photo.uri);
      setTextMode(false);
      setTextEditing(false);
      Keyboard.dismiss();
    } catch (error) {
      console.error('Hikâye kamera çekim hatası:', error);
      Alert.alert(
        'Fotoğraf çekilemedi',
        error instanceof Error ? error.message : 'Kamerayı tekrar açıp yeniden deneyebilirsin.'
      );
    } finally {
      setCapturing(false);
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
      resetTransforms();
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
    resetTransforms();
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
        text_color: textColor,
        text_align: textAlign,
        text_background: textBackground,
        text_style: textStyle,
        image_scale: imageScaleRef.current,
        image_offset_x: imageOffsetRef.current.x / stageSize.width,
        image_offset_y: imageOffsetRef.current.y / stageSize.height,
        text_offset_x: textOffsetRef.current.x / stageSize.width,
        text_offset_y: textOffsetRef.current.y / stageSize.height,
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
  const hasDraft = !!capturedUri || textMode;
  const showTextEditor = textMode || (!!capturedUri && (textEditing || !!storyText));

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
            capturedUri && styles.previewStage,
            {
              width: stageSize.width,
              height: stageSize.height,
              marginTop: Math.max(insets.top, 8),
            },
          ]}
        >
          {!capturedUri && !textMode && permission?.granted ? (
            <CameraView
              key={facing}
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
              mirror={facing === 'front'}
              onCameraReady={() => setCameraReady(true)}
              onMountError={(error) => {
                setCameraReady(false);
                console.error('Hikâye kamerası açılamadı:', error);
                Alert.alert('Kamera açılamadı', error.message || 'Kamerayı tekrar açmayı dene.');
              }}
            />
          ) : capturedUri ? (
            <View style={StyleSheet.absoluteFill} {...imagePanResponder.panHandlers}>
              <Image
                localPreview
                source={{ uri: capturedUri }}
                style={[
                  StyleSheet.absoluteFill,
                  {
                    transform: [
                      { translateX: imageOffset.x },
                      { translateY: imageOffset.y },
                      { scale: imageScale },
                    ],
                  },
                ]}
                resizeMode="cover"
              />
            </View>
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

          {showTextEditor && textEditing ? (
            <View style={styles.textToolbar}>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setTextBackground((value) => !value);
                }}
                style={[styles.textToolButton, textBackground && styles.textToolButtonActive]}
                accessibilityLabel="Yazı arka planını değiştir"
              >
                <Text style={styles.textToolAa}>A</Text>
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setTextAlign((current) => current === 'left' ? 'center' : current === 'center' ? 'right' : 'left');
                }}
                style={styles.textToolButton}
                accessibilityLabel="Yazı hizalamasını değiştir"
              >
                <Feather
                  name={textAlign === 'left' ? 'align-left' : textAlign === 'right' ? 'align-right' : 'align-center'}
                  size={19}
                  color="#FFF"
                />
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setTextStyle((current) => current === 'classic' ? 'strong' : 'classic');
                }}
                style={[styles.textStylePill, textStyle === 'strong' && styles.textToolButtonActive]}
              >
                <Text style={[styles.textStylePillText, textStyle === 'strong' && styles.textStylePillTextStrong]}>
                  {textStyle === 'strong' ? 'Güçlü' : 'Klasik'}
                </Text>
              </Pressable>
              <View style={styles.colorRail}>
                {STORY_TEXT_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={(event) => {
                      event.stopPropagation();
                      setTextColor(color);
                    }}
                    style={[styles.colorDotOuter, textColor === color && styles.colorDotSelected]}
                    accessibilityLabel="Yazı rengini değiştir"
                  >
                    <View style={[styles.colorDot, { backgroundColor: color }]} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {showTextEditor ? (
            <View
              style={[
                styles.textEditorWrap,
                textMode && styles.textEditorTextOnly,
                { transform: [{ translateX: textOffset.x }, { translateY: textOffset.y }] },
              ]}
              pointerEvents="auto"
              {...(!textEditing ? textPanResponder.panHandlers : {})}
            >
              <TextInput
                ref={textInputRef}
                value={storyText}
                onChangeText={setStoryText}
                onFocus={() => setTextEditing(true)}
                onBlur={() => setTextEditing(false)}
                onPressIn={(event) => event.stopPropagation()}
                placeholder={textMode ? 'Bir şeyler yaz…' : 'Yazmaya başla…'}
                placeholderTextColor="rgba(255,255,255,0.72)"
                multiline
                maxLength={1000}
                textAlign={textAlign}
                textAlignVertical="center"
                selectionColor={textColor}
                editable={textEditing}
                pointerEvents={textEditing ? 'auto' : 'none'}
                style={[
                  styles.storyTextInput,
                  textMode && styles.storyTextInputLarge,
                  textBackground && styles.storyTextInputBackground,
                  textStyle === 'strong' && styles.storyTextInputStrong,
                  { color: textColor, textAlign },
                ]}
              />
            </View>
          ) : null}

          {capturedUri && !textEditing ? (
            <View style={styles.zoomHint} pointerEvents="none">
              <Feather name="maximize-2" size={12} color="#FFF" />
              <Text style={styles.zoomHintText}>
                {imageScale > 1.01 ? 'Sürükle · iki parmakla yakınlaştır' : 'İki parmakla yakınlaştır'}
              </Text>
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
                disabled={capturing}
                style={[styles.shutterOuter, capturing && styles.shutterBusy]}
                accessibilityLabel="Fotoğraf çek"
              >
                {capturing ? (
                  <ActivityIndicator size="small" color="#111218" />
                ) : (
                  <View style={styles.shutterInner} pointerEvents="none" />
                )}
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

          {hasDraft ? (
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
  stage: { alignSelf: 'center', borderRadius: 26, overflow: 'hidden', backgroundColor: '#090A0E', position: 'relative' },
  previewStage: { borderRadius: 0 },
  blankStage: { ...StyleSheet.absoluteFill, backgroundColor: '#0B0C11' },
  textCanvas: { ...StyleSheet.absoluteFill, backgroundColor: '#171120' },
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
  shutterBusy: { backgroundColor: '#FFF', opacity: 0.9 },
  galleryButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(16,17,22,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  flipButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16,17,22,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  textToolbar: { position: 'absolute', left: 12, right: 12, top: 68, minHeight: 44, zIndex: 28, flexDirection: 'row', alignItems: 'center', gap: 7 },
  textToolButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(10,10,14,0.64)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  textToolButtonActive: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: '#FFF' },
  textToolAa: { color: '#FFF', fontSize: 17, fontWeight: '900', backgroundColor: '#17171C', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  textStylePill: { height: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: 'rgba(10,10,14,0.64)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  textStylePillText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  textStylePillTextStrong: { color: '#111218', fontWeight: '900' },
  colorRail: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  colorDotOuter: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  colorDotSelected: { borderColor: '#FFF' },
  colorDot: { width: 19, height: 19, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)' },
  textEditorWrap: { position: 'absolute', left: 22, right: 22, top: '31%', zIndex: 16, alignItems: 'center', justifyContent: 'center' },
  textEditorTextOnly: { top: 112, bottom: 92, justifyContent: 'center' },
  storyTextInput: { width: '100%', maxHeight: 210, paddingHorizontal: 10, paddingVertical: 8, color: '#FFF', backgroundColor: 'transparent', fontSize: 24, lineHeight: 31, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.30)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  storyTextInputBackground: { backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 8, paddingHorizontal: 12, textShadowColor: 'transparent' },
  storyTextInputStrong: { fontWeight: '900', fontSize: 27, lineHeight: 34 },
  storyTextInputLarge: { maxHeight: '72%', backgroundColor: 'transparent', fontSize: 32, lineHeight: 41, fontWeight: '800' },
  zoomHint: { position: 'absolute', left: 0, right: 0, bottom: 80, zIndex: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  zoomHintText: { color: 'rgba(255,255,255,0.82)', fontSize: 9.5, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
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
  settingsOverlay: { ...StyleSheet.absoluteFill, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' },
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
