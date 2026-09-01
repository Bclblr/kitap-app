const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');
const before = s;

// ProfileData tipine fullName ekle.
if (!s.includes('fullName: string;')) {
  s = s.replace(
    '  username: string;\n  bio: string;',
    '  username: string;\n  fullName: string;\n  bio: string;'
  );
}

// Varsayılan profile fullName ekle.
if (!s.includes("fullName: '',")) {
  s = s.replace(
    "  username: 'Kitap Okuru',\n  bio:",
    "  username: 'Kitap Okuru',\n  fullName: '',\n  bio:"
  );
}

// Supabase sorgusunda full_name alanını çek.
s = s.replace(
  "'id, username, bio, profile_image, cover_image'",
  "'id, username, full_name, bio, profile_image, cover_image'"
);

// Yeni profil oluşturulurken full_name alanını boş başlat.
if (!s.includes('full_name: null,')) {
  s = s.replace(
    '          username: DEFAULT_PROFILE.username,\n          bio: DEFAULT_PROFILE.bio,',
    '          username: DEFAULT_PROFILE.username,\n          full_name: null,\n          bio: DEFAULT_PROFILE.bio,'
  );
}

// Supabase verisini ProfileData nesnesine aktar.
if (!s.includes('fullName:\n    data.full_name')) {
  s = s.replace(
    /  username:\s*\n\s*data\.username \|\|\s*\n\s*DEFAULT_PROFILE\.username,\s*\n\s*\n\s*bio:/,
    `  username:\n    data.username ||\n    DEFAULT_PROFILE.username,\n\n  fullName:\n    data.full_name || '',\n\n  bio:`
  );
}

if (s === before) {
  console.log('full_name okuma alanları bulunamadı veya zaten düzeltilmiş.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Profil ekranı artık Supabase full_name verisini okuyacak.');
