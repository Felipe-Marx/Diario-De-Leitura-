import type { SQLiteDatabase } from 'expo-sqlite';

export type BookStatus = 'quero_ler' | 'lendo' | 'concluido';

export type Book = {
  id: number;
  title: string;
  author: string;
  total_pages: number;
  current_page: number;
  status: BookStatus;
  rating: number | null;
  format: 'fisico' | 'kindle' | null;
  google_volume_id: string | null;
  google_info_link: string | null;
  google_cover_uri: string | null;
  custom_cover_uri: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
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
  updated_at: string | null;
};

export type ReadingActivity = { reading_date: string; pages_read: number };
export type ReadingActivityEntry = { book_id: number; reading_date: string; pages_read: number };
export type ReadingShelf = { id: number; name: string; color: string; icon: string; icon_uri: string | null; sort_order: number; created_at: string };
export type ReadingShelfBook = { shelf_id: number; book_id: number; sort_order: number };

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
      rating REAL CHECK (rating IS NULL OR (rating BETWEEN 0.5 AND 5 AND rating * 2 = CAST(rating * 2 AS INTEGER))),
      format TEXT,
      google_volume_id TEXT,
      google_info_link TEXT,
      google_cover_uri TEXT,
      custom_cover_uri TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
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
    CREATE TABLE IF NOT EXISTS reading_activity (
      id INTEGER PRIMARY KEY NOT NULL,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      reading_date TEXT NOT NULL,
      pages_read INTEGER NOT NULL CHECK (pages_read > 0),
      UNIQUE (book_id, reading_date)
    );
    CREATE TABLE IF NOT EXISTS reading_shelves (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#48654B',
      icon TEXT NOT NULL DEFAULT '✦',
      icon_uri TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reading_shelf_books (
      shelf_id INTEGER NOT NULL REFERENCES reading_shelves(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (shelf_id, book_id)
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
  if (!columns.some((column) => column.name === 'started_at')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN started_at TEXT');
  }
  if (!columns.some((column) => column.name === 'completed_at')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN completed_at TEXT');
  }
  if (!columns.some((column) => column.name === 'rating')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN rating REAL');
  }
  if (!columns.some((column) => column.name === 'format')) {
    await database.execAsync('ALTER TABLE books ADD COLUMN format TEXT');
  }
  await migrateLegacyBookRatingConstraint(database);
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS books_completed_at_idx ON books(completed_at);
    CREATE INDEX IF NOT EXISTS reading_activity_date_idx ON reading_activity(reading_date);
    CREATE INDEX IF NOT EXISTS reading_shelf_books_book_idx ON reading_shelf_books(book_id);
  `);
  const noteColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(reading_notes)');
  if (!noteColumns.some((column) => column.name === 'updated_at')) {
    await database.execAsync('ALTER TABLE reading_notes ADD COLUMN updated_at TEXT');
  }
  const shelfColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(reading_shelves)');
  if (!shelfColumns.some((column) => column.name === 'icon_uri')) {
    await database.execAsync('ALTER TABLE reading_shelves ADD COLUMN icon_uri TEXT');
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

async function migrateLegacyBookRatingConstraint(database: SQLiteDatabase) {
  const booksSchema = await database.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'books'",
  );
  if (!booksSchema?.sql || !/CHECK\s*\(\s*rating\s+BETWEEN\s+1\s+AND\s+5\s*\)/i.test(booksSchema.sql)) return;

  // SQLite cannot alter an existing CHECK constraint, so rebuild the table while preserving its references.
  await database.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await database.withTransactionAsync(async () => {
      await database.execAsync(`
        CREATE TABLE books_half_star_migration (
          id INTEGER PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          total_pages INTEGER NOT NULL,
          current_page INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'quero_ler',
          rating REAL CHECK (rating IS NULL OR (rating BETWEEN 0.5 AND 5 AND rating * 2 = CAST(rating * 2 AS INTEGER))),
          format TEXT,
          google_volume_id TEXT,
          google_info_link TEXT,
          google_cover_uri TEXT,
          custom_cover_uri TEXT,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT
        );
        INSERT INTO books_half_star_migration (
          id, title, author, total_pages, current_page, status, rating, format,
          google_volume_id, google_info_link, google_cover_uri, custom_cover_uri,
          started_at, completed_at, created_at, updated_at
        )
        SELECT
          id, title, author, total_pages, current_page, status, rating, format,
          google_volume_id, google_info_link, google_cover_uri, custom_cover_uri,
          started_at, completed_at, created_at, updated_at
        FROM books;
        DROP TABLE books;
        ALTER TABLE books_half_star_migration RENAME TO books;
        CREATE INDEX IF NOT EXISTS books_completed_at_idx ON books(completed_at);
      `);
    });
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON');
  }
}

export function getBooks(database: SQLiteDatabase) {
  return database.getAllAsync<Book>(
    'SELECT id, title, author, total_pages, current_page, status, rating, format, google_volume_id, google_info_link, google_cover_uri, custom_cover_uri, started_at, completed_at, created_at FROM books ORDER BY created_at DESC, id DESC',
  );
}

export function getReaderProfile(database: SQLiteDatabase) {
  return database.getFirstAsync<ReaderProfile>(
    'SELECT display_name, avatar_uri, theme_key, annual_goal, reader_term FROM reader_profile WHERE id = 1',
  );
}

export type LibraryBackupData = {
  profile: ReaderProfile;
  books: Book[];
  notes: ReadingNote[];
  readingActivity: ReadingActivityEntry[];
  shelves: ReadingShelf[];
  shelfBooks: ReadingShelfBook[];
};

export async function getLibraryBackupData(database: SQLiteDatabase): Promise<LibraryBackupData> {
  const [profile, books, notes, readingActivity, shelves, shelfBooks] = await Promise.all([
    getReaderProfile(database),
    database.getAllAsync<Book>(
      'SELECT id, title, author, total_pages, current_page, status, rating, format, google_volume_id, google_info_link, google_cover_uri, custom_cover_uri, started_at, completed_at, created_at FROM books ORDER BY id',
    ),
    database.getAllAsync<ReadingNote>(
      'SELECT id, book_id, text, page_number, created_at, updated_at FROM reading_notes ORDER BY id',
    ),
    database.getAllAsync<ReadingActivityEntry>(
      'SELECT book_id, reading_date, pages_read FROM reading_activity ORDER BY reading_date, book_id',
    ),
    database.getAllAsync<ReadingShelf>('SELECT id, name, color, icon, icon_uri, sort_order, created_at FROM reading_shelves ORDER BY sort_order, id'),
    database.getAllAsync<ReadingShelfBook>('SELECT shelf_id, book_id, sort_order FROM reading_shelf_books ORDER BY shelf_id, sort_order, book_id'),
  ]);
  if (!profile) throw new Error('Perfil local não encontrado.');
  return { profile, books, notes, readingActivity, shelves, shelfBooks };
}

export function getReadingActivityByYear(database: SQLiteDatabase, year: number) {
  return database.getAllAsync<ReadingActivity>(
    'SELECT reading_date, SUM(pages_read) AS pages_read FROM reading_activity WHERE reading_date >= ? AND reading_date < ? GROUP BY reading_date ORDER BY reading_date',
    `${year}-01-01`,
    `${year + 1}-01-01`,
  );
}

export async function getCompletedBookCountByYear(database: SQLiteDatabase, year: number) {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM books WHERE completed_at >= ? AND completed_at < ?',
    `${year}-01-01`,
    `${year + 1}-01-01`,
  );
  return row?.count ?? 0;
}

export async function restoreLibraryBackup(database: SQLiteDatabase, data: LibraryBackupData) {
  await database.withTransactionAsync(async () => {
    await database.execAsync('DELETE FROM reading_shelf_books; DELETE FROM reading_shelves; DELETE FROM reading_activity; DELETE FROM reading_notes; DELETE FROM books;');
    await database.runAsync(
      'UPDATE reader_profile SET display_name = ?, avatar_uri = ?, theme_key = ?, annual_goal = ?, reader_term = ? WHERE id = 1',
      data.profile.display_name,
      data.profile.avatar_uri,
      data.profile.theme_key,
      data.profile.annual_goal,
      data.profile.reader_term,
    );
    for (const book of data.books) {
      assertValidBookRating(book.rating ?? null);
      await database.runAsync(
        'INSERT INTO books (id, title, author, total_pages, current_page, status, rating, format, google_volume_id, google_info_link, google_cover_uri, custom_cover_uri, started_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        book.id, book.title, book.author, book.total_pages, book.current_page, book.status, book.rating ?? null, book.format ?? null,
        book.google_volume_id, book.google_info_link, book.google_cover_uri, book.custom_cover_uri,
        book.started_at, book.completed_at, book.created_at,
      );
    }
    for (const note of data.notes) {
      await database.runAsync(
        'INSERT INTO reading_notes (id, book_id, text, page_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        note.id, note.book_id, note.text, note.page_number, note.created_at, note.updated_at,
      );
    }
    for (const activity of data.readingActivity) {
      await database.runAsync(
        'INSERT INTO reading_activity (book_id, reading_date, pages_read) VALUES (?, ?, ?)',
        activity.book_id, activity.reading_date, activity.pages_read,
      );
    }
    for (const shelf of data.shelves ?? []) {
      await database.runAsync(
        'INSERT INTO reading_shelves (id, name, color, icon, icon_uri, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        shelf.id, shelf.name, shelf.color, shelf.icon, shelf.icon_uri ?? null, shelf.sort_order, shelf.created_at,
      );
    }
    for (const shelfBook of data.shelfBooks ?? []) {
      await database.runAsync(
        'INSERT INTO reading_shelf_books (shelf_id, book_id, sort_order) VALUES (?, ?, ?)',
        shelfBook.shelf_id, shelfBook.book_id, shelfBook.sort_order,
      );
    }
  });
}

export function getReadingShelves(database: SQLiteDatabase) {
  return database.getAllAsync<ReadingShelf>(
    'SELECT id, name, color, icon, icon_uri, sort_order, created_at FROM reading_shelves ORDER BY sort_order, id',
  );
}

export function getBooksInShelf(database: SQLiteDatabase, shelfId: number) {
  return database.getAllAsync<Book>(
    'SELECT books.id, books.title, books.author, books.total_pages, books.current_page, books.status, books.rating, books.format, books.google_volume_id, books.google_info_link, books.google_cover_uri, books.custom_cover_uri, books.started_at, books.completed_at, books.created_at FROM books INNER JOIN reading_shelf_books ON reading_shelf_books.book_id = books.id WHERE reading_shelf_books.shelf_id = ? ORDER BY reading_shelf_books.sort_order, reading_shelf_books.rowid',
    shelfId,
  );
}

export async function createReadingShelf(database: SQLiteDatabase, name: string, color: string, icon: string, iconUri: string | null) {
  const orderRow = await database.getFirstAsync<{ nextOrder: number }>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM reading_shelves');
  await database.runAsync(
    'INSERT INTO reading_shelves (name, color, icon, icon_uri, sort_order) VALUES (?, ?, ?, ?, ?)',
    name.trim(), color, icon, iconUri, orderRow?.nextOrder ?? 0,
  );
}

export async function updateReadingShelf(database: SQLiteDatabase, shelfId: number, name: string, color: string, icon: string, iconUri: string | null) {
  await database.runAsync(
    'UPDATE reading_shelves SET name = ?, color = ?, icon = ?, icon_uri = ? WHERE id = ?',
    name.trim(), color, icon, iconUri, shelfId,
  );
}

export async function setReadingShelfBooks(database: SQLiteDatabase, shelfId: number, bookIds: number[]) {
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM reading_shelf_books WHERE shelf_id = ?', shelfId);
    for (const [sortOrder, bookId] of bookIds.entries()) {
      await database.runAsync(
        'INSERT INTO reading_shelf_books (shelf_id, book_id, sort_order) VALUES (?, ?, ?)',
        shelfId, bookId, sortOrder,
      );
    }
  });
}

export async function deleteReadingShelf(database: SQLiteDatabase, shelfId: number) {
  await database.runAsync('DELETE FROM reading_shelves WHERE id = ?', shelfId);
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
  rating?: number | null;
  format?: Book['format'];
  google_volume_id?: string | null;
  google_info_link?: string | null;
  google_cover_uri?: string | null;
  custom_cover_uri?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

export async function createBook(
  database: SQLiteDatabase,
  book: NewBook,
) {
  assertValidBookRating(book.rating ?? null);
  await database.runAsync(
    'INSERT INTO books (title, author, total_pages, google_volume_id, google_info_link, google_cover_uri, custom_cover_uri, current_page, status, rating, format, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    book.title.trim(),
    book.author.trim(),
    book.total_pages,
    book.google_volume_id ?? null,
    book.google_info_link ?? null,
    book.google_cover_uri ?? null,
    book.custom_cover_uri ?? null,
    book.completed_at ? book.total_pages : 0,
    book.completed_at ? 'concluido' : book.started_at ? 'lendo' : 'quero_ler',
    book.rating ?? null,
    book.format ?? null,
    book.started_at ?? null,
    book.completed_at ?? null,
  );
}

export async function updateBookDetails(
  database: SQLiteDatabase,
  book: Pick<Book, 'id' | 'title' | 'author' | 'total_pages' | 'current_page'> & {
    started_at: string | null;
    completed_at: string | null;
    rating: number | null;
    format: Book['format'];
  },
) {
  assertValidBookRating(book.rating);
  const status: BookStatus = book.completed_at || book.current_page >= book.total_pages
    ? 'concluido'
    : book.started_at || book.current_page > 0
      ? 'lendo'
      : 'quero_ler';
  await database.withTransactionAsync(async () => {
    const previous = await database.getFirstAsync<{ current_page: number; status: BookStatus }>(
      'SELECT current_page, status FROM books WHERE id = ?', book.id,
    );
    await database.runAsync(
      'UPDATE books SET title = ?, author = ?, total_pages = ?, current_page = ?, status = ?, started_at = ?, completed_at = ?, rating = ?, format = ? WHERE id = ?',
      book.title.trim(), book.author.trim(), book.total_pages, book.current_page, status,
      status === 'quero_ler' ? null : book.started_at,
      status === 'concluido' ? book.completed_at : null,
      book.rating,
      book.format,
      book.id,
    );
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const pagesRead = book.current_page - (previous?.current_page ?? book.current_page);
    const isHistoricalCompletion = book.completed_at !== null && book.completed_at < todayIso;
    if (previous && previous.status !== 'concluido' && pagesRead > 0 && !isHistoricalCompletion) {
      await recordReadingActivity(database, book.id, pagesRead);
    }
  });
}

export async function updateBookRating(database: SQLiteDatabase, bookId: number, rating: number | null) {
  assertValidBookRating(rating);
  await database.runAsync('UPDATE books SET rating = ? WHERE id = ?', rating, bookId);
}

function assertValidBookRating(rating: number | null) {
  if (rating !== null && (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2))) {
    throw new RangeError('A avaliação deve estar entre 0,5 e 5 estrelas, em intervalos de meia estrela.');
  }
}

export async function updateCustomCover(database: SQLiteDatabase, id: number, uri: string | null) {
  await database.runAsync('UPDATE books SET custom_cover_uri = ? WHERE id = ?', uri, id);
}

export async function startBook(database: SQLiteDatabase, id: number) {
  await database.runAsync(
    "UPDATE books SET status = 'lendo', started_at = COALESCE(started_at, date('now', 'localtime')) WHERE id = ? AND status = 'quero_ler'",
    id,
  );
}

export async function advancePage(database: SQLiteDatabase, book: Book) {
  const nextPage = Math.min(book.current_page + 1, book.total_pages);
  if (nextPage === book.current_page) return;
  const status = nextPage === book.total_pages ? 'concluido' : 'lendo';
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      "UPDATE books SET current_page = ?, status = ?, started_at = COALESCE(started_at, date('now', 'localtime')), completed_at = CASE WHEN ? = 'concluido' THEN COALESCE(completed_at, date('now', 'localtime')) ELSE NULL END WHERE id = ?",
      nextPage, status, status, book.id,
    );
    await recordReadingActivity(database, book.id, nextPage - book.current_page);
  });
}

async function recordReadingActivity(database: SQLiteDatabase, bookId: number, pagesRead: number) {
  if (pagesRead <= 0) return;
  await database.runAsync(
    "INSERT INTO reading_activity (book_id, reading_date, pages_read) VALUES (?, date('now', 'localtime'), ?) ON CONFLICT(book_id, reading_date) DO UPDATE SET pages_read = pages_read + excluded.pages_read",
    bookId, pagesRead,
  );
}

export async function deleteBook(database: SQLiteDatabase, id: number) {
  await database.runAsync('DELETE FROM books WHERE id = ?', id);
}

export function getReadingNotes(database: SQLiteDatabase, bookId: number) {
  return database.getAllAsync<ReadingNote>(
    'SELECT id, book_id, text, page_number, created_at, updated_at FROM reading_notes WHERE book_id = ? ORDER BY created_at DESC, id DESC',
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

export async function updateReadingNote(
  database: SQLiteDatabase,
  noteId: number,
  text: string,
  pageNumber: number | null,
) {
  await database.runAsync(
    "UPDATE reading_notes SET text = ?, page_number = ?, updated_at = datetime('now') WHERE id = ?",
    text.trim(),
    pageNumber,
    noteId,
  );
}

export async function deleteReadingNote(database: SQLiteDatabase, noteId: number) {
  await database.runAsync('DELETE FROM reading_notes WHERE id = ?', noteId);
}
