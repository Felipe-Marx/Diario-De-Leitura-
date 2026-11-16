import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getBooks,
  updateCustomCover,
  type Book,
  type BookStatus,
} from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';
import { useReaderProfile } from '@/providers/reader-profile';
import { saveImagePermanently } from '@/services/local-images';

type Filter = 'todos' | BookStatus;

const palette = {
  paper: '#FFFEFA',
  ink: '#282D25',
  muted: '#777B70',
  green: '#48654B',
  line: '#E9E5DA',
};

const defaultProfile = {
  display_name: 'Pessoa leitora',
  avatar_uri: null,
  theme_key: 'classic',
  annual_goal: 12,
  reader_term: 'neutral' as const,
};

const filterOptions: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'lendo', label: 'Lendo' },
  { key: 'quero_ler', label: 'Quero ler' },
  { key: 'concluido', label: 'Lidos' },
];

function ShortcutIcon({ kind, color, background, border }: { kind: 'map' | 'clock' | 'shelf'; color: string; background: string; border: string }) {
  return (
    <View style={[styles.shortcutIconFrame, { backgroundColor: background, borderColor: border }]}>
      {kind === 'map' ? <View style={styles.mapGlyph}>{Array.from({ length: 9 }, (_, index) => <View key={index} style={[styles.mapCell, { backgroundColor: color, opacity: [0.35, 0.62, 0.9, 0.52, 1, 0.72, 0.82, 0.46, 0.65][index] }]} />)}</View> : null}
      {kind === 'clock' ? <View style={[styles.clockGlyph, { borderColor: color }]}><View style={[styles.clockHand, styles.clockHourHand, { backgroundColor: color }]} /><View style={[styles.clockHand, styles.clockMinuteHand, { backgroundColor: color }]} /><View style={[styles.clockCenter, { backgroundColor: color }]} /></View> : null}
      {kind === 'shelf' ? <View style={styles.shelfGlyph}>{[17, 22, 19].map((height, index) => <View key={index} style={[styles.shelfBookGlyph, { height, backgroundColor: color, opacity: [0.58, 1, 0.76][index] }]} />)}</View> : null}
    </View>
  );
}

function ShortcutArrow({ color, background, border }: { color: string; background: string; border: string }) {
  return <View style={[styles.arrowFrame, { backgroundColor: background, borderColor: border }]}><Text style={[styles.arrowGlyph, { color }]}>›</Text></View>;
}

