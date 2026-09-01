const fs = require('fs');
const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

const start = s.indexOf('        {/* KAPAK */}');
const end = s.indexOf('        {/* İSTATİSTİKLER */}');
if (start < 0 || end < 0 || end <= start) throw new Error('Profil üst bölüm işaretleri bulunamadı.');

const block = `        {/* KAPAK + PROFİL ÜST BİLGİ */}
        <View style={styles.profileHero}>
          <Pressable
            onPress={isOwnProfile ? chooseCoverImage : undefined}
            style={styles.coverContainer}
          >
            {profile.coverImage ? (
              <Image source={{ uri: profile.coverImage }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverIcon}>🖼️</Text>
                {isOwnProfile && <Text style={styles.coverText}>Kapak fotoğrafı ekle</Text>}
              </View>
            )}
            <View style={styles.coverShade} />
            {isOwnProfile && (
              <View style={styles.coverCamera}><Text style={styles.cameraText}>📷</Text></View>
            )}
          </Pressable>

          <View style={styles.identityRow}>
            <Pressable
              onPress={isOwnProfile ? chooseProfileImage : undefined}
              style={styles.profileImageContainer}
            >
              {profile.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}><Text style={styles.profileIcon}>👤</Text></View>
              )}
              {isOwnProfile && (
                <View style={styles.profileCamera}><Text style={styles.cameraText}>📷</Text></View>
              )}
            </Pressable>

            {!editing && (
              <View style={styles.identityInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.username} numberOfLines={1}>{profile.username}</Text>
                </View>
                <Text style={styles.handle}>@{profile.username.toLowerCase().replace(/\\s+/g, '')}</Text>
                <View style={styles.verifiedRow}>
                  <Text style={styles.verifiedIcon}>✦</Text>
                  <Text style={styles.verifiedText}>Okur Profili</Text>
                </View>
                <Text style={styles.bio}>{profile.bio}</Text>
              </View>
            )}
          </View>

          {editing ? (
            <View style={styles.editArea}>
              <Text style={styles.inputLabel}>Kullanıcı adı</Text>
              <TextInput value={username} onChangeText={setUsername} placeholder="Kullanıcı adın" placeholderTextColor="#777" style={styles.input} maxLength={30} />
              <Text style={styles.inputLabel}>Biyografi</Text>
              <TextInput value={bio} onChangeText={setBio} placeholder="Kendinden bahset..." placeholderTextColor="#777" style={[styles.input, styles.bioInput]} multiline maxLength={150} />
              <View style={styles.editButtons}>
                <Pressable onPress={() => setEditing(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Vazgeç</Text></Pressable>
                <Pressable onPress={handleSaveProfile} style={styles.saveButton}><Text style={styles.saveText}>Kaydet</Text></Pressable>
              </View>
            </View>
          ) : isOwnProfile ? (
            <Pressable onPress={startEditing} style={styles.editButton}><Text style={styles.editButtonText}>✏️ Profili Düzenle</Text></Pressable>
          ) : (
            <View style={styles.profileActions}>
              <Pressable onPress={toggleFollow} disabled={followLoading} style={[styles.followButton, isFollowing && styles.followingButton]}>
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>{followLoading ? '...' : isFollowing ? 'Takiptesin' : 'Takip Et'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!profile?.id) { Alert.alert('Hata', 'Kullanıcı bulunamadı.'); return; }
                  router.push({ pathname: '/chat', params: { userId: profile.id, username: profile.username || 'Kitap Okuru' } });
                }}
                style={styles.messageButton}
              ><Text style={styles.messageButtonText}>💬 Mesaj</Text></Pressable>
            </View>
          )}
        </View>

`;
s = s.slice(0, start) + block + s.slice(end);

const styleStart = s.indexOf('  pageTitle: {');
const styleEnd = s.indexOf('  stats: {');
if (styleStart < 0 || styleEnd < 0 || styleEnd <= styleStart) throw new Error('Profil stil işaretleri bulunamadı.');

