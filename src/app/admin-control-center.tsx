import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type Tab = 'security' | 'sanctions' | 'profiles' | 'search' | 'messages';
type Health = Record<string, number | string | null>;
type Sanction = { id:string; user_id:string; username:string|null; sanction_type:string; reason:string; starts_at:string; ends_at:string|null; active:boolean };
type ProfileControl = { user_id:string; username:string|null; full_name:string|null; verified:boolean; follow_restricted:boolean; content_filter_level:'standard'|'strict'|'off'; note:string };
type SearchRow = { query:string; search_count:number; unique_users:number; avg_results:number; last_searched_at:string };
type MessageReport = { id:string; target_id:string; category:string; description:string; status:string; created_at:string };

const SANCTION_TYPES = ['warning','suspension','ban','comment_restriction','post_restriction','message_restriction','community_restriction'];
const FILTERS: ProfileControl['content_filter_level'][] = ['standard','strict','off'];

export default function AdminControlCenter() {
  const router = useRouter(); const styles = useThemedStyles(baseStyles); const { colors } = useAppTheme();
  const [tab,setTab]=useState<Tab>('security'); const [loading,setLoading]=useState(true); const [superAdmin,setSuperAdmin]=useState(false);
  const [health,setHealth]=useState<Health>({}); const [sanctions,setSanctions]=useState<Sanction[]>([]); const [profiles,setProfiles]=useState<ProfileControl[]>([]); const [searchRows,setSearchRows]=useState<SearchRow[]>([]); const [messageReports,setMessageReports]=useState<MessageReport[]>([]);
  const [query,setQuery]=useState(''); const [userId,setUserId]=useState(''); const [reason,setReason]=useState(''); const [sanctionType,setSanctionType]=useState('warning'); const [hours,setHours]=useState('');

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const access=await getCurrentAdminAccess(); if(!access.canOpenAdmin){router.replace('/');return;} setSuperAdmin(access.canManageAdmins);
      const [h,s,p,a,m]=await Promise.all([
        supabase.rpc('admin_security_health'),
        supabase.rpc('admin_list_sanctions',{p_search:'',p_active_only:false,p_limit:100}),
        access.canManageUsers ? supabase.rpc('admin_list_profile_controls',{p_search:'',p_limit:100}) : Promise.resolve({data:[],error:null} as any),
        access.canManageSystem ? supabase.rpc('admin_search_analytics',{p_days:30,p_limit:50}) : Promise.resolve({data:[],error:null} as any),
        supabase.from('reports').select('id,target_id,category,description,status,created_at').eq('target_type','message').order('created_at',{ascending:false}).limit(50),
      ]);
      if(h.error) throw h.error; setHealth((h.data ?? {}) as Health);
      setSanctions((s.data ?? []) as Sanction[]); setProfiles((p.data ?? []) as ProfileControl[]); setSearchRows((a.data ?? []) as SearchRow[]); setMessageReports((m.data ?? []) as MessageReport[]);
    } catch(e){ console.error('Control center load error',e); Alert.alert('Hata','Kontrol merkezi yüklenemedi.'); }
    finally{setLoading(false)}
  },[router]);
  useFocusEffect(useCallback(()=>{void load()},[load]));

  const shownProfiles=useMemo(()=>{const n=query.trim().toLocaleLowerCase('tr-TR'); if(!n)return profiles; return profiles.filter(p=>(p.username??'').toLocaleLowerCase('tr-TR').includes(n)||(p.full_name??'').toLocaleLowerCase('tr-TR').includes(n)||p.user_id.includes(n));},[profiles,query]);

  async function addSanction(){
    if(!userId.trim()){Alert.alert('Eksik','Kullanıcı UUID gerekli.');return;}
    const parsed=Number(hours); const endsAt=hours.trim() && Number.isFinite(parsed) && parsed>0 ? new Date(Date.now()+parsed*3600000).toISOString() : null;
    const {error}=await supabase.rpc('admin_add_sanction',{p_user_id:userId.trim(),p_type:sanctionType,p_reason:reason.trim(),p_ends_at:endsAt});
    if(error){Alert.alert('Hata',error.message);return;} setReason('');setHours('');await load();
  }
  async function revokeSanction(id:string){const {error}=await supabase.rpc('admin_revoke_sanction',{p_sanction_id:id,p_reason:'Admin kontrol merkezinden kaldırıldı'});if(error)Alert.alert('Hata',error.message);else await load();}
  async function saveProfile(row:ProfileControl, patch:Partial<ProfileControl>){
    const next={...row,...patch}; const {error}=await supabase.rpc('admin_set_profile_control',{p_user_id:row.user_id,p_verified:next.verified,p_follow_restricted:next.follow_restricted,p_content_filter_level:next.content_filter_level,p_note:next.note});
    if(error){Alert.alert('Hata',error.message);return;} setProfiles(cur=>cur.map(x=>x.user_id===row.user_id?next:x));
  }
  async function createSnapshot(){const {data,error}=await supabase.rpc('admin_create_config_snapshot',{p_label:`Kontrol merkezi ${new Date().toISOString()}`}); if(error)Alert.alert('Hata',error.message);else Alert.alert('Hazır',`Yapılandırma snapshotı oluşturuldu.\n${String(data)}`);}
  async function viewMessage(report:MessageReport){const {data,error}=await supabase.rpc('admin_reported_message_context',{p_report_id:report.id}); if(error){Alert.alert('Hata',error.message);return;} Alert.alert('Şikâyet edilen mesaj',JSON.stringify(data,null,2).slice(0,3500));}

  const tabs:[Tab,string,keyof typeof Feather.glyphMap][]=[['security','Güvenlik','shield'],['sanctions','Yaptırımlar','slash'],['profiles','Doğrulama','check-circle'],['search','Arama','search'],['messages','Mesaj Raporları','message-circle']];
  if(loading)return <View style={styles.center}><ActivityIndicator color={colors.primary}/><Text style={styles.muted}>Kontrol merkezi yükleniyor...</Text></View>;

  return <View style={styles.container}><View style={styles.header}><Pressable onPress={()=>router.back()} style={styles.iconButton}><Feather name="chevron-left" size={23} color={colors.textPrimary}/></Pressable><View style={{flex:1}}><Text style={styles.eyebrow}>YÖNETİM</Text><Text style={styles.title}>Kontrol Merkezi</Text></View><Pressable onPress={()=>void load()} style={styles.iconButton}><Feather name="refresh-cw" size={18} color={colors.textSecondary}/></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map(([key,label,icon])=><Pressable key={key} onPress={()=>setTab(key)} style={[styles.tab,tab===key&&styles.tabActive]}><Feather name={icon} size={15} color={tab===key?'#F5F5F8':'#8E8E9D'}/><Text style={[styles.tabText,tab===key&&styles.tabTextActive]}>{label}</Text></Pressable>)}</ScrollView>
    <ScrollView contentContainerStyle={styles.content}>
      {tab==='security'&&<><Text style={styles.sectionTitle}>Güvenlik ve DB Sağlığı</Text><View style={styles.grid}>{Object.entries(health).map(([k,v])=><View key={k} style={styles.metric}><Text style={styles.metricValue}>{typeof v==='number'?v.toLocaleString('tr-TR'):String(v??'—')}</Text><Text style={styles.muted}>{k.replaceAll('_',' ')}</Text></View>)}</View><Text style={styles.note}>Bu ekran veritabanı boyutu, bekleyen raporlar, aktif yaptırımlar ve yönetici sayılarını izler. Tam fiziksel veritabanı yedeği Supabase platform yedeklemesi üzerinden yapılır; burada güvenli yapılandırma snapshotı alınır.</Text>{superAdmin&&<Pressable onPress={()=>void createSnapshot()} style={styles.primary}><Text style={styles.primaryText}>Yapılandırma Snapshotı Oluştur</Text></Pressable>}</>}
      {tab==='sanctions'&&<><Text style={styles.sectionTitle}>Yeni Yaptırım</Text><TextInput value={userId} onChangeText={setUserId} placeholder="Kullanıcı UUID" placeholderTextColor="#686876" style={styles.input}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>{SANCTION_TYPES.map(t=><Pressable key={t} onPress={()=>setSanctionType(t)} style={[styles.pill,sanctionType===t&&styles.pillActive]}><Text style={styles.pillText}>{t}</Text></Pressable>)}</ScrollView><TextInput value={reason} onChangeText={setReason} placeholder="Gerekçe" placeholderTextColor="#686876" style={styles.input}/><TextInput value={hours} onChangeText={setHours} keyboardType="numeric" placeholder="Süre (saat, boşsa süresiz)" placeholderTextColor="#686876" style={styles.input}/><Pressable onPress={()=>void addSanction()} style={styles.primary}><Text style={styles.primaryText}>Yaptırım Uygula</Text></Pressable><Text style={styles.sectionTitle}>Kayıtlar</Text>{sanctions.map(s=><View key={s.id} style={styles.card}><Text style={styles.cardTitle}>{s.username||s.user_id} · {s.sanction_type}</Text><Text style={styles.muted}>{s.reason||'Gerekçe yok'}</Text><Text style={styles.small}>{s.active?'AKTİF':'PASİF'} {s.ends_at?`· ${new Date(s.ends_at).toLocaleString('tr-TR')}`:''}</Text>{s.active&&<Pressable onPress={()=>void revokeSanction(s.id)} style={styles.danger}><Text style={styles.dangerText}>Yaptırımı Kaldır</Text></Pressable>}</View>)}</>}
      {tab==='profiles'&&<><TextInput value={query} onChangeText={setQuery} placeholder="Kullanıcı ara" placeholderTextColor="#686876" style={styles.input}/>{shownProfiles.map(p=><View key={p.user_id} style={styles.card}><Text style={styles.cardTitle}>{p.username||'Kitap Okuru'} {p.verified?'✓':''}</Text><Text style={styles.small}>{p.full_name||''} · {p.user_id}</Text><View style={styles.row}><Pressable onPress={()=>void saveProfile(p,{verified:!p.verified})} style={styles.secondary}><Text style={styles.secondaryText}>{p.verified?'Doğrulamayı Kaldır':'Doğrula'}</Text></Pressable><Pressable onPress={()=>void saveProfile(p,{follow_restricted:!p.follow_restricted})} style={styles.secondary}><Text style={styles.secondaryText}>{p.follow_restricted?'Takibi Aç':'Takibi Kısıtla'}</Text></Pressable></View><View style={styles.row}>{FILTERS.map(f=><Pressable key={f} onPress={()=>void saveProfile(p,{content_filter_level:f})} style={[styles.secondary,p.content_filter_level===f&&styles.pillActive]}><Text style={styles.secondaryText}>{f}</Text></Pressable>)}</View></View>)}</>}
      {tab==='search'&&<><Text style={styles.sectionTitle}>Son 30 Gün Arama Analitiği</Text>{searchRows.map(r=><View key={r.query} style={styles.card}><Text style={styles.cardTitle}>{r.query}</Text><Text style={styles.muted}>{Number(r.search_count).toLocaleString('tr-TR')} arama · {Number(r.unique_users).toLocaleString('tr-TR')} kullanıcı · ort. {r.avg_results} sonuç</Text><Text style={styles.small}>{new Date(r.last_searched_at).toLocaleString('tr-TR')}</Text></View>)}</>}
      {tab==='messages'&&<><Text style={styles.note}>Gizlilik gereği tüm özel mesajlar listelenmez. Yalnızca kullanıcıların raporladığı mesajların bağlamı açılır.</Text>{messageReports.map(r=><View key={r.id} style={styles.card}><Text style={styles.cardTitle}>Mesaj raporu · {r.category}</Text><Text style={styles.muted}>{r.description||'Açıklama yok'}</Text><Text style={styles.small}>{r.status} · {new Date(r.created_at).toLocaleString('tr-TR')}</Text><Pressable onPress={()=>void viewMessage(r)} style={styles.secondary}><Text style={styles.secondaryText}>Raporlanan Mesajı İncele</Text></Pressable></View>)}</>}
    </ScrollView>
  </View>;
}

