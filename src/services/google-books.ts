export type GoogleBook = {
  id: string;
  title: string;
  author: string;
  pageCount: number | null;
  coverUri: string | null;
  infoLink: string;
};

type GoogleBooksResponse = {
  error?: {
    code?: number;
    message?: string;
    errors?: { reason?: string }[];
  };
  items?: {
    id?: string;
    volumeInfo?: {
      title?: string;
      authors?: string[];
      pageCount?: number;
      infoLink?: string;
      imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    };
  }[];
};

export async function searchGoogleBooks(searchTerm: string): Promise<GoogleBook[]> {
  const normalizedTerm = searchTerm.trim();
  if (!normalizedTerm) return [];

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('A busca do Google Books ainda não foi configurada. Adicione sua chave de API ao arquivo .env.local e reinicie o Expo.');
  }

  const query = new URLSearchParams({ q: normalizedTerm, maxResults: '12', printType: 'books', key: apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    response = await fetch(`https://www.googleapis.com/books/v1/volumes?${query.toString()}`, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A busca demorou demais. Verifique sua conexão e tente novamente.');
    }
    throw new Error('Não foi possível conectar ao Google Books. Confira sua internet e tente novamente.');
  } finally {
    clearTimeout(timeout);
  }

  const data = (await response.json().catch(() => null)) as GoogleBooksResponse | null;
  if (!response.ok) {
    const reasons = data?.error?.errors?.map((item) => item.reason).filter(Boolean) ?? [];
    if (response.status === 429 || reasons.some((reason) => /quota|rate.?limit|limitexceeded/i.test(reason ?? ''))) {
      throw new Error('A cota de pesquisa do Google Books está indisponível. Configure uma chave de API com a Books API ativada e cota habilitada.');
    }
    if (response.status === 400 || response.status === 403) {
      throw new Error('O Google Books recusou a solicitação. Confira se a chave é válida e se a Books API está ativada no Google Cloud.');
    }
    throw new Error('A busca de livros não respondeu. Confira sua conexão e tente novamente.');
  }

  if (!data) throw new Error('O Google Books enviou uma resposta inválida. Tente novamente.');

  return (data.items ?? [])
    .filter((item) => item.id && item.volumeInfo?.title)
    .map((item) => {
      const image = item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail;
      return {
        id: item.id as string,
        title: item.volumeInfo?.title as string,
        author: item.volumeInfo?.authors?.join(', ') ?? 'Autor não informado',
        pageCount: item.volumeInfo?.pageCount ?? null,
        coverUri: image?.replace(/^http:/, 'https:') ?? null,
        infoLink: item.volumeInfo?.infoLink ?? `https://books.google.com/books?id=${encodeURIComponent(item.id as string)}`,
      };
    });
}
