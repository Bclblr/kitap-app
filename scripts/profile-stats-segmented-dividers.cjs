const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

const start = s.indexOf('        {/* İSTATİSTİKLER */}');
const end = s.indexOf('        {/* =====================================================', start);

if (start < 0 || end < 0 || end <= start) {
  throw new Error('İstatistik bölümü bulunamadı.');
}

const divider = `
          <View style={styles.statDivider}>
            <View style={styles.statDash} />
            <View style={styles.statDash} />
            <View style={styles.statDash} />
            <View style={styles.statDash} />
            <View style={styles.statDash} />
          </View>`;

const block = `        {/* İSTATİSTİKLER */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>Takipçi</Text>
          </View>${divider}

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Takip</Text>
          </View>${divider}

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{quoteCount}</Text>
            <Text style={styles.statLabel}>Alıntı</Text>
          </View>${divider}

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{reviewCount}</Text>
            <Text style={styles.statLabel}>İnceleme</Text>
          </View>
        </View>

`;

s = s.slice(0, start) + block + s.slice(end);

const statsStart = s.indexOf('  stats: {');
const sectionStart = s.indexOf('  section: {', statsStart);

if (statsStart < 0 || sectionStart < 0 || sectionStart <= statsStart) {
  throw new Error('İstatistik stilleri bulunamadı.');
}

const styles = `  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },

  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
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

  statDivider: {
    width: 1,
    height: 38,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 2,
  },

  statDash: {
    width: 1,
    height: 5,
    backgroundColor: '#3A3B45',
    borderRadius: 1,
  },

`;

s = s.slice(0, statsStart) + styles + s.slice(sectionStart);

fs.writeFileSync(path, s, 'utf8');
console.log('İstatistikler arasına görünür dikey kesikli ayraçlar eklendi.');
