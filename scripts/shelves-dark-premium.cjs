const fs = require('fs');

const path = 'src/app/shelves.tsx';
if (!fs.existsSync(path)) throw new Error('src/app/shelves.tsx bulunamadı.');

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

replaceStyle('container', `    flex: 1,
    backgroundColor: '#090A0F',`);

replaceStyle('content', `    padding: 20,
    paddingTop: 24,
    paddingBottom: 110,`);

replaceStyle('title', `    fontSize: 28,
    fontWeight: '800',
    color: '#F5F5F7',`);

replaceStyle('subtitle', `    marginTop: 6,
    color: '#9A9AA4',
    fontSize: 14,`);

replaceStyle('filterContainer', `    gap: 8,
    paddingVertical: 20,`);

replaceStyle('filterButton', `    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#15161D',
    borderWidth: 1,
    borderColor: '#2A2B34',`);

replaceStyle('activeFilter', `    backgroundColor: '#2B2140',
    borderColor: '#8B5CF6',`);

replaceStyle('filterText', `    fontSize: 13,
    fontWeight: '600',
    color: '#A0A0AA',`);

replaceStyle('activeFilterText', `    color: '#D9CCFF',`);

replaceStyle('info', `    marginTop: 40,
    textAlign: 'center',
    color: '#9A9AA4',`);

replaceStyle('count', `    marginBottom: 12,
    fontSize: 13,
    color: '#8E8E98',
    fontWeight: '600',`);

replaceStyle('empty', `    alignItems: 'center',
    marginTop: 40,
    marginHorizontal: 0,
    paddingHorizontal: 24,
    paddingVertical: 34,
    borderRadius: 20,
    backgroundColor: '#15161D',
    borderWidth: 1,
    borderColor: '#25262F',`);

replaceStyle('emptyIcon', `    fontSize: 44,
    marginBottom: 15,`);

replaceStyle('emptyTitle', `    fontSize: 20,
    fontWeight: '800',
    color: '#F5F5F7',`);

replaceStyle('emptyText', `    marginTop: 10,
    textAlign: 'center',
    color: '#9A9AA4',
    lineHeight: 21,`);

replaceStyle('exploreButton', `    marginTop: 25,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,`);

replaceStyle('exploreButtonText', `    color: '#FFFFFF',
    fontWeight: '800',`);

replaceStyle('bookCard', `    backgroundColor: '#15161D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#25262F',
    marginBottom: 14,
    overflow: 'hidden',`);

replaceStyle('bookPressable', `    flexDirection: 'row',
    padding: 14,`);

replaceStyle('cover', `    width: 86,
    height: 128,
    borderRadius: 10,
    backgroundColor: '#20212A',`);

replaceStyle('noCover', `    width: 86,
    height: 128,
    borderRadius: 10,
    backgroundColor: '#20212A',
    borderWidth: 1,
    borderColor: '#30313A',
    alignItems: 'center',
    justifyContent: 'center',`);

replaceStyle('noCoverText', `    color: '#777984',
    fontSize: 11,
    textAlign: 'center',`);

replaceStyle('bookInfo', `    flex: 1,
    marginLeft: 14,
    paddingVertical: 2,`);

replaceStyle('bookTitle', `    color: '#F5F5F7',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',`);

replaceStyle('author', `    marginTop: 6,
    color: '#A0A1AA',
    fontSize: 13,
    lineHeight: 18,`);

replaceStyle('status', `    marginTop: 10,
    alignSelf: 'flex-start',
    color: '#CDB7F8',
    fontSize: 12,
    fontWeight: '700',`);

replaceStyle('year', `    marginTop: 7,
    color: '#6F707A',
    fontSize: 11,`);

replaceStyle('statusSection', `    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#25262F',`);

replaceStyle('statusLabel', `    color: '#8E8E98',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,`);

replaceStyle('statusButtons', `    flexDirection: 'row',
    gap: 8,`);

replaceStyle('smallStatusButton', `    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1B1C24',
    borderWidth: 1,
    borderColor: '#2B2C35',
    alignItems: 'center',
    justifyContent: 'center',`);

replaceStyle('selectedSmallStatus', `    backgroundColor: '#2B2140',
    borderColor: '#8B5CF6',`);

replaceStyle('smallStatusText', `    fontSize: 18,`);

replaceStyle('deleteButton', `    marginHorizontal: 14,
    marginBottom: 14,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#1C171A',
    borderWidth: 1,
    borderColor: '#4A292F',
    alignItems: 'center',
    justifyContent: 'center',`);

replaceStyle('deleteButtonPressed', `    opacity: 0.7,`);

replaceStyle('deleteText', `    color: '#D98792',
    fontSize: 12,
    fontWeight: '700',`);

if (s === before) {
  console.log('Raflar sayfasında değiştirilecek stil bulunamadı veya tasarım zaten uygulanmış.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Raflar sayfası mevcut koyu premium tasarıma uyarlandı.');
