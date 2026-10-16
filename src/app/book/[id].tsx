import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { createReadingNote, deleteReadingNote, getBooks, getReaderProfile, getReadingNotes, type Book, type ReadingNote, type ReaderProfile } from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';

export default function BookNotesScreen() {
  const database = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);
  const [book, setBook] = useState<Book | null>(null);
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [profile, setProfile] = useState<ReaderProfile | null>(null);
  const [noteText, setNoteText] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const theme = getReaderTheme(profile?.theme_key);

  const loadData = useCallback(async () => {
    const [books, savedNotes, savedProfile] = await Promise.all([
      getBooks(database),
      getReadingNotes(database, bookId),
      getReaderProfile(database),
    ]);
    setBook(books.find((item) => item.id === bookId) ?? null);
    setNotes(savedNotes);
    setProfile(savedProfile);
  }, [bookId, database]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  async function handleSave() {
    const trimmedText = noteText.trim();
    const page = pageNumber.trim() ? Number.parseInt(pageNumber, 10) : null;
    if (!trimmedText) {
      Alert.alert('Escreva uma anotação', 'Adicione um pensamento ou comentário antes de salvar.');
      return;
    }
    if (pageNumber.trim() && (!Number.isInteger(page) || (page as number) < 1 || (book && (page as number) > book.total_pages))) {
      Alert.alert('Confira a página', `Informe um número entre 1 e ${book?.total_pages ?? 'o total de páginas do livro'}.`);
      return;
    }
    setSaving(true);
    try {
      await createReadingNote(database, bookId, trimmedText, page);
      setNoteText('');
      setPageNumber('');
      await loadData();
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(note: ReadingNote) {
    Alert.alert('Apagar anotação?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await deleteReadingNote(database, note.id); await loadData(); } },
    ]);
  }

  function formatDate(value: string) {
    const date = new Date(`${value.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={[styles.back, { color: theme.accent }]}>‹ Voltar à estante</Text></Pressable>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>CADERNO DE LEITURA {theme.symbol}</Text>
        <Text style={[styles.title, { color: theme.ink, fontFamily: theme.headingFont }]}>{book?.title ?? 'Livro não encontrado'}</Text>
        {book && <Text style={[styles.author, { color: theme.muted }]}>{book.author}</Text>}
        <Text style={[styles.intro, { color: theme.muted }]}>Guarde aqui pensamentos, dúvidas e trechos que surgirem durante a leitura. Suas anotações ficam privadas neste aparelho.</Text>

          <View style={[styles.form, { backgroundColor: theme.paper, borderColor: theme.line }]}>
          <Text style={[styles.formTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>Nova anotação</Text>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="O que passou pela sua cabeça?"
            placeholderTextColor={theme.muted}
            style={[styles.noteInput, { backgroundColor: theme.background, borderColor: theme.line, color: theme.ink }]}
            multiline
            textAlignVertical="top"
            maxLength={3000}
          />
          <View style={styles.formFooter}>
            <TextInput
              value={pageNumber}
              onChangeText={setPageNumber}
              placeholder="Página (opcional)"
              placeholderTextColor={theme.muted}
              style={[styles.pageInput, { backgroundColor: theme.background, borderColor: theme.line, color: theme.ink }]}
              keyboardType="number-pad"
            />
            <Pressable style={[styles.saveButton, { backgroundColor: theme.accent, borderRadius: theme.cardRadius }, saving && styles.disabled]} onPress={() => void handleSave()} disabled={saving || !book}>
              <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>{saving ? 'Salvando…' : 'Salvar nota'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.notesHeading}>
          <Text style={[styles.notesTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>Suas anotações</Text>
          <Text style={[styles.notesCount, { color: theme.muted }]}>{notes.length}</Text>
        </View>
        {notes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}><Text style={[styles.emptyText, { color: theme.muted }]}>Ainda não há anotações. Quando uma ideia aparecer, deixe-a aqui.</Text></View>
        ) : notes.map((note) => (
          <View key={note.id} style={[styles.noteCard, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
            <View style={styles.noteMeta}>
              <Text style={[styles.noteDate, { color: theme.accent }]}>{formatDate(note.created_at)}</Text>
              <Pressable onPress={() => confirmDelete(note)} hitSlop={8}><Text style={styles.deleteNote}>Apagar</Text></Pressable>
            </View>
            <Text style={[styles.noteBody, { color: theme.ink }]}>{note.text}</Text>
            {note.page_number !== null && <Text style={[styles.notePage, { backgroundColor: theme.soft, color: theme.accent }]}>Página {note.page_number}</Text>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 40 },
  back: { fontSize: 13, fontWeight: '700', marginBottom: 28 },
  eyebrow: { fontSize: 9, letterSpacing: 1.7, fontWeight: '700' },
  title: { color: '#282D25', fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 9 },
  author: { color: '#777B70', fontSize: 13, marginTop: 5 },
  intro: { color: '#777B70', fontSize: 12, lineHeight: 19, marginTop: 14, marginBottom: 22 },
  form: { backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#E9E5DA', borderRadius: 16, padding: 14 },
  formTitle: { color: '#282D25', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  noteInput: { minHeight: 112, maxHeight: 220, color: '#282D25', fontSize: 13, lineHeight: 19, borderWidth: 1, borderColor: '#E9E5DA', borderRadius: 11, padding: 12 },
  formFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 11, gap: 10 },
  pageInput: { height: 42, flex: 1, borderWidth: 1, borderColor: '#E9E5DA', borderRadius: 10, paddingHorizontal: 11, color: '#282D25', fontSize: 11 },
  saveButton: { height: 42, paddingHorizontal: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  notesHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 },
  notesTitle: { color: '#282D25', fontSize: 18, fontWeight: '700' },
  notesCount: { color: '#777B70', fontSize: 11 },
  emptyCard: { backgroundColor: '#FFFEFA', borderRadius: 14, padding: 17, borderWidth: 1, borderColor: '#E9E5DA' },
  emptyText: { color: '#777B70', fontSize: 12, lineHeight: 18 },
  noteCard: { backgroundColor: '#FFFEFA', borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#E9E5DA', marginBottom: 10 },
  noteMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  noteDate: { fontSize: 10, fontWeight: '700' },
  deleteNote: { color: '#A45C52', fontSize: 10, fontWeight: '600' },
  noteBody: { color: '#282D25', fontSize: 13, lineHeight: 20 },
  notePage: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '700', marginTop: 12 },
});
