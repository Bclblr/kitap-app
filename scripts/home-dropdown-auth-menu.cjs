const fs = require('fs');

const path = 'src/app/index.tsx';
if (!fs.existsSync(path)) throw new Error('src/app/index.tsx bulunamadı.');

let s = fs.readFileSync(path, 'utf8');

// Feather ikonu ekle.
if (!s.includes("import { Feather } from '@expo/vector-icons';")) {
  s = "import { Feather } from '@expo/vector-icons';\n" + s;
}

// Menü state'i ekle.
const marker = 'export default function';
const fnIndex = s.indexOf(marker);
if (fnIndex < 0) throw new Error('Ana component bulunamadı.');
const braceIndex = s.indexOf('{', fnIndex);
if (braceIndex < 0) throw new Error('Component başlangıcı bulunamadı.');

if (!s.includes('const [showAuthMenu, setShowAuthMenu]')) {
  s = s.slice(0, braceIndex + 1) + "\n  const [showAuthMenu, setShowAuthMenu] = useState(false);" + s.slice(braceIndex + 1);
}

const oldLeft = `          <Pressable
            onPress={() => router.push('/explore')}
            style={styles.headerIconButton}
            accessibilityLabel="Ara"
          >
            <Text style={styles.headerIcon}>⌕</Text>
          </Pressable>`;

const newLeft = `          <View style={styles.headerMenuWrap}>
            <Pressable
              onPress={() => setShowAuthMenu((value) => !value)}
              style={styles.headerIconButton}
              accessibilityLabel="Menü"
            >
              <Feather name="menu" size={23} color="#F1F1F5" />
            </Pressable>

            {showAuthMenu && (
              <View style={styles.authDropdown}>
                <Pressable
                  onPress={() => {
                    setShowAuthMenu(false);
                    router.push('/login');
                  }}
                  style={styles.authDropdownItem}
                >
                  <Feather name="log-in" size={17} color="#A985FF" />
                  <Text style={styles.authDropdownText}>Giriş Yap</Text>
                </Pressable>

                <View style={styles.authDropdownDivider} />

                <Pressable
                  onPress={() => {
                    setShowAuthMenu(false);
                    router.push('/register');
                  }}
                  style={styles.authDropdownItem}
                >
                  <Feather name="user-plus" size={17} color="#A985FF" />
                  <Text style={styles.authDropdownText}>Kaydol</Text>
                </Pressable>
              </View>
            )}
          </View>`;

if (s.includes(oldLeft)) {
  s = s.replace(oldLeft, newLeft);
} else if (!s.includes('styles.authDropdown')) {
  throw new Error('Sol üstteki mevcut arama butonu bulunamadı. Yerel index.tsx GitHub sürümünden farklı olabilir.');
}

// StyleSheet kapanışından hemen önce menü stillerini ekle.
if (!s.includes('authDropdown: {')) {
  const last = s.lastIndexOf('});');
  if (last < 0) throw new Error('StyleSheet kapanışı bulunamadı.');

  const styles = `
    headerMenuWrap: {
      position: 'relative',
      zIndex: 50,
    },
    authDropdown: {
      position: 'absolute',
      top: 48,
      left: 0,
      width: 170,
      backgroundColor: '#111116',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#292932',
      paddingVertical: 6,
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
      zIndex: 100,
    },
    authDropdownItem: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
      gap: 11,
    },
    authDropdownText: {
      color: '#F1F1F5',
      fontSize: 14,
      fontWeight: '700',
    },
    authDropdownDivider: {
      height: 1,
      backgroundColor: '#24242B',
      marginHorizontal: 12,
    },
`;
  s = s.slice(0, last) + styles + s.slice(last);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Ana sayfanın sol üst arama ikonu menü ikonuna çevrildi.');
console.log('Açılır menüye Giriş Yap ve Kaydol seçenekleri eklendi.');