const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'app', 'index.tsx');

if (!fs.existsSync(filePath)) {
  throw new Error('src/app/index.tsx bulunamadı. Scripti proje ana klasöründe çalıştır.');
}

let source = fs.readFileSync(filePath, 'utf8');

const profileSelectNeedle = `.from('profiles')\n          .select('id, full_name, username, profile_image');`;

if (!source.includes(profileSelectNeedle)) {
  throw new Error('Ana sayfadaki profiles sorgusu bulunamadı. Mevcut index.tsx yapısı farklı olabilir.');
}

if (!source.includes("console.log('HOME PROFILE DEBUG'))" ) {
  source = source.replace(
    profileSelectNeedle,
    `.from('profiles')\n          .select('id, full_name, username, profile_image');\n\n      console.log('HOME PROFILE DEBUG', {\n        userId,\n        profileData,\n      });`
  );
}

const preparedNeedle = `      const preparedPosts: Post[] =\n        await Promise.all(`;

if (!source.includes(preparedNeedle)) {
  throw new Error('preparedPosts bölümü bulunamadı.');
}

if (!source.includes("console.log('HOME PREPARED POST DEBUG')")) {
  const setCurrentNeedle = `       const {\n  data: reviewData,`;
  if (!source.includes(setCurrentNeedle)) {
    throw new Error('İnceleme akışı başlangıcı bulunamadı.');
  }

  source = source.replace(
    setCurrentNeedle,
    `      console.log('HOME PREPARED POST DEBUG',\n        preparedPosts.slice(0, 3).map((item) => ({\n          id: item.id,\n          user_id: item.user_id,\n          username: item.username,\n          full_name: item.full_name,\n          profile_image: item.profile_image,\n        }))\n      );\n\n       const {\n  data: reviewData,`
  );
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('Tamam: ana sayfaya profil debug kayıtları eklendi.');
console.log('Şimdi Expo terminalinde HOME PROFILE DEBUG ve HOME PREPARED POST DEBUG satırlarını paylaş.');
