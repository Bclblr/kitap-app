import { PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
export function ReaderScreen({ title, children }: PropsWithChildren<{ title: string }>) {
  const router = useRouter();
  return <SafeAreaView edges={['bottom']} style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={ui.header}><Action label="Geri" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} /><Text style={[ui.title, { flex: 1 }]}>{title}</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>{children}</ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
export function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[ui.button, disabled && { opacity: .45 }]}><Text style={ui.text}>{label}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={ui.muted}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#92929F" keyboardAppearance="dark" {...props} style={[ui.input, props.multiline && { minHeight: 100, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function Busy() { return <ActivityIndicator color="#A985FF" style={{ padding: 20 }} />; }
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0E' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, gap: 16, paddingBottom: 40 },
  title: { color: '#F5F5F8', fontSize: 23, fontWeight: '700', flexShrink: 1 },
  text: { color: '#F5F5F8', fontSize: 15, flexShrink: 1 },
  muted: { color: '#A5A5B3', fontSize: 14, flexShrink: 1 },
  error: { color: '#FFB2B2', fontSize: 14 },
  input: { backgroundColor: '#17171F', borderColor: '#333340', borderWidth: 1, borderRadius: 12, padding: 12, color: '#FFF', minHeight: 48, width: '100%' },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#302246', alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  card: { backgroundColor: '#15151D', borderColor: '#292934', borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, minWidth: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
});
