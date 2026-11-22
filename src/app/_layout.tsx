import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';

import { initializeDatabase } from '@/db/books';
import { ReaderProfileProvider } from '@/providers/reader-profile';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="diario-leitura.db" onInit={initializeDatabase}>
      <ReaderProfileProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="in-progress" />
          <Stack.Screen name="add-book" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile" />
          <Stack.Screen name="shelves" />
          <Stack.Screen name="book/edit/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      </ReaderProfileProvider>
    </SQLiteProvider>
  );
}
