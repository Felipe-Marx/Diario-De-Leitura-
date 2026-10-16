import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';

import { getReaderProfile, saveReaderProfile, type ReaderProfile } from '@/db/books';
import { getReaderTheme, readerThemes, normalizeReaderThemeKey, type ReaderThemeKey } from '@/constants/reader-themes';
import { saveImagePermanently } from '@/services/local-images';

const defaultProfile: ReaderProfile = {
  display_name: 'Pessoa leitora',
  avatar_uri: null,
  theme_key: 'classic',
  annual_goal: 12,
  reader_term: 'neutral',
};

const readerTerms: { value: ReaderProfile['reader_term']; label: string }[] = [
  { value: 'masculine', label: 'Leitor (ele/dele)' },
  { value: 'feminine', label: 'Leitora (ela/dela)' },
  { value: 'neutral', label: 'Pessoa leitora (neutro)' },
];

export default function ProfileScreen() {
  const database = useSQLiteContext();
  const [profile, setProfile] = useState(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const theme = getReaderTheme(profile.theme_key);

  useEffect(() => {
    void getReaderProfile(database).then((savedProfile) => {
      if (savedProfile) setProfile({ ...savedProfile, theme_key: normalizeReaderThemeKey(savedProfile.theme_key) });
      setLoading(false);
    });
  }, [database]);

  async function persistProfile(nextProfile: ReaderProfile) {
    setProfile(nextProfile);
    await saveReaderProfile(database, nextProfile);
  }

  async function handlePickAvatar() {
    setSaving(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const avatarUri = await saveImagePermanently(result.assets[0].uri, 'reader-avatar');
      await persistProfile({ ...profile, avatar_uri: avatarUri });
    } catch {
      Alert.alert('Não foi possível salvar a foto', 'Tente escolher outra imagem.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const goal = Math.max(1, Number.parseInt(String(profile.annual_goal), 10) || 1);
      await persistProfile({ ...profile, display_name: profile.display_name.trim() || 'Pessoa leitora', annual_goal: goal });
      Alert.alert('Perfil atualizado', 'Suas escolhas foram salvas neste aparelho.');
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente em instantes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} style={{ flex: 1 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={[styles.backText, { color: theme.accent }]}>‹  Minha estante</Text></Pressable>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>SEU ESPAÇO, DO SEU JEITO {theme.symbol}</Text>
        <Text style={[styles.title, { color: theme.ink, fontFamily: theme.headingFont }]}>
          {profile.reader_term === 'masculine' ? 'Perfil de leitor' : profile.reader_term === 'feminine' ? 'Perfil de leitora' : 'Seu perfil de leitura'}
        </Text>

        <View style={[styles.avatarSection, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
          <Pressable onPress={() => void handlePickAvatar()} style={[styles.avatar, { backgroundColor: theme.soft, borderColor: theme.line }]} accessibilityRole="button" accessibilityLabel="Escolher foto de perfil">
            {profile.avatar_uri ? <Image source={{ uri: profile.avatar_uri }} style={styles.avatarImage} /> : <Text style={[styles.avatarInitial, { color: theme.accent }]}>{profile.display_name.trim().charAt(0).toUpperCase() || 'L'}</Text>}
            <View style={[styles.avatarBadge, { backgroundColor: theme.accent, borderColor: theme.paper }]}><Text style={[styles.avatarBadgeText, { color: theme.buttonText }]}>＋</Text></View>
          </Pressable>
          <Text style={[styles.avatarHint, { color: theme.muted }]}>{saving ? 'Salvando…' : 'Toque para escolher sua foto'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>Como o app deve se referir a você?</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>Você pode mudar essa preferência quando quiser.</Text>
          <View style={styles.termOptions}>
            {readerTerms.map((option) => {
              const selected = profile.reader_term === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setProfile((current) => ({ ...current, reader_term: option.value }))}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  style={[styles.termOption, { backgroundColor: theme.paper, borderColor: selected ? theme.accent : theme.line }]}
                >
                  <Text style={[styles.termOptionText, { color: selected ? theme.accent : theme.ink }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>Qual nome ou apelido você prefere?</Text>
          <TextInput
            value={profile.display_name}
            onChangeText={(display_name) => setProfile((current) => ({ ...current, display_name }))}
            accessibilityLabel="Nome ou apelido"
            placeholder="Seu nome ou apelido"
            placeholderTextColor="#96978F"
            style={[styles.input, { backgroundColor: theme.paper, borderColor: theme.line, color: theme.ink }]}
            maxLength={32}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>Galeria de temas gratuitos</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>Escolha uma identidade completa para o aplicativo.</Text>
          <View style={styles.themeGrid}>
            {(Object.keys(readerThemes) as ReaderThemeKey[]).map((themeKey) => {
              const option = readerThemes[themeKey];
              const selected = normalizeReaderThemeKey(profile.theme_key) === themeKey;
              return (
                <Pressable
                  key={themeKey}
                  onPress={() => setProfile((current) => ({ ...current, theme_key: themeKey }))}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.themeOption, { backgroundColor: option.paper, borderColor: selected ? option.accent : option.line, borderRadius: option.cardRadius }]}>
                  <View style={[styles.themeSymbol, { backgroundColor: option.soft }]}><Text style={[styles.themeSymbolText, { color: option.accent }]}>{option.symbol}</Text></View>
                  <View style={styles.themeCopy}>
                    <Text style={[styles.themeLabel, { color: option.ink }, selected && { color: option.accent }]}>{option.label}</Text>
                    <Text style={[styles.themeDescription, { color: option.muted }]}>{option.description}</Text>
                  </View>
                  <View style={[styles.themeSwatch, { backgroundColor: option.accent }]} />
                  {selected && <Text style={[styles.check, { color: option.accent }]}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.ink, fontFamily: theme.headingFont }]}>Meta anual de leitura</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>Uma meta pessoal para acompanhar no seu ritmo.</Text>
          <View style={styles.goalRow}>
            <Text style={[styles.goalText, { color: theme.muted }]}>Quero ler</Text>
            <TextInput
              value={String(profile.annual_goal)}
              onChangeText={(value) => setProfile((current) => ({ ...current, annual_goal: Number.parseInt(value, 10) || 0 }))}
              accessibilityLabel="Meta anual de livros"
              style={[styles.goalInput, { backgroundColor: theme.paper, borderColor: theme.line, color: theme.ink }]}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={[styles.goalText, { color: theme.muted }]}>livros neste ano</Text>
          </View>
        </View>

        <Pressable style={[styles.saveButton, { backgroundColor: theme.accent, borderRadius: theme.cardRadius }]} onPress={() => void handleSaveProfile()} disabled={saving}>
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>{saving ? 'Salvando…' : 'Salvar meu perfil'}</Text>
        </Pressable>
        <Text style={[styles.localNote, { color: theme.muted }]}>Seu perfil e suas preferências ficam salvos neste aparelho.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 23, paddingBottom: 36 },
  backButton: { paddingVertical: 13, alignSelf: 'flex-start' },
  backText: { fontSize: 12, fontWeight: '700' },
  eyebrow: { color: '#777B70', fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginTop: 8 },
  title: { color: '#282D25', fontSize: 29, fontWeight: '700', letterSpacing: -0.8, marginTop: 6 },
  avatarSection: { alignItems: 'center', paddingVertical: 24, borderWidth: 1, marginTop: 16 },
  avatar: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarImage: { width: 104, height: 104, borderRadius: 52 },
  avatarInitial: { fontSize: 39, fontWeight: '700' },
  avatarBadge: { position: 'absolute', right: 0, bottom: 1, width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#F7F4EC' },
  avatarBadgeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  avatarHint: { color: '#777B70', fontSize: 10, marginTop: 9 },
  section: { marginTop: 15 },
  sectionTitle: { color: '#282D25', fontSize: 14, fontWeight: '700' },
  helper: { color: '#777B70', fontSize: 10, marginTop: 4 },
  input: { height: 48, paddingHorizontal: 14, borderRadius: 11, backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#E9E5DA', marginTop: 10, color: '#282D25', fontSize: 13 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  termOptions: { gap: 8, marginTop: 12 },
  termOption: { minHeight: 46, borderWidth: 1, borderRadius: 11, justifyContent: 'center', paddingHorizontal: 14 },
  termOptionText: { fontSize: 13, fontWeight: '600' },
  themeOption: { width: '48%', minHeight: 74, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 7 },
  themeSymbol: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  themeSymbolText: { fontSize: 17, fontWeight: '700' },
  themeCopy: { flex: 1, gap: 3 },
  themeLabel: { color: '#585C53', fontSize: 10, fontWeight: '700' },
  themeDescription: { color: '#777B70', fontSize: 8, lineHeight: 11 },
  themeSwatch: { width: 12, height: 12, borderRadius: 6 },
  check: { fontSize: 12, fontWeight: '700' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  goalText: { color: '#585C53', fontSize: 12 },
  goalInput: { width: 58, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E9E5DA', backgroundColor: '#FFFEFA', textAlign: 'center', color: '#282D25', fontWeight: '700' },
  saveButton: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 27 },
  saveButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  localNote: { color: '#777B70', fontSize: 9, textAlign: 'center', marginTop: 11 },
});
