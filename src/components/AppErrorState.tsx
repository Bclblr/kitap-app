import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type AppErrorStateProps = {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  fullScreen?: boolean;
  icon?: keyof typeof Feather.glyphMap;
};

export default function AppErrorState({
  title = 'Bir şeyler ters gitti',
  message,
  actionLabel = 'Tekrar Dene',
  onAction,
  busy = false,
  fullScreen = false,
  icon = 'alert-circle',
}: AppErrorStateProps) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.container, fullScreen && styles.fullScreen]}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Feather name={icon} size={24} color="#A985FF" />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onAction}
            style={({ pressed }) => [
              styles.button,
              (pressed || busy) && styles.buttonPressed,
            ]}
          >
            <Feather name="refresh-cw" size={15} color="#FFFFFF" />
            <Text style={styles.buttonText}>{busy ? 'Yenileniyor...' : actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0A0A0E',
  },
  card: {
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#302342',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21182F',
    marginBottom: 12,
  },
  title: {
    color: '#F5F5F8',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: '#A9A9B6',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  button: {
    marginTop: 18,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: '#6C3CC5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
