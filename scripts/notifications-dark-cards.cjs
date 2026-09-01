const fs = require('fs');

const path = 'src/app/notifications.tsx';
let s = fs.readFileSync(path, 'utf8');
const before = s;

function replaceStyle(name, body) {
  const re = new RegExp(`  ${name}: \\{[\\s\\S]*?\\n  \\},`);
  if (!re.test(s)) {
    console.log(`${name} stili bulunamadı.`);
    return;
  }
  s = s.replace(re, `  ${name}: {\n${body}\n  },`);
}

replaceStyle('card', `    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111114',
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#24242A',`);

replaceStyle('unreadCard', `    backgroundColor: '#18131F',
    borderColor: '#6D4AFF',`);

replaceStyle('profileImage', `    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1C1C21',
    borderWidth: 1,
    borderColor: '#303038',`);

replaceStyle('iconCircle', `    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#211A31',
    borderWidth: 1,
    borderColor: '#6D4AFF',
    alignItems: 'center',
    justifyContent: 'center',`);

replaceStyle('icon', `    fontSize: 21,
    fontWeight: '700',
    color: '#A78BFA',`);

replaceStyle('typeText', `    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA',
    letterSpacing: 0.3,`);

replaceStyle('dot', `    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',`);

replaceStyle('message', `    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: '#C9C9D1',`);

replaceStyle('username', `    fontWeight: '800',
    color: '#FFFFFF',`);

replaceStyle('date', `    marginTop: 6,
    fontSize: 11,
    color: '#74747F',`);

replaceStyle('emptyCard', `    marginHorizontal: 20,
    marginTop: 10,
    padding: 30,
    borderRadius: 20,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#24242A',
    alignItems: 'center',`);

replaceStyle('emptyIcon', `    fontSize: 46,
    color: '#8B5CF6',`);

replaceStyle('emptyTitle', `    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',`);

replaceStyle('emptyText', `    marginTop: 7,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: '#8E8E98',`);

replaceStyle('clearText', `    fontSize: 12,
    fontWeight: '600',
    color: '#777782',`);

if (s === before) {
  console.log('Bildirim kartı stillerinde değiştirilecek alan bulunamadı veya zaten uygulanmış.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Bildirim kartları mevcut koyu premium temaya uyarlandı.');
