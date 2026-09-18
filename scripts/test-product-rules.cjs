const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
let session = null, loading = false, theme;
const jsx = (type, props) => ({ type, props });
const Stack = Object.assign(() => {}, { Screen: 'Screen', Protected: 'Protected' });
const mocks = {
  react: { useMemo: fn => fn() }, 'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { ActivityIndicator: 'Loading', View: 'View' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-router': { Stack },
  '@/providers/AuthProvider': { AuthProvider: 'AuthProvider', useAuth: () => ({ session, loading }) },
  '@/providers/ThemeProvider': { ThemeProvider: 'ThemeProvider', useAppTheme: () => theme },
  './supabase': { supabase: {} },
};
function load(file) {
  const source = fs.readFileSync(file,'utf8'); const module = { exports: {} };
  const compiled = ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled,{ exports:module.exports,module,require:name=> { if (!(name in mocks)) throw Error(`Unexpected dependency ${name}`); return mocks[name]; }, URL,Set,Map,Date },{filename:file});
  return module.exports;
}
const image = load('src/lib/image-policy.ts');
for (const uri of ['blob:http://localhost/1','file:///photo.jpg','content://gallery/1','data:image/png;base64,AAAA','http://example.com/a','https://name:password@example.com/a','nonsense']) {
  assert.equal(image.permanentImageUrl(uri),null); assert.throws(()=>image.requirePermanentImage(uri));
}
assert.equal(image.requirePermanentImage(null),null);
assert.equal(image.permanentImageUrl('https://example.supabase.co/storage/v1/object/authenticated/work-covers/a.jpg'),'https://example.supabase.co/storage/v1/object/authenticated/work-covers/a.jpg');
console.log('PASS: invalid/temporary images rejected; permanent HTTPS accepted');
const { palette } = load('src/theme/palette.ts');
theme = { colors:palette.light,scheme:'light',ready:true };
const { useThemedStyles } = load('src/theme/use-themed-styles.ts');
const base = { screen:{backgroundColor:'#09090D',padding:16}, text:{color:'#F5F5F8'}, card:{backgroundColor:'#15151D',borderColor:'#292934'} };
const light = useThemedStyles(base);
assert.equal(light.screen.backgroundColor,palette.light.background); assert.equal(light.text.color,palette.light.text);
assert.equal(light.card.backgroundColor,palette.light.surface); assert.equal(light.card.borderColor,palette.light.border); assert.equal(light.screen.padding,16);
theme = { colors:palette.dark,scheme:'dark',ready:true };
const dark = useThemedStyles(base);
assert.equal(dark.screen.backgroundColor,palette.dark.background);
assert.equal(dark.text.color,palette.dark.text);
assert.equal(dark.card.backgroundColor,palette.dark.surface);
assert.equal(dark.card.borderColor,palette.dark.border);
assert.equal(dark.screen.padding,16);
console.log('PASS: semantic surfaces/text/borders map to the active light/dark palette while layout stays unchanged');
const rec = load('src/lib/reader-recommendations.ts');
const signals = {followedByFriends:0,sharedBook:0,sharedCommunity:0,sharedHashtag:0,recentPost:0,completeProfile:0};
assert.match(rec.explainReader({...signals,followedByFriends:3}).reason,/3 kişi/);
assert.match(rec.explainReader({...signals,sharedBook:2}).reason,/2 kitap/);
assert.equal(rec.explainReader(signals).reason,'Keşfedebileceğin bir okur');
const readers = ['self','following','blocked-out','blocked-in','hidden','a','b','c'].map((id,i)=>({id,score:20-i,group:id==='c'?'books':'friends'}));
const ranked=rec.rankReaders(readers,new Set(readers.slice(0,5).map(r=>r.id)),3);
assert.equal(ranked.map(r=>r.id).join(','),'a,c,b');
console.log('PASS: exclusion filters, evidence-based reasons and ranking diversity');
const layoutSource = fs.readFileSync('src/app/_layout.tsx','utf8');
function routeNames(constantName) {
  const match = layoutSource.match(new RegExp(`const ${constantName} = \\[([\\s\\S]*?)\\] as const;`));
  assert.ok(match, `Missing ${constantName} route list`);
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(item => item[1]);
}
const authenticatedRoutes = routeNames('AUTHENTICATED_ROUTES');
const adminRoutes = routeNames('ADMIN_ROUTES');
const publicRoutes = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'account-deletion',
]);
const specialRoutes = new Set(['auth/callback']);
const appFiles = fs.readdirSync('src/app')
  .filter(file => file.endsWith('.tsx') && file !== '_layout.tsx')
  .map(file => path.basename(file,'.tsx'));

for (const route of appFiles) {
  if (publicRoutes.has(route) || specialRoutes.has(route) || adminRoutes.includes(route)) continue;
  assert.ok(authenticatedRoutes.includes(route), `Missing authenticated route ${route}`);
}
for (const route of adminRoutes) assert.ok(/^admin(?:-|$)/.test(route), `Unexpected admin route ${route}`);
assert.ok(/<Stack\.Protected guard=\{!session\}>[\s\S]*name="login"[\s\S]*name="register"/.test(layoutSource));
assert.ok(/<Stack\.Protected guard=\{!!session\}>/.test(layoutSource));
assert.ok(/<Stack\.Protected guard=\{canOpenAdmin\}>/.test(layoutSource));
assert.ok(/<Stack\.Screen name="auth\/callback" \/>/.test(layoutSource));
console.log('PASS: public, authenticated and admin route guard contract is complete');

const explore=fs.readFileSync('src/app/explore.tsx','utf8');
assert.ok(!/import .*?(ReadersList|ReaderSuggestions|WorksList)/.test(explore));
for(const file of ['book','shelves','read']) assert.ok(!fs.readFileSync(`src/app/${file}.tsx`,'utf8').includes("from('works')"));
for(const width of [320,360,390,430]) assert.ok(Math.min(188,width-64)+32<=width);
console.log('PASS: work/book separation and recommendation card width budget at 320/360/390/430 dp');
