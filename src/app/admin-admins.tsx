import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Image from '@/components/SafeImage';
import { getCurrentAdminAccess, type AppRole } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type AdminAccount = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  profile_image: string | null;
  role: AppRole;
  updated_at: string | null;
  updated_by: string | null;
};

type Candidate = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  profile_image: string | null;
  role: AppRole;
};

const ROLES: AppRole[] = ['user', 'moderator', 'admin', 'super_admin'];
const ROLE_LABELS: Record<AppRole, string> = {
  user: 'Kullanıcı',
  moderator: 'Moderatör',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export default function AdminAdminsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canManageAdmins) {
        router.replace('/admin');
        return;
      }

      const { data, error } = await supabase.rpc('admin_list_admin_accounts');
      if (error) throw error;
      setAccounts((data ?? []) as AdminAccount[]);
    } catch (error) {
      console.error('Admin hesapları yüklenemedi:', error);
      Alert.alert('Hata', 'Admin hesapları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { void loadAccounts(); }, [loadAccounts]));

  async function searchUsers() {
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('admin_search_role_candidates', {
        p_search: query.trim(),
        p_limit: 50,
      });
      if (error) throw error;
      setCandidates((data ?? []) as Candidate[]);
    } catch (error) {
      console.error('Kullanıcı araması başarısız:', error);
      Alert.alert('Hata', 'Kullanıcı araması yapılamadı.');
    } finally {
      setSearching(false);
    }
  }

  async function changeRole(userId: string, currentRole: AppRole, nextRole: AppRole) {
    if (currentRole === nextRole) return;
    setUpdatingId(userId);
    try {
      const { error } = await supabase.rpc('admin_set_user_role', {
        p_user_id: userId,
        p_role: nextRole,
      });
      if (error) throw error;

      setCandidates((current) => current.map((item) => item.user_id === userId ? { ...item, role: nextRole } : item));
      await loadAccounts();
    } catch (error: any) {
      console.error('Rol değiştirilemedi:', error);
      Alert.alert('Rol değiştirilemedi', error?.message || 'İşlem tamamlanamadı.');
    } finally {
      setUpdatingId(null);
    }
  }

  const roleCounts = useMemo(() => ({
    moderator: accounts.filter((x) => x.role === 'moderator').length,
    admin: accounts.filter((x) => x.role === 'admin').length,
    superAdmin: accounts.filter((x) => x.role === 'super_admin').length,
  }), [accounts]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary}/><Text style={styles.loadingText}>Admin hesapları yükleniyor...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}><Feather name="chevron-left" size={24} color={colors.textPrimary}/></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>YÖNETİM</Text><Text style={styles.title}>Admin Hesapları</Text></View>
          <Pressable onPress={() => void loadAccounts()} style={styles.headerButton}><Feather name="refresh-cw" size={19} color={colors.textSecondary}/></Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{roleCounts.superAdmin}</Text><Text style={styles.summaryLabel}>Super Admin</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{roleCounts.admin}</Text><Text style={styles.summaryLabel}>Admin</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryValue}>{roleCounts.moderator}</Text><Text style={styles.summaryLabel}>Moderatör</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Yetkili Hesaplar</Text>
        <View style={styles.list}>
          {accounts.map((item) => (
            <View key={item.user_id} style={styles.card}>
              <View style={styles.userHeader}>
                {item.profile_image ? <Image source={{ uri: item.profile_image }} style={styles.avatar}/> : <View style={styles.avatarPlaceholder}><Feather name="user" size={19} color={colors.textSecondary}/></View>}
                <View style={styles.userCopy}>
                  <Text style={styles.username}>{item.username || 'Kitap Okuru'}</Text>
                  <Text style={styles.fullName}>{item.full_name || 'Ad soyad belirtilmemiş'}</Text>
                  <Text style={styles.userId} numberOfLines={1}>{item.user_id}</Text>
                </View>
                <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{ROLE_LABELS[item.role]}</Text></View>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Kullanıcıya Yetki Ver</Text>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.textMuted}/>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void searchUsers()}
            placeholder="Kullanıcı adı, ad soyad veya UUID"
            placeholderTextColor="#747483"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          <Pressable onPress={() => void searchUsers()} style={styles.searchButton} disabled={searching}>
            {searching ? <ActivityIndicator size="small" color="#fff"/> : <Text style={styles.searchButtonText}>Ara</Text>}
          </Pressable>
        </View>

        <View style={[styles.list, { marginTop: 12 }]}>
          {candidates.map((user) => (
            <View key={user.user_id} style={styles.card}>
              <View style={styles.userHeader}>
                {user.profile_image ? <Image source={{ uri: user.profile_image }} style={styles.avatar}/> : <View style={styles.avatarPlaceholder}><Feather name="user" size={19} color={colors.textSecondary}/></View>}
                <View style={styles.userCopy}>
                  <Text style={styles.username}>{user.username || 'Kitap Okuru'}</Text>
                  <Text style={styles.fullName}>{user.full_name || 'Ad soyad belirtilmemiş'}</Text>
                  <Text style={styles.userId} numberOfLines={1}>{user.user_id}</Text>
                </View>
              </View>

              <View style={styles.roleRow}>
                {ROLES.map((role) => {
                  const active = role === user.role;
                  return (
                    <Pressable
                      key={role}
                      disabled={updatingId === user.user_id}
                      onPress={() => void changeRole(user.user_id, user.role, role)}
                      style={[styles.roleButton, active && styles.roleButtonActive]}
                    >
                      <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]}>{ROLE_LABELS[role]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.warningCard}>
          <Feather name="shield" size={18} color="#BDA8FF"/>
          <Text style={styles.warningText}>Rol değişiklikleri yalnızca Super Admin tarafından yapılabilir. Kendi rolünü değiştirmek ve son Super Admin hesabını düşürmek veritabanı tarafından engellenir.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0A0A0E'},
  centered:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0A0E'},
  loadingText:{marginTop:12,color:'#A5A5B3'},
  content:{width:'100%',maxWidth:860,alignSelf:'center',padding:18,paddingBottom:48},
  header:{flexDirection:'row',alignItems:'center',marginBottom:18},
  headerButton:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},
  headerCopy:{flex:1,marginHorizontal:14},
  eyebrow:{color:'#A985FF',fontSize:11,fontWeight:'900',letterSpacing:1.2},
  title:{color:'#F5F5F8',fontSize:25,fontWeight:'900'},
  summaryRow:{flexDirection:'row',gap:9,marginBottom:22},
  summaryCard:{flex:1,padding:14,borderRadius:15,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},
  summaryValue:{color:'#F5F5F8',fontSize:21,fontWeight:'900'},
  summaryLabel:{marginTop:4,color:'#8E8E9D',fontSize:11},
  sectionTitle:{color:'#F5F5F8',fontSize:17,fontWeight:'800',marginBottom:10},
  list:{gap:9},
  card:{padding:14,borderRadius:16,backgroundColor:'#15151D',borderWidth:1,borderColor:'#292934'},
  userHeader:{flexDirection:'row',alignItems:'center'},
  avatar:{width:44,height:44,borderRadius:22},
  avatarPlaceholder:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'#20202A'},
  userCopy:{flex:1,marginLeft:11,minWidth:0},
  username:{color:'#F5F5F8',fontSize:14,fontWeight:'800'},
  fullName:{marginTop:2,color:'#A5A5B3',fontSize:12},
  userId:{marginTop:3,color:'#686876',fontSize:10},
  roleBadge:{marginLeft:8,paddingHorizontal:10,paddingVertical:6,borderRadius:999,backgroundColor:'#21182F'},
  roleBadgeText:{color:'#BDA8FF',fontSize:10,fontWeight:'800'},
  searchBox:{minHeight:50,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:13,backgroundColor:'#15151D',borderRadius:15,borderWidth:1,borderColor:'#292934'},
  searchInput:{flex:1,color:'#F5F5F8',fontSize:14},
  searchButton:{paddingHorizontal:14,paddingVertical:9,borderRadius:10,backgroundColor:'#6C3CC5'},
  searchButtonText:{color:'#fff',fontWeight:'800',fontSize:12},
  roleRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:13,paddingTop:12,borderTopWidth:1,borderTopColor:'#292934'},
  roleButton:{paddingHorizontal:10,paddingVertical:7,borderRadius:10,backgroundColor:'#0F0F15',borderWidth:1,borderColor:'#30303D'},
  roleButtonActive:{backgroundColor:'#2B1E3E',borderColor:'#60458A'},
  roleButtonText:{color:'#8E8E9D',fontSize:11,fontWeight:'700'},
  roleButtonTextActive:{color:'#C8B8FF'},
  warningCard:{flexDirection:'row',gap:10,marginTop:18,padding:14,borderRadius:15,backgroundColor:'#17131E',borderWidth:1,borderColor:'#352746'},
  warningText:{flex:1,color:'#AFA5BF',fontSize:12,lineHeight:18},
});
