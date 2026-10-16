import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';

import {
  advancePage,
  deleteBook,
  getBooks,
  getReaderProfile,
  startBook,
  updateCustomCover,
  type Book,
  type BookStatus,
  type ReaderProfile,
} from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';
import { saveImagePermanently } from '@/services/local-images';

type Filter = 'todos' | BookStatus;

const palette = {
  paper: '#FFFEFA',
  ink: '#282D25',
  muted: '#777B70',
  green: '#48654B',
  line: '#E9E5DA',
};

const filterOptions: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'lendo', label: 'Lendo' },
  { key: 'quero_ler', label: 'Quero ler' },
  { key: 'concluido', label: 'Lidos' },
];

function statusLabel(status: BookStatus) {
  if (status === 'lendo') return 'EM LEITURA';
  if (status === 'concluido') return 'CONCLUÍDO';
  return 'NA LISTA';
}

export default function HomeScreen() {
  const database = useSQLiteContext();
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<Filter>('todos');
  const [profile, setProfile] = useState<ReaderProfile>({
    display_name: 'Pessoa leitora',
    avatar_uri: null,
    theme_key: 'classic',
    annual_goal: 12,
    reader_term: 'neutral',
  });
  const theme = getReaderTheme(profile.theme_key);

  useFocusEffect(useCallback(() => {
    void Promise.all([getBooks(database), getReaderProfile(database)]).then(([savedBooks, savedProfile]) => {
      setBooks(savedBooks);
      if (savedProfile) setProfile(savedProfile);
    });
  }, [database]));

  const visibleBooks = useMemo(
    () => (filter === 'todos' ? books : books.filter((book) => book.status === filter)),
    [books, filter],
  );
  const readingCount = books.filter((book) => book.status === 'lendo').length;
  const finishedCount = books.filter((book) => book.status === 'concluido').length;

  function confirmDelete(book: Book) {
    Alert.alert('Remover livro?', `“${book.title}” será retirado da sua estante.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deleteBook(database, book.id);
          setBooks(await getBooks(database));
        },
      },
    ]);
  }

  async function updateBook(book: Book, action: 'start' | 'advance') {
    if (action === 'start') await startBook(database, book.id);
    else await advancePage(database, book);
    setBooks(await getBooks(database));
  }

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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [2, 3],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const imageUri = await saveImagePermanently(result.assets[0].uri, `book-cover-${book.id}`);
      await updateCustomCover(database, book.id, imageUri);
      setBooks(await getBooks(database));
    } catch {
      Alert.alert('Não foi possível salvar a capa', 'Tente escolher outra imagem.');
    }
  }

  function renderBook({ item }: { item: Book }) {
    const progress = Math.round((item.current_page / item.total_pages) * 100);
    return (
      <View style={[styles.bookCard, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
        <View style={styles.bookTop}>
          <View style={styles.coverColumn}>
            <Pressable style={styles.cover} onPress={() => handleCoverMenu(item)} accessibilityLabel={`Personalizar capa de ${item.title}`}>
              {item.custom_cover_uri || item.google_cover_uri ? (
                <Image source={{ uri: item.custom_cover_uri ?? item.google_cover_uri ?? undefined }} style={styles.coverImage} />
              ) : <Text style={[styles.coverMark, { color: theme.accent }]}>✳</Text>}
            </Pressable>
            <Pressable onPress={() => handleCoverMenu(item)}><Text style={[styles.coverEdit, { color: theme.accent }]}>capa</Text></Pressable>
          </View>
          <View style={styles.bookInfo}>
            <Text style={[styles.bookTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>{item.title}</Text>
            <Text style={[styles.author, { color: theme.muted }]}>{item.author}</Text>
            {item.google_volume_id && item.google_info_link && (
              <Pressable onPress={() => void Linking.openURL(item.google_info_link as string)}>
                <Text style={[styles.googleBookLink, { color: theme.accent }]}>Google Books ↗</Text>
              </Pressable>
            )}
            <Text style={[styles.status, { color: theme.accent }]}>{statusLabel(item.status)}</Text>
          </View>
          <Pressable accessibilityLabel={`Remover ${item.title}`} onPress={() => confirmDelete(item)} hitSlop={10}>
            <Text style={[styles.remove, { color: theme.muted }]}>×</Text>
          </Pressable>
        </View>
        {item.status !== 'quero_ler' && (
          <View style={styles.progressArea}>
            <View style={styles.progressMeta}>
              <Text style={[styles.progressText, { color: theme.muted }]}>{item.current_page} de {item.total_pages} páginas</Text>
              <Text style={[styles.progressText, { color: theme.muted }]}>{progress}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.soft }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} />
            </View>
          </View>
        )}
        {item.status !== 'concluido' && (
          <Pressable
            accessibilityRole="button"
            style={[styles.bookAction, { borderTopColor: theme.line }]}
            onPress={() => void updateBook(item, item.status === 'quero_ler' ? 'start' : 'advance')}>
            <Text style={[styles.bookActionText, { color: theme.accent }]}>
              {item.status === 'quero_ler' ? 'Começar leitura' : '+ Registrar uma página'}
            </Text>
            <Text style={[styles.actionArrow, { color: theme.accent }]}>→</Text>
          </Pressable>
        )}
        {item.status === 'concluido' && <Text style={[styles.finishedNote, { color: theme.accent }]}>Uma história a mais na memória ✨</Text>}
        <Pressable style={[styles.notesLink, { borderTopColor: theme.line }]} onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(item.id) } })}>
          <Text style={[styles.notesLinkText, { color: theme.accent }]}>✎  Minhas anotações</Text>
          <Text style={[styles.actionArrow, { color: theme.accent }]}>→</Text>
        </Pressable>
        <Pressable style={[styles.editLink, { borderTopColor: theme.line }]} onPress={() => router.push({ pathname: '/book/edit/[id]', params: { id: String(item.id) } })}>
          <Text style={[styles.notesLinkText, { color: theme.muted }]}>Editar livro e progresso</Text>
          <Text style={[styles.actionArrow, { color: theme.muted }]}>→</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <FlatList
        data={visibleBooks}
        keyExtractor={(book) => String(book.id)}
        renderItem={renderBook}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.topline}>
              <Text pointerEvents="none" style={[styles.heroDecoration, { color: theme.accent }]}>{theme.symbol}</Text>
              <View>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>OLÁ, {(profile.display_name === 'Pessoa leitora'
                  ? profile.reader_term === 'masculine' ? 'LEITOR' : profile.reader_term === 'feminine' ? 'LEITORA' : 'PESSOA LEITORA'
                  : profile.display_name).toLocaleUpperCase('pt-BR')} {theme.symbol}</Text>
                <Text style={[styles.heading, { color: theme.ink, fontFamily: theme.headingFont }]}>Entre páginas,{ '\n' }<Text style={{ color: theme.accent, fontStyle: 'italic' }}>um mundo seu.</Text></Text>
                <Text style={[styles.shelfCaption, { color: theme.muted }]}>Sua estante · {books.length} {books.length === 1 ? 'livro' : 'livros'}</Text>
                <Text style={[styles.ornament, { color: theme.accent }]}>{theme.ornament}</Text>
              </View>
              <Pressable onPress={() => router.push('/profile')} style={[styles.headerIcon, { backgroundColor: theme.soft, borderColor: theme.line }]} accessibilityRole="button" accessibilityLabel="Abrir perfil">
                {profile.avatar_uri ? <Image source={{ uri: profile.avatar_uri }} style={styles.headerAvatar} /> : <Text style={[styles.headerIconText, { color: theme.accent }]}>{profile.display_name.trim().charAt(0).toUpperCase() || 'L'}</Text>}
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
                <Text style={[styles.summaryLabel, { color: theme.buttonText, opacity: 0.82 }]}>de {profile.annual_goal} na meta</Text>
              </View>
              <Text style={[styles.summaryFlower, { color: theme.buttonText }]}>{theme.symbol}</Text>
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
              {filterOptions.map((option) => (
                <Pressable key={option.key} onPress={() => setFilter(option.key)} style={[styles.filterChip, { backgroundColor: filter === option.key ? theme.soft : theme.paper, borderColor: theme.line }]}>
                  <Text style={[styles.filterText, { color: filter === option.key ? theme.accent : theme.muted, fontWeight: filter === option.key ? '700' : '500' }]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyIcon, { color: theme.accent }]}>{theme.symbol}</Text>
            <Text style={[styles.emptyTitle, { color: theme.ink }]}>{books.length === 0 ? 'Sua estante começa aqui' : 'Nada por aqui ainda'}</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              {books.length === 0 ? 'Adicione o livro que está lendo ou quer ler.' : 'Escolha outro filtro para ver seus livros.'}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 },
  sectionTitle: { color: palette.ink, fontSize: 21, fontWeight: '700', letterSpacing: -0.4 },
  sectionSubtitle: { color: palette.muted, fontSize: 12, marginTop: 4 },
  addButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  filters: { gap: 8, paddingBottom: 17 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  filterText: { color: palette.muted, fontSize: 12, fontWeight: '500' },
  filterTextActive: { color: palette.green, fontWeight: '700' },
  bookCard: { backgroundColor: palette.paper, borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#F0EDE4' },
  bookTop: { flexDirection: 'row', alignItems: 'flex-start' },
  coverColumn: { alignItems: 'center', gap: 2 },
  cover: { width: 48, height: 65, borderRadius: 6, backgroundColor: '#E8D8C1', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 4, borderLeftColor: '#D0B998', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverEdit: { fontSize: 8, fontWeight: '700' },
  coverMark: { color: '#9B7653', fontSize: 22 },
  bookInfo: { flex: 1, paddingLeft: 13, paddingTop: 2 },
  bookTitle: { color: palette.ink, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  author: { color: palette.muted, fontSize: 12, marginTop: 4 },
  googleBookLink: { color: palette.green, fontSize: 9, fontWeight: '700', marginTop: 5 },
  status: { color: palette.green, fontSize: 9, letterSpacing: 1, fontWeight: '700', marginTop: 9 },
  remove: { color: '#A6A79D', fontSize: 24, lineHeight: 24, paddingHorizontal: 4 },
  progressArea: { marginTop: 15 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  progressText: { color: palette.muted, fontSize: 11 },
  progressTrack: { height: 5, borderRadius: 4, backgroundColor: '#EAE8DF', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: palette.green, borderRadius: 4 },
  bookAction: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookActionText: { fontSize: 12, fontWeight: '700' },
  actionArrow: { fontSize: 17 },
  finishedNote: { fontSize: 11, marginTop: 14, fontStyle: 'italic' },
  notesLink: { marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: palette.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLink: { marginTop: 9, paddingTop: 10, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notesLinkText: { fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingHorizontal: 25, paddingVertical: 38 },
  emptyIcon: { color: '#9AA58F', fontSize: 35, marginBottom: 12 },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  emptyText: { color: palette.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 7 },
});
