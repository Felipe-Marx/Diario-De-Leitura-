import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { advancePage, createReadingNote, deleteBook, deleteReadingNote, getBooks, getReadingNotes, startBook, updateBookRating, updateReadingNote, type Book, type ReadingNote } from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';
import { ThemeSceneHeader } from '@/components/theme-scene-header';
import { formatRatingValue, RatingStars } from '@/components/rating-stars';
import { useReaderProfile } from '@/providers/reader-profile';

export default function BookNotesScreen() {
  const database = useSQLiteContext();
  const { profile, loading: profileLoading } = useReaderProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);
  const [book, setBook] = useState<Book | null>(null);
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const theme = getReaderTheme(profile?.theme_key);

  const loadData = useCallback(async () => {
    const [books, savedNotes] = await Promise.all([
      getBooks(database),
      getReadingNotes(database, bookId),
    ]);
    setBook(books.find((item) => item.id === bookId) ?? null);
    setNotes(savedNotes);
    setNotesLoading(false);
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
      if (editingNoteId === null) await createReadingNote(database, bookId, trimmedText, page);
      else await updateReadingNote(database, editingNoteId, trimmedText, page);
      setNoteText('');
      setPageNumber('');
      setEditingNoteId(null);
      await loadData();
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteBook() {
    if (!book) return;
    Alert.alert('Remover livro?', `“${book.title}” será retirado da biblioteca.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await deleteBook(database, book.id); router.back(); } },
    ]);
  }

  async function handleAdvancePage() {
    if (!book) return;
    if (book.status === 'quero_ler') await startBook(database, book.id);
    else await advancePage(database, book);
    await loadData();
  }

  async function handleRatingChange(rating: number | null) {
    if (!book) return;
    try {
      await updateBookRating(database, book.id, rating);
      await loadData();
    } catch {
      Alert.alert('Não foi possível salvar a avaliação', 'Tente novamente.');
    }
  }

  function beginEdit(note: ReadingNote) {
    setEditingNoteId(note.id);
    setNoteText(note.text);
    setPageNumber(note.page_number === null ? '' : String(note.page_number));
  }

  function confirmDelete(note: ReadingNote) {
    Alert.alert('Apagar anotação?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await deleteReadingNote(database, note.id); await loadData(); } },
    ]);
  }

  if (profileLoading || !profile || notesLoading) {
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color="#777B70" /></SafeAreaView>;
  }

  function formatDate(value: string) {
    const date = new Date(`${value.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={[styles.back, { color: theme.accent }]}>‹ Voltar à estante</Text></Pressable>
        <ThemeSceneHeader
          themeKey={profile.theme_key}
          eyebrow={`CADERNO DE LEITURA ${theme.symbol}`}
          title={book?.title ?? 'Livro não encontrado'}
          subtitle={book?.author ?? 'Acompanhe o progresso e as anotações desta leitura.'}
          minHeight={185}
          titleNumberOfLines={4}
          style={styles.sceneHeader}
        />
        {book && <View style={[styles.bookDetails, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
          <View style={styles.detailTop}><Text style={[styles.formatTag, { color: theme.accent, backgroundColor: theme.soft }]}>{book.format === 'kindle' ? 'eBook Kindle' : book.format === 'fisico' ? 'Livro físico' : 'Formato não informado'}</Text><Text style={[styles.statusTag, { color: theme.muted }]}>{book.status === 'lendo' ? 'EM ANDAMENTO' : book.status === 'concluido' ? 'CONCLUÍDO' : 'QUERO LER'}</Text></View>
          {book.status !== 'quero_ler' && <><Text style={[styles.progressLabel, { color: theme.muted }]}>{book.current_page} de {book.total_pages} páginas · {Math.round(book.current_page / book.total_pages * 100)}%</Text><View style={[styles.progressTrack, { backgroundColor: theme.soft }]}><View style={[styles.progressFill, { width: `${Math.round(book.current_page / book.total_pages * 100)}%`, backgroundColor: theme.accent }]} /></View></>}
          {(book.started_at || book.completed_at) && <Text style={[styles.dateInfo, { color: theme.muted }]}>{book.started_at ? `Início: ${new Date(`${book.started_at}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ''}{book.started_at && book.completed_at ? ' · ' : ''}{book.completed_at ? `Conclusão: ${new Date(`${book.completed_at}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ''}</Text>}
          <Text style={[styles.ratingLabel, { color: theme.ink }]}>{book.rating === null ? 'Sua avaliação' : `Sua avaliação · ${formatRatingValue(book.rating)}/5`}</Text>
          <RatingStars rating={book.rating} size={30} color="#D69E42" emptyColor={theme.line} onSelect={(rating) => void handleRatingChange(rating)} />
          <Text style={[styles.ratingHint, { color: theme.muted }]}>Toque à esquerda para meia estrela e à direita para uma estrela inteira. Toque na nota atual para removê-la.</Text>
          {book.status !== 'concluido' && <Pressable accessibilityRole="button" onPress={() => void handleAdvancePage()} style={[styles.advanceButton, { backgroundColor: theme.accent, borderRadius: theme.cardRadius }]}><Text style={{ color: theme.buttonText, fontSize: 12, fontWeight: '700' }}>{book.status === 'quero_ler' ? 'Começar leitura' : 'Registrar próxima página'}</Text></Pressable>}
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/book/edit/[id]', params: { id: String(book.id) } })} style={[styles.detailLink, { borderTopColor: theme.line }]}><Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>Editar livro, formato e progresso</Text><Text style={{ color: theme.accent }}>→</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={confirmDeleteBook} style={styles.deleteBook}><Text style={{ color: '#A84F48', fontSize: 11, fontWeight: '600' }}>Remover livro da biblioteca</Text></Pressable>
        </View>}
        <Text style={[styles.intro, { color: theme.muted }]}>Guarde aqui pensamentos, dúvidas e trechos que surgirem durante a leitura. Suas anotações ficam privadas neste aparelho.</Text>

          <View style={[styles.form, { backgroundColor: theme.paper, borderColor: theme.line }]}>
          <Text style={[styles.formTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>{editingNoteId === null ? 'Nova anotação' : 'Editar anotação'}</Text>
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
              <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>{saving ? 'Salvando…' : editingNoteId === null ? 'Salvar nota' : 'Atualizar nota'}</Text>
            </Pressable>
            {editingNoteId !== null && <Pressable onPress={() => { setEditingNoteId(null); setNoteText(''); setPageNumber(''); }}><Text style={{ color: theme.muted, fontSize: 11 }}>Cancelar</Text></Pressable>}
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
              <Text style={[styles.noteDate, { color: theme.accent }]}>{formatDate(note.created_at)}{note.updated_at ? ` · Editada ${formatDate(note.updated_at)}` : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Pressable onPress={() => beginEdit(note)} hitSlop={8}><Text style={[styles.deleteNote, { color: theme.accent }]}>Editar</Text></Pressable>
                <Pressable onPress={() => confirmDelete(note)} hitSlop={8}><Text style={styles.deleteNote}>Apagar</Text></Pressable>
              </View>
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
  loadingScreen: { flex: 1, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 40 },
  bookDetails: { borderWidth: 1, padding: 14, marginTop: 17 },
  detailTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formatTag: { fontSize: 10, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  statusTag: { fontSize: 9, letterSpacing: 0.8, fontWeight: '700' },
  progressLabel: { fontSize: 11, marginTop: 13, marginBottom: 6 },
  dateInfo: { fontSize: 10, marginTop: 9 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3 },
  ratingLabel: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  ratingHint: { fontSize: 10, lineHeight: 15, marginTop: 1 },
  advanceButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  detailLink: { borderTopWidth: 1, marginTop: 13, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  deleteBook: { alignSelf: 'flex-start', paddingTop: 13 },
  back: { fontSize: 13, fontWeight: '700', marginBottom: 14 },
  sceneHeader: { marginBottom: 17 },
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
