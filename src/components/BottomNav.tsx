import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/lib/supabase';
import { getSignedImageUrl } from '@/lib/image-cache';

type NavRoute = '/' | '/shelves' | '/messages' | '/explore' | '/profile';
type NavIcon = 'home' | 'book-open' | 'message-circle' | 'search' | 'user';

type NavItemProps = {
  href: NavRoute;
  pathname: string;
  icon: NavIcon;
  onPress: () => void;
  badgeCount?: number;
  avatarUri?: string | null;
};

const NAV_LABELS: Record<NavRoute, string> = {
  '/': 'Ana sayfa',
  '/shelves': 'Raflarım',
  '/messages': 'Mesajlar',
  '/explore': 'Keşfet',
  '/profile': 'Profil',
};

function NavItem({ href, pathname, icon, onPress, badgeCount = 0, avatarUri = null }: NavItemProps) {
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
        {href === '/profile' && avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={[
              styles.profileAvatar,
              active && { borderColor: colors.primary },
            ]}
          />
        ) : (
          <Feather
            name={icon}
            size={23}
            color={active ? colors.primary : colors.textSecondary}
          />
        )}
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
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfileImage = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfileImage(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('profile_image')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('BottomNav profil fotoğrafı alınamadı:', error);
      return;
    }

    const storedUrl = data?.profile_image ?? null;
    if (!storedUrl) {
      setProfileImage(null);
      return;
    }

    try {
      const url = new URL(storedUrl);
      const marker = '/storage/v1/object/';
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex < 0) {
        setProfileImage(storedUrl);
        return;
      }

      const remainder = url.pathname.slice(markerIndex + marker.length);
      const match = remainder.match(/^(?:public|authenticated)\/avatars\/(.+)$/);
      if (!match) {
        setProfileImage(storedUrl);
        return;
      }

      const path = decodeURIComponent(match[1]);
      const signedUrl = await getSignedImageUrl('avatars', path);
      setProfileImage(signedUrl ?? null);
    } catch {
      setProfileImage(storedUrl);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfileImage();
    }, [loadProfileImage])
  );

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
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefresh = () => {
      if (!active) return;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void loadUnreadMessages();
      }, 100);
    };

    scheduleRefresh();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      scheduleRefresh();
      void loadProfileImage();
    });

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;

      // Ensure any stale channel with the same topic is removed before creating a new one.
      await supabase.removeChannel(
        supabase.channel(`bottom-nav-unread-${user.id}`)
      ).catch(() => undefined);

      if (!active) return;

      channel = supabase
        .channel(`bottom-nav-unread-${user.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          scheduleRefresh
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages' },
          scheduleRefresh
        );

      channel.subscribe();

      profileChannel = supabase
        .channel(`bottom-nav-profile-${user.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          () => {
            void loadProfileImage();
          }
        );

      profileChannel.subscribe();
    };

    void setupRealtime();

    return () => {
      active = false;
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      authListener.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
      if (profileChannel) void supabase.removeChannel(profileChannel);
    };
  }, [loadProfileImage, loadUnreadMessages]);

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
      <NavItem href="/shelves" pathname={pathname} icon="book-open" onPress={() => { if (!pathname.startsWith('/shelves')) router.replace('/shelves'); }} />
      <NavItem href="/messages" pathname={pathname} icon="message-circle" badgeCount={unreadMessages} onPress={() => { if (!pathname.startsWith('/messages')) router.replace('/messages'); }} />
      <NavItem href="/explore" pathname={pathname} icon="search" onPress={() => { if (!pathname.startsWith('/explore')) router.replace('/explore'); }} />
      <NavItem href="/profile" pathname={pathname} icon="user" avatarUri={profileImage} onPress={() => { if (!pathname.startsWith('/profile')) router.replace('/profile'); }} />
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
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#20212A',
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
