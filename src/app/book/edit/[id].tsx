import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { getBooks, getReaderProfile, updateBookDetails, type Book, type ReaderProfile } from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';

export default function EditBookScreen() {
  const database = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);
  const [book, setBook] = useState<Book | null>(null);
  const [profile, setProfile] = useState<ReaderProfile | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [currentPage, setCurrentPage] = useState('');
  const [saving, setSaving] = useState(false);
  const theme = getReaderTheme(profile?.theme_key);

  const loadData = useCallback(async () => {
    const [books, savedProfile] = await Promise.all([getBooks(database), getReaderProfile(database)]);
    const savedBook = books.find((item) => item.id === bookId) ?? null;
    setBook(savedBook);
    setProfile(savedProfile);
    if (savedBook) {
      setTitle(savedBook.title);
      setAuthor(savedBook.author);
      setTotalPages(String(savedBook.total_pages));
      setCurrentPage(String(savedBook.current_page));
    }
  }, [bookId, database]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  async function handleSave() {
    const parsedTotalPages = Number(totalPages);
    const parsedCurrentPage = Number(currentPage);
    if (!title.trim() || !author.trim()) {
      Alert.alert('Confira os dados', 'Título e autor são obrigatórios.');
      return;
    }
    if (!Number.isInteger(parsedTotalPages) || parsedTotalPages < 1) {
      Alert.alert('Confira o total de páginas', 'Informe um número inteiro maior que zero.');
      return;
    }
    if (!currentPage.trim() || !Number.isInteger(parsedCurrentPage) || parsedCurrentPage < 0 || parsedCurrentPage > parsedTotalPages) {
      Alert.alert('Confira a página atual', `Use um número entre 0 e ${parsedTotalPages}.`);
      return;
    }

    setSaving(true);
    try {
      await updateBookDetails(database, {
        id: bookId,
        title,
        author,
        total_pages: parsedTotalPages,
        current_page: parsedCurrentPage,
      });
      router.back();
    } catch {
      Alert.alert('Não foi possível atualizar', 'Tente salvar as alterações novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={[styles.back, { color: theme.accent }]}>‹ Voltar</Text></Pressable>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>SUA ESTANTE {theme.symbol}</Text>
        <Text style={[styles.title, { color: theme.ink, fontFamily: theme.headingFont }]}>Editar livro</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Atualize os dados e ajuste o progresso para a página em que você está.</Text>

        {book ? (
          <View style={[styles.form, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
            <Text style={[styles.label, { color: theme.ink }]}>Título</Text>
            <TextInput accessibilityLabel="Título do livro" value={title} onChangeText={setTitle} placeholder="Título do livro" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.background, borderColor: theme.line, color: theme.ink }]} maxLength={160} />

            <Text style={[styles.label, { color: theme.ink }]}>Autor</Text>
            <TextInput accessibilityLabel="Autor do livro" value={author} onChangeText={setAuthor} placeholder="Nome do autor" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.background, borderColor: theme.line, color: theme.ink }]} maxLength={120} />

            <Text style={[styles.label, { color: theme.ink }]}>Total de páginas</Text>
            <TextInput accessibilityLabel="Número total de páginas" value={totalPages} onChangeText={setTotalPages} placeholder="Ex.: 320" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.background, borderColor: theme.line, color: theme.ink }]} keyboardType="number-pad" />

            <Text style={[styles.label, { color: theme.ink }]}>Página atual</Text>
            <TextInput accessibilityLabel="Página atual de leitura" value={currentPage} onChangeText={setCurrentPage} placeholder="0" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.background, borderColor: theme.line, color: theme.ink }]} keyboardType="number-pad" />
            <Text style={[styles.helper, { color: theme.muted }]}>Use 0 se ainda não começou. Ao salvar, o status acompanha a página informada.</Text>

            <Pressable style={[styles.saveButton, { backgroundColor: theme.accent, borderRadius: theme.cardRadius }, saving && styles.disabled]} onPress={() => void handleSave()} disabled={saving}>
              <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>{saving ? 'Salvando…' : 'Salvar alterações'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.paper, borderColor: theme.line }]}>
            <Text style={[styles.emptyText, { color: theme.muted }]}>Este livro não está mais na sua estante.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 40 },
  back: { fontSize: 13, fontWeight: '700', marginBottom: 27 },
  eyebrow: { fontSize: 9, letterSpacing: 1.7, fontWeight: '700' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', marginTop: 8 },
  subtitle: { fontSize: 12, lineHeight: 19, marginTop: 8, marginBottom: 22 },
  form: { borderWidth: 1, padding: 15 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 13, marginBottom: 6 },
  input: { height: 47, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, fontSize: 13 },
  helper: { fontSize: 10, lineHeight: 15, marginTop: 8 },
  saveButton: { height: 49, alignItems: 'center', justifyContent: 'center', marginTop: 23 },
  saveButtonText: { fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.65 },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  emptyText: { fontSize: 12, lineHeight: 18 },
});
