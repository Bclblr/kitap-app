const fs = require('fs');

const navPath = 'src/components/BottomNav.tsx';
const homePath = 'src/app/index.tsx';

if (!fs.existsSync(navPath)) throw new Error('src/components/BottomNav.tsx bulunamadı.');
if (!fs.existsSync(homePath)) throw new Error('src/app/index.tsx bulunamadı.');

const navContent = `import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

type NavRoute = '/' | '/read' | '/messages' | '/notifications' | '/explore' | '/profile';
type NavIcon = 'home' | 'book-open' | 'message-circle' | 'bell' | 'search' | 'user';

type NavItemProps = {
  href: NavRoute;
  pathname: string;
  icon: NavIcon;
  onPress: () => void;
};

function NavItem({ href, pathname, icon, onPress }: NavItemProps) {
  const active = pathname === href;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.pressedTab]}
      hitSlop={8}
    >
      <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
        <Feather
          name={icon}
          size={23}
          color={active ? '#A985FF' : '#85858F'}
        />
      </View>
    </Pressable>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const go = (href: NavRoute) => router.push(href);

  return (
    <View style={styles.bottomBar}>
      <NavItem href="/" pathname={pathname} icon="home" onPress={() => go('/')} />
      <NavItem href="/read" pathname={pathname} icon="book-open" onPress={() => go('/read')} />
      <NavItem href="/messages" pathname={pathname} icon="message-circle" onPress={() => go('/messages')} />
      <NavItem href="/notifications" pathname={pathname} icon="bell" onPress={() => go('/notifications')} />
      <NavItem href="/explore" pathname={pathname} icon="search" onPress={() => go('/explore')} />
      <NavItem href="/profile" pathname={pathname} icon="user" onPress={() => go('/profile')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    height: 76,
    backgroundColor: '#0A0A0E',
    borderTopWidth: 1,
    borderTopColor: '#222229',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedTab: {
    opacity: 0.65,
  },
  iconWrap: {
    width: 40,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrap: {
    backgroundColor: '#1D1728',
    borderWidth: 1,
    borderColor: '#302342',
  },
});
`;

fs.writeFileSync(navPath, navContent, 'utf8');

let home = fs.readFileSync(homePath, 'utf8');
let changes = 0;

function removeExactSectionByText(source, markerText) {
  const marker = source.indexOf(markerText);
  if (marker === -1) return source;

  // Önce marker'ın bulunduğu en yakın JSX View/Pressable başlangıcını bul.
  const candidates = [source.lastIndexOf('<View', marker), source.lastIndexOf('<Pressable', marker)].filter(i => i >= 0);
  if (!candidates.length) return source;
  const start = Math.max(...candidates);

  const openTag = source.startsWith('<Pressable', start) ? 'Pressable' : 'View';
  const tokenRe = new RegExp(`<${openTag}\\b|</${openTag}>`, 'g');
  tokenRe.lastIndex = start;
  let depth = 0;
  let match;

  while ((match = tokenRe.exec(source))) {
    if (match[0].startsWith(`</`)) depth--;
    else depth++;

    if (depth === 0) {
      changes++;
      return source.slice(0, start) + source.slice(match.index + match[0].length);
    }
  }

  return source;
}

// Ana sayfa sağ üstteki mesaj butonunu kaldır; bildirim butonuna dokunma.
const messageButtonPatterns = [
  /<Pressable[\\s\\S]{0,700}?router\\.(?:push|navigate)\\(\\s*['\"]\\/messages['\"]\\s*\\)[\\s\\S]{0,500}?<\\/Pressable>/,
  /<Pressable[\\s\\S]{0,700}?href\s*[:=]\s*['\"]\\/messages['\"][\\s\\S]{0,500}?<\\/Pressable>/,
];

for (const re of messageButtonPatterns) {
  if (re.test(home)) {
    home = home.replace(re, '');
    changes++;
    break;
  }
}

// İstenen geçici ana sayfa bloklarını kaldır.
home = removeExactSectionByText(home, 'ŞU AN AKTİF OKURLAR');
home = removeExactSectionByText(home, 'Okuma Kültürünü Keşfedin');
home = removeExactSectionByText(home, 'AYNI KİTABI OKUYANLAR');
home = removeExactSectionByText(home, 'Birlikte hazır');

// Arama alanını kaldır. Sadece üst bölümdeki search TextInput/Pressable bloğunu hedefle.
const searchPatterns = [
  /<View[^>]*style=\{styles\.(?:searchContainer|searchBox|searchBar|searchSection)\}[^>]*>[\\s\\S]{0,1200}?<\\/View>/,
  /<Pressable[^>]*[\\s\\S]{0,300}?(?:Ara|arama|search)[\\s\\S]{0,700}?<\\/Pressable>/i,
];

for (const re of searchPatterns) {
  if (re.test(home)) {
    home = home.replace(re, '');
    changes++;
    break;
  }
}

fs.writeFileSync(homePath, home, 'utf8');

console.log('BottomNav eşit hizalandı ve bildirim ikonu eklendi.');
console.log('Ana sayfa mesaj ikonu ile istenen arama/keşif geçici blokları temizlendi.');
console.log('Ana sayfada yapılan eşleşme sayısı:', changes);
