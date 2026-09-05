import { Stack } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#0A0A0E' }}><Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="explore" />
      <Stack.Screen name="shelves" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="review" />
    </Stack></SafeAreaView></SafeAreaProvider>
  );
}