const styles = `  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F7',
    marginTop: 18,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  profileHero: { paddingBottom: 4 },
  coverContainer: { width: '100%', height: 190, position: 'relative', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: '#15161D', justifyContent: 'center', alignItems: 'center' },
  coverShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 95, backgroundColor: 'rgba(9,10,15,0.38)' },
  coverIcon: { fontSize: 34 },
  coverText: { marginTop: 8, fontSize: 13, color: '#A2A2AC', fontWeight: '600' },
  coverCamera: { position: 'absolute', right: 16, top: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(15,16,22,0.88)', justifyContent: 'center', alignItems: 'center' },
  cameraText: { fontSize: 17 },
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -74, paddingHorizontal: 20, zIndex: 3 },
  profileImageContainer: { width: 138, height: 138, borderRadius: 69, borderWidth: 3, borderColor: '#7C63E6', backgroundColor: '#090A0F', padding: 4, position: 'relative', flexShrink: 0 },
  profileImage: { width: 124, height: 124, borderRadius: 62 },
  profilePlaceholder: { width: 124, height: 124, borderRadius: 62, backgroundColor: '#1A1B23', justifyContent: 'center', alignItems: 'center' },
  profileIcon: { fontSize: 48 },
  profileCamera: { position: 'absolute', right: -2, bottom: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: '#20212A', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#090A0F' },
  identityInfo: { flex: 1, paddingLeft: 18, paddingTop: 70, minHeight: 150 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { flexShrink: 1, fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#F5F5F7' },
  handle: { marginTop: 3, fontSize: 14, color: '#B5B5BE' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  verifiedIcon: { color: '#8B6FF0', fontSize: 16, marginRight: 6 },
  verifiedText: { color: '#A98BFF', fontSize: 14, fontWeight: '700' },
  bio: { marginTop: 9, color: '#E0E0E5', fontSize: 14, lineHeight: 20 },
  profileActions: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 20 },
  messageButton: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: '#1B1C23', borderWidth: 1, borderColor: '#292A33', justifyContent: 'center', alignItems: 'center' },
  messageButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  editArea: { width: '90%', marginTop: 18, alignSelf: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#E7E7EB', marginBottom: 7, marginTop: 12 },
  input: { width: '100%', minHeight: 48, backgroundColor: '#15161D', borderRadius: 12, borderWidth: 1, borderColor: '#2A2B34', paddingHorizontal: 14, fontSize: 15, color: '#F5F5F7' },
  bioInput: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 15 },
  cancelButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: '#20212A' },
  cancelText: { color: '#B0B0BA', fontWeight: '600' },
  saveButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#7C63E6' },
  saveText: { color: '#FFF', fontWeight: '700' },
  editButton: { marginTop: 16, marginHorizontal: 20, minHeight: 46, borderRadius: 23, backgroundColor: '#7C63E6', justifyContent: 'center', alignItems: 'center' },
  editButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  followButton: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: '#7157DD', justifyContent: 'center', alignItems: 'center' },
  followingButton: { backgroundColor: '#7157DD' },
  followButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  followingButtonText: { color: '#FFF' },

`;
s = s.slice(0, styleStart) + styles + s.slice(styleEnd);

// İstatistik kartını referanstaki düz, koyu şeride yaklaştır.
s = s.replace(/  stats: \{[\s\S]*?  statLabel: \{[\s\S]*?\n  \},\n\n  section:/, `  stats: { flexDirection: 'row', marginTop: 22, marginHorizontal: 20, justifyContent: 'space-around', paddingVertical: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#20212A' },\n  stat: { alignItems: 'center', flex: 1 },\n  statNumber: { fontSize: 18, fontWeight: '800', color: '#F5F5F7' },\n  statLabel: { marginTop: 4, fontSize: 11, color: '#9A9AA4' },\n\n  section:`);

fs.writeFileSync(path, s, 'utf8');
console.log('Profil üst bölümü referans tasarıma göre güncellendi.');
