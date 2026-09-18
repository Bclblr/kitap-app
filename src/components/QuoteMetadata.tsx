import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title?: string | null;
  topic?: string | null;
  pageNumber?: number | null;
  note?: string | null;
};

export default function QuoteMetadata({ title, topic, pageNumber, note }: Props) {
  if (!title && !topic && !pageNumber && !note) return null;

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.metaRow}>
        {topic ? <Text style={styles.chip}>{topic}</Text> : null}
        {pageNumber ? <Text style={styles.chip}>s. {pageNumber}</Text> : null}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 7,
  },
  title: {
    color: '#F5F5F8',
    fontSize: 15,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    color: '#CFC4ED',
    backgroundColor: '#21182F',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  note: {
    color: '#A9AFBB',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
