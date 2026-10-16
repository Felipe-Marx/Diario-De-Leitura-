import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';

import { createBook, getReaderProfile } from '@/db/books';
import { getReaderTheme, normalizeReaderThemeKey, type ReaderThemeKey } from '@/constants/reader-themes';
import { searchGoogleBooks, type GoogleBook } from '@/services/google-books';
import { saveImagePermanently } from '@/services/local-images';

export default function AddBookScreen() {
  const database = useSQLiteContext();
  const [themeKey, setThemeKey] = useState<ReaderThemeKey>('classic');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<GoogleBook | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [customCoverUri, setCustomCoverUri] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getReaderProfile(database).then((profile) => {
      const savedTheme = profile?.theme_key;
      setThemeKey(normalizeReaderThemeKey(savedTheme));
    });
  }, [database]);

  const theme = getReaderTheme(themeKey);

  async function handleSearch() {
    if (!searchTerm.trim()) {
      Alert.alert('O que vamos procurar?', 'Digite um título ou nome de autor.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchGoogleBooks(searchTerm));
    } catch (error) {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : 'Tente novamente em instantes.');
    } finally {
      setSearching(false);
    }
  }

  function selectResult(book: GoogleBook) {
    setSelectedBook(book);
    setTitle(book.title);
    setAuthor(book.author === 'Autor não informado' ? '' : book.author);
    setTotalPages(book.pageCount ? String(book.pageCount) : '');
    setCustomCoverUri(null);
    setResults([]);
  }

  async function handlePickCover() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [2, 3],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        const savedUri = await saveImagePermanently(result.assets[0].uri, 'book-cover');
        setCustomCoverUri(savedUri);
      }
    } catch {
      Alert.alert('Não foi possível escolher a capa', 'Verifique o acesso às fotos e tente novamente.');
    }
  }

  async function handleSave() {
    const pageCount = Number.parseInt(totalPages, 10);
    if (!title.trim() || !author.trim() || !Number.isFinite(pageCount) || pageCount < 1) {
      Alert.alert('Confira os dados', 'Informe título, autor e um número de páginas maior que zero.');
      return;
    }

    setSaving(true);
    try {
      await createBook(database, {
        title,
        author,
        total_pages: pageCount,
        google_volume_id: selectedBook?.id ?? null,
        google_info_link: selectedBook?.infoLink ?? null,
        google_cover_uri: selectedBook?.coverUri ?? null,
        custom_cover_uri: customCoverUri,
      });
      router.back();
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente adicionar o livro novamente.');
    } finally {
      setSaving(false);
    }
  }

  const displayedCover = customCoverUri ?? selectedBook?.coverUri ?? null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={[styles.back, { color: theme.accent }]}>‹ Voltar</Text></Pressable>
          <Text style={[styles.step, { color: theme.accent }]}>ESTANTE · NOVO LIVRO {theme.symbol}</Text>
        </View>
        <Text style={[styles.title, { color: theme.ink, fontFamily: theme.headingFont }]}>Encontre seu{ '\n' }próximo capítulo.</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Busque na biblioteca do Google ou preencha os dados por conta própria.</Text>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Powered by Google Books"
          style={styles.googleBrand}
          onPress={() => void Linking.openURL('https://www.google.com')}
        >
          <Image
            source={require('../../assets/images/google-books-powered-by.png')}
            style={styles.googleBrandImage}
            resizeMode="contain"
            accessibilityLabel="Powered by Google"
          />
        </Pressable>
        <View style={styles.searchRow}>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            accessibilityLabel="Pesquisar livros por título ou autor"
            onSubmitEditing={() => void handleSearch()}
            placeholder="Título ou autor"
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { backgroundColor: theme.paper, borderColor: theme.line, color: theme.ink }]}
            returnKeyType="search"
          />
          <Pressable accessibilityRole="button" style={[styles.searchButton, { backgroundColor: theme.accent, borderRadius: theme.cardRadius }]} onPress={() => void handleSearch()} disabled={searching}>
            {searching ? <ActivityIndicator color={theme.buttonText} /> : <Text style={[styles.searchButtonText, { color: theme.buttonText }]}>Pesquisar</Text>}
          </Pressable>
        </View>
        {results.length > 0 && (
          <View style={[styles.resultsBox, { backgroundColor: theme.paper, borderColor: theme.line }]}>
            <Text style={[styles.resultsTitle, { color: theme.muted }]}>RESULTADOS DA PESQUISA DO GOOGLE BOOKS</Text>
            {results.map((book) => (
              <View key={book.id} style={[styles.resultRow, { borderTopColor: theme.line }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar ${book.title} de ${book.author}`} style={styles.resultSelect} onPress={() => selectResult(book)}>
                  {book.coverUri ? <Image source={{ uri: book.coverUri }} style={styles.resultCover} /> : <View style={[styles.resultCover, styles.coverPlaceholder]}><Text>✳</Text></View>}
                  <View style={styles.resultText}>
                    <Text style={[styles.resultBookTitle, { color: theme.ink, fontFamily: theme.headingFont }]} numberOfLines={2}>{book.title}</Text>
                    <Text style={[styles.resultAuthor, { color: theme.muted }]} numberOfLines={1}>{book.author}</Text>
                    <Text style={[styles.resultPages, { color: theme.accent }]}>{book.pageCount ? `${book.pageCount} páginas` : 'Páginas não informadas'}</Text>
                  </View>
                  <Text style={[styles.resultArrow, { color: theme.accent }]}>＋</Text>
                </Pressable>
                <Pressable accessibilityRole="link" accessibilityLabel={`Ver ${book.title} no Google Books`} style={styles.googleLink} onPress={() => void Linking.openURL(book.infoLink)}>
                  <Text style={[styles.googleLinkText, { color: theme.accent }]}>Ver no Google Books ↗</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {searchError && <Text style={[styles.searchHint, { color: theme.muted }]}>{searchError}</Text>}
        {!searchError && searchTerm.trim().length > 0 && results.length === 0 && !searching && (
          <Text style={[styles.searchHint, { color: theme.muted }]}>A busca não encontrou livros ainda. Confira o termo ou preencha os dados abaixo.</Text>
        )}

        <View style={styles.formHeading}>
          <Text style={[styles.formTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>Detalhes do livro</Text>
          {selectedBook && <Text style={[styles.googleTag, { color: theme.accent }]}>DADOS DO GOOGLE</Text>}
        </View>
        <Text style={[styles.label, { color: theme.ink }]}>Título</Text>
        <TextInput accessibilityLabel="Título do livro" value={title} onChangeText={setTitle} placeholder="Nome do livro" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.paper, borderColor: theme.line, color: theme.ink }]} />
        <Text style={[styles.label, { color: theme.ink }]}>Autor</Text>
        <TextInput accessibilityLabel="Autor do livro" value={author} onChangeText={setAuthor} placeholder="Nome do autor" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.paper, borderColor: theme.line, color: theme.ink }]} />
        <Text style={[styles.label, { color: theme.ink }]}>Número de páginas</Text>
        <TextInput accessibilityLabel="Número total de páginas" value={totalPages} onChangeText={setTotalPages} placeholder="Ex.: 240" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.paper, borderColor: theme.line, color: theme.ink }]} keyboardType="number-pad" />

        <Text style={[styles.label, { color: theme.ink }]}>Capa</Text>
        <View style={[styles.coverEditor, { backgroundColor: theme.paper, borderColor: theme.line }]}>
          {displayedCover ? <Image source={{ uri: displayedCover }} style={styles.coverPreview} /> : <View style={[styles.coverPreview, styles.coverPlaceholder]}><Text style={styles.coverFlower}>✳</Text></View>}
          <View style={styles.coverActions}>
            <Text style={[styles.coverChoice, { color: theme.muted }]}>{customCoverUri ? 'Sua foto escolhida' : selectedBook?.coverUri ? 'Capa do Google Books' : 'Escolha uma capa'}</Text>
            <Pressable accessibilityRole="button" style={[styles.coverButton, { backgroundColor: theme.soft }]} onPress={() => void handlePickCover()}>
              <Text style={[styles.coverButtonText, { color: theme.accent }]}>{displayedCover ? 'Escolher outra foto' : 'Escolher foto'}</Text>
            </Pressable>
            {customCoverUri && selectedBook?.coverUri && (
              <Pressable accessibilityRole="button" onPress={() => setCustomCoverUri(null)}><Text style={styles.restoreText}>Usar capa do Google</Text></Pressable>
            )}
          </View>
        </View>

        <Pressable accessibilityRole="button" style={[styles.saveButton, { backgroundColor: theme.accent }, saving && styles.disabled]} onPress={() => void handleSave()} disabled={saving}>
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>{saving ? 'Salvando…' : 'Adicionar à estante'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F4EC' },
  content: { paddingHorizontal: 22, paddingBottom: 35 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  back: { color: '#48654B', fontWeight: '700', fontSize: 13 },
  step: { color: '#777B70', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#282D25', fontSize: 31, lineHeight: 35, fontWeight: '700', letterSpacing: -1, marginTop: 14 },
  subtitle: { color: '#777B70', fontSize: 13, lineHeight: 19, marginTop: 9, marginBottom: 19 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#FFFEFA', borderColor: '#E9E5DA', borderWidth: 1, paddingHorizontal: 14, color: '#282D25', fontSize: 14 },
  searchButton: { minWidth: 78, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#48654B', alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  resultsBox: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E9E5DA', backgroundColor: '#FFFEFA', paddingHorizontal: 12, paddingVertical: 10 },
  resultsTitle: { color: '#777B70', fontSize: 9, letterSpacing: 1.1, fontWeight: '700', marginBottom: 4 },
  googleBrand: { alignSelf: 'flex-end', marginBottom: 5 },
  googleBrandImage: { width: 62, height: 30 },
  resultRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F0EDE4' },
  resultSelect: { flexDirection: 'row', alignItems: 'center' },
  resultCover: { width: 38, height: 54, borderRadius: 4, backgroundColor: '#E8D8C1' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  resultText: { flex: 1, paddingHorizontal: 10 },
  resultBookTitle: { color: '#282D25', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  resultAuthor: { color: '#777B70', fontSize: 10, marginTop: 3 },
  resultPages: { color: '#48654B', fontSize: 9, marginTop: 3 },
  resultArrow: { color: '#48654B', fontSize: 20, paddingHorizontal: 4 },
  googleLink: { alignSelf: 'flex-end', paddingVertical: 5 },
  googleLinkText: { color: '#48654B', fontSize: 9, fontWeight: '700' },
  searchHint: { color: '#777B70', fontSize: 11, lineHeight: 16, marginTop: 10 },
  formHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 2 },
  formTitle: { color: '#282D25', fontSize: 17, fontWeight: '700' },
  googleTag: { color: '#48654B', fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  label: { color: '#282D25', fontSize: 11, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { height: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: '#E9E5DA', borderRadius: 10, backgroundColor: '#FFFEFA', color: '#282D25', fontSize: 13 },
  coverEditor: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 13, backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#E9E5DA' },
  coverPreview: { width: 55, height: 78, borderRadius: 5, backgroundColor: '#E8D8C1' },
  coverFlower: { color: '#9B7653', fontSize: 24 },
  coverActions: { flex: 1, paddingLeft: 13, gap: 7 },
  coverChoice: { color: '#777B70', fontSize: 10 },
  coverButton: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#E8EDE4', borderRadius: 9 },
  coverButtonText: { color: '#48654B', fontWeight: '700', fontSize: 10 },
  restoreText: { color: '#777B70', fontSize: 10 },
  saveButton: { height: 50, borderRadius: 13, backgroundColor: '#48654B', alignItems: 'center', justifyContent: 'center', marginTop: 23 },
  disabled: { opacity: 0.65 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
