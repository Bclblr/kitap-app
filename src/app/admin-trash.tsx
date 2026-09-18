import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { safeBack } from '@/lib/navigation';
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type TrashType='all'|'post'|'review'|'quote'|'post_comment'|'comment';
type TrashRow={id:string;target_type:string;target_id:string;snapshot:any;reason:string|null;deleted_by:string|null;deleted_username:string|null;deleted_at:string};

const FILTERS:[TrashType,string][]=[['all','Tümü'],['post','Gönderi'],['review','İnceleme'],['quote','Alıntı'],['post_comment','Gönderi Yorumu'],['comment','İnceleme Yorumu']];

function labelFor(type:string){return FILTERS.find(([key])=>key===type)?.[1]??type}
function formatDate(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString('tr-TR')}
function preview(snapshot:any){return String(snapshot?.text??snapshot?.book_title??snapshot?.title??'Metin içeriği yok')}

export default function AdminTrashScreen(){
  const router=useRouter();
  const styles=useThemedStyles(baseStyles);
  const{colors}=useAppTheme();
  const[filter,setFilter]=useState<TrashType>('all');
  const[rows,setRows]=useState<TrashRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[restoringId,setRestoringId]=useState<string|null>(null);

  const loadTrash=useCallback(async()=>{
    setLoading(true);
    try{
      const access=await getCurrentAdminAccess();
      if(!access.canOpenAdmin){router.replace('/');return}
      const{data,error}=await supabase.rpc('admin_list_trash',{...(filter==='all'?{}:{p_target_type:filter}),p_limit:100,p_offset:0});
      if(error)throw error;
      setRows((data??[]) as TrashRow[]);
    }catch(error:any){
      console.error('Çöp kutusu yüklenemedi:',error);
      Alert.alert('Hata',error?.message||'Çöp kutusu yüklenemedi.');
      setRows([]);
    }finally{setLoading(false)}
  },[filter,router]);

  useFocusEffect(useCallback(()=>{void loadTrash()},[loadTrash]));

  const groupedCount=useMemo(()=>rows.length,[rows]);

  const restore=useCallback(async(item:TrashRow)=>{
    setRestoringId(item.id);
    try{
      const{error}=await supabase.rpc('admin_restore_trash',{p_trash_id:item.id});
      if(error)throw error;
      setRows(current=>current.filter(row=>row.id!==item.id));
      Alert.alert('Geri yüklendi','İçerik yeniden aktif hale getirildi.');
    }catch(error:any){
      console.error('Geri yükleme hatası:',error);
      Alert.alert('Geri yüklenemedi',error?.message||'İçerik geri yüklenemedi.');
    }finally{setRestoringId(null)}
  },[]);

  const askRestore=useCallback((item:TrashRow)=>{
    Alert.alert('İçeriği geri yükle','Bu içerik eski kimliğiyle yeniden oluşturulacak. Devam edilsin mi?',[{text:'Vazgeç',style:'cancel'},{text:'Geri Yükle',onPress:()=>void restore(item)}]);
  },[restore]);

  return <View style={styles.container}>
    <View style={styles.header}>
      <Pressable onPress={()=>safeBack(router, '/admin')} style={styles.headerButton}><Feather name="chevron-left" size={24} color={colors.textPrimary}/></Pressable>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>YÖNETİM</Text><Text style={styles.title}>Çöp Kutusu</Text></View>
      <Pressable onPress={()=>void loadTrash()} style={styles.headerButton}><Feather name="refresh-cw" size={19} color={colors.textSecondary}/></Pressable>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {FILTERS.map(([key,label])=>{const active=filter===key;return <Pressable key={key} onPress={()=>setFilter(key)} style={[styles.filterButton,active&&styles.filterButtonActive]}><Text style={[styles.filterText,active&&styles.filterTextActive]}>{label}</Text></Pressable>})}
    </ScrollView>

    {loading?<View style={styles.centered}><ActivityIndicator color={colors.primary}/><Text style={styles.loadingText}>Çöp kutusu yükleniyor...</Text></View>:
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.resultText}>{groupedCount} silinmiş kayıt gösteriliyor</Text>
      {rows.length===0?<View style={styles.emptyCard}><Feather name="trash-2" size={28} color={colors.textMuted}/><Text style={styles.emptyTitle}>Çöp kutusu boş</Text><Text style={styles.emptyText}>Bu kategoride geri yüklenebilir içerik yok.</Text></View>:
      rows.map(item=><View key={item.id} style={styles.card}>
        <View style={styles.cardTop}><View style={styles.badge}><Text style={styles.badgeText}>{labelFor(item.target_type)}</Text></View><Text style={styles.date}>{formatDate(item.deleted_at)}</Text></View>
        <Text style={styles.preview} numberOfLines={6}>{preview(item.snapshot)}</Text>
        <View style={styles.metaBox}><Text style={styles.meta}>İçerik ID: {item.target_id}</Text><Text style={styles.meta}>Silen: {item.deleted_username||item.deleted_by||'Bilinmiyor'}</Text>{item.reason?<Text style={styles.meta}>Neden: {item.reason}</Text>:null}</View>
        <Pressable disabled={restoringId===item.id} onPress={()=>askRestore(item)} style={[styles.restoreButton,restoringId===item.id&&styles.disabled]}><Feather name="rotate-ccw" size={16} color="#BDA8FF"/><Text style={styles.restoreText}>{restoringId===item.id?'Geri yükleniyor...':'Geri Yükle'}</Text></Pressable>
      </View>)}
    </ScrollView>}
  </View>
}

