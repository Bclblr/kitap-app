import { Feather } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeBack } from '@/lib/navigation';
import Image from '@/components/SafeImage';
import { requirePermanentImage } from '@/lib/image-policy';
import { supabase } from '@/lib/supabase';

export default function StoryCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [busy, setBusy] = useState(false);
  async function ensureCamera() { if (permission?.granted) return true; return (await requestPermission()).granted; }
  async function takePhoto() { if (!(await ensureCamera())) { Alert.alert('Kamera izni gerekli', 'Hikâye çekebilmek için kamera izni vermelisin.'); return; } const photo = await cameraRef.current?.takePictureAsync({ quality: 0.82 }); if (photo?.uri) setCapturedUri(photo.uri); }
  async function pickFromLibrary() { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [9, 16], quality: 0.85 }); if (!result.canceled && result.assets[0]?.uri) setCapturedUri(result.assets[0].uri); }
  async function publish() {
    const cleanText = storyText.trim(); if (!capturedUri && !cleanText) return;
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { Alert.alert('Giriş gerekli', 'Hikâye paylaşmak için önce giriş yapmalısın.'); return; }
    setBusy(true);
    try {
      let imageUrl: string | null = null;
      if (capturedUri) { const response = await fetch(capturedUri); if (!response.ok) throw new Error('Hikâye görseli okunamadı.'); const bytes = await response.arrayBuffer(); const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`; const path = `${user.id}/${fileName}`; const upload = await supabase.storage.from('story-images').upload(path, bytes, { contentType: 'image/jpeg', upsert: false }); if (upload.error) throw upload.error; imageUrl = supabase.storage.from('story-images').getPublicUrl(path).data.publicUrl; }
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
      const result = await supabase.from('stories').insert({ user_id: user.id, username: profile?.username || 'Kitap Okuru', text: cleanText || null, image_url: requirePermanentImage(imageUrl), expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
      if (result.error) throw result.error; router.replace('/');
    } catch (error) { console.error('Hikâye paylaşma hatası:', error); Alert.alert('Hikâye paylaşılamadı', error instanceof Error ? error.message : 'Tekrar dene.'); } finally { setBusy(false); }
  }
  const readyToShare = !!capturedUri || !!storyText.trim();
  return <View style={styles.root}>
    <View style={[styles.stage, { marginTop: insets.top + 8 }]}>
      {!capturedUri && !textMode && permission?.granted ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} flash={flash} /> : capturedUri ? <Image localPreview source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={styles.blankStage} />}
      {textMode ? <View style={styles.textCanvas}><TextInput autoFocus value={storyText} onChangeText={setStoryText} placeholder="Bir şeyler yaz…" placeholderTextColor="#8B9098" multiline maxLength={1000} style={styles.storyTextInput} /></View> : null}
      <View style={styles.topBar}><Pressable onPress={() => safeBack(router, '/')} style={styles.iconButton}><Feather name="x" size={31} color="#fff" /></Pressable>{!capturedUri && !textMode ? <Pressable onPress={() => setFlash(current => current === 'off' ? 'on' : 'off')} style={styles.iconButton}><Feather name={flash === 'on' ? 'zap' : 'zap-off'} size={26} color="#fff" /></Pressable> : <View />}<View style={styles.iconButton}><Feather name="settings" size={26} color="#fff" /></View></View>
      {!capturedUri && !textMode ? <View style={styles.toolRail}><Pressable onPress={() => setTextMode(true)} style={styles.tool}><Text style={styles.aa}>Aa</Text><Text style={styles.toolText}>Oluştur</Text></Pressable><Pressable onPress={() => Alert.alert('Yakında', 'Çoklu yerleşim aracı sonraki sürümde eklenecek.')} style={styles.tool}><Feather name="grid" size={27} color="#fff" /><Text style={styles.toolText}>Yerleşim</Text></Pressable><Pressable onPress={() => setFacing(current => current === 'back' ? 'front' : 'back')} style={styles.tool}><Feather name="refresh-cw" size={25} color="#fff" /><Text style={styles.toolText}>Kamerayı çevir</Text></Pressable></View> : null}
      {capturedUri && !textMode ? <View style={styles.captionWrap}><TextInput value={storyText} onChangeText={setStoryText} placeholder="Hikâyene yazı ekle…" placeholderTextColor="#C6C9CE" multiline maxLength={1000} style={styles.captionInput} /></View> : null}
      {!capturedUri && !textMode ? <View style={styles.captureRow}><Pressable onPress={pickFromLibrary} style={styles.galleryButton}><Feather name="image" size={25} color="#fff" /></Pressable><Pressable onPress={takePhoto} style={styles.shutterOuter}><View style={styles.shutterInner} /></Pressable><Pressable onPress={() => setFacing(current => current === 'back' ? 'front' : 'back')} style={styles.flipButton}><Feather name="refresh-cw" size={25} color="#fff" /></Pressable></View> : null}
      {(capturedUri || textMode) ? <View style={styles.editFooter}><Pressable onPress={() => { setCapturedUri(null); setTextMode(false); }} style={styles.retake}><Text style={styles.retakeText}>Vazgeç</Text></Pressable><Pressable onPress={() => void publish()} disabled={!readyToShare || busy} style={[styles.share, (!readyToShare || busy) && styles.disabled]}><Text style={styles.shareText}>{busy ? 'Paylaşılıyor…' : 'Hikâyeyi paylaş'}</Text><Feather name="arrow-right" size={18} color="#fff" /></Pressable></View> : null}
    </View>
    <View style={[styles.bottomLabel, { paddingBottom: Math.max(insets.bottom, 12) }]}><Text style={styles.bottomActive}>HİKÂYE</Text></View>
  </View>;
}
const styles = StyleSheet.create({ root:{flex:1,backgroundColor:'#080B0F'},stage:{flex:1,marginHorizontal:8,marginBottom:10,borderRadius:32,overflow:'hidden',backgroundColor:'#050607'},blankStage:{position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:'#050607'},textCanvas:{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center',padding:28,backgroundColor:'#11131A'},storyTextInput:{width:'100%',color:'#fff',fontSize:30,lineHeight:39,fontWeight:'800',textAlign:'center',maxHeight:'70%'},topBar:{position:'absolute',left:18,right:18,top:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},iconButton:{width:48,height:48,borderRadius:24,backgroundColor:'rgba(0,0,0,0.24)',alignItems:'center',justifyContent:'center'},toolRail:{position:'absolute',left:25,top:'35%',gap:22},tool:{minWidth:150,flexDirection:'row',alignItems:'center',gap:18},aa:{color:'#fff',fontSize:31,fontWeight:'500'},toolText:{color:'#fff',fontSize:15,fontWeight:'800'},captureRow:{position:'absolute',left:24,right:24,bottom:28,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},shutterOuter:{width:84,height:84,borderRadius:42,borderWidth:5,borderColor:'#fff',alignItems:'center',justifyContent:'center'},shutterInner:{width:68,height:68,borderRadius:34,backgroundColor:'#E8E9EB'},galleryButton:{width:52,height:52,borderRadius:16,backgroundColor:'rgba(20,22,28,0.82)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#3A3D45'},flipButton:{width:52,height:52,borderRadius:26,backgroundColor:'rgba(45,48,56,0.82)',alignItems:'center',justifyContent:'center'},captionWrap:{position:'absolute',left:22,right:22,bottom:98},captionInput:{color:'#fff',backgroundColor:'rgba(0,0,0,0.48)',borderRadius:18,paddingHorizontal:16,paddingVertical:12,fontSize:17,textAlign:'center'},editFooter:{position:'absolute',left:18,right:18,bottom:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},retake:{height:48,paddingHorizontal:20,borderRadius:24,backgroundColor:'rgba(0,0,0,0.52)',alignItems:'center',justifyContent:'center'},retakeText:{color:'#fff',fontWeight:'800'},share:{flex:1,height:50,borderRadius:25,backgroundColor:'#7957E8',flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'},shareText:{color:'#fff',fontWeight:'900',fontSize:15},disabled:{opacity:.45},bottomLabel:{minHeight:58,flexDirection:'row',justifyContent:'center',alignItems:'center'},bottomActive:{color:'#fff',fontWeight:'900',letterSpacing:1.5} });
