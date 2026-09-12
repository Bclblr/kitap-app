const fs = require('fs');

const p = 'src/app/explore.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

const start = lines.findIndex(line =>
  line.includes('const {') &&
  lines.slice(lines.indexOf(line), lines.indexOf(line) + 5).join('\n').includes('supabase.auth.getUser()')
);

if (start === -1) {
  console.error('getUser bloğu bulunamadı');
  process.exit(1);
}

let end = start;

while (
  end < lines.length &&
  !lines[end].includes("const { data, error } = await supabase.rpc('get_trending_hashtags')")
) {
  end++;
}

if (end >= lines.length) {
  console.error('RPC satırı bulunamadı');
  process.exit(1);
}

lines.splice(
  start,
  end - start,
  '      if (requestId !== trendingHashtagsRequestIdRef.current) return;',
  ''
);

fs.writeFileSync(p, lines.join('\n'), 'utf8');

console.log('Trending hashtags oturum kontrolü kaldırıldı');
