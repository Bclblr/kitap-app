const fs = require('fs');

const settingsPath = 'src/app/profile-settings.tsx';
const profilePath = 'src/app/profile.tsx';

if (!fs.existsSync(settingsPath)) {
  throw new Error('src/app/profile-settings.tsx bulunamadı. Önce profil ayarları scriptini çalıştır.');
}

let settings = fs.readFileSync(settingsPath, 'utf8');
let profile = fs.readFileSync(profilePath, 'utf8');

// --- PROFİL AYARLARI ---
if (!settings.includes('fullName: string;')) {
  settings = settings.replace(
    '  username: string;\n  bio: string;',
    '  username: string;\n  fullName: string;\n  bio: string;'
  );
}

if (!settings.includes("fullName: '',")) {
  settings = settings.replace(
    "  username: 'Kitap Okuru',\n  bio: '',",
    "  username: 'Kitap Okuru',\n  fullName: '',\n  bio: '',"
  );
}

if (!settings.includes("const [fullName, setFullName]")) {
  settings = settings.replace(
    "  const [username, setUsername] = useState('');",
    "  const [username, setUsername] = useState('');\n  const [fullName, setFullName] = useState('');"
  );
}

settings = settings.replace(
  ".select('id, username, bio, profile_image, cover_image')",
  ".select('id, username, full_name, bio, profile_image, cover_image')"
);

if (!settings.includes('fullName: data?.full_name')) {
  settings = settings.replace(
    "      username: data?.username || 'Kitap Okuru',\n      bio: data?.bio || '',",
    "      username: data?.username || 'Kitap Okuru',\n      fullName: data?.full_name || '',\n      bio: data?.bio || '',"
  );
}

if (!settings.includes('setFullName(nextProfile.fullName);')) {
  settings = settings.replace(
    '    setUsername(nextProfile.username);\n    setBio(nextProfile.bio);',
    '    setUsername(nextProfile.username);\n    setFullName(nextProfile.fullName);\n    setBio(nextProfile.bio);'
  );
}

if (!settings.includes('full_name: fullName.trim(),')) {
  settings = settings.replace(
    "          username: username.trim() || merged.username || 'Kitap Okuru',\n          bio: bio.trim(),",
    "          username: username.trim() || merged.username || 'Kitap Okuru',\n          full_name: fullName.trim(),\n          bio: bio.trim(),"
  );
}

if (!settings.includes('fullName: fullName.trim(),')) {
  settings = settings.replace(
    "      username: username.trim() || merged.username || 'Kitap Okuru',\n      bio: bio.trim(),",
    "      username: username.trim() || merged.username || 'Kitap Okuru',\n      fullName: fullName.trim(),\n      bio: bio.trim(),"
  );
}

if (!settings.includes('<Text style={styles.label}>Ad Soyad</Text>')) {
  const marker = '          <Text style={styles.label}>Kullanıcı adı</Text>';
  settings = settings.replace(
    marker,
    `          <Text style={styles.label}>Ad Soyad</Text>\n          <TextInput\n            value={fullName}\n            onChangeText={setFullName}\n            style={styles.input}\n            placeholder="Adın ve soyadın"\n            placeholderTextColor="#74747E"\n            maxLength={60}\n          />\n\n${marker}`
  );
}

// --- PROFİL EKRANI ---
if (!profile.includes('fullName: string;')) {
  profile = profile.replace(
    '  username: string;\n  bio: string;',
    '  username: string;\n  fullName: string;\n  bio: string;'
  );
}

if (!profile.includes("fullName: '',")) {
  profile = profile.replace(
    "  username: 'Kitap Okuru',\n  bio:",
    "  username: 'Kitap Okuru',\n  fullName: '',\n  bio:"
  );
}

profile = profile.replace(
  ".select('id, username, bio, profile_image, cover_image')",
  ".select('id, username, full_name, bio, profile_image, cover_image')"
);

if (!profile.includes('fullName: data.full_name')) {
  profile = profile.replace(
    '      username: data.username || DEFAULT_PROFILE.username,\n      bio:',
    "      username: data.username || DEFAULT_PROFILE.username,\n      fullName: data.full_name || '',\n      bio:"
  );
}

// Profilde ad soyadı kullanıcı adının üstünde göster.
if (!profile.includes('styles.fullName')) {
  const nameRow = /<View style=\{styles\.nameRow\}>\s*<Text style=\{styles\.username\} numberOfLines=\{1\}>\{profile\.username\}<\/Text>\s*<\/View>/;
  profile = profile.replace(
    nameRow,
    `<View style={styles.nameRow}>\n          <Text style={styles.fullName} numberOfLines={1}>\n            {profile.fullName || profile.username}\n          </Text>\n        </View>`
  );
}

if (!profile.includes('fullName: {')) {
  const marker = '  username: {';
  const i = profile.indexOf(marker);
  if (i >= 0) {
    profile = profile.slice(0, i) + `  fullName: {\n    flexShrink: 1,\n    fontSize: 24,\n    lineHeight: 30,\n    fontWeight: '800',\n    color: '#F5F5F7',\n  },\n` + profile.slice(i);
  }
}

fs.writeFileSync(settingsPath, settings, 'utf8');
fs.writeFileSync(profilePath, profile, 'utf8');

console.log('Ad Soyad alanı Profil Ayarları ve profil ekranına eklendi.');
