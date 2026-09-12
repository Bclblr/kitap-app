import Constants from 'expo-constants';
import { usePathname, useRouter } from 'expo-router';
import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getRuntimeControls, hasActiveRestriction, settingBoolean, settingString, type RuntimeControls } from '@/lib/runtime-controls';
import { useAppTheme } from '@/providers/ThemeProvider';

function versionParts(value: string) {
  return value.split('.').map((part) => Number.parseInt(part.replace(/\D.*$/, ''), 10) || 0);
}
function isOlder(current: string, minimum: string) {
  const a = versionParts(current); const b = versionParts(minimum);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i += 1) {
    const av = a[i] ?? 0; const bv = b[i] ?? 0;
    if (av < bv) return true; if (av > bv) return false;
  }
  return false;
}

export default function RuntimeGate({ children }: PropsWithChildren) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [controls, setControls] = useState<RuntimeControls | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setControls(await getRuntimeControls()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  if (loading || !controls) {
    return <View style={[styles.center,{ backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  const privileged = ['moderator','admin','super_admin'].includes(controls.role);
  const maintenance = settingBoolean(controls,'maintenance_mode',false) && !privileged;
  const blocked = hasActiveRestriction(controls,'ban','suspension') && !privileged;
  const registrationClosed = pathname === '/register' && !settingBoolean(controls,'registration_enabled',true);
  const forceUpdate = settingBoolean(controls,'force_update_enabled',false) && !privileged;
  const minimum = settingString(controls,'minimum_app_version','');
  const current = Constants.expoConfig?.version ?? '1.0.0';
  const updateRequired = forceUpdate && !!minimum && isOlder(current,minimum);

  if (maintenance || blocked || updateRequired || registrationClosed) {
    const restriction = controls.restrictions.find((item) => item.type === 'ban' || item.type === 'suspension');
    const title = registrationClosed ? 'Yeni Kayıtlar Kapalı' : maintenance ? 'Bakım Modu' : updateRequired ? 'Güncelleme Gerekli' : 'Hesap Erişimi Kısıtlandı';
    const body = registrationClosed
      ? 'Yeni hesap oluşturma geçici olarak kapalı. Mevcut hesabın varsa giriş yapabilirsin.'
      : maintenance
        ? 'Uygulama şu anda bakımda. Kısa süre sonra tekrar deneyebilirsin.'
        : updateRequired
          ? `Bu sürüm artık desteklenmiyor. Minimum sürüm: ${minimum}. Mevcut sürüm: ${current}.`
          : restriction?.reason || 'Hesabında aktif bir erişim kısıtlaması bulunuyor.';
    return <View style={[styles.center,{ backgroundColor: colors.background }]}>
      <Text style={[styles.blockTitle,{ color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.blockBody,{ color: colors.textSecondary }]}>{body}</Text>
      {registrationClosed ? <Pressable onPress={() => router.replace('/login')} style={[styles.button,{ backgroundColor: colors.primary }]}><Text style={styles.buttonText}>Giriş Ekranına Dön</Text></Pressable> : <Pressable onPress={() => void reload()} style={[styles.button,{ backgroundColor: colors.primary }]}><Text style={styles.buttonText}>Tekrar Kontrol Et</Text></Pressable>}
    </View>;
  }

  const announcement = controls.announcement;
  const route = announcement?.action_route;
  const safeRoute = typeof route === 'string' && route.startsWith('/') && !route.startsWith('//') ? route : null;

  return <View style={styles.fill}>
    {announcement ? <Pressable disabled={!safeRoute} onPress={() => safeRoute && router.push(safeRoute as never)} style={[styles.banner,{ borderColor: colors.primary }]}>
      <Text style={[styles.bannerTitle,{ color: colors.textPrimary }]}>{announcement.title}</Text>
      <Text numberOfLines={2} style={[styles.bannerBody,{ color: colors.textSecondary }]}>{announcement.body}</Text>
    </Pressable> : null}
    <View style={styles.fill}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({
  fill:{flex:1},center:{flex:1,alignItems:'center',justifyContent:'center',padding:28},
  blockTitle:{fontSize:24,fontWeight:'900',textAlign:'center'},blockBody:{fontSize:14,lineHeight:21,textAlign:'center',marginTop:10,maxWidth:520},
  button:{marginTop:20,paddingHorizontal:18,paddingVertical:12,borderRadius:12},buttonText:{color:'#fff',fontWeight:'800'},
  banner:{marginHorizontal:12,marginTop:8,padding:12,borderRadius:14,borderWidth:1,backgroundColor:'#15151D'},bannerTitle:{fontSize:13,fontWeight:'900'},bannerBody:{marginTop:3,fontSize:12,lineHeight:17},
});
