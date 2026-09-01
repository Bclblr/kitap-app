const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    /  sectionTitle: \{[\s\S]*?\n  \},\n\n  emptyCard:/,
    `  sectionTitle: {\n    fontSize: 21,\n    fontWeight: '700',\n    color: '#F5F5F7',\n    marginBottom: 12,\n  },\n\n  emptyCard:`
  ],
  [
    /  emptyCard: \{[\s\S]*?\n  \},\n\n  emptyIcon:/,
    `  emptyCard: {\n    backgroundColor: '#15161D',\n    borderRadius: 18,\n    borderWidth: 1,\n    borderColor: '#25262F',\n    padding: 25,\n    alignItems: 'center',\n  },\n\n  emptyIcon:`
  ],
  [
    /  emptyTitle: \{[\s\S]*?\n  \},\n\n  emptyText:/,
    `  emptyTitle: {\n    marginTop: 10,\n    fontSize: 17,\n    fontWeight: '700',\n    color: '#F5F5F7',\n  },\n\n  emptyText:`
  ],
  [
    /  feedCard: \{[\s\S]*?\n  \},\n\n  quoteCard:/,
    `  feedCard: {\n    backgroundColor: '#15161D',\n    borderRadius: 18,\n    borderWidth: 1,\n    borderColor: '#25262F',\n    padding: 18,\n    marginBottom: 12,\n  },\n\n  quoteCard:`
  ],
  [
    /  bookTitle: \{[\s\S]*?\n  \},\n\n  openBookText:/,
    `  bookTitle: {\n    flex: 1,\n    fontSize: 17,\n    fontWeight: '700',\n    color: '#F5F5F7',\n    lineHeight: 23,\n  },\n\n  openBookText:`
  ],
  [
    /  stars: \{[\s\S]*?\n  \},\n\n  ratingText:/,
    `  stars: {\n    fontSize: 17,\n    letterSpacing: 2,\n    color: '#A98BFF',\n  },\n\n  ratingText:`
  ],
  [
    /  postImage: \{[\s\S]*?\n  \},\n\n  attachedBook:/,
    `  postImage: {\n    width: '100%',\n    height: 260,\n    borderRadius: 14,\n    marginTop: 14,\n    backgroundColor: '#20212A',\n  },\n\n  attachedBook:`
  ],
];

let changed = 0;
for (const [pattern, replacement] of replacements) {
  if (pattern.test(s)) {
    s = s.replace(pattern, replacement);
    changed++;
  }
}

if (changed === 0) {
  console.log('Gönderi kartı stilleri bulunamadı veya zaten güncellenmiş.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log(`Profil gönderi alanı koyu tasarıma uyarlandı. Güncellenen bölüm: ${changed}`);
