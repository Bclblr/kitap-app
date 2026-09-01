const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

const statsStart = s.indexOf('  stats: {');
const sectionStart = s.indexOf('  section: {', statsStart);

if (statsStart < 0 || sectionStart < 0 || sectionStart <= statsStart) {
  throw new Error('İstatistik stilleri bulunamadı.');
}

const replacement = `  stats: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 20,
    marginHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 15,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#20212A',
  },

  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  statNumber: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: '#F5F5F7',
    textAlign: 'center',
  },

  statLabel: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 14,
    color: '#9696A0',
    textAlign: 'center',
  },

`;

s = s.slice(0, statsStart) + replacement + s.slice(sectionStart);

fs.writeFileSync(path, s, 'utf8');
console.log('Profil istatistik kartı kaldırıldı; koyu düz satır düzeni uygulandı.');
