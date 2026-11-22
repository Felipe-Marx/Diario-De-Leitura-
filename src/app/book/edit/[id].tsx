import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useSQLiteContext } from 'expo-sqlite';

import { getBooks, updateBookDetails, type Book } from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';
import { ThemeSceneHeader } from '@/components/theme-scene-header';
import { formatRatingValue, RatingStars } from '@/components/rating-stars';
import { useReaderProfile } from '@/providers/reader-profile';

export default function EditBookScreen() {
  const database = useSQLiteContext();
  const { profile, loading: profileLoading } = useReaderProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);
  const [book, setBook] = useState<Book | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [currentPage, setCurrentPage] = useState('');
  const [format, setFormat] = useState<'fisico' | 'kindle' | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [openDatePicker, setOpenDatePicker] = useState<'started' | 'completed' | null>(null);
  const [saving, setSaving] = useState(false);
  const theme = getReaderTheme(profile?.theme_key);

  const loadData = useCallback(async () => {
    const books = await getBooks(database);
    const savedBook = books.find((item) => item.id === bookId) ?? null;
    setBook(savedBook);
    if (savedBook) {
      setTitle(savedBook.title);
      setAuthor(savedBook.author);
      setTotalPages(String(savedBook.total_pages));
      setCurrentPage(String(savedBook.current_page));
      setFormat(savedBook.format);
      setRating(savedBook.rating);
      setStartedAt(savedBook.started_at ?? '');
      setCompletedAt(savedBook.completed_at ?? '');
    }
  }, [bookId, database]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadData().finally(() => { if (active) setBookLoading(false); });
    return () => { active = false; };
  }, [loadData]));

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
    const isValidDate = (value: string) => {
      if (!value.trim()) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    if (!isValidDate(startedAt) || !isValidDate(completedAt)) {
      Alert.alert('Confira as datas', 'A data informada não é válida.');
      return;
    }
    if (startedAt && completedAt && completedAt < startedAt) {
      Alert.alert('Confira o período', 'A conclusão não pode ser anterior ao início da leitura.');
      return;
    }

    setSaving(true);
    try {
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const resolvedStartedAt = startedAt.trim() || (parsedCurrentPage > 0 && book?.status === 'quero_ler' ? todayIso : null);
      const resolvedCompletedAt = completedAt.trim() || (parsedCurrentPage >= parsedTotalPages && book?.status !== 'concluido' ? todayIso : null);
      await updateBookDetails(database, {
        id: bookId,
        title,
        author,
        total_pages: parsedTotalPages,
        current_page: completedAt.trim() ? parsedTotalPages : parsedCurrentPage,
        format,
        rating,
        started_at: resolvedStartedAt,
        completed_at: resolvedCompletedAt,
      });
      router.back();
    } catch {
      Alert.alert('Não foi possível atualizar', 'Tente salvar as alterações novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (profileLoading || !profile || bookLoading) {
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color="#777B70" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={[styles.back, { color: theme.accent }]}>‹ Voltar</Text></Pressable>
        <ThemeSceneHeader
          themeKey={profile.theme_key}
          eyebrow={`SUA ESTANTE ${theme.symbol}`}
          title="Editar livro"
          subtitle="Atualize os dados e ajuste o progresso para a página em que você está."
          minHeight={160}
          style={styles.sceneHeader}
        />

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

            <Text style={[styles.label, { color: theme.ink }]}>Formato</Text>
            <View style={styles.choiceRow}>{([{ value: null, label: 'Não informado' }, { value: 'fisico', label: 'Físico' }, { value: 'kindle', label: 'eBook Kindle' }] as const).map((option) => <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ selected: format === option.value }} onPress={() => setFormat(option.value)} style={[styles.choice, { backgroundColor: format === option.value ? theme.soft : theme.background, borderColor: format === option.value ? theme.accent : theme.line }]}><Text style={{ color: format === option.value ? theme.accent : theme.muted, fontSize: 12, fontWeight: '600' }}>{option.label}</Text></Pressable>)}</View>

            <Text style={[styles.label, { color: theme.ink }]}>{rating === null ? 'Sua avaliação' : `Sua avaliação · ${formatRatingValue(rating)}/5`}</Text>
            <RatingStars rating={rating} size={30} color="#D69E42" emptyColor={theme.line} onSelect={setRating} />
            <Text style={[styles.helper, { color: theme.muted }]}>Toque à esquerda para meia estrela e à direita para uma estrela inteira. Toque na nota atual para removê-la.</Text>

            <ReadingDateField label="Data de início da leitura (opcional)" value={startedAt} onChange={setStartedAt} isOpen={openDatePicker === 'started'} onOpen={() => setOpenDatePicker('started')} onClose={() => setOpenDatePicker(null)} theme={theme} />
        <ReadingDateField label="Data de conclusão (opcional)" value={completedAt} onChange={setCompletedAt} isOpen={openDatePicker === 'completed'} onOpen={() => setOpenDatePicker('completed')} onClose={() => setOpenDatePicker(null)} theme={theme} />
            <Text style={[styles.helper, { color: theme.muted }]}>Preencha as datas para organizar leituras anteriores em suas estantes por ano. Datas antigas não são preenchidas automaticamente.</Text>

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

function ReadingDateField({ label, value, onChange, isOpen, onOpen, onClose, theme }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  theme: ReturnType<typeof getReaderTheme>;
}) {
  const selectedDate = value ? dateFromIso(value) : new Date();
  return (
    <View>
      <Text style={[styles.label, { color: theme.ink }]}>{label}</Text>
      <View style={[styles.dateField, { backgroundColor: theme.paper, borderColor: theme.line }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDate(value) : 'nenhuma data selecionada'}. Abrir calendário`} onPress={onOpen} style={styles.dateButton}>
          <Text style={[styles.dateValue, { color: value ? theme.ink : theme.muted }]}>{value ? formatDate(value) : 'Selecionar data'}</Text>
          <Text style={[styles.dateIcon, { color: theme.accent }]} accessibilityElementsHidden>▦</Text>
        </Pressable>
        {value ? <Pressable accessibilityRole="button" accessibilityLabel={`Limpar ${label}`} onPress={() => onChange('')} style={styles.clearDate}><Text style={[styles.clearDateText, { color: theme.accent }]}>Limpar</Text></Pressable> : null}
      </View>
      {isOpen ? (
        <View style={[styles.datePickerBox, { backgroundColor: theme.paper, borderColor: theme.line }]}>
          <DateTimePicker value={selectedDate} mode="date" display="inline" presentation={Platform.OS === 'android' ? 'dialog' : 'inline'} locale="pt_BR" accentColor={theme.accent} positiveButton={{ label: 'Confirmar' }} negativeButton={{ label: 'Cancelar' }} onValueChange={(_event, date) => { onChange(toIsoDate(date)); if (Platform.OS === 'android') onClose(); }} />
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.dateDone, { backgroundColor: theme.accent }]}><Text style={[styles.dateDoneText, { color: theme.buttonText }]}>Concluir</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string) {
  return dateFromIso(value).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}
const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  dateField: { minHeight: 46, paddingLeft: 13, paddingRight: 10, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  dateButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateValue: { fontSize: 13 },
  dateIcon: { fontSize: 18, paddingHorizontal: 8 },
  clearDate: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 7 },
  clearDateText: { fontSize: 11, fontWeight: '700' },
  datePickerBox: { marginTop: 8, padding: 8, borderWidth: 1, borderRadius: 12 },
  dateDone: { minHeight: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  dateDoneText: { fontSize: 12, fontWeight: '700' },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 40 },
  choiceRow: { flexDirection: 'row', gap: 9, marginBottom: 7 },
  choice: { minHeight: 40, paddingHorizontal: 13, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 13, fontWeight: '700', marginBottom: 14 },
  sceneHeader: { marginBottom: 18 },
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
