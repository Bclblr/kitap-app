const fs = require('fs');

const path = 'src/app/notifications.tsx';
if (!fs.existsSync(path)) throw new Error('src/app/notifications.tsx bulunamadı.');

let s = fs.readFileSync(path, 'utf8');
const before = s;

const replacements = [
  ["backgroundColor: '#F7F7F5'", "backgroundColor: '#090A0F'"],
  ["color: '#777',\n    fontSize: 14", "color: '#9A9AA4',\n    fontSize: 14"],
  ["fontWeight: '700',\n    color: '#222',", "fontWeight: '800',\n    color: '#F5F5F7',"],
  ["fontSize: 13,\n    color: '#777',", "fontSize: 13,\n    color: '#9A9AA4',"],
  ["backgroundColor: '#E8E8E3',\n  },\n\n  readAllText", "backgroundColor: '#1B1C24',\n    borderWidth: 1,\n    borderColor: '#2A2B34',\n  },\n\n  readAllText"],
  ["color: '#333',\n    fontSize: 12", "color: '#A98BFF',\n    fontSize: 12"],
  ["backgroundColor: '#FFF',\n    alignItems: 'center',", "backgroundColor: '#15161D',\n    borderWidth: 1,\n    borderColor: '#25262F',\n    alignItems: 'center',"],
  ["fontSize: 46,\n    color: '#999',", "fontSize: 46,\n    color: '#A98BFF',"],
  ["fontSize: 18,\n    fontWeight: '700',\n    color: '#222',", "fontSize: 18,\n    fontWeight: '700',\n    color: '#F5F5F7',"],
  ["lineHeight: 21,\n    color: '#777',", "lineHeight: 21,\n    color: '#9A9AA4',"],
  ["backgroundColor: '#FFF',\n    borderRadius: 17,", "backgroundColor: '#15161D',\n    borderWidth: 1,\n    borderColor: '#25262F',\n    borderRadius: 17,"],
  ["unreadCard: {\n    backgroundColor: '#EEEEEA',", "unreadCard: {\n    backgroundColor: '#1B1925',\n    borderColor: '#3B315A',"],
  ["borderRadius: 23,\n    backgroundColor: '#E8E8E3',", "borderRadius: 23,\n    backgroundColor: '#20212A',"],
  ["fontSize: 22,\n    fontWeight: '700',\n    color: '#222',", "fontSize: 22,\n    fontWeight: '700',\n    color: '#A98BFF',"],
  ["fontSize: 12,\n    fontWeight: '700',\n    color: '#777',", "fontSize: 12,\n    fontWeight: '700',\n    color: '#A98BFF',"],
  ["backgroundColor: '#222',\n  },\n\n  message", "backgroundColor: '#A98BFF',\n  },\n\n  message"],
  ["lineHeight: 20,\n    color: '#555',", "lineHeight: 20,\n    color: '#D4D4DA',"],
  ["fontWeight: '700',\n    color: '#222',\n  },\n\n  date", "fontWeight: '700',\n    color: '#F5F5F7',\n  },\n\n  date"],
  ["fontSize: 11,\n    color: '#999',", "fontSize: 11,\n    color: '#777984',"],
  ["fontWeight: '600',\n    color: '#888',", "fontWeight: '600',\n    color: '#8E8E98',"]
];

for (const [from, to] of replacements) s = s.replace(from, to);

// Headerı biraz daha premium ve dengeli yap.
s = s.replace("paddingTop: 20,\n    paddingBottom: 18,", "paddingTop: 24,\n    paddingBottom: 20,");
s = s.replace("fontSize: 30,", "fontSize: 28,");

if (s === before) {
  console.log('Bildirim tasarımında değiştirilecek alan bulunamadı veya zaten uygulanmış.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Bildirimler sayfası mevcut koyu premium tasarıma uyarlandı. Bildirim mantığına dokunulmadı.');
