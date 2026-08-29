import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
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
    </Stack>
  );
}