import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';

type NavRoute = '/' | '/read' | '/messages' | '/explore' | '/profile';
type NavIcon = 'home' | 'book-open' | 'message-circle' | 'search' | 'user';

type NavItemProps = {
  href: NavRoute;
  pathname: string;
  icon: NavIcon;
  onPress: () => void;
};

const NAV_LABELS: Record<NavRoute, string> = {
  '/': 'Ana sayfa',
  '/read': 'Okumalarım',
  '/messages': 'Mesajlar',
  '/explore': 'Keşfet',
  '/profile': 'Profil',
};

function NavItem({ href, pathname, icon, onPress }: NavItemProps) {
  const styles = useThemedStyles(baseStyles);
  const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  const { colors } = useAppTheme();
  const label = NAV_LABELS[href];

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityHint={active ? `${label} sekmesindesin` : `${label} sekmesine geç`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      focusable
      style={({ pressed }) => [
        styles.tab,
        active && { backgroundColor: colors.primarySoft },
        pressed && styles.pressedTab,
      ]}
      hitSlop={6}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.iconWrap,
          active && styles.activeIconWrap,
          active && { borderColor: colors.focusRing },
        ]}
      >
        <Feather
          name={icon}
          size={23}
          color={active ? colors.primary : colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

export default function BottomNav() {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bottomBar,
        {
          height: 68 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      <NavItem href="/" pathname={pathname} icon="home" onPress={() => { if (pathname !== '/') router.replace('/'); }} />
      <NavItem href="/read" pathname={pathname} icon="book-open" onPress={() => { if (!pathname.startsWith('/read')) router.replace('/read'); }} />
      <NavItem href="/messages" pathname={pathname} icon="message-circle" onPress={() => { if (!pathname.startsWith('/messages')) router.replace('/messages'); }} />
      <NavItem href="/explore" pathname={pathname} icon="search" onPress={() => { if (!pathname.startsWith('/explore')) router.replace('/explore'); }} />
      <NavItem href="/profile" pathname={pathname} icon="user" onPress={() => { if (!pathname.startsWith('/profile')) router.replace('/profile'); }} />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  bottomBar: {
    height: 76,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedTab: {
    opacity: 0.65,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrap: {
    borderWidth: 2,
  },
});
