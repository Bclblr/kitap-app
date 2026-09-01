const fs = require('fs');

const path = 'src/app/index.tsx';
if (!fs.existsSync(path)) throw new Error('src/app/index.tsx bulunamadı.');

let s = fs.readFileSync(path, 'utf8');

if (!s.includes("import { Feather } from '@expo/vector-icons';")) {
  s = "import { Feather } from '@expo/vector-icons';\n" + s;
}

if (!s.includes('const [showAuthMenu, setShowAuthMenu]')) {
  const marker = 'export default function';
  const fnIndex = s.indexOf(marker);
  if (fnIndex < 0) throw new Error('Ana component bulunamadı.');
  const braceIndex = s.indexOf('{', fnIndex);
  if (braceIndex < 0) throw new Error('Component başlangıcı bulunamadı.');
  s = s.slice(0, braceIndex + 1) + "\n  const [showAuthMenu, setShowAuthMenu] = useState(false);" + s.slice(braceIndex + 1);
}

// Önceki küçük dropdown menü varsa sadece sol butonu sade menü ikonuna çevir.
const dropdownBlock = /<View style=\{styles\.headerMenuWrap\}>[\s\S]*?<\/View>\s*(?=\n\s*<Text style=\{styles\.brandTitle\}>)/;
const plainMenuButton = `<Pressable
            onPress={() => setShowAuthMenu(true)}
            style={styles.headerIconButton}
            accessibilityLabel="Menü"
          >
            <Feather name="menu" size={24} color="#F1F1F5" />
          </Pressable>`;

if (dropdownBlock.test(s)) {
  s = s.replace(dropdownBlock, plainMenuButton);
} else {
  const oldSearch = /<Pressable\s+onPress=\{\(\) => router\.push\('\/explore'\)\}[\s\S]*?accessibilityLabel="Ara"[\s\S]*?<\/Pressable>/;
  if (oldSearch.test(s)) {
    s = s.replace(oldSearch, plainMenuButton);
  }
}

// Drawer modalını ana container içine, ScrollView'dan önce ekle.
if (!s.includes('styles.drawerOverlay')) {
  const target = `<View style={styles.container}>`;
  const modal = `<View style={styles.container}>
      <Modal
        visible={showAuthMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAuthMenu(false)}
      >
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerBrand}>
                1000<Text style={styles.drawerBrandAccent}>Kitap</Text>
              </Text>

              <Pressable
                onPress={() => setShowAuthMenu(false)}
                style={styles.drawerCloseButton}
                accessibilityLabel="Menüyü kapat"
              >
                <Feather name="x" size={24} color="#F1F1F5" />
              </Pressable>
            </View>

            <View style={styles.drawerDivider} />

            <View style={styles.drawerSection}>
              <Pressable
                onPress={() => {
                  setShowAuthMenu(false);
                  router.push('/login');
                }}
                style={styles.drawerItem}
              >
                <View style={styles.drawerIconWrap}>
                  <Feather name="log-in" size={22} color="#F1F1F5" />
                </View>
                <Text style={styles.drawerItemText}>Giriş Yap</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowAuthMenu(false);
                  router.push('/register');
                }}
                style={styles.drawerItem}
              >
                <View style={styles.drawerIconWrap}>
                  <Feather name="user-plus" size={22} color="#F1F1F5" />
                </View>
                <Text style={styles.drawerItemText}>Kaydol</Text>
              </Pressable>
            </View>

            <View style={styles.drawerBottomArea}>
              <Text style={styles.drawerBottomText}>Okuma dünyana hoş geldin.</Text>
            </View>
          </View>

          <Pressable
            style={styles.drawerDismissArea}
            onPress={() => setShowAuthMenu(false)}
          />
        </View>
      </Modal>`;

  if (!s.includes(target)) throw new Error('Ana container bulunamadı.');
  s = s.replace(target, modal);
}

// Önceki dropdown stillerini bırakabiliriz; kullanılmayacak. Yeni drawer stillerini ekle.
if (!s.includes('drawerOverlay: {')) {
  const last = s.lastIndexOf('});');
  if (last < 0) throw new Error('StyleSheet kapanışı bulunamadı.');

  const styles = `
    drawerOverlay: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.48)',
    },
    drawerPanel: {
      width: '86%',
      height: '100%',
      backgroundColor: '#101012',
      paddingTop: 54,
      paddingHorizontal: 24,
      borderRightWidth: 1,
      borderRightColor: '#24242A',
    },
    drawerDismissArea: {
      flex: 1,
    },
    drawerHeader: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    drawerBrand: {
      fontSize: 24,
      fontWeight: '800',
      color: '#F3F3F6',
      letterSpacing: -0.5,
    },
    drawerBrandAccent: {
      color: '#A985FF',
    },
    drawerCloseButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#17171C',
      borderWidth: 1,
      borderColor: '#2A2A31',
    },
    drawerDivider: {
      height: 1,
      backgroundColor: '#29292F',
      marginTop: 18,
      marginBottom: 26,
    },
    drawerSection: {
      gap: 6,
    },
    drawerItem: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 10,
    },
    drawerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#17171C',
      borderWidth: 1,
      borderColor: '#29292F',
      marginRight: 14,
    },
    drawerItemText: {
      color: '#F3F3F6',
      fontSize: 18,
      fontWeight: '700',
    },
    drawerBottomArea: {
      marginTop: 'auto',
      paddingBottom: 42,
      paddingTop: 22,
      borderTopWidth: 1,
      borderTopColor: '#29292F',
    },
    drawerBottomText: {
      color: '#7F7F89',
      fontSize: 13,
    },
`;

  s = s.slice(0, last) + styles + s.slice(last);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Ana sayfadaki menü görseldeki gibi soldan açılan tam boy koyu çekmece menüye çevrildi.');
console.log('Menüde şimdilik Giriş Yap ve Kaydol seçenekleri var.');