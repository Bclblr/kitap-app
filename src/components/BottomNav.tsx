import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/lib/supabase';

type NavRoute = '/' | '/read' | '/messages' | '/explore' | '/profile';
type NavIcon = 'home' | 'book-open' | 'message-circle' | 'search' | 'user';

type NavItemProps = {
  href: NavRoute;
  pathname: string;
  icon: NavIcon;
  onPress: () => void;
  badgeCount?: number;
};

const NAV_LABELS: Record<NavRoute, string> = {
  '/': 'Ana sayfa',
  '/read': 'Okumalarım',
  '/messages': 'Mesajlar',
  '/explore': 'Keşfet',
  '/profile': 'Profil',
};

function NavItem({ href, pathname, icon, onPress, badgeCount = 0 }: NavItemProps) {
  const styles = useThemedStyles(baseStyles);
  const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const label = NAV_LABELS[href];

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityHint={active ? `${label} sekmesindesin` : `${label} sekmesine geç`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      focusable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.tab,
        active && { backgroundColor: colors.primarySoft },
        focused && { borderColor: colors.focusRing, borderWidth: 2 },
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
        {badgeCount > 0 ? (
          <View style={styles.messageBadge}>
            <Text style={styles.messageBadgeText}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        ) : null}
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUnreadMessages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUnreadMessages(0);
      return;
    }

    const { data, error } = await supabase.rpc('get_my_inbox', { p_limit: 100 });
    if (error) {
      console.warn('Okunmamış mesaj sayısı alınamadı:', error);
      return;
    }

    const total = (data ?? []).reduce(
      (sum: number, row: any) => sum + (Number(row.unread_count) || 0),
      0
    );
    setUnreadMessages(total);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefresh = () => {
      if (!active) return;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void loadUnreadMessages();
      }, 100);
    };

    void loadUnreadMessages();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      scheduleRefresh();
    });

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      channel = supabase
        .channel(`bottom-nav-unread-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, scheduleRefresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, scheduleRefresh)
        .subscribe();
    });

    return () => {
      active = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      authListener.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadUnreadMessages]);

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
      <NavItem href="/messages" pathname={pathname} icon="message-circle" badgeCount={unreadMessages} onPress={() => { if (!pathname.startsWith('/messages')) router.replace('/messages'); }} />
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
    borderRadius: 14,
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
  messageBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4D67',
    borderWidth: 2,
    borderColor: '#0A0A0E',
  },
  messageBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
});
