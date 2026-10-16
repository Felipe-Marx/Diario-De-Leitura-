import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';

import { initializeDatabase } from '@/db/books';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="diario-leitura.db" onInit={initializeDatabase}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="add-book" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="book/edit/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </SQLiteProvider>
  );
}