const baseStyles=StyleSheet.create({container:{flex:1,backgroundColor:'#0A0A0E',paddingTop:14},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:18,marginBottom:12},headerButton:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},headerCopy:{flex:1,marginHorizontal:14},eyebrow:{color:'#A985FF',fontSize:11,fontWeight:'900',letterSpacing:1.2},title:{marginTop:2,color:'#F5F5F8',fontSize:24,fontWeight:'900'},filters:{paddingHorizontal:18,gap:8,paddingBottom:12},filterButton:{paddingHorizontal:12,paddingVertical:9,borderRadius:11,backgroundColor:'#14141B',borderWidth:1,borderColor:'#292934'},filterButtonActive:{backgroundColor:'#2B1F3C',borderColor:'#654A8C'},filterText:{color:'#8E8E9D',fontSize:12,fontWeight:'700'},filterTextActive:{color:'#F5F5F8'},centered:{flex:1,alignItems:'center',justifyContent:'center'},loadingText:{marginTop:10,color:'#8E8E9D'},content:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:18,paddingBottom:48},resultText:{color:'#777786',fontSize:12,marginBottom:10},card:{backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934',borderRadius:17,padding:15,marginBottom:10},cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},badge:{backgroundColor:'#21182F',borderRadius:9,paddingHorizontal:8,paddingVertical:5},badgeText:{color:'#BFA9F4',fontSize:10,fontWeight:'800'},date:{color:'#777786',fontSize:11},preview:{marginTop:12,color:'#D7D7DF',fontSize:14,lineHeight:20},metaBox:{marginTop:13,padding:10,backgroundColor:'#101015',borderRadius:11,gap:4},meta:{color:'#696978',fontSize:10},restoreButton:{marginTop:13,minHeight:42,borderRadius:12,borderWidth:1,borderColor:'#5E4885',backgroundColor:'#21182F',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},restoreText:{color:'#C8B8FF',fontSize:13,fontWeight:'800'},disabled:{opacity:.5},emptyCard:{marginTop:60,alignItems:'center',padding:28,backgroundColor:'#15151D',borderRadius:18,borderWidth:1,borderColor:'#292934'},emptyTitle:{marginTop:12,color:'#F5F5F8',fontSize:16,fontWeight:'800'},emptyText:{marginTop:6,color:'#7E7E8B',fontSize:13,textAlign:'center'}});
