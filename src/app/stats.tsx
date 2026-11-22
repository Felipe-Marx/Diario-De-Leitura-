import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';

import { getCompletedBookCountByYear, getReadingActivityByYear, type ReadingActivity } from '@/db/books';
import { getReaderTheme } from '@/constants/reader-themes';
import { ThemeSceneHeader } from '@/components/theme-scene-header';
import { useReaderProfile } from '@/providers/reader-profile';

const today = new Date();
const todayIso = toIsoDate(today);

export default function StatisticsScreen() {
  const database = useSQLiteContext();
  const [year, setYear] = useState(today.getFullYear());
  const [activity, setActivity] = useState<ReadingActivity[]>([]);
  const [completedBooks, setCompletedBooks] = useState(0);
  const { profile, loading: profileLoading } = useReaderProfile();
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [heatmapReady, setHeatmapReady] = useState(false);
  const theme = getReaderTheme(profile?.theme_key);

  const loadData = useCallback(async (isActive: () => boolean) => {
    const [savedActivity, completedBookCount] = await Promise.all([
      getReadingActivityByYear(database, year),
      getCompletedBookCountByYear(database, year),
    ]);
    if (!isActive()) return false;
    setActivity(savedActivity);
    setCompletedBooks(completedBookCount);
    setLoadError(false);
    setLoading(false);
    return true;
  }, [database, year]);

  useFocusEffect(useCallback(() => {
    let active = true;
    let delayId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    void loadData(() => active).then((loaded) => {
      if (!loaded || !active) return;
      delayId = setTimeout(() => {
        idleId = requestIdleCallback(() => {
          if (active) setHeatmapReady(true);
          idleId = null;
        }, { timeout: 350 });
      }, 220);
    }).catch(() => {
      if (active) {
        setLoading(false);
        setLoadError(true);
      }
    });

    return () => {
      active = false;
      if (delayId !== null) clearTimeout(delayId);
      if (idleId !== null) cancelIdleCallback(idleId);
    };
  }, [loadData]));

  const pagesByDate = useMemo(() => new Map(activity.map((item) => [item.reading_date, item.pages_read])), [activity]);
  const activeDays = activity.length;
  const totalPages = activity.reduce((sum, item) => sum + item.pages_read, 0);
  const longestStreak = useMemo(() => calculateLongestStreak(activity), [activity]);
  const weeks = useMemo(() => heatmapReady ? makeYearGrid(year) : [], [heatmapReady, year]);
  const selectedPages = pagesByDate.get(selectedDate) ?? 0;

  if (profileLoading || !profile) {
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color="#777B70" /></SafeAreaView>;
  }

  function changeYear(nextYear: number) {
    setYear(nextYear);
    setSelectedDate(nextYear === today.getFullYear() ? todayIso : `${nextYear}-01-01`);
    setLoading(true);
    setLoadError(false);
    setHeatmapReady(false);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={[styles.backText, { color: theme.accent }]}>‹  Minha estante</Text>
        </Pressable>
        <ThemeSceneHeader
          themeKey={profile.theme_key}
          eyebrow={`SEU CAMINHO DE LEITURA ${theme.symbol}`}
          title="Estatísticas"
          subtitle="Cada página registrada deixa uma marca no seu ano."
          minHeight={150}
          style={styles.sceneHeader}
        />

        <View style={[styles.yearSelector, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
          <Pressable onPress={() => changeYear(year - 1)} accessibilityRole="button" accessibilityLabel="Ver ano anterior" style={styles.yearArrow}>
            <Text style={[styles.yearArrowText, { color: theme.accent }]}>‹</Text>
          </Pressable>
          <Text style={[styles.yearText, { color: theme.ink }]}>{year}</Text>
          <Pressable onPress={() => changeYear(year + 1)} disabled={year >= today.getFullYear()} accessibilityRole="button" accessibilityLabel="Ver próximo ano" style={[styles.yearArrow, year >= today.getFullYear() && styles.disabled]}>
            <Text style={[styles.yearArrowText, { color: theme.accent }]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard label="Páginas registradas" value={loading || loadError ? '—' : totalPages.toLocaleString('pt-BR')} theme={theme} />
          <SummaryCard label="Dias com leitura" value={loading || loadError ? '—' : String(activeDays)} theme={theme} />
          <SummaryCard label="Maior sequência" value={loading || loadError ? '—' : `${longestStreak} ${longestStreak === 1 ? 'dia' : 'dias'}`} theme={theme} />
          <SummaryCard label="Livros concluídos" value={loading || loadError ? '—' : String(completedBooks)} theme={theme} />
        </View>

        <View style={[styles.heatmapCard, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>Mapa de leitura</Text>
          <Text style={[styles.cardSubtitle, { color: theme.muted }]}>Páginas por dia · toque em um quadrado para ver detalhes</Text>
          {loadError ? (
            <View style={styles.heatmapLoading}>
              <Text style={[styles.heatmapLoadingText, { color: theme.muted }]}>Não foi possível carregar o mapa.</Text>
            </View>
          ) : heatmapReady ? (
            <View style={styles.heatmapGrid}>
              <View style={styles.weekdayColumn}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekday, { color: theme.muted }]}>{day}</Text>)}
              </View>
              <FlatList
                style={styles.weekList}
                horizontal
                data={weeks}
                keyExtractor={(_, index) => `week-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.heatmapScroll}
                initialNumToRender={24}
                maxToRenderPerBatch={12}
                windowSize={1}
                updateCellsBatchingPeriod={25}
                getItemLayout={(_, index) => ({ length: 15, offset: 15 * index, index })}
                renderItem={({ item: week }) => (
                  <View style={styles.weekColumn}>
                    <Text style={[styles.monthLabel, { color: theme.muted }]} numberOfLines={1}>{week.monthLabel}</Text>
                    <View style={styles.weekDays}>
                      {week.days.map((date, dayIndex) => {
                        if (!date) return <View key={`empty-${dayIndex}`} style={styles.dayCell} />;
                        const count = pagesByDate.get(date) ?? 0;
                        const selected = selectedDate === date;
                        return (
                          <HeatmapDayCell
                            key={date}
                            date={date}
                            count={count}
                            selected={selected}
                            theme={theme}
                            onSelect={setSelectedDate}
                            accessibilityLabel={`${formatDate(date)}: ${count} ${count === 1 ? 'página' : 'páginas'} lidas`}
                          />
                        );
                      })}
                    </View>
                  </View>
                )}
              />
            </View>
          ) : (
            <View style={styles.heatmapLoading}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.heatmapLoadingText, { color: theme.muted }]}>Preparando o mapa...</Text>
            </View>
          )}
          <View style={[styles.selectedDay, { borderTopColor: theme.line }]}>
            <Text style={[styles.selectedDateText, { color: theme.ink }]}>{formatDate(selectedDate)}</Text>
            <Text style={[styles.selectedPagesText, { color: theme.accent }]}>{selectedPages} {selectedPages === 1 ? 'página' : 'páginas'} registradas</Text>
          </View>
          <View style={styles.legend}>
            <Text style={[styles.legendText, { color: theme.muted }]}>Menos</Text>
            {[0, 1, 6, 16, 31].map((count) => <View key={count} style={[styles.legendCell, { backgroundColor: heatColor(count, theme) }]} />)}
            <Text style={[styles.legendText, { color: theme.muted }]}>Mais</Text>
          </View>
          <Text style={[styles.note, { color: theme.muted }]}>O histórico começa a ser contado a partir de agora. Ajustes para uma página menor não apagam registros anteriores.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof getReaderTheme> }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
      <Text style={[styles.summaryValue, { color: theme.accent }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.summaryLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const HeatmapDayCell = memo(function HeatmapDayCell({
  date,
  count,
  selected,
  theme,
  onSelect,
  accessibilityLabel,
}: {
  date: string;
  count: number;
  selected: boolean;
  theme: ReturnType<typeof getReaderTheme>;
  onSelect: (date: string) => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={() => onSelect(date)}
      style={[styles.dayCell, { backgroundColor: heatColor(count, theme), borderColor: selected ? theme.ink : 'transparent' }]}
    />
  );
});

function makeYearGrid(year: number) {
  const firstDay = new Date(year, 0, 1, 12);
  const weekCount = Math.ceil((daysInYear(year) + firstDay.getDay()) / 7);
  const start = new Date(year, 0, 1 - firstDay.getDay(), 12);
  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const dates = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + weekIndex * 7 + dayIndex, 12);
      return date.getFullYear() === year ? toIsoDate(date) : null;
    });
    const firstOfMonth = dates.find((date) => date?.endsWith('-01'));
    const monthLabel = firstOfMonth ? new Date(`${firstOfMonth}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : '';
    return { days: dates, monthLabel };
  });
}

function daysInYear(year: number) {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function calculateLongestStreak(activity: ReadingActivity[]) {
  let best = 0;
  let current = 0;
  let previousDay: number | null = null;
  for (const { reading_date } of activity) {
    const [year, month, day] = reading_date.split('-').map(Number);
    const dayNumber = Date.UTC(year, month - 1, day) / 86_400_000;
    current = previousDay !== null && dayNumber === previousDay + 1 ? current + 1 : 1;
    best = Math.max(best, current);
    previousDay = dayNumber;
  }
  return best;
}

function heatColor(pages: number, theme: ReturnType<typeof getReaderTheme>) {
  if (pages >= 31) return theme.accent;
  if (pages >= 16) return `${theme.accent}B3`;
  if (pages >= 6) return `${theme.accent}80`;
  if (pages > 0) return `${theme.accent}4D`;
  return theme.soft;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 38 },
  backButton: { paddingVertical: 11, alignSelf: 'flex-start' },
  backText: { fontSize: 12, fontWeight: '700' },
  sceneHeader: { marginTop: 4, marginBottom: 18 },
  yearSelector: { minHeight: 48, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 19, paddingHorizontal: 15 },
  yearArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  yearArrowText: { fontSize: 27, lineHeight: 30 },
  yearText: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  summaryCard: { width: '48%', minHeight: 78, borderWidth: 1, padding: 12, justifyContent: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { fontSize: 10, marginTop: 3 },
  heatmapCard: { borderWidth: 1, padding: 14, marginTop: 17 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSubtitle: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  heatmapScroll: { paddingTop: 17, paddingBottom: 5 },
  weekList: { flex: 1 },
  heatmapLoading: { height: 136, alignItems: 'center', justifyContent: 'center', gap: 8 },
  heatmapLoadingText: { fontSize: 10 },
  heatmapGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  weekdayColumn: { width: 19, paddingTop: 34, gap: 3 },
  weekday: { width: 12, height: 12, fontSize: 8, lineHeight: 11, textAlign: 'center' },
  weekColumn: { width: 13, marginRight: 2 },
  monthLabel: { height: 12, width: 15, fontSize: 8, lineHeight: 10, marginBottom: 5 },
  weekDays: { gap: 3 },
  dayCell: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  selectedDay: { borderTopWidth: 1, marginTop: 11, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectedDateText: { flex: 1, fontSize: 11, fontWeight: '600' },
  selectedPagesText: { fontSize: 11, fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 11 },
  legendText: { fontSize: 9 },
  legendCell: { width: 11, height: 11, borderRadius: 3 },
  note: { fontSize: 9, lineHeight: 14, marginTop: 11 },
});
