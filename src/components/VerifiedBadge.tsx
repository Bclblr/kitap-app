import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

export default function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityLabel="Doğrulanmış hesap"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4C83FF',
        flexShrink: 0,
      }}
    >
      <Feather name="check" size={Math.max(9, Math.round(size * 0.62))} color="#FFFFFF" />
    </View>
  );
}
