const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

function replaceStyle(name, body) {
  const marker = `  ${name}: {`;
  const start = s.indexOf(marker);
  if (start < 0) return false;

  const next = s.indexOf('\n  },', start);
  if (next < 0) return false;

  const end = next + '\n  },'.length;
  s = s.slice(0, start) + `  ${name}: {\n${body}\n  },` + s.slice(end);
  return true;
}

let changed = 0;

const styles = {
  sectionTitle: `    fontSize: 21,\n    fontWeight: '700',\n    color: '#F5F5F7',\n    marginBottom: 12,`,
  emptyCard: `    backgroundColor: '#15161D',\n    borderRadius: 18,\n    borderWidth: 1,\n    borderColor: '#25262F',\n    padding: 25,\n    alignItems: 'center',`,
  emptyTitle: `    marginTop: 10,\n    fontSize: 17,\n    fontWeight: '700',\n    color: '#F5F5F7',`,
  feedCard: `    backgroundColor: '#15161D',\n    borderRadius: 18,\n    borderWidth: 1,\n    borderColor: '#25262F',\n    padding: 18,\n    marginBottom: 12,`,
  feedType: `    fontSize: 12,\n    fontWeight: '800',\n    color: '#A98BFF',`,
  feedDate: `    fontSize: 11,\n    color: '#8E8E98',`,
  bookTitle: `    flex: 1,\n    fontSize: 17,\n    fontWeight: '700',\n    color: '#F5F5F7',\n    lineHeight: 23,`,
  openBookText: `    marginLeft: 8,\n    fontSize: 28,\n    color: '#A98BFF',\n    lineHeight: 30,`,
  stars: `    fontSize: 17,\n    letterSpacing: 2,\n    color: '#A98BFF',`,
  ratingText: `    marginLeft: 8,\n    fontSize: 13,\n    fontWeight: '600',\n    color: '#A7A7B0',`,
  feedText: `    marginTop: 12,\n    fontSize: 15,\n    lineHeight: 22,\n    color: '#E0E0E5',`,
  quoteText: `    marginTop: 15,\n    fontSize: 17,\n    lineHeight: 27,\n    color: '#E0E0E5',\n    fontStyle: 'italic',`,
  postUsername: `    fontSize: 13,\n    fontWeight: '700',\n    color: '#F5F5F7',\n    marginBottom: 7,`,
  postImage: `    width: '100%',\n    height: 260,\n    borderRadius: 14,\n    marginTop: 14,\n    backgroundColor: '#20212A',`,
  attachedBook: `    marginTop: 14,\n    padding: 12,\n    borderRadius: 12,\n    backgroundColor: '#1B1C24',\n    borderWidth: 1,\n    borderColor: '#292A33',`,
  attachedBookText: `    fontSize: 14,\n    fontWeight: '700',\n    color: '#F5F5F7',`,
  commentButton: `    paddingHorizontal: 10,\n    paddingVertical: 7,\n    borderRadius: 9,\n    backgroundColor: '#20212A',\n    borderWidth: 1,\n    borderColor: '#2B2C35',`,
  repostText: `    fontSize: 12,\n    fontWeight: '700',\n    color: '#A98BFF',`,
};

for (const [name, body] of Object.entries(styles)) {
  if (replaceStyle(name, body)) changed++;
}

if (changed === 0) {
  throw new Error('Profil stillerinde hedef alanlar bulunamadı.');
}

fs.writeFileSync(path, s, 'utf8');
console.log(`Profil gönderi kartları koyu temaya uyarlandı. Güncellenen stil: ${changed}`);
