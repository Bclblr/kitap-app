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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tab, pressed && styles.pressedTab]} hitSlop={8}>
      <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
        <Feather name={icon} size={23} color={active ? '#A985FF' : '#85858F'} />
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
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedTab: { opacity: 0.65 },
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

function removeContainingBlock(source, markerText) {
  const marker = source.indexOf(markerText);
  if (marker === -1) return source;

  const viewStart = source.lastIndexOf('<View', marker);
  const pressStart = source.lastIndexOf('<Pressable', marker);
  const start = Math.max(viewStart, pressStart);
  if (start < 0) return source;

  const tag = source.startsWith('<Pressable', start) ? 'Pressable' : 'View';
  const openToken = '<' + tag;
  const closeToken = '</' + tag + '>';
  let pos = start;
  let depth = 0;

  while (pos < source.length) {
    const nextOpen = source.indexOf(openToken, pos);
    const nextClose = source.indexOf(closeToken, pos);
    if (nextClose === -1) return source;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openToken.length;
    } else {
      depth--;
      pos = nextClose + closeToken.length;
      if (depth === 0) {
        changes++;
        return source.slice(0, start) + source.slice(pos);
      }
    }
  }
  return source;
}

function removePressableContaining(source, needle) {
  let searchFrom = 0;
  while (true) {
    const hit = source.indexOf(needle, searchFrom);
    if (hit === -1) return source;
    const start = source.lastIndexOf('<Pressable', hit);
    const end = source.indexOf('</Pressable>', hit);
    if (start !== -1 && end !== -1) {
      changes++;
      return source.slice(0, start) + source.slice(end + '</Pressable>'.length);
    }
    searchFrom = hit + needle.length;
  }
}

// Sağ üst mesaj butonunu kaldır; bildirim butonuna dokunma.
home = removePressableContaining(home, "'/messages'");
if (home.includes('"/messages"')) home = removePressableContaining(home, '"/messages"');

// Geçici ana sayfa bölümlerini kaldır.
home = removeContainingBlock(home, 'ŞU AN AKTİF OKURLAR');
home = removeContainingBlock(home, 'Okuma Kültürünü Keşfedin');
home = removeContainingBlock(home, 'AYNI KİTABI OKUYANLAR');
home = removeContainingBlock(home, 'Birlikte hazır');

// Üst arama alanını, yaygın style adlarından biri mevcutsa kaldır.
for (const styleName of ['searchContainer', 'searchBox', 'searchBar', 'searchSection']) {
  const marker = 'styles.' + styleName;
  if (home.includes(marker)) {
    home = removeContainingBlock(home, marker);
    break;
  }
}

fs.writeFileSync(homePath, home, 'utf8');
console.log('BottomNav eşit hizalandı ve bildirim ikonu eklendi.');
console.log('Ana sayfa mesaj ikonu ile istenen geçici bölümler temizlendi.');
console.log('Ana sayfada yapılan değişiklik sayısı:', changes);
