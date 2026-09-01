const fs = require('fs');

const path = 'src/app/index.tsx';
if (!fs.existsSync(path)) throw new Error('src/app/index.tsx bulunamadı.');

let source = fs.readFileSync(path, 'utf8');

function getPressableBlockContaining(text, needle) {
  const hit = text.indexOf(needle);
  if (hit === -1) return null;
  const start = text.lastIndexOf('<Pressable', hit);
  const end = text.indexOf('</Pressable>', hit);
  if (start === -1 || end === -1) return null;
  return { start, end: end + '</Pressable>'.length, block: text.slice(start, end + '</Pressable>'.length) };
}

// Önce mevcut bildirim butonunu bulup kaldır ki tek bildirim ikonu kalsın.
for (const needle of ["'/notifications'", '"/notifications"']) {
  const found = getPressableBlockContaining(source, needle);
  if (found) {
    source = source.slice(0, found.start) + source.slice(found.end);
    break;
  }
}

// Sağ üstteki mesaj butonunu aynı yerde bildirim butonuna çevir.
let messageBlock = null;
for (const needle of ["'/messages'", '"/messages"']) {
  messageBlock = getPressableBlockContaining(source, needle);
  if (messageBlock) break;
}

if (!messageBlock) {
  throw new Error('Ana sayfadaki mesaj butonu bulunamadı. Önce bottomnav-home-cleanup scriptini çalıştırmadıysan bu dosyayı mevcut haliyle gönder.');
}

let replacement = messageBlock.block
  .replaceAll("'/messages'", "'/notifications'")
  .replaceAll('"/messages"', '"/notifications"')
  .replace(/message-circle/g, 'bell')
  .replace(/message-square/g, 'bell')
  .replace(/mail/g, 'bell')
  .replace(/💬/g, '🔔')
  .replace(/✉️/g, '🔔')
  .replace(/✉/g, '🔔');

source = source.slice(0, messageBlock.start) + replacement + source.slice(messageBlock.end);

fs.writeFileSync(path, source, 'utf8');
console.log('Ana sayfadaki bildirim ikonu sağ üstte, eski mesaj ikonunun yerinde olacak şekilde ayarlandı.');
