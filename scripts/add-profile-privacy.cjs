const fs = require('fs');

function patch(path, apply) {
  const before = fs.readFileSync(path, 'utf8');
  const after = apply(before);
  if (before === after) throw new Error(`No changes applied to ${path}`);
  fs.writeFileSync(path, after);
}

patch('src/app/profile-settings.tsx', (source) => {
  if (source.includes("router.push('/privacy-settings')")) return source;
  const needle = `        <Pressable onPress={() => router.push('/privacy-data')} style={styles.adminButton}>\n          <Text style={styles.adminButtonText}>🔐 Gizlilik ve Verilerim</Text>\n          <Text style={styles.adminButtonArrow}>›</Text>\n        </Pressable>`;
  if (!source.includes(needle)) throw new Error('privacy-data button not found');
  return source.replace(
    needle,
    `${needle}\n\n        <Pressable onPress={() => router.push('/privacy-settings')} style={styles.adminButton}>\n          <Text style={styles.adminButtonText}>👁 Profil Gizliliği</Text>\n          <Text style={styles.adminButtonArrow}>›</Text>\n        </Pressable>`
  );
});

patch('src/app/explore.tsx', (source) => {
  const needle = `        supabase\n          .from('profiles')\n          .select('id, username, profile_image, bio')\n          .ilike('username', \`%\${searchText}%\`)\n          .limit(10),`;
  if (!source.includes(needle)) throw new Error('explore profile search block not found');
  return source.replace(
    needle,
    `        supabase.rpc('search_visible_profiles', { p_query: searchText, p_limit: 10 }),`
  );
});

patch('src/app/profile.tsx', (source) => {
  const needle = `                onPress={() => {\n                  if (!profile?.id) { Alert.alert('Hata', 'Kullanıcı bulunamadı.'); return; }\n                  router.push({ pathname: '/chat', params: { userId: profile.id, username: profile.username || 'Kitap Okuru' } });\n                }}`;
  if (!source.includes(needle)) throw new Error('profile message button block not found');
  return source.replace(
    needle,
    `                onPress={async () => {\n                  if (!profile?.id) { Alert.alert('Hata', 'Kullanıcı bulunamadı.'); return; }\n                  const { data: authData } = await supabase.auth.getUser();\n                  const senderId = authData.user?.id;\n                  if (!senderId) { Alert.alert('Giriş gerekli', 'Mesaj göndermek için giriş yapmalısın.'); return; }\n                  const { data: allowed, error } = await supabase.rpc('can_message_user', { p_sender: senderId, p_target: profile.id });\n                  if (error) { console.error('Mesaj izni kontrol edilemedi:', error); Alert.alert('Hata', 'Mesaj izni kontrol edilemedi.'); return; }\n                  if (!allowed) { Alert.alert('Mesaj gönderilemiyor', 'Bu kullanıcı kimlerin mesaj gönderebileceğini sınırlandırmış olabilir.'); return; }\n                  router.push({ pathname: '/chat', params: { userId: profile.id, username: profile.username || 'Kitap Okuru' } });\n                }}`
  );
});

console.log('Profile privacy integration applied.');