const baseStyles=StyleSheet.create({container:{flex:1,backgroundColor:'#0A0A0E'},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0A0E'},header:{flexDirection:'row',alignItems:'center',gap:12,padding:16},iconButton:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.2,color:'#A985FF'},title:{fontSize:24,fontWeight:'900',color:'#F5F5F8'},tabs:{paddingHorizontal:16,paddingBottom:10,gap:8},tab:{height:38,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:12,borderRadius:12,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},tabActive:{backgroundColor:'#2B1F3C',borderColor:'#654A8C'},tabText:{fontSize:12,fontWeight:'700',color:'#8E8E9D'},tabTextActive:{color:'#F5F5F8'},content:{width:'100%',maxWidth:820,alignSelf:'center',padding:16,paddingBottom:60},sectionTitle:{fontSize:17,fontWeight:'900',color:'#F5F5F8',marginBottom:10,marginTop:8},grid:{flexDirection:'row',flexWrap:'wrap',gap:9},metric:{minWidth:145,flexGrow:1,padding:14,borderRadius:15,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},metricValue:{fontSize:18,fontWeight:'900',color:'#F5F5F8'},muted:{marginTop:5,fontSize:12,color:'#8E8E9D'},small:{marginTop:7,fontSize:10,color:'#686876'},note:{padding:13,borderRadius:14,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934',color:'#9A9AA8',fontSize:12,lineHeight:18,marginBottom:12},input:{height:48,borderRadius:13,borderWidth:1,borderColor:'#30303D',backgroundColor:'#15151D',color:'#F5F5F8',paddingHorizontal:13,marginBottom:9},pills:{gap:7,paddingBottom:10},pill:{paddingHorizontal:10,paddingVertical:7,borderRadius:10,borderWidth:1,borderColor:'#30303D',backgroundColor:'#111117'},pillActive:{backgroundColor:'#2B1F3C',borderColor:'#654A8C'},pillText:{fontSize:11,color:'#BDBDC9'},primary:{minHeight:44,borderRadius:12,backgroundColor:'#6C3CC5',alignItems:'center',justifyContent:'center',paddingHorizontal:14,marginBottom:10},primaryText:{color:'#fff',fontWeight:'900'},card:{padding:14,borderRadius:16,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934',marginBottom:9},cardTitle:{fontSize:14,fontWeight:'800',color:'#F5F5F8'},row:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},secondary:{minHeight:36,paddingHorizontal:11,borderRadius:10,borderWidth:1,borderColor:'#3B3150',backgroundColor:'#21182F',alignItems:'center',justifyContent:'center'},secondaryText:{fontSize:11,fontWeight:'800',color:'#C8B8FF'},danger:{marginTop:10,minHeight:38,borderRadius:10,borderWidth:1,borderColor:'#54272E',backgroundColor:'#201317',alignItems:'center',justifyContent:'center'},dangerText:{color:'#FF7D86',fontWeight:'800'}});
