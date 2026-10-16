import type { SQLiteDatabase } from 'expo-sqlite';

export type BookStatus = 'quero_ler' | 'lendo' | 'concluido';

export type Book = {
  id: number;
  title: string;
  author: string;
  total_pages: number;
  current_page: number;
  status: BookStatus;
  google_volume_id: string | null;
  google_info_link: string | null;
  google_cover_uri: string | null;
  custom_cover_uri: string | null;
};

export type ReaderProfile = {
  display_name: string;
  avatar_uri: string | null;
  theme_key: string;
  annual_goal: number;
  reader_term: 'masculine' | 'feminine' | 'neutral';
};

export type ReadingNote = {
  id: number;
  book_id: number;
  text: string;
  page_number: number | null;
  created_at: string;
};

export async function initializeDatabase(database: SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      total_pages INTEGER NOT NULL,
      current_page INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'quero_ler',
      google_volume_id TEXT,
      google_info_link TEXT,
      google_cover_uri TEXT,
      custom_cover_uri TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reader_profile (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      display_name TEXT NOT NULL DEFAULT 'Pessoa leitora',
      avatar_uri TEXT,
      theme_key TEXT NOT NULL DEFAULT 'classic',
      annual_goal INTEGER NOT NULL DEFAULT 12,
      reader_term TEXT NOT NULL DEFAULT 'neutral'
    );
    CREATE TABLE IF NOT EXISTS reading_notes (
      id INTEGER PRIMARY KEY NOT NULL,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      page_number INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(books)');
  if (!columns.some((column) => column.name === 'google_volume_id')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN google_volume_id TEXT');
  }
  if (!columns.some((column) => column.name === 'google_cover_uri')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN google_cover_uri TEXT');
  }
  if (!columns.some((column) => column.name === 'google_info_link')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN google_info_link TEXT');
  }
  if (!columns.some((column) => column.name === 'custom_cover_uri')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN custom_cover_uri TEXT');
  }

  await database.runAsync(
    "INSERT OR IGNORE INTO reader_profile (id, display_name, theme_key, annual_goal) VALUES (1, 'Pessoa leitora', 'classic', 12)",
  );

  await database.runAsync(`
    UPDATE reader_profile SET theme_key = CASE theme_key
      WHEN 'forest' THEN 'classic'
      WHEN 'plum' THEN 'witch'
      WHEN 'ocean' THEN 'space'
      WHEN 'midnight' THEN 'space'
      WHEN 'terracotta' THEN 'flowers'
      ELSE theme_key
    END WHERE id = 1
  `);

  const profileColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(reader_profile)');
  if (!profileColumns.some((column) => column.name === 'annual_goal')) {
    await database.execAsync('ALTER TABLE reader_profile ADD COLUMN annual_goal INTEGER NOT NULL DEFAULT 12');
  }
  if (!profileColumns.some((column) => column.name === 'reader_term')) {
    await database.execAsync("ALTER TABLE reader_profile ADD COLUMN reader_term TEXT NOT NULL DEFAULT 'neutral'");
  }
  await database.runAsync("UPDATE reader_profile SET display_name = 'Pessoa leitora' WHERE id = 1 AND display_name = 'Leitora'");
}

export function getBooks(database: SQLiteDatabase) {
  return database.getAllAsync<Book>(
    'SELECT id, title, author, total_pages, current_page, status, google_volume_id, google_info_link, google_cover_uri, custom_cover_uri FROM books ORDER BY created_at DESC, id DESC',
  );
}

export function getReaderProfile(database: SQLiteDatabase) {
  return database.getFirstAsync<ReaderProfile>(
    'SELECT display_name, avatar_uri, theme_key, annual_goal, reader_term FROM reader_profile WHERE id = 1',
  );
}

export async function saveReaderProfile(database: SQLiteDatabase, profile: ReaderProfile) {
  await database.runAsync(
    'UPDATE reader_profile SET display_name = ?, avatar_uri = ?, theme_key = ?, annual_goal = ?, reader_term = ? WHERE id = 1',
    profile.display_name.trim() || 'Pessoa leitora',
    profile.avatar_uri,
    profile.theme_key,
    profile.annual_goal,
    profile.reader_term,
  );
}

export type NewBook = Pick<Book, 'title' | 'author' | 'total_pages'> & {
  google_volume_id?: string | null;
  google_info_link?: string | null;
  google_cover_uri?: string | null;
  custom_cover_uri?: string | null;
};

export async function createBook(
  database: SQLiteDatabase,
  book: NewBook,
) {
  await database.runAsync(
    'INSERT INTO books (title, author, total_pages, google_volume_id, google_info_link, google_cover_uri, custom_cover_uri) VALUES (?, ?, ?, ?, ?, ?, ?)',
    book.title.trim(),
    book.author.trim(),
    book.total_pages,
    book.google_volume_id ?? null,
    book.google_info_link ?? null,
    book.google_cover_uri ?? null,
    book.custom_cover_uri ?? null,
  );
}

export async function updateBookDetails(
  database: SQLiteDatabase,
  book: Pick<Book, 'id' | 'title' | 'author' | 'total_pages' | 'current_page'>,
) {
  const status: BookStatus = book.current_page === 0
    ? 'quero_ler'
    : book.current_page >= book.total_pages
      ? 'concluido'
      : 'lendo';
  await database.runAsync(
    'UPDATE books SET title = ?, author = ?, total_pages = ?, current_page = ?, status = ? WHERE id = ?',
    book.title.trim(),
    book.author.trim(),
    book.total_pages,
    book.current_page,
    status,
    book.id,
  );
}

export async function updateCustomCover(database: SQLiteDatabase, id: number, uri: string | null) {
  await database.runAsync('UPDATE books SET custom_cover_uri = ? WHERE id = ?', uri, id);
}

export async function startBook(database: SQLiteDatabase, id: number) {
  await database.runAsync(
    "UPDATE books SET status = 'lendo' WHERE id = ? AND status = 'quero_ler'",
    id,
  );
}

export async function advancePage(database: SQLiteDatabase, book: Book) {
  const nextPage = Math.min(book.current_page + 1, book.total_pages);
  const status = nextPage === book.total_pages ? 'concluido' : 'lendo';
  await database.runAsync(
    'UPDATE books SET current_page = ?, status = ? WHERE id = ?',
    nextPage,
    status,
    book.id,
  );
}

export async function deleteBook(database: SQLiteDatabase, id: number) {
  await database.runAsync('DELETE FROM books WHERE id = ?', id);
}

export function getReadingNotes(database: SQLiteDatabase, bookId: number) {
  return database.getAllAsync<ReadingNote>(
    'SELECT id, book_id, text, page_number, created_at FROM reading_notes WHERE book_id = ? ORDER BY created_at DESC, id DESC',
    bookId,
  );
}

export async function createReadingNote(
  database: SQLiteDatabase,
  bookId: number,
  text: string,
  pageNumber: number | null,
) {
  await database.runAsync(
    'INSERT INTO reading_notes (book_id, text, page_number) VALUES (?, ?, ?)',
    bookId,
    text.trim(),
    pageNumber,
  );
}

export async function deleteReadingNote(database: SQLiteDatabase, noteId: number) {
  await database.runAsync('DELETE FROM reading_notes WHERE id = ?', noteId);
}
