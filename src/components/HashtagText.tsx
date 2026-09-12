import { useAppTheme } from '@/providers/ThemeProvider';
import { useRouter } from 'expo-router';
import { StyleProp, Text, TextStyle } from 'react-native';

type HashtagTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
};

const HASHTAG_REGEX = /(#[A-Za-z0-9_À-ÖØ-öø-ÿÇĞİÖŞÜçğıöşü]+)/g;

export default function HashtagText({ text, style }: HashtagTextProps) {
  const router = useRouter();
  const { scheme } = useAppTheme();
  const parts = text.split(HASHTAG_REGEX);

  // Hashtag rengi parent Text stilinden bağımsız, doğrudan tema rengine sabitlenir.
  // Böylece özellikle React Native Web'de üst metnin gri rengi etiketi ezemez.
  const hashtagStyle: TextStyle = {
    color: scheme === 'dark' ? '#A985FF' : '#6C3CC5',
    fontWeight: '800',
  };

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (!part.startsWith('#')) return part;

        const tag = part.slice(1).trim();
        if (!tag) return part;

        return (
          <Text
            key={`${part}-${index}`}
            onPress={() =>
              router.push({
                pathname: '/hashtag',
                params: { tag },
              })
            }
            accessibilityRole="link"
            accessibilityLabel={`${part} etiketini aç`}
            style={hashtagStyle}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
