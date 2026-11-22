import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { advancePage, getBooks, type Book } from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';
import { ThemeSceneHeader } from '@/components/theme-scene-header';
import { ClockIcon } from '@/components/clock-icon';
import { useReaderProfile } from '@/providers/reader-profile';

export default function InProgressScreen() {
  const database = useSQLiteContext();
  const [books, setBooks] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { profile } = useReaderProfile();
  const theme = getReaderTheme(profile?.theme_key ?? 'classic');

  const refresh = useCallback(async () => {
    try { setBooks((await getBooks(database)).filter((book) => book.status === 'lendo')); }
    finally { setLoaded(true); }
  }, [database]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <FlatList
        data={books}
        keyExtractor={(book) => String(book.id)}
        contentContainerStyle={styles.content}
        initialNumToRender={5}
        windowSize={7}
        ListHeaderComponent={
          <View>
            <Pressable onPress={() => router.back()} accessibilityRole="button">
              <Text style={[styles.back, { color: theme.accent }]}>‹ Biblioteca</Text>
            </Pressable>
            <ThemeSceneHeader
              themeKey={profile?.theme_key}
              eyebrow="SUA LEITURA AGORA"
              title="Em andamento"
              subtitle={`${books.length} ${books.length === 1 ? 'livro' : 'livros'} em leitura`}
              minHeight={138}
              accessory={<View style={[styles.clockAccessory, { backgroundColor: theme.paper }]}><ClockIcon color={theme.accent} size={18} /></View>}
              style={styles.sceneHeader}
            />
          </View>
        }
        ListEmptyComponent={!loaded ? <ActivityIndicator color={theme.accent} style={styles.empty} /> : <View style={styles.empty}><Text style={[styles.emptyTitle, { color: theme.ink }]}>Nenhuma leitura em andamento</Text><Text style={[styles.subtitle, { color: theme.muted }]}>Quando começar um livro, ele aparecerá aqui.</Text></View>}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const cover = item.custom_cover_uri ?? item.google_cover_uri;
          const progress = Math.min(100, Math.round((item.current_page / item.total_pages) * 100));
          return <View style={[styles.card, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
            <Pressable onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(item.id) } })} style={styles.bookPressable}>
              {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" cachePolicy="disk" recyclingKey={cover} /> : <View style={[styles.cover, styles.noCover, { backgroundColor: theme.soft }]}><Text style={{ color: theme.accent }}>✦</Text></View>}
              <View style={styles.bookInfo}><Text numberOfLines={2} style={[styles.bookTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>{item.title}</Text><Text numberOfLines={1} style={[styles.author, { color: theme.muted }]}>{item.author}</Text><View style={[styles.track, { backgroundColor: theme.soft }]}><View style={[styles.fill, { width: `${progress}%`, backgroundColor: theme.accent }]} /></View><Text style={[styles.progress, { color: theme.muted }]}>{item.current_page} de {item.total_pages} páginas · {progress}%</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Registrar uma página de ${item.title}`} onPress={() => void advancePage(database, item).then(refresh)} style={[styles.advance, { backgroundColor: theme.soft }]}><Text style={{ color: theme.accent, fontSize: 20 }}>＋</Text></Pressable>
          </View>;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { paddingHorizontal: 22, paddingBottom: 32 },
  back: { fontSize: 13, fontWeight: '700', marginBottom: 14, marginTop: 12 },
  sceneHeader: { marginBottom: 22 },
  clockAccessory: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 12, marginTop: 6 },
  card: { minHeight: 112, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, bookPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 58, height: 82, borderRadius: 6 }, noCover: { alignItems: 'center', justifyContent: 'center' },
  bookInfo: { flex: 1 }, bookTitle: { fontSize: 14, fontWeight: '700' }, author: { fontSize: 11, marginTop: 4 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 12 }, fill: { height: '100%', borderRadius: 3 }, progress: { fontSize: 10, marginTop: 5 },
  advance: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 }, emptyTitle: { fontSize: 15, fontWeight: '700' },
});
