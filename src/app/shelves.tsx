import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';

import { createReadingShelf, deleteReadingShelf, getBooks, getBooksInShelf, getReadingShelves, setReadingShelfBooks, updateReadingShelf, type Book, type ReadingShelf } from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';
import { ThemeSceneHeader } from '@/components/theme-scene-header';
import { useReaderProfile } from '@/providers/reader-profile';
import { saveImagePermanently } from '@/services/local-images';

const colors = ['#48654B', '#B66B5E', '#6D78A8', '#C08B3E', '#8B668E', '#4C8790', '#5D6670'];
const icons = ['✦', '♡', '☾', '❀', '▤', '★', '◷'];

function ShelfGlyph({ glyph, color, size }: { glyph: string; color: string; size: number }) {
  return (
    <View pointerEvents="none" style={styles.glyphCenter}>
      <Text
        accessible={false}
        allowFontScaling={false}
        style={{
          color,
          fontSize: size,
          lineHeight: size * 1.2,
          includeFontPadding: false,
          textAlign: 'center',
          textAlignVertical: 'center',
          transform: [{ translateY: -size * 0.08 }],
        }}>
        {glyph}
      </Text>
    </View>
  );
}

export default function ShelvesScreen() {
  const database = useSQLiteContext();
  const { profile } = useReaderProfile();
  const theme = getReaderTheme(profile?.theme_key ?? 'classic');
  const [shelves, setShelves] = useState<ReadingShelf[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedShelf, setSelectedShelf] = useState<ReadingShelf | null>(null);
  const [shelfBooks, setShelfBooks] = useState<Book[]>([]);
  const [mode, setMode] = useState<'list' | 'detail' | 'edit'>('list');
  const [name, setName] = useState('');
  const [color, setColor] = useState(colors[0]);
  const [icon, setIcon] = useState(icons[0]);
  const [iconUri, setIconUri] = useState<string | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextShelves, nextBooks] = await Promise.all([getReadingShelves(database), getBooks(database)]);
      setShelves(nextShelves);
      setBooks(nextBooks);
      setSelectedShelf((current) => current ? nextShelves.find((shelf) => shelf.id === current.id) ?? null : null);
    } finally { setLoading(false); }
  }, [database]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function openShelf(shelf: ReadingShelf | null) {
    setSelectedShelf(shelf);
    setName(shelf?.name ?? '');
    setColor(shelf?.color ?? colors[0]);
    setIcon(shelf?.icon ?? icons[0]);
    setIconUri(shelf?.icon_uri ?? null);
    const shelfBooksList = shelf ? await getBooksInShelf(database, shelf.id) : [];
    setShelfBooks(shelfBooksList);
    setSelectedBooks(shelfBooksList.map((book) => book.id));
    setMode('detail');
  }

  function openCreateEditor() {
    setSelectedShelf(null);
    setName('');
    setColor(colors[0]);
    setIcon(icons[0]);
    setIconUri(null);
    setSelectedBooks([]);
    setMode('edit');
  }

  function cancelEditor() {
    if (!selectedShelf) { resetEditor(); return; }
    setName(selectedShelf.name);
    setColor(selectedShelf.color);
    setIcon(selectedShelf.icon);
    setIconUri(selectedShelf.icon_uri);
    setSelectedBooks(shelfBooks.map((book) => book.id));
    setMode('detail');
  }

  async function saveShelf() {
    const trimmedName = name.trim();
    if (!trimmedName) { Alert.alert('Dê um nome para a estante', 'Ex.: Fantasia, Favoritos ou Para reler.'); return; }
    setSaving(true);
    try {
      if (selectedShelf) await updateReadingShelf(database, selectedShelf.id, trimmedName, color, icon, iconUri);
      else await createReadingShelf(database, trimmedName, color, icon, iconUri);
      const nextShelves = await getReadingShelves(database);
      const savedShelf = selectedShelf
        ? nextShelves.find((shelf) => shelf.id === selectedShelf.id)
        : nextShelves[nextShelves.length - 1];
      if (savedShelf) await setReadingShelfBooks(database, savedShelf.id, selectedBooks);
      await refresh();
      if (savedShelf) {
        setSelectedShelf(savedShelf);
        setShelfBooks(await getBooksInShelf(database, savedShelf.id));
        setMode('detail');
      } else resetEditor();
    } catch { Alert.alert('Não foi possível salvar', 'Tente novamente.'); }
    finally { setSaving(false); }
  }

  function confirmDelete(shelf: ReadingShelf) {
    Alert.alert('Excluir estante?', `“${shelf.name}” será removida. Os livros continuarão na biblioteca e nas outras estantes.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteReadingShelf(database, shelf.id); if (selectedShelf?.id === shelf.id) resetEditor(); await refresh(); } },
    ]);
  }

  function toggleBook(id: number) {
    setSelectedBooks((current) => current.includes(id) ? current.filter((bookId) => bookId !== id) : [...current, id]);
  }

  function resetEditor() {
    setSelectedShelf(null);
    setName('');
    setColor(colors[0]);
    setIcon(icons[0]);
    setIconUri(null);
    setSelectedBooks([]);
    setShelfBooks([]);
    setMode('list');
  }

  async function pickShelfIcon() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      setIconUri(await saveImagePermanently(result.assets[0].uri, `shelf-icon-${selectedShelf?.id ?? 'new'}`));
    } catch {
      Alert.alert('Não foi possível escolher o ícone', 'Tente selecionar outra imagem.');
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Pressable onPress={() => {
            if (mode === 'edit') cancelEditor();
            else if (mode === 'detail') setMode('list');
            else router.back();
          }} accessibilityRole="button"><Text style={[styles.back, { color: theme.accent }]}>‹ {mode === 'list' ? 'Voltar' : 'Estantes'}</Text></Pressable>
        </View>
        <ThemeSceneHeader
          themeKey={profile?.theme_key}
          eyebrow="SUA BIBLIOTECA"
          title={mode === 'edit' ? selectedShelf ? 'Editar estante' : 'Nova estante' : mode === 'detail' ? selectedShelf?.name ?? 'Estante' : 'Estantes'}
          subtitle={mode === 'list' ? 'Suas coleções pessoais, cada uma do seu jeito.' : mode === 'detail' ? `${shelfBooks.length} ${shelfBooks.length === 1 ? 'livro nesta estante' : 'livros nesta estante'}` : 'Escolha o nome, a aparência e os livros desta coleção.'}
          minHeight={150}
          titleNumberOfLines={3}
          style={styles.sceneHeader}
        />

        {mode === 'list' && <>
          <View style={styles.listHeader}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Suas estantes</Text><Pressable onPress={openCreateEditor} style={[styles.newButton, { backgroundColor: theme.accent }]}><Text style={[styles.newButtonText, { color: theme.buttonText }]}>＋ Adicionar</Text></Pressable></View>
          {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 18 }} /> : shelves.length === 0 ? <View style={[styles.emptyCard, { backgroundColor: theme.paper, borderColor: theme.line }]}><Text style={[styles.emptyTitle, { color: theme.ink }]}>Nenhuma estante ainda</Text><Text style={[styles.description, { color: theme.muted }]}>Crie sua primeira coleção para organizar os livros por gênero, cor, favoritos ou do jeito que preferir.</Text><Pressable onPress={openCreateEditor} style={[styles.emptyAction, { backgroundColor: theme.accent }]}><Text style={{ color: theme.buttonText, fontWeight: '700', fontSize: 12 }}>＋ Criar estante</Text></Pressable></View> : shelves.map((shelf) => <Pressable key={shelf.id} onPress={() => void openShelf(shelf)} style={[styles.shelfCard, { backgroundColor: theme.paper, borderColor: theme.line, borderLeftColor: shelf.color, borderRadius: theme.cardRadius }]}><View style={[styles.shelfIcon, { backgroundColor: `${shelf.color}20` }]}>{shelf.icon_uri ? <Image source={{ uri: shelf.icon_uri }} style={styles.shelfIconImage} contentFit="cover" cachePolicy="disk" /> : <ShelfGlyph glyph={shelf.icon} color={shelf.color} size={36} />}</View><View style={{ flex: 1 }}><Text style={[styles.shelfName, { color: theme.ink }]}>{shelf.name}</Text><Text style={[styles.description, { color: theme.muted }]}>Toque para ver os livros</Text></View><Text style={[styles.chevron, { color: shelf.color }]}>›</Text></Pressable>)}
        </>}

        {mode === 'detail' && selectedShelf && <>
          <View style={[styles.detailBanner, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}><View style={[styles.detailIconFrame, { backgroundColor: `${selectedShelf.color}20` }]}>{selectedShelf.icon_uri ? <Image source={{ uri: selectedShelf.icon_uri }} style={styles.detailIconImage} contentFit="cover" cachePolicy="disk" /> : <ShelfGlyph glyph={selectedShelf.icon} color={selectedShelf.color} size={42} />}</View><View style={{ flex: 1 }}><Text style={[styles.detailName, { color: theme.ink }]}>{selectedShelf.name}</Text><Text style={[styles.detailCount, { color: theme.muted }]}>{shelfBooks.length} {shelfBooks.length === 1 ? 'livro' : 'livros'}</Text></View><Pressable accessibilityRole="button" onPress={() => setMode('edit')} style={[styles.detailEdit, { backgroundColor: theme.soft }]}><Text style={{ color: theme.accent, fontWeight: '700', fontSize: 11 }}>Editar</Text></Pressable></View>
          {shelfBooks.length === 0 ? <View style={[styles.emptyCard, { backgroundColor: theme.paper, borderColor: theme.line }]}><Text style={[styles.emptyTitle, { color: theme.ink }]}>Esta estante está vazia</Text><Text style={[styles.description, { color: theme.muted }]}>Edite a estante para adicionar livros da sua biblioteca.</Text><Pressable onPress={() => setMode('edit')} style={[styles.emptyAction, { backgroundColor: selectedShelf.color }]}><Text style={styles.saveText}>Adicionar livros</Text></Pressable></View> : shelfBooks.map((book) => <Pressable key={book.id} onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(book.id) } })} style={[styles.bookRow, styles.shelfBookRow, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>{book.custom_cover_uri || book.google_cover_uri ? <Image source={{ uri: book.custom_cover_uri ?? book.google_cover_uri ?? undefined }} style={styles.detailBookCover} contentFit="cover" /> : <View style={[styles.detailBookCover, styles.coverFallback, { backgroundColor: theme.soft }]}><Text style={{ color: theme.accent }}>✦</Text></View>}<View style={styles.bookLabel}><Text numberOfLines={1} style={[styles.bookTitle, { color: theme.ink }]}>{book.title}</Text><Text numberOfLines={1} style={[styles.description, { color: theme.muted }]}>{book.author}</Text></View><Text style={[styles.chevron, { color: selectedShelf.color }]}>›</Text></Pressable>)}
        </>}

        {mode === 'edit' && (
          <View style={[styles.editor, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
            <Text style={[styles.editorTitle, { color: theme.ink }]}>Aparência da estante</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Nome da estante" placeholderTextColor={theme.muted} maxLength={40} style={[styles.input, { color: theme.ink, backgroundColor: theme.background, borderColor: theme.line }]} />
            <Text style={[styles.label, { color: theme.muted }]}>Ícone da estante</Text>
            <View style={styles.iconEditorRow}>
              <View style={[styles.iconEditorPreview, { backgroundColor: `${color}20`, borderColor: theme.line }]}>{iconUri ? <Image source={{ uri: iconUri }} style={styles.iconEditorImage} contentFit="cover" cachePolicy="disk" /> : <ShelfGlyph glyph={icon} color={color} size={52} />}</View>
              <View style={styles.iconEditorActions}>
                <Pressable accessibilityRole="button" onPress={() => void pickShelfIcon()} style={[styles.pickIconButton, { backgroundColor: theme.soft, borderColor: theme.line }]}><Text style={[styles.pickIconText, { color: theme.accent }]}>{iconUri ? 'Trocar imagem' : 'Escolher imagem'}</Text></Pressable>
                {iconUri && <Pressable accessibilityRole="button" onPress={() => setIconUri(null)} hitSlop={8}><Text style={[styles.removeIconText, { color: theme.muted }]}>Remover imagem</Text></Pressable>}
                <Text style={[styles.iconHelp, { color: theme.muted }]}>A imagem será recortada em formato quadrado.</Text>
              </View>
            </View>
            <Text style={[styles.label, { color: theme.muted }]}>Ou escolha um símbolo</Text>
            <View style={styles.options}>{icons.map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: !iconUri && icon === option }} accessibilityLabel={`Ícone ${option}`} onPress={() => { setIcon(option); setIconUri(null); }} style={[styles.iconOption, { borderColor: !iconUri && icon === option ? color : theme.line, backgroundColor: theme.background }]}><ShelfGlyph glyph={option} color={!iconUri && icon === option ? color : theme.muted} size={30} /></Pressable>)}</View>
            <Text style={[styles.label, { color: theme.muted }]}>Cor</Text>
            <View style={styles.options}>{colors.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Cor ${option}`} onPress={() => setColor(option)} style={[styles.colorOption, { backgroundColor: option, borderColor: color === option ? theme.ink : theme.paper }]} />)}</View>
            <Text style={[styles.label, { color: theme.muted }]}>Livros nesta estante</Text>
            {loading ? <ActivityIndicator color={theme.accent} /> : books.length === 0 ? <Text style={[styles.description, { color: theme.muted }]}>Adicione livros à biblioteca antes de organizá-los.</Text> : books.map((book) => {
              const checked = selectedBooks.includes(book.id);
              return <Pressable key={book.id} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => toggleBook(book.id)} style={[styles.bookRow, { borderBottomColor: theme.line }]}>
                {book.custom_cover_uri || book.google_cover_uri ? <Image source={{ uri: book.custom_cover_uri ?? book.google_cover_uri ?? undefined }} style={styles.bookCover} contentFit="cover" /> : <View style={[styles.bookCover, styles.coverFallback, { backgroundColor: theme.soft }]}><Text style={{ color: theme.accent }}>✦</Text></View>}
                <View style={styles.bookLabel}><Text numberOfLines={1} style={[styles.bookTitle, { color: theme.ink }]}>{book.title}</Text><Text numberOfLines={1} style={[styles.description, { color: theme.muted }]}>{book.author}</Text></View>
                <View style={[styles.checkbox, { borderColor: checked ? color : theme.line, backgroundColor: checked ? color : 'transparent' }]}>{checked && <Text style={styles.check}>✓</Text>}</View>
              </Pressable>;
            })}
            <View style={styles.actions}>
              {selectedShelf && <Pressable onPress={() => confirmDelete(selectedShelf)} style={styles.deleteButton}><Text style={{ color: '#A84F48', fontWeight: '700' }}>Excluir</Text></Pressable>}
              <Pressable onPress={cancelEditor} style={styles.cancelButton}><Text style={{ color: theme.muted }}>Cancelar</Text></Pressable>
              <Pressable disabled={saving} onPress={() => void saveShelf()} style={[styles.saveButton, { backgroundColor: color }]}><Text style={styles.saveText}>{saving ? 'Salvando…' : selectedShelf ? 'Salvar alterações' : 'Criar estante'}</Text></Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { paddingHorizontal: 22, paddingBottom: 35 }, top: { paddingTop: 12 }, back: { fontSize: 13, fontWeight: '700', marginBottom: 14 },
  sceneHeader: { marginBottom: 20 }, description: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  editor: { borderWidth: 1, padding: 15, marginBottom: 25 }, editorTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 }, input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 13 },
  label: { fontSize: 10, fontWeight: '700', marginTop: 14, marginBottom: 7 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, iconOption: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2 }, colorOption: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  bookRow: { minHeight: 60, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }, bookCover: { width: 32, height: 44, borderRadius: 4 }, coverFallback: { alignItems: 'center', justifyContent: 'center' }, bookLabel: { flex: 1 }, bookTitle: { fontSize: 12, fontWeight: '600' }, checkbox: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, check: { color: 'white', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 16 }, deleteButton: { marginRight: 'auto', paddingVertical: 10 }, cancelButton: { paddingVertical: 10 }, saveButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, saveText: { color: 'white', fontSize: 11, fontWeight: '700' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { fontSize: 19, fontWeight: '700' }, newButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9 }, newButtonText: { fontSize: 11, fontWeight: '700' },
  shelfCard: { minHeight: 73, borderWidth: 1, borderLeftWidth: 4, paddingHorizontal: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 12 }, shelfIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, shelfIconImage: { width: '100%', height: '100%' }, shelfName: { fontSize: 13, fontWeight: '700' }, chevron: { fontSize: 25, paddingHorizontal: 4 },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 17, marginTop: 5 }, emptyTitle: { fontSize: 14, fontWeight: '700' }, emptyAction: { minHeight: 40, paddingHorizontal: 13, borderRadius: 9, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  glyphCenter: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  iconEditorRow: { flexDirection: 'row', alignItems: 'center', gap: 13 }, iconEditorPreview: { width: 68, height: 68, borderRadius: 19, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, iconEditorImage: { width: '100%', height: '100%' }, iconEditorActions: { flex: 1, alignItems: 'flex-start', gap: 6 }, pickIconButton: { minHeight: 38, paddingHorizontal: 13, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, pickIconText: { fontSize: 11, fontWeight: '700' }, removeIconText: { fontSize: 10, fontWeight: '600' }, iconHelp: { fontSize: 9, lineHeight: 13 },
  detailBanner: { minHeight: 86, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }, detailIconFrame: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, detailIconImage: { width: '100%', height: '100%' }, detailName: { fontSize: 16, fontWeight: '700' }, detailCount: { fontSize: 11, marginTop: 4 }, detailEdit: { minHeight: 36, paddingHorizontal: 14, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  shelfBookRow: { paddingHorizontal: 11, marginBottom: 9, borderWidth: 1, borderBottomWidth: 1 }, detailBookCover: { width: 48, height: 66, borderRadius: 5 },
});
