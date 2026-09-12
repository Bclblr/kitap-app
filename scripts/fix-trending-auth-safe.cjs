const fs = require('fs');

const p = 'src/app/explore.tsx';
let s = fs.readFileSync(p, 'utf8');

const fnStart = s.indexOf('  const loadTrendingHashtags = useCallback');
const rpcLine = "      const { data, error } = await supabase.rpc('get_trending_hashtags');";

if (fnStart === -1) {
  console.error('loadTrendingHashtags bulunamadı');
  process.exit(1);
}

const authStart = s.indexOf('      const {', fnStart);
const rpcStart = s.indexOf(rpcLine, fnStart);

if (authStart === -1 || rpcStart === -1 || authStart > rpcStart) {
  console.error('Hedef auth bloğu bulunamadı');
  process.exit(1);
}

s =
  s.slice(0, authStart) +
  '      if (requestId !== trendingHashtagsRequestIdRef.current) return;\n\n' +
  s.slice(rpcStart);

fs.writeFileSync(p, s, 'utf8');

console.log('Sadece loadTrendingHashtags oturum kontrolü kaldırıldı.');
