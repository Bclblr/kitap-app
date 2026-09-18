import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { safeBack } from '@/lib/navigation';
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type TargetType = 'all' | 'user' | 'role';

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [targetValue, setTargetValue] = useState('');
  const [route, setRoute] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void (async () => {
      const access = await getCurrentAdminAccess();
      if (!access.canManageSystem) router.replace('/admin' as never);
    })();
  }, [router]);

  async function send() {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Eksik bilgi', 'Başlık ve mesaj zorunludur.');
      return;
    }
    if (targetType !== 'all' && !targetValue.trim()) {
      Alert.alert('Eksik hedef', targetType === 'user' ? 'Kullanıcı UUID gir.' : 'Rol seç.');
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc('admin_send_notification', {
      p_title: title.trim(),
      p_message: message.trim(),
      p_target_type: targetType,
      ...(targetType === 'all' ? {} : { p_target_value: targetValue.trim() }),
      ...(route.trim() ? { p_action_route: route.trim() } : {}),
    });
    setSending(false);
    if (error) {
      Alert.alert('Gönderilemedi', error.message);
      return;
    }
    setTitle(''); setMessage(''); setTargetType('all'); setTargetValue(''); setRoute('');
    Alert.alert('Gönderildi', 'Bildirim hedef kitle için oluşturuldu.');
  }

  const roles = ['user', 'moderator', 'admin', 'super_admin'];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/admin')} style={styles.iconButton}><Feather name="chevron-left" size={24} color={colors.textPrimary} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>YÖNETİM</Text><Text style={styles.title}>Bildirimler</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Başlık</Text>
          <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Bildirim başlığı" placeholderTextColor="#747483" style={styles.input} />
          <Text style={styles.label}>Mesaj</Text>
          <TextInput value={message} onChangeText={setMessage} maxLength={1000} multiline placeholder="Kullanıcılara gösterilecek mesaj" placeholderTextColor="#747483" style={[styles.input, styles.messageInput]} />

          <Text style={styles.label}>Hedef</Text>
          <View style={styles.row}>
            {([['all','Herkes'],['user','Tek kullanıcı'],['role','Rol']] as const).map(([value,label]) => (
              <Pressable key={value} onPress={() => { setTargetType(value); setTargetValue(''); }} style={[styles.chip,targetType===value && styles.chipActive]}>
                <Text style={[styles.chipText,targetType===value && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {targetType === 'user' && <TextInput value={targetValue} onChangeText={setTargetValue} autoCapitalize="none" placeholder="Kullanıcı UUID" placeholderTextColor="#747483" style={styles.input} />}
          {targetType === 'role' && <View style={styles.row}>{roles.map((roleName) => <Pressable key={roleName} onPress={() => setTargetValue(roleName)} style={[styles.chip,targetValue===roleName && styles.chipActive]}><Text style={[styles.chipText,targetValue===roleName && styles.chipTextActive]}>{roleName}</Text></Pressable>)}</View>}

          <Text style={styles.label}>Yönlendirme (isteğe bağlı)</Text>
          <TextInput value={route} onChangeText={setRoute} autoCapitalize="none" placeholder="Örn. /explore" placeholderTextColor="#747483" style={styles.input} />

          <Pressable disabled={sending} onPress={() => void send()} style={[styles.sendButton,sending && styles.disabled]}>
            <Feather name="send" size={17} color="#fff" /><Text style={styles.sendText}>{sending ? 'Gönderiliyor...' : 'Bildirimi gönder'}</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>Herkes, tek kullanıcı veya uygulama rolü hedeflenebilir. Gönderimler yönetici işlem geçmişine kaydedilir.</Text>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0A0A0E'},content:{width:'100%',maxWidth:760,alignSelf:'center',padding:18,paddingBottom:48},header:{flexDirection:'row',alignItems:'center',marginBottom:18},iconButton:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},headerCopy:{marginLeft:14},eyebrow:{color:'#A985FF',fontSize:11,fontWeight:'900',letterSpacing:1.2},title:{color:'#F5F5F8',fontSize:25,fontWeight:'900'},card:{padding:16,borderRadius:18,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},label:{color:'#C8C8D2',fontSize:12,fontWeight:'800',marginBottom:7,marginTop:12},input:{color:'#F5F5F8',backgroundColor:'#0F0F15',borderWidth:1,borderColor:'#30303D',borderRadius:12,paddingHorizontal:13,paddingVertical:11},messageInput:{minHeight:110,textAlignVertical:'top'},row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:4},chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:12,backgroundColor:'#0F0F15',borderWidth:1,borderColor:'#30303D'},chipActive:{backgroundColor:'#302246',borderColor:'#A985FF'},chipText:{color:'#A5A5B3',fontSize:12,fontWeight:'700'},chipTextActive:{color:'#E5D9FF'},sendButton:{marginTop:18,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',paddingVertical:13,borderRadius:13,backgroundColor:'#6C3CC5'},sendText:{color:'#fff',fontWeight:'900'},disabled:{opacity:.55},note:{marginTop:14,color:'#747483',fontSize:12,lineHeight:18,textAlign:'center'}
});