export default function HomeScreen() {
  const database = useSQLiteContext();
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('todos');
  const [selectedYear, setSelectedYear] = useState<number | null>(new Date().getFullYear());
  const { profile: cachedProfile, loading: profileLoading } = useReaderProfile();
  const profile = cachedProfile ?? defaultProfile;
  const theme = getReaderTheme(profile.theme_key);

  useFocusEffect(useCallback(() => {
    let active = true;
    void getBooks(database)
      .then((savedBooks) => { if (active) setBooks(savedBooks); })
      .catch(() => {})
      .finally(() => { if (active) setBooksLoaded(true); });
    return () => { active = false; };
  }, [database]));

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    for (const book of books) {
      for (const value of [book.started_at, book.completed_at]) {
        if (value && /^\d{4}-/.test(value)) years.add(Number(value.slice(0, 4)));
      }
    }
    return [...years].sort((a, b) => b - a);
  }, [books]);
  const yearBooks = useMemo(() => selectedYear === null ? books : books.filter((book) => {
    const relevantDate = book.completed_at ?? book.started_at;
    return relevantDate?.slice(0, 4) === String(selectedYear);
  }), [books, selectedYear]);
  const visibleBooks = useMemo(
    () => (filter === 'todos' ? yearBooks : yearBooks.filter((book) => book.status === filter)),
    [yearBooks, filter],
  );
  const readingCount = yearBooks.filter((book) => book.status === 'lendo').length;
  const finishedCount = books.filter((book) => book.status === 'concluido' && (selectedYear === null || book.completed_at?.slice(0, 4) === String(selectedYear))).length;

  function handleCoverMenu(book: Book) {
    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      { text: 'Escolher foto do aparelho', onPress: () => void pickCustomCover(book) },
    ];
    if (book.custom_cover_uri) {
      actions.push({
        text: book.google_cover_uri ? 'Voltar à capa do Google' : 'Remover foto personalizada',
        onPress: async () => {
          await updateCustomCover(database, book.id, null);
          setBooks(await getBooks(database));
        },
      });
    }
    actions.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Personalizar capa', `Escolha a imagem para “${book.title}”.`, actions);
  }

  async function pickCustomCover(book: Book) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [2, 3], quality: 0.9 });
      if (result.canceled || !result.assets[0]) return;
      await updateCustomCover(database, book.id, await saveImagePermanently(result.assets[0].uri, `book-cover-${book.id}`));
      setBooks(await getBooks(database));
    } catch { Alert.alert('Não foi possível salvar a capa', 'Tente escolher outra imagem.'); }
  }

  function renderBook({ item }: { item: Book }) {
    const coverUri = item.custom_cover_uri ?? item.google_cover_uri;
    return (
      <Pressable onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(item.id) } })} onLongPress={() => handleCoverMenu(item)} accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}; mantenha pressionado para personalizar a capa`} style={styles.coverTile}>
        {coverUri ? <Image source={{ uri: coverUri }} style={[styles.coverImage, { borderRadius: theme.cardRadius }]} contentFit="cover" cachePolicy="disk" recyclingKey={coverUri} /> : <View style={[styles.coverImage, styles.coverPlaceholder, { backgroundColor: theme.soft, borderRadius: theme.cardRadius }]}><Text style={[styles.coverMark, { color: theme.accent }]}>✳</Text></View>}
      </Pressable>
    );
  }

  if (profileLoading || !cachedProfile) {
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color="#777B70" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <FlatList
        data={[]}
        contentContainerStyle={styles.listContent}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={7}
        ListHeaderComponent={
          <View>
            <View style={styles.topline}>
              <Text pointerEvents="none" style={[styles.heroDecoration, { color: theme.accent }]}>{theme.symbol}</Text>
              <View>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>OLÁ, {(profile.display_name === 'Pessoa leitora'
                  ? profile.reader_term === 'masculine' ? 'LEITOR' : profile.reader_term === 'feminine' ? 'LEITORA' : 'PESSOA LEITORA'
                  : profile.display_name).toLocaleUpperCase('pt-BR')} {theme.symbol}</Text>
                <Text style={[styles.heading, { color: theme.ink, fontFamily: theme.headingFont }]}>Entre páginas,{ '\n' }<Text style={{ color: theme.accent, fontStyle: 'italic' }}>um mundo seu.</Text></Text>
                <Text style={[styles.shelfCaption, { color: theme.muted }]}>{selectedYear === null ? 'Todos os anos' : `Estante ${selectedYear}`} · {yearBooks.length} {yearBooks.length === 1 ? 'livro' : 'livros'}</Text>
                <Text style={[styles.ornament, { color: theme.accent }]}>{theme.ornament}</Text>
              </View>
              <Pressable onPress={() => router.push('/profile')} style={[styles.headerIcon, { backgroundColor: theme.soft, borderColor: theme.line }]} accessibilityRole="button" accessibilityLabel="Abrir perfil">
                {profile.avatar_uri ? <Image source={{ uri: profile.avatar_uri }} style={styles.headerAvatar} contentFit="cover" cachePolicy="memory-disk" /> : <Text style={[styles.headerIconText, { color: theme.accent }]}>{profile.display_name.trim().charAt(0).toUpperCase() || 'L'}</Text>}
              </Pressable>
            </View>
            <View style={[styles.summary, { backgroundColor: theme.accent }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNumber, { color: theme.buttonText }]}>{readingCount}</Text>
                <Text style={[styles.summaryLabel, { color: theme.buttonText, opacity: 0.82 }]}>em leitura</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNumber, { color: theme.buttonText }]}>{finishedCount}</Text>
                <Text style={[styles.summaryLabel, { color: theme.buttonText, opacity: 0.82 }]}>{selectedYear === null ? 'total de livros concluídos' : `${selectedYear} · meta de ${profile.annual_goal}`}</Text>
              </View>
              <Text style={[styles.summaryFlower, { color: theme.buttonText }]}>{theme.symbol}</Text>
            </View>
            <View style={styles.shortcutList}>
              <Pressable accessibilityRole="button" accessibilityLabel="Abrir estatísticas e mapa de leitura" onPress={() => router.push('/stats')} style={[styles.shortcutCard, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
                <ShortcutIcon kind="map" color={theme.accent} background={theme.soft} border={theme.line} />
                <View style={styles.statisticsCopy}><Text style={[styles.statisticsTitle, { color: theme.ink }]}>Seu mapa de leitura</Text><Text style={[styles.statisticsSubtitle, { color: theme.muted }]}>Páginas por dia e estatísticas do ano</Text></View>
                <ShortcutArrow color={theme.accent} background={theme.soft} border={theme.line} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/in-progress')} style={[styles.shortcutCard, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
                <ShortcutIcon kind="clock" color={theme.accent} background={theme.soft} border={theme.line} />
                <View style={styles.statisticsCopy}><Text style={[styles.statisticsTitle, { color: theme.ink }]}>Em andamento</Text><Text style={[styles.statisticsSubtitle, { color: theme.muted }]}>Continue de onde você parou</Text></View>
                <ShortcutArrow color={theme.accent} background={theme.soft} border={theme.line} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/shelves')} style={[styles.shortcutCard, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
                <ShortcutIcon kind="shelf" color={theme.accent} background={theme.soft} border={theme.line} />
                <View style={styles.statisticsCopy}><Text style={[styles.statisticsTitle, { color: theme.ink }]}>Suas estantes</Text><Text style={[styles.statisticsSubtitle, { color: theme.muted }]}>Organize os livros em coleções</Text></View>
                <ShortcutArrow color={theme.accent} background={theme.soft} border={theme.line} />
              </Pressable>
            </View>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.ink }]}>Livros</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>Suas próximas histórias</Text>
              </View>
              <Pressable style={[styles.addButton, { backgroundColor: theme.accent, borderRadius: theme.cardRadius }]} onPress={() => router.push('/add-book')} accessibilityRole="button">
                <Text style={[styles.addButtonText, { color: theme.buttonText }]}>＋  Adicionar</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Pressable onPress={() => setSelectedYear(null)} style={[styles.filterChip, { backgroundColor: selectedYear === null ? theme.soft : theme.paper, borderColor: theme.line }]}>
                <Text style={[styles.filterText, { color: selectedYear === null ? theme.accent : theme.muted, fontWeight: selectedYear === null ? '700' : '500' }]}>Todos os anos</Text>
              </Pressable>
              {availableYears.map((year) => (
                <Pressable key={year} onPress={() => setSelectedYear(year)} style={[styles.filterChip, { backgroundColor: selectedYear === year ? theme.soft : theme.paper, borderColor: theme.line }]}>
                  <Text style={[styles.filterText, { color: selectedYear === year ? theme.accent : theme.muted, fontWeight: selectedYear === year ? '700' : '500' }]}>{year}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {filterOptions.map((option) => (
                <Pressable key={option.key} onPress={() => setFilter(option.key)} style={[styles.filterChip, { backgroundColor: filter === option.key ? theme.soft : theme.paper, borderColor: theme.line }]}>
                  <Text style={[styles.filterText, { color: filter === option.key ? theme.accent : theme.muted, fontWeight: filter === option.key ? '700' : '500' }]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.coverHint, { color: theme.muted }]}>Toque em uma capa para abrir o livro. Mantenha pressionado para personalizá-la.</Text>
            {visibleBooks.length > 0 ? <FlatList
              horizontal
              data={visibleBooks}
              keyExtractor={(book) => String(book.id)}
              renderItem={renderBook}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.coverRail}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
            /> : booksLoaded ? <View style={styles.emptyState}>
              <Text style={[styles.emptyIcon, { color: theme.accent }]}>{theme.symbol}</Text>
              <Text style={[styles.emptyTitle, { color: theme.ink }]}>{books.length === 0 ? 'Sua estante começa aqui' : 'Nada por aqui ainda'}</Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>{books.length === 0 ? 'Adicione um livro para começar.' : 'Escolha outro filtro para ver seus livros.'}</Text>
            </View> : null}
          </View>
        }
        ListEmptyComponent={<View style={{ height: booksLoaded ? 0 : 44, alignItems: 'center', justifyContent: 'center' }}>{!booksLoaded && <ActivityIndicator color={theme.accent} />}</View>}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 22, paddingBottom: 38 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 14, paddingBottom: 22, position: 'relative' },
  heroDecoration: { position: 'absolute', right: 58, top: -7, fontSize: 76, lineHeight: 84, opacity: 0.09 },
  eyebrow: { color: palette.green, fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  heading: { color: palette.ink, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.7, marginTop: 12 },
  shelfCaption: { color: palette.muted, fontSize: 11, letterSpacing: 0.2, marginTop: 9 },
  ornament: { fontSize: 12, letterSpacing: 2, marginTop: 7 },
  headerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 8, overflow: 'hidden', borderWidth: 1 },
  headerIconText: { fontSize: 19, fontWeight: '700' },
  headerAvatar: { width: 48, height: 48, borderRadius: 24 },
  summary: { backgroundColor: palette.green, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 21, flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  summaryItem: { minWidth: 90 },
  summaryNumber: { color: '#FFFDF6', fontSize: 25, fontWeight: '700' },
  summaryLabel: { color: '#DCE5D8', fontSize: 12, marginTop: 2 },
  summaryDivider: { width: 1, height: 37, backgroundColor: '#82927D', marginHorizontal: 18 },
  summaryFlower: { color: '#D8B276', fontSize: 31, marginLeft: 'auto' },
  shortcutList: { gap: 10, marginBottom: 25 },
  shortcutCard: { minHeight: 76, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shortcutIconFrame: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mapGlyph: { width: 23, height: 23, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  mapCell: { width: 5.5, height: 5.5, borderRadius: 1.5 },
  clockGlyph: { width: 23, height: 23, borderWidth: 1.8, borderRadius: 12, position: 'relative' },
  clockHand: { position: 'absolute', width: 1.8, borderRadius: 1, left: 10.6 },
  clockHourHand: { height: 7, top: 4 }, clockMinuteHand: { height: 7, top: 8, transform: [{ rotate: '42deg' }] },
  clockCenter: { position: 'absolute', width: 3, height: 3, borderRadius: 2, left: 10, top: 10 },
  shelfGlyph: { height: 23, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  shelfBookGlyph: { width: 5, borderRadius: 1.5 },
  arrowFrame: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  arrowGlyph: { fontSize: 21, lineHeight: 24, marginTop: -1 },
  statisticsCopy: { flex: 1, gap: 4 },
  statisticsTitle: { fontSize: 12, fontWeight: '700' },
  statisticsSubtitle: { fontSize: 10 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 },
  sectionTitle: { color: palette.ink, fontSize: 21, fontWeight: '700', letterSpacing: -0.4 },
  sectionSubtitle: { color: palette.muted, fontSize: 12, marginTop: 4 },
  addButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  filters: { gap: 8, paddingBottom: 17 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  filterText: { color: palette.muted, fontSize: 12, fontWeight: '500' },
  filterTextActive: { color: palette.green, fontWeight: '700' },
  coverHint: { fontSize: 10, marginTop: -6, marginBottom: 12 },
  coverRail: { gap: 12, paddingBottom: 12 },
  coverTile: { width: 112, height: 164, borderRadius: 10, backgroundColor: '#E8D8C1', overflow: 'hidden', borderLeftWidth: 4, borderLeftColor: '#D0B998' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverMark: { fontSize: 28 },
  emptyState: { alignItems: 'center', paddingHorizontal: 25, paddingVertical: 38 },
  emptyIcon: { color: '#9AA58F', fontSize: 35, marginBottom: 12 },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  emptyText: { color: palette.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 7 },
});
