import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getReaderProfile, type ReaderProfile } from '@/db/books';
import { normalizeReaderThemeKey } from '@/constants/reader-themes';

type ReaderProfileContextValue = {
  profile: ReaderProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  setCachedProfile: (profile: ReaderProfile) => void;
};

const ReaderProfileContext = createContext<ReaderProfileContextValue | null>(null);

export function ReaderProfileProvider({ children }: { children: ReactNode }) {
  const database = useSQLiteContext();
  const [profile, setProfile] = useState<ReaderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const savedProfile = await getReaderProfile(database);
    if (savedProfile) {
      setProfile({ ...savedProfile, theme_key: normalizeReaderThemeKey(savedProfile.theme_key) });
    }
    setLoading(false);
  }, [database]);

  useEffect(() => {
    let active = true;
    void getReaderProfile(database)
      .then((savedProfile) => {
        if (active && savedProfile) {
          setProfile({ ...savedProfile, theme_key: normalizeReaderThemeKey(savedProfile.theme_key) });
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [database]);

  const value = useMemo(() => ({
    profile,
    loading,
    refreshProfile,
    setCachedProfile: setProfile,
  }), [profile, loading, refreshProfile]);

  return <ReaderProfileContext.Provider value={value}>{children}</ReaderProfileContext.Provider>;
}

export function useReaderProfile() {
  const context = useContext(ReaderProfileContext);
  if (!context) throw new Error('useReaderProfile precisa estar dentro de ReaderProfileProvider.');
  return context;
}
