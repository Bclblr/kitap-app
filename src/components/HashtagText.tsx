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
  const { colors } = useAppTheme();
  const parts = text.split(HASHTAG_REGEX);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (!part.startsWith('#')) {
          return part;
        }

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
            style={{ color: colors.primary, fontWeight: '700' }}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
