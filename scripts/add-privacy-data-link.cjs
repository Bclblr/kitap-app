const fs = require('fs');

const path = 'src/app/profile-settings.tsx';
let source = fs.readFileSync(path, 'utf8');

if (source.includes("router.push('/privacy-data')")) {
  console.log('Privacy data link already present.');
  process.exit(0);
}

const needle = `        <Pressable onPress={() => router.push('/notification-settings')} style={styles.adminButton}>\n          <Text style={styles.adminButtonText}>🔔 Bildirim Ayarları</Text>\n          <Text style={styles.adminButtonArrow}>›</Text>\n        </Pressable>`;

if (!source.includes(needle)) {
  throw new Error('Notification settings button not found');
}

source = source.replace(
  needle,
  `${needle}\n\n        <Pressable onPress={() => router.push('/privacy-data')} style={styles.adminButton}>\n          <Text style={styles.adminButtonText}>🔐 Gizlilik ve Verilerim</Text>\n          <Text style={styles.adminButtonArrow}>›</Text>\n        </Pressable>`
);

fs.writeFileSync(path, source);
console.log('Privacy data link added.');
