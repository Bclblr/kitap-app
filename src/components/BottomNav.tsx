import { Link, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.bottomBar}>
      <Link href="/" style={styles.tab}>
        <Text style={[styles.icon, pathname === '/' && styles.activeIcon]}>🏠</Text>
        <Text style={[styles.label, pathname === '/' && styles.activeLabel]}>
          Ana Sayfa
        </Text>
      </Link>

      <Link href="/explore" style={styles.tab}>
        <Text style={[styles.icon, pathname === '/explore' && styles.activeIcon]}>
          🔍
        </Text>
        <Text style={[styles.label, pathname === '/explore' && styles.activeLabel]}>
          Keşfet
        </Text>
      </Link>

      <Link href="/read" style={styles.tab}>
        <Text style={[styles.icon, pathname === '/read' && styles.activeIcon]}>📖</Text>
        <Text style={[styles.label, pathname === '/read' && styles.activeLabel]}>
          Oku
        </Text>
      </Link>

      <Link href="/notifications" style={styles.tab}>
        <Text
          style={[
            styles.icon,
            pathname === '/notifications' && styles.activeIcon,
          ]}
        >
          🔔
        </Text>
        <Text
          style={[
            styles.label,
            pathname === '/notifications' && styles.activeLabel,
          ]}
        >
          Bildirimler
        </Text>
      </Link>

      <Link href="/profile" style={styles.tab}>
        <Text style={[styles.icon, pathname === '/profile' && styles.activeIcon]}>
          👤
        </Text>
        <Text style={[styles.label, pathname === '/profile' && styles.activeLabel]}>
          Profil
        </Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    height: 88,
    backgroundColor: '#0B0B0F',
    borderTopWidth: 1,
    borderTopColor: '#24242B',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 7,
  },

  tab: {
    flex: 1,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
  },

  icon: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 4,
  },

  label: {
    marginTop: 1,
    textAlign: 'center',
    color: '#8B8B92',
    fontSize: 10,
    fontWeight: '600',
  },

  activeIcon: {
    transform: [{ scale: 1.08 }],
  },

  activeLabel: {
    color: '#A985FF',
    fontWeight: '800',
  },
});
