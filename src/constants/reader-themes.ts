export const readerThemes = {
  classic: {
    label: 'Clássico',
    description: 'Papel, tinta e biblioteca.',
    symbol: '✦',
    ornament: '✦  ·  ✧  ·  ✦',
    accent: '#48654B',
    buttonText: '#FFFFFF',
    soft: '#E8EDE4',
    background: '#F7F4EC',
    paper: '#FFFEFA',
    ink: '#282D25',
    muted: '#696E63',
    line: '#E9E5DA',
    headingFont: 'serif',
    cardRadius: 17,
  },
  witch: {
    label: 'Bruxas',
    description: 'Livros antigos e noites mágicas.',
    symbol: '☾',
    ornament: '☾  ·  ✧  ·  ☽',
    accent: '#C7A96B',
    buttonText: '#241B2A',
    soft: '#392D43',
    background: '#1C1723',
    paper: '#2A2232',
    ink: '#F3EBDD',
    muted: '#C0B4C6',
    line: '#50425A',
    headingFont: 'serif',
    cardRadius: 12,
  },
  space: {
    label: 'Espacial',
    description: 'Uma viagem entre estrelas.',
    symbol: '✧',
    ornament: '✦  ·  ∘  ·  ✧',
    accent: '#76A9D4',
    buttonText: '#000000',
    soft: '#18334D',
    background: '#091827',
    paper: '#11273B',
    ink: '#E8F2FA',
    muted: '#A9BDCE',
    line: '#29445B',
    headingFont: 'sans-serif',
    cardRadius: 20,
  },
  flowers: {
    label: 'Flores',
    description: 'Um jardim entre páginas.',
    symbol: '❀',
    ornament: '❀  ·  ❁  ·  ❀',
    accent: '#A85F73',
    buttonText: '#FFFFFF',
    soft: '#F5E8EC',
    background: '#FAF4F5',
    paper: '#FFFCFD',
    ink: '#4D3539',
    muted: '#80646B',
    line: '#EFE1E5',
    headingFont: 'serif',
    cardRadius: 24,
  },
} as const;

export type ReaderThemeKey = keyof typeof readerThemes;

export function getReaderTheme(themeKey: string | null | undefined) {
  if (themeKey && themeKey in readerThemes) {
    return readerThemes[themeKey as ReaderThemeKey];
  }
  return readerThemes.classic;
}

export function normalizeReaderThemeKey(themeKey: string | null | undefined): ReaderThemeKey {
  if (themeKey === 'forest') return 'classic';
  if (themeKey === 'plum') return 'witch';
  if (themeKey === 'ocean' || themeKey === 'midnight') return 'space';
  if (themeKey === 'terracotta') return 'flowers';
  return themeKey && themeKey in readerThemes ? themeKey as ReaderThemeKey : 'classic';
}
