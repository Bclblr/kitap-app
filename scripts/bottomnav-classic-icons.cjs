const fs = require('fs');

const path = 'src/components/BottomNav.tsx';
if (!fs.existsSync(path)) throw new Error('src/components/BottomNav.tsx bulunamadı.');

const content = `import { Link, usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

type NavItemProps = {
  href: '/' | '/read' | '/messages' | '/explore' | '/profile';
  pathname: string;
  icon: 'house' | 'book' | 'message' | 'magnifyingglass' | 'person';
  activeIcon: 'house.fill' | 'book.fill' | 'message.fill' | 'magnifyingglass' | 'person.fill';
};

function NavItem({ href, pathname, icon, activeIcon }: NavItemProps) {
  const active = pathname === href;

  return (
    <Link href={href} style={styles.tab}>
      <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
        <SymbolView
          name={active ? activeIcon : icon}
          size={24}
          tintColor={active ? '#A985FF' : '#85858F'}
          weight={active ? 'semibold' : 'regular'}
        />
      </View>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.bottomBar}>
      <NavItem href="/" pathname={pathname} icon="house" activeIcon="house.fill" />
      <NavItem href="/read" pathname={pathname} icon="book" activeIcon="book.fill" />
      <NavItem href="/messages" pathname={pathname} icon="message" activeIcon="message.fill" />
      <NavItem href="/explore" pathname={pathname} icon="magnifyingglass" activeIcon="magnifyingglass" />
      <NavItem href="/profile" pathname={pathname} icon="person" activeIcon="person.fill" />
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
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44,
    height: 38,
    borderRadius: 14,
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

fs.writeFileSync(path, content, 'utf8');
console.log('BottomNav güncellendi: Ana Sayfa → Oku → Mesajlar → Arama → Profil. Yazılar kaldırıldı ve klasik ikonlar eklendi.');
