import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import BookCover from '@/components/BookCover';
import { pickWorkCover } from '@/lib/upload-cover';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

const LICENSES = [
  ['all_rights_reserved','Tüm Hakları Saklıdır'],
  ['public_domain','Kamu Malı'],
  ['cc_by','Creative Commons BY (Atıf)'],
  ['cc_by_sa','Creative Commons BY-SA (Atıf - Benzer Paylaşım)'],
  ['cc_by_nd','Creative Commons BY-ND (Atıf - Türetilemez)'],
  ['cc_by_nc','Creative Commons BY-NC (Atıf - Ticari Olmayan)'],
  ['cc_by_nc_sa','Creative Commons BY-NC-SA'],
  ['cc_by_nc_nd','Creative Commons BY-NC-ND'],
] as const;
const AUDIENCES = [['general','Genel Okur'],['teen','Genç Okur']] as const;

export default function StoryEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [workId,setWorkId]=useState<string|null>(id ?? null);
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [genre,setGenre]=useState('');
  const [tags,setTags]=useState('');
  const [language,setLanguage]=useState('tr');
  const [audience,setAudience]=useState('general');
  const [license,setLicense]=useState('all_rights_reserved');
  const [warnings,setWarnings]=useState('');
  const [completed,setCompleted]=useState(false);
  const [cover,setCover]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [licenseOpen,setLicenseOpen]=useState(false);

  useEffect(() => {
    if (!id || !userId) return;
    let alive=true;
    void supabase.from('works').select('*').eq('id',id).eq('author_id',userId).eq('work_type','story').single().then(({data,error})=>{
      if(!alive)return;
      if(error||!data){Alert.alert('Hikaye bulunamadı');return;}
      setTitle(data.title);setDescription(data.description ?? '');setGenre(data.genre ?? '');
      setTags((data.tags ?? []).join(', '));setLanguage(data.language ?? 'tr');setAudience(data.audience ?? 'general');
      setLicense(data.copyright_license ?? 'all_rights_reserved');setWarnings((data.content_warnings ?? []).join(', '));
      setCompleted(!!data.completed);setCover(data.cover_url ?? null);
    });
    return()=>{alive=false;};
  },[id,userId]);

  async function chooseCover(){
    try{const uri=await pickWorkCover();if(uri)setCover(uri);}catch(error){Alert.alert('Kapak yüklenemedi',error instanceof Error?error.message:'Tekrar dene.');}
  }

  async function save(status:'draft'|'published'){
    if(!userId||saving)return;
    if(!title.trim()){Alert.alert('Başlık gerekli','Hikayene bir başlık eklemelisin.');return;}
    if(status==='published'&&!description.trim()){Alert.alert('Açıklama gerekli','Yayınlamadan önce kısa bir açıklama eklemelisin.');return;}
    setSaving(true);
    const payload={
      author_id:userId,title:title.trim(),description:description.trim(),cover_url:cover,genre:genre.trim(),
      tags:tags.split(',').map(x=>x.trim()).filter(Boolean),language:language.trim()||'tr',audience,completed,
      status,work_type:'story',copyright_license:license,
      content_warnings:warnings.split(',').map(x=>x.trim()).filter(Boolean),
      updated_at:new Date().toISOString(),...(status==='published'?{published_at:new Date().toISOString()}:{})
    };
    try{
      if(workId){
        const {error}=await supabase.from('works').update(payload).eq('id',workId).eq('author_id',userId);if(error)throw error;
      }else{
        const {data,error}=await supabase.from('works').insert(payload).select('id').single();if(error)throw error;setWorkId(data.id);
      }
      Alert.alert(status==='published'?'Hikaye yayınlandı':'Taslak kaydedildi',status==='published'?'Hikayen okurlarla buluşmaya hazır.':'Daha sonra kaldığın yerden devam edebilirsin.');
    }catch(error){console.error('Hikaye kaydedilemedi:',error);Alert.alert('Kaydedilemedi','Lütfen tekrar dene.');}
    finally{setSaving(false);}
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={()=>router.back()} style={styles.icon}><Feather name="chevron-left" size={22} color={colors.textPrimary}/></Pressable>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>{workId?'HİKAYE STÜDYOSU':'YENİ HİKAYE'}</Text><Text style={styles.headerTitle}>{title.trim()||'İsimsiz hikaye'}</Text></View>
      <Pressable disabled={saving} onPress={()=>void save('published')} style={styles.publish}><Text style={styles.publishText}>Yayınla</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Pressable onPress={()=>void chooseCover()} style={styles.coverButton}>
          <BookCover uri={cover} style={styles.cover} resizeMode="contain"><View style={[styles.cover,styles.coverEmpty]}><Feather name="image" size={26} color={colors.primary}/><Text style={styles.coverText}>Kapak Ekle</Text></View></BookCover>
          <View style={styles.coverEdit}><Feather name="camera" size={13} color="#FFF"/></View>
        </Pressable>
        <View style={styles.heroFields}>
          <Field label="Başlık *" value={title} onChangeText={setTitle} placeholder="Hikayenin adı"/>
          <Field label="Kısa açıklama *" value={description} onChangeText={setDescription} placeholder="Okura hikayeni birkaç cümleyle anlat" multiline/>
        </View>
      </View>

      <Section title="Keşfedilebilirlik" subtitle="Hikayenin doğru okurlara ulaşmasına yardımcı olur.">
        <Field label="Kategori" value={genre} onChangeText={setGenre} placeholder="Örn. Fantastik, Tarih, Bilim Kurgu"/>
        <Field label="Konular / etiketler" value={tags} onChangeText={setTags} placeholder="virgülle ayır: zaman yolculuğu, gizem"/>
        <Field label="Dil" value={language} onChangeText={setLanguage} placeholder="tr"/>
      </Section>

      <Section title="Okur ve içerik bilgileri" subtitle="İçeriği doğru şekilde sınıflandır; hassas temaları önceden belirt.">
        <Text style={styles.label}>Hedef Kitle</Text>
        <View style={styles.chips}>{AUDIENCES.map(([value,label])=><Pressable key={value} onPress={()=>setAudience(value)} style={[styles.chip,audience===value&&styles.chipActive]}><Text style={[styles.chipText,audience===value&&styles.chipTextActive]}>{label}</Text></Pressable>)}</View>
        <Field label="İçerik uyarıları" value={warnings} onChangeText={setWarnings} placeholder="Varsa hassas temaları virgülle ayır"/>
        <View style={styles.switchRow}><View style={{flex:1}}><Text style={styles.switchTitle}>Hikaye tamamlandı</Text><Text style={styles.switchText}>Kapandıysa okurlara tamamlanmış eser olarak gösterilir.</Text></View><Switch value={completed} onValueChange={setCompleted}/></View>
      </Section>

      <Section title="Telif ve lisans" subtitle="Eserinin hangi koşullarda kullanılabileceğini belirt.">
        <Pressable onPress={()=>setLicenseOpen(v=>!v)} style={styles.selector}><Text style={styles.selectorText}>{LICENSES.find(x=>x[0]===license)?.[1]}</Text><Feather name={licenseOpen?'chevron-up':'chevron-down'} size={17} color={colors.textMuted}/></Pressable>
        {licenseOpen&&<View style={styles.licenseList}>{LICENSES.map(([value,label])=><Pressable key={value} onPress={()=>{setLicense(value);setLicenseOpen(false)}} style={[styles.licenseItem,license===value&&styles.licenseItemActive]}><Text style={styles.licenseText}>{label}</Text>{license===value&&<Feather name="check" size={16} color={colors.primary}/>}</Pressable>)}</View>}
      </Section>

      {workId&&<Section title="Bölümler" subtitle="Hikayeni bölüm bölüm yazabilir ve yayınlayabilirsin."><Pressable onPress={()=>router.push({pathname:'/work-editor',params:{id:workId,addChapter:'1'}} as any)} style={styles.chapterAction}><Feather name="plus-circle" size={17} color={colors.primary}/><Text style={styles.chapterActionText}>Yeni Bölüm Yaz</Text></Pressable><Pressable onPress={()=>router.push({pathname:'/work-editor',params:{id:workId}} as any)} style={styles.chapterAction}><Feather name="list" size={17} color={colors.primary}/><Text style={styles.chapterActionText}>Bölümleri Yönet</Text></Pressable></Section>}

      <View style={styles.bottomActions}><Pressable disabled={saving} onPress={()=>void save('draft')} style={styles.draft}><Feather name="save" size={15} color={colors.primary}/><Text style={styles.draftText}>Taslak Kaydet</Text></Pressable><Pressable disabled={saving} onPress={()=>void save('published')} style={styles.publishLarge}><Feather name="send" size={15} color="#FFF"/><Text style={styles.publishText}>Hikayeyi Yayınla</Text></Pressable></View>
    </ScrollView>
  </View>;
}

