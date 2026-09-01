const fs = require('fs');

const path = 'src/app/read.tsx';
let s = fs.readFileSync(path, 'utf8');
const before = s;

s = s.replace(
`        <View style={styles.header}>\n          <Text style={styles.headerEyebrow}>KİTAPLIĞIN</Text>\n          <Text style={styles.headerTitle}>Oku</Text>\n        </View>`,
`        <View style={styles.header}>\n          <View style={styles.headerTopRow}>\n            <Pressable\n              onPress={() => router.back()}\n              style={styles.backButton}\n              hitSlop={10}\n            >\n              <Text style={styles.backButtonText}>‹</Text>\n            </Pressable>\n\n            <View style={styles.headerTextWrap}>\n              <Text style={styles.headerEyebrow}>KİTAPLIĞIN</Text>\n              <Text style={styles.headerTitle}>Oku</Text>\n            </View>\n          </View>\n        </View>`
);

if (!s.includes('  headerTopRow: {')) {
  s = s.replace(
`  header: {\n    paddingVertical: 12,\n    marginBottom: 20,\n  },`,
`  header: {\n    paddingVertical: 12,\n    marginBottom: 20,\n  },\n  headerTopRow: {\n    flexDirection: 'row',\n    alignItems: 'center',\n  },\n  backButton: {\n    width: 42,\n    height: 42,\n    borderRadius: 21,\n    alignItems: 'center',\n    justifyContent: 'center',\n    backgroundColor: '#111218',\n    borderWidth: 1,\n    borderColor: '#2A2B34',\n    marginRight: 12,\n  },\n  backButtonText: {\n    color: '#F7F7F9',\n    fontSize: 32,\n    lineHeight: 34,\n    fontWeight: '500',\n    marginTop: -2,\n  },\n  headerTextWrap: {\n    flex: 1,\n  },`
  );
}

if (s === before) {
  console.log('Geri butonu için değiştirilecek alan bulunamadı veya zaten uygulanmış.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Oku sayfasına mevcut temaya uygun geri butonu eklendi.');
