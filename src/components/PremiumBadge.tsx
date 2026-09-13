import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

export default function PremiumBadge({ size = 16 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityLabel="Premium hesap"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8058D9',
        flexShrink: 0,
      }}
    >
      <Feather name="star" size={Math.max(9, Math.round(size * 0.6))} color="#FFFFFF" />
    </View>
  );
}
