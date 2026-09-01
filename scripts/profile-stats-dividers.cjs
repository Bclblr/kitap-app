const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
`        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>Takipçi</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Takip</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{quoteCount}</Text>
            <Text style={styles.statLabel}>Alıntı</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{reviewCount}</Text>
            <Text style={styles.statLabel}>İnceleme</Text>
          </View>
        </View>`,
`        <View style={styles.stats}>
          <View style={[styles.stat, styles.statDivider]}>
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>Takipçi</Text>
          </View>

          <View style={[styles.stat, styles.statDivider]}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Takip</Text>
          </View>

          <View style={[styles.stat, styles.statDivider]}>
            <Text style={styles.statNumber}>{quoteCount}</Text>
            <Text style={styles.statLabel}>Alıntı</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statNumber}>{reviewCount}</Text>
            <Text style={styles.statLabel}>İnceleme</Text>
          </View>
        </View>`
);

if (!s.includes('  statDivider: {')) {
  s = s.replace(
`  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },`,
`  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  statDivider: {
    borderRightWidth: 1,
    borderRightColor: '#3A3B45',
    borderStyle: 'dashed',
  },`
  );
}

fs.writeFileSync(path, s, 'utf8');
console.log('İstatistiklerin arasına dikey kesikli çizgiler eklendi.');