function Field({label,...props}:{label:string;value:string;onChangeText:(v:string)=>void;placeholder:string;multiline?:boolean}){
 return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#686A74" style={[styles.input,props.multiline&&styles.textarea]}/></View>
}
function Section({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){
 return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text><View style={styles.sectionBody}>{children}</View></View>
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#08090D'},header:{minHeight:68,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:1,borderBottomColor:'#24252D'},icon:{width:40,height:40,borderRadius:13,borderWidth:1,borderColor:'#2D2E37',alignItems:'center',justifyContent:'center'},headerCopy:{flex:1,minWidth:0},eyebrow:{color:'#A985FF',fontSize:8,fontWeight:'900',letterSpacing:1},headerTitle:{color:'#F4F4F6',fontSize:17,fontWeight:'900',marginTop:2},publish:{minHeight:39,borderRadius:12,backgroundColor:'#6232B5',paddingHorizontal:14,alignItems:'center',justifyContent:'center'},publishText:{color:'#FFF',fontSize:10,fontWeight:'900'},
 content:{width:'100%',maxWidth:900,alignSelf:'center',padding:16,paddingBottom:80,gap:13},hero:{borderRadius:20,borderWidth:1,borderColor:'#292A33',backgroundColor:'#111218',padding:14,flexDirection:'row',gap:14},coverButton:{width:118,height:177},cover:{width:118,height:177,borderRadius:12,backgroundColor:'#181920'},coverEmpty:{alignItems:'center',justifyContent:'center',gap:7,borderWidth:1,borderColor:'#3B2B50'},coverText:{color:'#A990CF',fontSize:9,fontWeight:'800'},coverEdit:{position:'absolute',right:7,bottom:7,width:28,height:28,borderRadius:14,backgroundColor:'#6232B5',alignItems:'center',justifyContent:'center'},heroFields:{flex:1,gap:10},
 section:{borderRadius:18,borderWidth:1,borderColor:'#292A33',backgroundColor:'#111218',padding:14},sectionTitle:{color:'#F3F3F6',fontSize:15,fontWeight:'900'},sectionSubtitle:{color:'#747680',fontSize:9,lineHeight:14,marginTop:3},sectionBody:{gap:11,marginTop:13},field:{gap:6},label:{color:'#B7B8C0',fontSize:10,fontWeight:'800'},input:{minHeight:44,borderRadius:12,borderWidth:1,borderColor:'#30313B',backgroundColor:'#15161D',paddingHorizontal:11,color:'#F1F1F4',fontSize:11},textarea:{minHeight:96,textAlignVertical:'top',paddingTop:11},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{minHeight:34,borderRadius:999,borderWidth:1,borderColor:'#30313B',paddingHorizontal:11,alignItems:'center',justifyContent:'center'},chipActive:{borderColor:'#654A91',backgroundColor:'#241A35'},chipText:{color:'#7E808A',fontSize:9,fontWeight:'800'},chipTextActive:{color:'#D8C8FF'},
 switchRow:{minHeight:65,borderRadius:13,borderWidth:1,borderColor:'#30313B',backgroundColor:'#15161D',padding:11,flexDirection:'row',alignItems:'center',gap:10},switchTitle:{color:'#E7E7EB',fontSize:11,fontWeight:'900'},switchText:{color:'#747680',fontSize:8,lineHeight:13,marginTop:3},selector:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:'#30313B',backgroundColor:'#15161D',paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},selectorText:{color:'#E7E7EB',fontSize:10,fontWeight:'800',flex:1},licenseList:{borderRadius:13,borderWidth:1,borderColor:'#30313B',overflow:'hidden'},licenseItem:{minHeight:46,paddingHorizontal:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#24252D'},licenseItemActive:{backgroundColor:'#1E1728'},licenseText:{color:'#D0D0D6',fontSize:9,flex:1},
 chapterAction:{minHeight:43,borderRadius:11,borderWidth:1,borderColor:'#3D2D53',backgroundColor:'#19151F',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:7},chapterActionText:{color:'#CBB6F0',fontSize:10,fontWeight:'900'},bottomActions:{flexDirection:'row',gap:9},draft:{flex:1,minHeight:46,borderRadius:12,borderWidth:1,borderColor:'#493466',backgroundColor:'#1A1522',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},draftText:{color:'#CBB6F0',fontSize:10,fontWeight:'900'},publishLarge:{flex:1,minHeight:46,borderRadius:12,backgroundColor:'#6232B5',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7}
});
