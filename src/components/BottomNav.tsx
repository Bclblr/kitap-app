import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavRoute = '/' | '/read' | '/messages' | '/explore' | '/profile';
type NavIcon = 'home' | 'book-open' | 'message-circle' | 'search' | 'user';

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
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={[styles.bottomBar, { height: 68 + Math.max(insets.bottom, 8), paddingBottom: Math.max(insets.bottom, 8) }]}>
      <NavItem href="/" pathname={pathname} icon="home" onPress={() => router.push('/')} />
      <NavItem href="/read" pathname={pathname} icon="book-open" onPress={() => router.push('/read')} />
      <NavItem href="/messages" pathname={pathname} icon="message-circle" onPress={() => router.push('/messages')} />
      <NavItem href="/explore" pathname={pathname} icon="search" onPress={() => router.push('/explore')} />
      <NavItem href="/profile" pathname={pathname} icon="user" onPress={() => router.push('/profile')} />
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
