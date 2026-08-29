
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function BottomNav() {
  return (
    <View style={styles.bottomBar}>
      <Link href="/" style={styles.tab}>
        <Text style={styles.icon}>🏠</Text>
        <Text style={styles.label}>Ana Sayfa</Text>
      </Link>

      <Link href="/explore" style={styles.tab}>
        <Text style={styles.icon}>🔍</Text>
        <Text style={styles.label}>Keşfet</Text>
      </Link>

      <Link href="/shelves" style={styles.tab}>
        <Text style={styles.icon}>📚</Text>
        <Text style={styles.label}>Raflarım</Text>
      </Link>

      <Link href="/notifications" style={styles.tab}>
        <Text style={styles.icon}>🔔</Text>
        <Text style={styles.label}>Bildirimler</Text>
      </Link>

      <Link href="/profile" style={styles.tab}>
        <Text style={styles.icon}>👤</Text>
        <Text style={styles.label}>Profil</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    height: 75,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 55,
  },

  icon: {
    fontSize: 21,
    textAlign: 'center',
  },

  label: {
    marginTop: 2,
    textAlign: 'center',
    color: '#777',
    fontSize: 10,
  },
});

