import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { saveReaderProfile, type ReaderProfile } from '@/db/books';
import { getReaderTheme, readerThemes, normalizeReaderThemeKey, type ReaderThemeKey } from '@/constants/reader-themes';
import { readerThemeArtwork } from '@/constants/reader-theme-artwork';
import { ThemeSceneHeader } from '@/components/theme-scene-header';
import { createBackupFile, readBackupFile, restoreBackupFile, saveImagePermanently } from '@/services/local-images';
import { useReaderProfile } from '@/providers/reader-profile';

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
  const { profile: cachedProfile, loading, refreshProfile, setCachedProfile } = useReaderProfile();
  const [profileDraft, setProfileDraft] = useState<ReaderProfile | null>(null);
  const profile = profileDraft ?? cachedProfile ?? defaultProfile;
  const [saving, setSaving] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const theme = getReaderTheme(profile.theme_key);

  function updateProfile(update: (current: ReaderProfile) => ReaderProfile) {
    setProfileDraft((current) => update(current ?? cachedProfile ?? defaultProfile));
  }

  async function persistProfile(nextProfile: ReaderProfile) {
    setProfileDraft(nextProfile);
    await saveReaderProfile(database, nextProfile);
    setCachedProfile(nextProfile);
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

  async function handleExportBackup() {
    setBackupBusy(true);
    try {
      if (!await Sharing.isAvailableAsync()) {
        Alert.alert('Compartilhamento indisponível', 'Este aparelho não oferece um destino para salvar o arquivo.');
        return;
      }
      const profileForBackup = {
        ...profile,
        display_name: profile.display_name.trim() || 'Pessoa leitora',
        annual_goal: Math.max(1, Number.parseInt(String(profile.annual_goal), 10) || 1),
      };
      await saveReaderProfile(database, profileForBackup);
      setProfileDraft(profileForBackup);
      setCachedProfile(profileForBackup);
      const uri = await createBackupFile(database);
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Salvar backup do Diário de Leitura',
        mimeType: 'application/json',
        UTI: 'public.json',
      });
    } catch (error) {
      Alert.alert('Não foi possível criar o backup', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreConfirmed(backup: Awaited<ReturnType<typeof readBackupFile>>['backup']) {
    setBackupBusy(true);
    try {
      await restoreBackupFile(database, backup);
      setProfileDraft(null);
      await refreshProfile();
      Alert.alert('Backup restaurado', 'Livros, estantes, anotações, avaliações, perfil e imagens foram recuperados.', [
        { text: 'Continuar', onPress: () => router.replace('/') },
      ]);
    } catch (error) {
      Alert.alert('Não foi possível restaurar', error instanceof Error ? error.message : 'Os dados atuais foram mantidos se a restauração falhou.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleChooseBackup() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;
      setBackupBusy(true);
      const parsed = await readBackupFile(result.assets[0].uri);
      setBackupBusy(false);
      Alert.alert(
        'Restaurar este backup?',
        `O conteúdo atual deste aparelho será substituído. O arquivo contém ${parsed.bookCount} ${parsed.bookCount === 1 ? 'livro' : 'livros'} e ${parsed.noteCount} ${parsed.noteCount === 1 ? 'anotação' : 'anotações'}, além do perfil e das imagens.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Restaurar', style: 'destructive', onPress: () => void restoreConfirmed(parsed.backup) },
        ],
      );
    } catch (error) {
      setBackupBusy(false);
      Alert.alert('Arquivo não reconhecido', error instanceof Error ? error.message : 'Escolha um backup do Diário de Leitura.');
    }
  }

  if (loading || !cachedProfile) {
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color="#777B70" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={[styles.backText, { color: theme.accent }]}>‹  Minha estante</Text></Pressable>
        <ThemeSceneHeader
          themeKey={profile.theme_key}
          eyebrow="SEU ESPAÇO, DO SEU JEITO"
          title={profile.reader_term === 'masculine' ? 'Perfil de leitor' : profile.reader_term === 'feminine' ? 'Perfil de leitora' : 'Seu perfil de leitura'}
          subtitle="Personalize seu perfil, escolha um tema e acompanhe sua meta."
          minHeight={155}
          style={styles.profileScene}
        />

        <View style={[styles.avatarSection, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
          <Pressable onPress={() => void handlePickAvatar()} style={[styles.avatar, { backgroundColor: theme.soft, borderColor: theme.line }]} accessibilityRole="button" accessibilityLabel="Escolher foto de perfil">
            {profile.avatar_uri ? <Image source={{ uri: profile.avatar_uri }} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" /> : <Text style={[styles.avatarInitial, { color: theme.accent }]}>{profile.display_name.trim().charAt(0).toUpperCase() || 'L'}</Text>}
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
                  onPress={() => updateProfile((current) => ({ ...current, reader_term: option.value }))}
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
            onChangeText={(display_name) => updateProfile((current) => ({ ...current, display_name }))}
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
                  onPress={() => updateProfile((current) => ({ ...current, theme_key: themeKey }))}
                  accessibilityRole="button"
                  accessibilityLabel={`Tema ${option.label}`}
                  accessibilityState={{ selected }}
                  style={[styles.themeOption, { backgroundColor: option.paper, borderColor: selected ? option.accent : option.line, borderRadius: option.cardRadius }]}>
                  <View style={styles.themeThumb}>
                    <Image
                      source={readerThemeArtwork[themeKey].source}
                      style={styles.themeThumbImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      accessibilityLabel={readerThemeArtwork[themeKey].description}
                    />
                    <View style={[styles.themeThumbSymbol, { backgroundColor: option.accent }]}>
                      <Text style={[styles.themeSymbolText, { color: option.buttonText }]}>{option.symbol}</Text>
                    </View>
                  </View>
                  <View style={styles.themeCopy}>
                    <Text style={[styles.themeLabel, { color: option.ink }, selected && { color: option.accent }]}>{option.label}</Text>
                    <Text style={[styles.themeDescription, { color: option.muted }]}>{option.description}</Text>
                  </View>
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
              onChangeText={(value) => updateProfile((current) => ({ ...current, annual_goal: Number.parseInt(value, 10) || 0 }))}
              accessibilityLabel="Meta anual de livros"
              style={[styles.goalInput, { backgroundColor: theme.paper, borderColor: theme.line, color: theme.ink }]}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={[styles.goalText, { color: theme.muted }]}>livros neste ano</Text>
          </View>
        </View>

        <Pressable style={[styles.saveButton, { backgroundColor: theme.accent, borderRadius: theme.cardRadius }]} onPress={() => void handleSaveProfile()} disabled={saving || backupBusy}>
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>{saving ? 'Salvando…' : 'Salvar meu perfil'}</Text>
        </Pressable>
        <View style={[styles.backupSection, { backgroundColor: theme.paper, borderColor: theme.line, borderRadius: theme.cardRadius }]}>
          <Text style={[styles.backupHeading, { color: theme.ink }]}>Backup dos seus dados</Text>
          <Text style={[styles.helper, { color: theme.muted }]}>Atualizar o APK por cima normalmente mantém os dados. Exporte antes de desinstalar o app ou trocar de aparelho.</Text>
          <Pressable onPress={() => void handleExportBackup()} style={[styles.backupButton, { backgroundColor: theme.accent, borderRadius: theme.cardRadius }, backupBusy && styles.disabled]} disabled={backupBusy || saving} accessibilityRole="button">
            <Text style={[styles.backupPrimaryText, { color: theme.buttonText }]}>{backupBusy ? 'Preparando arquivo…' : 'Exportar arquivo de backup'}</Text>
          </Pressable>
          <Pressable onPress={() => void handleChooseBackup()} style={[styles.backupRestoreButton, { borderColor: theme.accent, borderRadius: theme.cardRadius }, backupBusy && styles.disabled]} disabled={backupBusy || saving} accessibilityRole="button">
            <Text style={[styles.backupButtonText, { color: theme.accent }]}>Restaurar de um arquivo</Text>
          </Pressable>
          <Text style={[styles.helper, { color: theme.muted }]}>O arquivo inclui anotações e imagens, não é criptografado e deve ser guardado em local privado. Restaurar substitui os dados atuais.</Text>
        </View>
        <Text style={[styles.localNote, { color: theme.muted }]}>Seu perfil e suas preferências ficam salvos neste aparelho.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 23, paddingBottom: 36 },
  backButton: { paddingVertical: 13, alignSelf: 'flex-start' },
  backText: { fontSize: 12, fontWeight: '700' },
  profileScene: { marginBottom: 16 },
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
  themeOption: { width: '48%', minHeight: 74, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, gap: 7 },
  themeThumb: { width: 42, height: 56, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  themeThumbImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  themeThumbSymbol: { position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  themeSymbolText: { fontSize: 10, fontWeight: '700' },
  themeCopy: { flex: 1, gap: 3 },
  themeLabel: { color: '#585C53', fontSize: 10, fontWeight: '700' },
  themeDescription: { color: '#777B70', fontSize: 8, lineHeight: 11 },
  check: { fontSize: 12, fontWeight: '700' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  goalText: { color: '#585C53', fontSize: 12 },
  goalInput: { width: 58, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E9E5DA', backgroundColor: '#FFFEFA', textAlign: 'center', color: '#282D25', fontWeight: '700' },
  saveButton: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 27 },
  saveButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  backupSection: { borderWidth: 1, padding: 14, marginTop: 20 },
  backupHeading: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  backupButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 11 },
  backupRestoreButton: { minHeight: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  backupButtonText: { fontSize: 12, fontWeight: '700' },
  backupPrimaryText: { fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  localNote: { color: '#777B70', fontSize: 9, textAlign: 'center', marginTop: 11 },
});
