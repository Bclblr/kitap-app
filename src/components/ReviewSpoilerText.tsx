import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';

type Props = {
  text: string;
  containsSpoiler?: boolean;
  title?: string | null;
  topic?: string | null;
  tags?: string[] | null;
  textStyle?: TextStyle | TextStyle[];
  containerStyle?: ViewStyle | ViewStyle[];
};

export default function ReviewSpoilerText({
  text,
  containsSpoiler = false,
  title,
  topic,
  tags,
  textStyle,
  containerStyle,
}: Props) {
  const [revealed, setRevealed] = useState(!containsSpoiler);
  const normalizedTags = Array.isArray(tags) ? tags.filter(Boolean) : [];

  return (
    <View style={containerStyle}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      {topic || normalizedTags.length ? (
        <View style={styles.metaRow}>
          {topic ? <Text style={styles.topic}>{topic}</Text> : null}
          {normalizedTags.slice(0, 6).map((tag) => (
            <Text key={tag} style={styles.tag}>#{String(tag).replace(/^#/, '')}</Text>
          ))}
        </View>
      ) : null}

      {containsSpoiler && !revealed ? (
        <View style={styles.warning}>
          <View style={styles.warningTitleRow}>
            <Feather name="alert-triangle" size={16} color="#F2B36C" />
            <Text style={styles.warningTitle}>Spoiler içeren inceleme</Text>
          </View>
          <Text style={styles.warningText}>
            İnceleme metni spoiler içerdiği için gizlendi.
          </Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              setRevealed(true);
            }}
            style={styles.revealButton}
            accessibilityRole="button"
            accessibilityLabel="Spoiler içeriğini göster"
          >
            <Feather name="eye" size={15} color="#D8C8FF" />
            <Text style={styles.revealText}>İncelemeyi göster</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={textStyle}>{text}</Text>
          {containsSpoiler ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                setRevealed(false);
              }}
              style={styles.hideButton}
              accessibilityRole="button"
              accessibilityLabel="Spoiler içeriğini yeniden gizle"
            >
              <Feather name="eye-off" size={14} color="#A9AFBB" />
              <Text style={styles.hideText}>Spoileri yeniden gizle</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#F5F5F8',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 7,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 9,
  },
  topic: {
    color: '#D8C8FF',
    backgroundColor: '#21182F',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  tag: {
    color: '#A9AFBB',
    backgroundColor: '#17171F',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
  },
  warning: {
    borderWidth: 1,
    borderColor: '#5C4730',
    backgroundColor: '#1C1712',
    borderRadius: 13,
    padding: 13,
  },
  warningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  warningTitle: {
    color: '#F2D2A8',
    fontSize: 14,
    fontWeight: '800',
  },
  warningText: {
    marginTop: 7,
    color: '#B9AA98',
    fontSize: 12,
    lineHeight: 18,
  },
  revealButton: {
    marginTop: 11,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    backgroundColor: '#2A2038',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  revealText: {
    color: '#D8C8FF',
    fontSize: 12,
    fontWeight: '800',
  },
  hideButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hideText: {
    color: '#A9AFBB',
    fontSize: 11,
    fontWeight: '700',
  },
});
