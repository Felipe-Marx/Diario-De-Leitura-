import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getLibraryBackupData, restoreLibraryBackup, type LibraryBackupData } from '@/db/books';

type BackupImage = { mimeType: string; base64: string };
type BackupFile = {
  format: 'diario-leitura-backup';
  version: 1;
  exportedAt: string;
  data: LibraryBackupData;
  images: Record<string, BackupImage>;
};

export type ParsedBackup = { backup: BackupFile; bookCount: number; noteCount: number };
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export async function saveImagePermanently(sourceUri: string, prefix: string) {
  const extension = sourceUri.split('.').pop()?.split(/[?#]/)[0] || 'jpg';
  const destination = new File(Paths.document, `${prefix}-${Date.now()}.${extension}`);
  await new File(sourceUri).copy(destination);
  return destination.uri;
}

function imageMimeType(uri: string) {
  const extension = uri.split('.').pop()?.split(/[?#]/)[0]?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function imageExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

export async function createBackupFile(database: SQLiteDatabase) {
  const data = await getLibraryBackupData(database);
  const imageUris = new Set([data.profile.avatar_uri, ...data.books.map((book) => book.custom_cover_uri), ...data.shelves.map((shelf) => shelf.icon_uri)]);
  const images: Record<string, BackupImage> = {};

  for (const uri of imageUris) {
    if (!uri?.startsWith('file://')) continue;
    const image = new File(uri);
    if (!image.exists) throw new Error('Uma foto salva no app não está mais disponível.');
    images[uri] = { mimeType: imageMimeType(uri), base64: await image.base64() };
  }

  const backup: BackupFile = {
    format: 'diario-leitura-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    images,
  };
  const content = JSON.stringify(backup);
  if (new TextEncoder().encode(content).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('O backup ultrapassa 50 MB. Reduza o tamanho ou a quantidade de imagens salvas e tente novamente.');
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = new File(Paths.cache, `diario-leitura-${stamp}.json`);
  file.create({ overwrite: true });
  file.write(content, { encoding: 'utf8' });
  return file.uri;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateBackup(value: unknown): BackupFile {
  if (!isRecord(value) || value.format !== 'diario-leitura-backup' || value.version !== 1 || !isRecord(value.data)) {
    throw new Error('Este arquivo não é um backup compatível do Diário de Leitura.');
  }
  const { profile, books, notes } = value.data;
  const readingActivity = value.data.readingActivity ?? [];
  const shelves = value.data.shelves ?? [];
  const shelfBooks = value.data.shelfBooks ?? [];
  if (!isRecord(profile) || !Array.isArray(books) || !Array.isArray(notes)
    || !Array.isArray(readingActivity) || !Array.isArray(shelves) || !Array.isArray(shelfBooks) || !isRecord(value.images)) {
    throw new Error('O arquivo de backup está incompleto ou inválido.');
  }
  if (typeof profile.display_name !== 'string' || typeof profile.theme_key !== 'string'
    || typeof profile.annual_goal !== 'number' || typeof profile.reader_term !== 'string') {
    throw new Error('Os dados do perfil neste backup são inválidos.');
  }

  const ids = new Set<number>();
  for (const book of books) {
    if (!isRecord(book) || typeof book.id !== 'number' || ids.has(book.id)
      || typeof book.title !== 'string' || typeof book.author !== 'string'
      || typeof book.total_pages !== 'number' || typeof book.current_page !== 'number'
      || (book.rating !== undefined && book.rating !== null && (typeof book.rating !== 'number' || !Number.isInteger(book.rating) || book.rating < 1 || book.rating > 5))
      || (book.format !== undefined && book.format !== null && book.format !== 'fisico' && book.format !== 'kindle')
      || !['quero_ler', 'lendo', 'concluido'].includes(String(book.status))
      || typeof book.created_at !== 'string') {
      throw new Error('Há dados de livro inválidos neste backup.');
    }
    ids.add(book.id);
  }
  for (const note of notes) {
    if (!isRecord(note) || typeof note.id !== 'number' || typeof note.book_id !== 'number'
      || !ids.has(note.book_id) || typeof note.text !== 'string' || typeof note.created_at !== 'string') {
      throw new Error('Há anotações inválidas ou sem livro correspondente neste backup.');
    }
  }
  for (const activity of readingActivity) {
    if (!isRecord(activity) || typeof activity.book_id !== 'number'
      || !ids.has(activity.book_id) || typeof activity.reading_date !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(activity.reading_date)
      || typeof activity.pages_read !== 'number' || !Number.isInteger(activity.pages_read)
      || activity.pages_read < 1) {
      throw new Error('HÃ¡ registros de leitura diÃ¡ria invÃ¡lidos neste backup.');
    }
  }
  const shelfIds = new Set<number>();
  for (const shelf of shelves) {
    if (!isRecord(shelf) || typeof shelf.id !== 'number' || shelfIds.has(shelf.id)
      || typeof shelf.name !== 'string' || typeof shelf.color !== 'string' || typeof shelf.icon !== 'string'
      || (shelf.icon_uri !== undefined && shelf.icon_uri !== null && typeof shelf.icon_uri !== 'string')
      || typeof shelf.sort_order !== 'number' || typeof shelf.created_at !== 'string') {
      throw new Error('Há dados de estante inválidos neste backup.');
    }
    shelfIds.add(shelf.id);
  }
  for (const shelfBook of shelfBooks) {
    if (!isRecord(shelfBook) || typeof shelfBook.shelf_id !== 'number' || !shelfIds.has(shelfBook.shelf_id)
      || typeof shelfBook.book_id !== 'number' || !ids.has(shelfBook.book_id)
      || typeof shelfBook.sort_order !== 'number') {
      throw new Error('Há livros vinculados a estantes inválidas neste backup.');
    }
  }
  for (const image of Object.values(value.images)) {
    if (!isRecord(image) || typeof image.mimeType !== 'string' || typeof image.base64 !== 'string') {
      throw new Error('Há uma imagem inválida neste backup.');
    }
  }
  return {
    ...value,
    data: {
      ...value.data,
      books: books.map((book) => ({ ...book, rating: book.rating ?? null, format: book.format === 'kindle' ? 'kindle' : book.format === 'fisico' ? 'fisico' : null })),
      readingActivity,
      shelves: shelves.map((shelf) => ({ ...shelf, icon_uri: shelf.icon_uri ?? null })),
      shelfBooks,
    },
  } as unknown as BackupFile;
}

export async function readBackupFile(uri: string): Promise<ParsedBackup> {
  const file = new File(uri);
  if (!file.exists) throw new Error('Não foi possível abrir o arquivo selecionado.');
  if (file.size !== null && file.size > MAX_BACKUP_BYTES) throw new Error('O arquivo de backup ultrapassa o limite de 50 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error('O arquivo não contém um JSON de backup válido.');
  }
  const backup = validateBackup(parsed);
  return { backup, bookCount: backup.data.books.length, noteCount: backup.data.notes.length };
}

export async function restoreBackupFile(database: SQLiteDatabase, backup: BackupFile) {
  const restoredUris = new Map<string, string>();
  let imageIndex = 0;
  for (const [oldUri, imageData] of Object.entries(backup.images)) {
    const file = new File(Paths.document, `restored-image-${Date.now()}-${imageIndex}.${imageExtension(imageData.mimeType)}`);
    imageIndex += 1;
    file.create({ overwrite: true });
    file.write(imageData.base64, { encoding: 'base64' });
    restoredUris.set(oldUri, file.uri);
  }

  const remapImage = (uri: string | null) => {
    if (!uri?.startsWith('file://')) return uri;
    return restoredUris.get(uri) ?? null;
  };
  const data: LibraryBackupData = {
    profile: { ...backup.data.profile, avatar_uri: remapImage(backup.data.profile.avatar_uri) },
    books: backup.data.books.map((book) => ({ ...book, custom_cover_uri: remapImage(book.custom_cover_uri) })),
    notes: backup.data.notes,
    readingActivity: backup.data.readingActivity,
    shelves: (backup.data.shelves ?? []).map((shelf) => ({ ...shelf, icon_uri: remapImage(shelf.icon_uri ?? null) })),
    shelfBooks: backup.data.shelfBooks ?? [],
  };
  await restoreLibraryBackup(database, data);
}
