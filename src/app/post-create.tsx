import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Image from '@/components/SafeImage';
import { cleanupUploadedMedia } from '@/lib/media-cleanup';
import { requirePermanentImage } from '@/lib/image-policy';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';

type Profile = { full_name: string | null; username: string | null; profile_image: string | null };

export default function PostCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useAppTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const dark = scheme === 'dark';
  const name = profile?.full_name?.trim() || profile?.username?.trim() || 'Kitap Okuru';
  const username = profile?.username?.trim() || 'kitapokuru';
  const ready = !!(title.trim() || body.trim() || image) && !posting;

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || !mounted) return;
      const { data } = await supabase.from('profiles').select('full_name, username, profile_image').eq('id', user.id).maybeSingle();
      if (mounted) setProfile(data ?? null);
    });
    return () => { mounted = false; };
  }, []);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('İzin gerekli', 'Fotoğraf eklemek için galeri izni vermelisin.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (!result.canceled && result.assets[0]?.uri) setImage(result.assets[0].uri);
  }

  function close() {
    if (!title.trim() && !body.trim() && !image) return router.back();
    Alert.alert('Gönderiden çıkılsın mı?', 'Yazdıkların kaydedilmeyecek.', [
      { text: 'Devam et', style: 'cancel' },
      { text: 'Çık', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  async function publish() {
    if (!ready) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Alert.alert('Giriş gerekli', 'Gönderi paylaşmak için giriş yapmalısın.');
    setPosting(true);
    let uploadedPath: string | null = null;
    try {
      let imageUrl: string | null = null;
      if (image) {
        uploadedPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const response = await fetch(image);
        if (!response.ok) throw new Error('Fotoğraf okunamadı.');
        const buffer = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage.from('post-images').upload(uploadedPath, buffer, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('post-images').getPublicUrl(uploadedPath);
        imageUrl = data.publicUrl.replace('/object/public/', '/object/authenticated/');
      }
      const text = [title.trim(), body.trim()].filter(Boolean).join('\n\n') || null;
      const { error } = await supabase.from('posts').insert({
        user_id: user.id, username, text, image_url: requirePermanentImage(imageUrl),
        book_key: null, book_title: null, rating: 0,
      });
      if (error) throw error;
      uploadedPath = null;
      router.back();
    } catch (error) {
      if (uploadedPath) await cleanupUploadedMedia('post-images', uploadedPath, 'post_insert_failed');
      Alert.alert('Gönderi yayınlanamadı', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally { setPosting(false); }
  }

  return (
    <KeyboardAvoidingView style={[s.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={close} style={s.iconButton}><Feather name="x" size={29} color={colors.text} /></Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>Yeni Gönderi</Text>
        <Pressable style={s.iconButton}><Feather name="more-vertical" size={24} color={colors.text} /></Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingBottom: 120 + insets.bottom }]}>
        <View style={s.identity}>
          <View style={[s.avatar, { backgroundColor: colors.primarySoft }]}>
            {profile?.profile_image ? <Image source={{ uri: profile.profile_image }} style={s.avatarImage} /> : <Text style={[s.avatarText, { color: colors.primary }]}>{name.charAt(0).toUpperCase()}</Text>}
          </View>
          <View style={s.identityText}>
            <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            <Text style={[s.handle, { color: colors.textSecondary }]} numberOfLines={1}>@{username}</Text>
          </View>
        </View>

        <TextInput value={title} onChangeText={setTitle} placeholder="Başlık" placeholderTextColor={colors.textSecondary} maxLength={120} style={[s.title, { color: colors.text }]} />
        <TextInput value={body} onChangeText={setBody} placeholder="Ne düşünüyorsun?" placeholderTextColor={colors.textSecondary} multiline maxLength={2000} textAlignVertical="top" style={[s.body, { color: colors.text }]} />

        {image ? <View style={s.previewWrap}>
          <Image localPreview source={{ uri: image }} style={s.preview} resizeMode="cover" />
          <Pressable onPress={() => setImage(null)} style={[s.remove, { backgroundColor: colors.background }]}><Feather name="x" size={20} color={colors.text} /></Pressable>
        </View> : null}

        <Pressable style={s.topic}>
          <View style={[s.topicIcon, { backgroundColor: colors.primarySoft }]}><Feather name="grid" size={18} color={colors.primary} /></View>
          <Text style={[s.topicText, { color: colors.textSecondary }]}>Konu seç</Text>
          <Feather name="chevron-down" size={19} color={colors.textSecondary} />
        </Pressable>

        <View style={[s.tools, { borderTopColor: colors.border }]}>
          <Pressable onPress={pickImage} style={s.tool}><Feather name="image" size={24} color={colors.text} /></Pressable>
          <Pressable onPress={() => router.push('/quote-create')} style={s.tool}><Feather name="feather" size={24} color={colors.text} /></Pressable>
          <Pressable onPress={() => router.push('/review')} style={s.tool}><Feather name="book-open" size={24} color={colors.text} /></Pressable>
          <Pressable style={s.tool}><Feather name="at-sign" size={24} color={colors.text} /></Pressable>
          <Pressable style={s.tool}><Feather name="smile" size={24} color={colors.text} /></Pressable>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10), borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={s.options}><Feather name="sliders" size={21} color={colors.textSecondary} /><Text style={[s.optionsText, { color: colors.textSecondary }]}>Gönderi seçenekleri</Text></View>
        <Feather name="eye" size={22} color={colors.textSecondary} />
        <Pressable onPress={publish} disabled={!ready} style={[s.publish, { backgroundColor: ready ? colors.primary : colors.primarySoft }]}>
          {posting ? <ActivityIndicator color={dark ? '#0D0913' : '#FFF'} /> : <Text style={[s.publishText, { color: ready ? (dark ? '#0D0913' : '#FFF') : colors.textSecondary }]}>Yayınla</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen:{flex:1}, header:{height:64,paddingHorizontal:14,borderBottomWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center'}, headerTitle:{fontSize:20,fontWeight:'900',letterSpacing:-0.4},
  content:{flexGrow:1,paddingHorizontal:20,paddingTop:22}, identity:{flexDirection:'row',alignItems:'center',marginBottom:22},
  avatar:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',overflow:'hidden'}, avatarImage:{width:'100%',height:'100%'}, avatarText:{fontSize:18,fontWeight:'900'},
  identityText:{flex:1,marginLeft:12,minWidth:0}, name:{fontSize:16,fontWeight:'800'}, handle:{fontSize:12,marginTop:2},
  title:{fontSize:24,fontWeight:'800',paddingVertical:8,letterSpacing:-0.5}, body:{minHeight:250,fontSize:18,lineHeight:27,paddingTop:16,paddingBottom:18},
  previewWrap:{position:'relative',marginBottom:18}, preview:{width:'100%',height:240,borderRadius:18}, remove:{position:'absolute',top:10,right:10,width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  topic:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:9,paddingVertical:12}, topicIcon:{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center'}, topicText:{fontSize:15,fontWeight:'700'},
  tools:{marginTop:8,paddingTop:17,borderTopWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',gap:7}, tool:{width:48,height:48,borderRadius:16,alignItems:'center',justifyContent:'center'},
  footer:{position:'absolute',left:0,right:0,bottom:0,minHeight:76,paddingTop:10,paddingHorizontal:18,borderTopWidth:StyleSheet.hairlineWidth,flexDirection:'row',alignItems:'center',gap:14},
  options:{flex:1,flexDirection:'row',alignItems:'center',gap:9,minWidth:0}, optionsText:{fontSize:14,fontWeight:'700',flexShrink:1},
  publish:{minWidth:104,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',paddingHorizontal:22}, publishText:{fontSize:16,fontWeight:'900'}
});
