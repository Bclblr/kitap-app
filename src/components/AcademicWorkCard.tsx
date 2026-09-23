import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { AcademicWork, academicAuthorLine } from '@/lib/academic';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  work: AcademicWork;
  onPress: () => void;
  compact?: boolean;
};

export default function AcademicWorkCard({ work, onPress, compact = false }: Props) {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.iconWrap}>
        <Feather name="file-text" size={18} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={compact ? 2 : 3}>{work.title}</Text>
        <Text style={styles.authors} numberOfLines={2}>{academicAuthorLine(work)}</Text>
        <View style={styles.metaRow}>
          {work.publicationYear ? <Text style={styles.meta}>{work.publicationYear}</Text> : null}
          {work.journal?.name ? <Text style={styles.meta} numberOfLines={1}>{work.journal.name}</Text> : null}
          <Text style={styles.meta}>{work.citedByCount} atıf</Text>
          {work.isOpenAccess ? <Text style={styles.openAccess}>Açık erişim</Text> : null}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2B34',
    backgroundColor: '#111218',
    padding: 14,
    marginBottom: 10,
  },
  compactCard: {
    paddingVertical: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#231B34',
    borderWidth: 1,
    borderColor: '#3B2B56',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#F2F2F5', fontSize: 14, fontWeight: '800', lineHeight: 20 },
  authors: { color: '#A4A5AE', fontSize: 11, lineHeight: 16, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 7 },
  meta: { color: '#767985', fontSize: 10, fontWeight: '700', maxWidth: 150 },
  openAccess: { color: '#71C89A', fontSize: 10, fontWeight: '800' },
});
