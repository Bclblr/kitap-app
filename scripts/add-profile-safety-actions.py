# Temporary patch script; removed automatically after a successful typecheck.
from pathlib import Path

p = Path('src/app/profile.tsx')
s = p.read_text()

old = "  const [followLoading, setFollowLoading] = useState(false);\n\n  const [reviews, setReviews] = useState<Review[]>([]);"
new = "  const [followLoading, setFollowLoading] = useState(false);\n  const [safetyLoading, setSafetyLoading] = useState(false);\n\n  const [reviews, setReviews] = useState<Review[]>([]);"
if old not in s:
    raise SystemExit('state anchor not found')
s = s.replace(old, new, 1)

anchor = "  /*\n   * ============================================================\n   * İNCELEMELER\n   * ============================================================\n   */"
funcs = '''  async function reportProfile() {
    const loggedInUserId = await getCurrentUserId();
    const targetUserId = typeof userId === 'string' && userId ? userId : null;
    if (!loggedInUserId) {
      Alert.alert('Giriş gerekli', 'Şikâyet göndermek için giriş yapmalısın.');
      return;
    }
    if (!targetUserId || targetUserId === loggedInUserId) return;

    const submitReport = async (category: string) => {
      try {
        setSafetyLoading(true);
        const { error } = await supabase.from('user_reports').insert({ reporter_id: loggedInUserId, reported_id: targetUserId, category, description: '' });
        if (error) throw error;
        Alert.alert('Şikâyet alındı', 'Bildirimin inceleme için gönderildi.');
      } catch (error) {
        console.error('Kullanıcı şikâyeti gönderilemedi:', error);
        Alert.alert('Hata', 'Şikâyet gönderilemedi.');
      } finally { setSafetyLoading(false); }
    };

    Alert.alert('Kullanıcıyı şikâyet et', 'Şikâyet nedenini seç.', [
      { text: 'Spam', onPress: () => submitReport('spam') },
      { text: 'Taciz', onPress: () => submitReport('harassment') },
      { text: 'Uygunsuz içerik', onPress: () => submitReport('inappropriate') },
      { text: 'Taklit / sahte hesap', onPress: () => submitReport('impersonation') },
      { text: 'Diğer', onPress: () => submitReport('other') },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  async function blockProfile() {
    const loggedInUserId = await getCurrentUserId();
    const targetUserId = typeof userId === 'string' && userId ? userId : null;
    if (!loggedInUserId) {
      Alert.alert('Giriş gerekli', 'Kullanıcı engellemek için giriş yapmalısın.');
      return;
    }
    if (!targetUserId || targetUserId === loggedInUserId) return;

    Alert.alert('Kullanıcıyı engelle', `@${profile.username} hesabını engellemek istiyor musun?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Engelle', style: 'destructive', onPress: async () => {
        try {
          setSafetyLoading(true);
          const { error } = await supabase.from('user_blocks').insert({ blocker_id: loggedInUserId, blocked_id: targetUserId });
          if (error && error.code !== '23505') throw error;
          await supabase.from('follows').delete().eq('follower_id', loggedInUserId).eq('following_id', targetUserId);
          await supabase.from('follows').delete().eq('follower_id', targetUserId).eq('following_id', loggedInUserId);
          Alert.alert('Engellendi', 'Bu kullanıcıyla etkileşim kısıtlandı.', [{ text: 'Tamam', onPress: () => router.replace('/profile') }]);
        } catch (error) {
          console.error('Kullanıcı engellenemedi:', error);
          Alert.alert('Hata', 'Kullanıcı engellenemedi.');
        } finally { setSafetyLoading(false); }
      }},
    ]);
  }

  function openSafetyMenu() {
    Alert.alert('Profil seçenekleri', `@${profile.username}`, [
      { text: 'Şikâyet Et', onPress: reportProfile },
      { text: 'Engelle', style: 'destructive', onPress: blockProfile },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

'''
if anchor not in s:
    raise SystemExit('function anchor not found')
s = s.replace(anchor, funcs + anchor, 1)

old_actions = """              <Pressable
                onPress={() => {
                  if (!profile?.id) { Alert.alert('Hata', 'Kullanıcı bulunamadı.'); return; }
                  router.push({ pathname: '/chat', params: { userId: profile.id, username: profile.username || 'Kitap Okuru' } });
                }}
                style={styles.messageButton}
              ><Text style={styles.messageButtonText}>💬 Mesaj</Text></Pressable>"""
new_actions = old_actions + """
              <Pressable onPress={openSafetyMenu} disabled={safetyLoading} style={styles.messageButton} accessibilityLabel="Profil seçenekleri">
                <Text style={styles.messageButtonText}>{safetyLoading ? '...' : '⋯'}</Text>
              </Pressable>"""
if old_actions not in s:
    raise SystemExit('action anchor not found')
s = s.replace(old_actions, new_actions, 1)
p.write_text(s)
