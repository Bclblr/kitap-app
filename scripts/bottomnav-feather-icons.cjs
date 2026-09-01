const fs = require('fs');

const path = 'src/components/BottomNav.tsx';
if (!fs.existsSync(path)) throw new Error('src/components/BottomNav.tsx bulunamadı.');

const content = `import { Feather } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

type NavItemProps = {
  href: '/' | '/read' | '/messages' | '/explore' | '/profile';
  pathname: string;
  icon: 'home' | 'book-open' | 'message-circle' | 'search' | 'user';
};

function NavItem({ href, pathname, icon }: NavItemProps) {
  const active = pathname === href;

  return (
    <Link href={href} style={styles.tab}>
      <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
        <Feather
          name={icon}
          size={24}
          color={active ? '#A985FF' : '#85858F'}
        />
      </View>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.bottomBar}>
      <NavItem href="/" pathname={pathname} icon="home" />
      <NavItem href="/read" pathname={pathname} icon="book-open" />
      <NavItem href="/messages" pathname={pathname} icon="message-circle" />
      <NavItem href="/explore" pathname={pathname} icon="search" />
      <NavItem href="/profile" pathname={pathname} icon="user" />
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
console.log('BottomNav Feather ikonlarıyla düzeltildi.');
