const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

const start = s.indexOf('        {/* İSTATİSTİKLER */}');
const end = s.indexOf('        {/* =====================================================', start);

if (start < 0 || end < 0 || end <= start) {
  throw new Error('İstatistik bölümü bulunamadı.');
}

const block = `        {/* İSTATİSTİKLER */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>Takipçi</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Takip</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{quoteCount}</Text>
            <Text style={styles.statLabel}>Alıntı</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{reviewCount}</Text>
            <Text style={styles.statLabel}>İnceleme</Text>
          </View>
        </View>

`;

s = s.slice(0, start) + block + s.slice(end);

const styleStart = s.indexOf('  stats: {');
const sectionStart = s.indexOf('  section:', styleStart);

if (styleStart < 0 || sectionStart < 0 || sectionStart <= styleStart) {
  throw new Error('İstatistik stilleri bulunamadı.');
}

const stylesBlock = `  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },

  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },

  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#34353F',
  },

  statNumber: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: '#F5F5F7',
    textAlign: 'center',
  },

  statLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    color: '#9A9AA4',
    textAlign: 'center',
  },

`;

s = s.slice(0, styleStart) + stylesBlock + s.slice(sectionStart);

fs.writeFileSync(path, s, 'utf8');
console.log('İstatistik ayraçları düz çizgi olarak güncellendi.');
