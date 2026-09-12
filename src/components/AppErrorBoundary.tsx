import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uygulama arayüz hatası:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container} accessibilityRole="alert">
        <View style={styles.card}>
          <Text style={styles.icon}>!</Text>
          <Text style={styles.title}>Bir şeyler ters gitti</Text>
          <Text style={styles.description}>
            Bu ekran beklenmedik bir hata nedeniyle açılamadı. Tekrar deneyebilirsin.
          </Text>
          <Pressable
            onPress={this.reset}
            accessibilityRole="button"
            accessibilityLabel="Ekranı tekrar yükle"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0E',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#302342',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
  },
  icon: {
    color: '#A985FF',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 10,
  },
  title: {
    color: '#F5F5F8',
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    color: '#A9A9B6',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 9,
  },
  button: {
    marginTop: 18,
    minHeight: 46,
    minWidth: 140,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#6C3CC5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
