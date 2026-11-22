import type { ReaderThemeKey } from '@/constants/reader-themes';

export const readerThemeArtwork: Record<ReaderThemeKey, { source: number; description: string }> = {
  classic: {
    source: require('../../assets/images/theme-classic.jpg'),
    description: 'Estantes com livros antigos encadernados',
  },
  witch: {
    source: require('../../assets/images/theme-witch.jpg'),
    description: 'Paisagem histórica à noite, iluminada pela lua',
  },
  space: {
    source: require('../../assets/images/theme-space.jpg'),
    description: 'Região de formação estelar 30 Doradus, fotografada pelo Hubble',
  },
  flowers: {
    source: require('../../assets/images/theme-flowers.jpg'),
    description: 'Ilustração botânica histórica de lírios alaranjados',
  },
};
