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
import Svg, { Path } from 'react-native-svg';

import {
  getBooks,
  updateCustomCover,
  type Book,
  type BookStatus,
} from '@/db/books';
import { getReaderTheme, normalizeReaderThemeKey } from '@/constants/reader-themes';
import { ThemeSceneHeader } from '@/components/theme-scene-header';
import { ClockIcon } from '@/components/clock-icon';
import { formatRatingValue, RatingStars } from '@/components/rating-stars';
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
      {kind === 'map' ? (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 5.764v15M9 3.236v15" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
      {kind === 'clock' ? <ClockIcon color={color} /> : null}
      {kind === 'shelf' ? (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="m16 6 4 14M12 6v14M8 8v12M4 4v16" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
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
  const readerName = profile.display_name === 'Pessoa leitora'
    ? profile.reader_term === 'masculine' ? 'LEITOR' : profile.reader_term === 'feminine' ? 'LEITORA' : 'PESSOA LEITORA'
    : profile.display_name;

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
    const rating = item.rating;
    const accessibilityLabel = rating === null
      ? `Abrir ${item.title}; mantenha pressionado para personalizar a capa`
      : `Abrir ${item.title}; avaliação ${formatRatingValue(rating)} de 5 estrelas; mantenha pressionado para personalizar a capa`;
    return (
      <Pressable onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(item.id) } })} onLongPress={() => handleCoverMenu(item)} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.coverCard}>
        <View style={[styles.coverTile, { borderRadius: theme.cardRadius }]}>
          {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverImage} contentFit="cover" cachePolicy="disk" recyclingKey={coverUri} /> : <View style={[styles.coverImage, styles.coverPlaceholder, { backgroundColor: theme.soft }]}><Text style={[styles.coverMark, { color: theme.accent }]}>✳</Text></View>}
        </View>
        {rating !== null && <View pointerEvents="none" style={[styles.coverRating, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
          <RatingStars rating={rating} size={16} color="#D69E42" emptyColor={theme.line} />
          <Text style={[styles.coverRatingValue, { color: theme.ink }]}>{formatRatingValue(rating)}</Text>
        </View>}
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
            <ThemeSceneHeader
              themeKey={profile.theme_key}
              eyebrow={`OLÁ, ${readerName.toLocaleUpperCase('pt-BR')} ${theme.symbol}`}
              title={<>Entre páginas,{'\n'}<Text style={styles.homeTitleAccent}>um mundo seu.</Text></>}
              subtitle={`${selectedYear === null ? 'Todos os anos' : `Estante ${selectedYear}`} · ${yearBooks.length} ${yearBooks.length === 1 ? 'livro' : 'livros'}`}
              minHeight={208}
              titleNumberOfLines={3}
              copyMaxWidth={normalizeReaderThemeKey(profile.theme_key) === 'flowers' ? '82%' : undefined}
              titleStyle={styles.homeTitle}
              style={styles.homeScene}
              accessory={
                <Pressable onPress={() => router.push('/profile')} style={[styles.headerIcon, { backgroundColor: theme.paper, borderColor: '#FFFFFF' }]} accessibilityRole="button" accessibilityLabel="Abrir perfil">
                {profile.avatar_uri ? <Image source={{ uri: profile.avatar_uri }} style={styles.headerAvatar} contentFit="cover" cachePolicy="memory-disk" /> : <Text style={[styles.headerIconText, { color: theme.accent }]}>{profile.display_name.trim().charAt(0).toUpperCase() || 'L'}</Text>}
                </Pressable>
              }
            />
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
  homeScene: { marginTop: 12, marginBottom: 20 },
  homeTitle: { fontSize: 31, lineHeight: 37 },
  homeTitleAccent: { fontStyle: 'italic' },
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
  coverCard: { width: 112, alignItems: 'center' },
  coverTile: { width: 112, height: 164, backgroundColor: '#E8D8C1', overflow: 'hidden', borderLeftWidth: 4, borderLeftColor: '#D0B998' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverMark: { fontSize: 28 },
  coverRating: { width: '100%', minHeight: 30, marginTop: 7, paddingHorizontal: 4, paddingVertical: 4, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  coverRatingValue: { fontSize: 11, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingHorizontal: 25, paddingVertical: 38 },
  emptyIcon: { color: '#9AA58F', fontSize: 35, marginBottom: 12 },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  emptyText: { color: palette.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 7 },
});
