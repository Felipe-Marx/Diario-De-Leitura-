import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { getReaderTheme, normalizeReaderThemeKey } from '@/constants/reader-themes';
import { readerThemeArtwork } from '@/constants/reader-theme-artwork';

const sceneStyles = {
  classic: { overlay: 'rgba(20, 17, 15, 0.55)', title: '#FFFEFA', eyebrow: '#FFFEFA' },
  witch: { overlay: 'rgba(25, 18, 30, 0.3)', title: '#F3EBDD', eyebrow: '#F3D28C' },
  space: { overlay: 'rgba(5, 16, 30, 0.6)', title: '#E8F2FA', eyebrow: '#E8F2FA' },
  flowers: { overlay: 'rgba(255, 246, 248, 0.16)', title: '#4D3539', eyebrow: '#4D3539' },
} as const;

type ThemeSceneHeaderProps = {
  themeKey: string | null | undefined;
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  accessory?: ReactNode;
  minHeight?: number;
  titleNumberOfLines?: number;
  subtitleNumberOfLines?: number;
  copyMaxWidth?: ViewStyle['maxWidth'];
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

export function ThemeSceneHeader({
  themeKey,
  eyebrow,
  title,
  subtitle,
  accessory,
  minHeight = 145,
  titleNumberOfLines = 2,
  subtitleNumberOfLines = 3,
  copyMaxWidth,
  titleStyle,
  subtitleStyle,
  style,
}: ThemeSceneHeaderProps) {
  const key = normalizeReaderThemeKey(themeKey);
  const theme = getReaderTheme(key);
  const scene = sceneStyles[key];
  const artwork = readerThemeArtwork[key];

  return (
    <View
      style={[
        styles.container,
        { minHeight, borderRadius: theme.cardRadius, backgroundColor: theme.soft },
        style,
      ]}
    >
      <Image
        source={artwork.source}
        style={key === 'flowers' ? styles.flowerImage : styles.image}
        contentFit={key === 'flowers' ? 'contain' : 'cover'}
        cachePolicy="memory-disk"
        accessibilityLabel={artwork.description}
      />
      <View pointerEvents="none" style={[styles.overlay, { backgroundColor: scene.overlay }]} />
      <View style={[styles.copy, { maxWidth: copyMaxWidth ?? (key === 'flowers' ? '57%' : accessory ? '82%' : '100%') }]}>
        <Text style={[styles.eyebrow, { color: scene.eyebrow }]} numberOfLines={2}>
          {eyebrow}
        </Text>
        <Text
          style={[styles.title, { color: scene.title, fontFamily: theme.headingFont }, titleStyle]}
          numberOfLines={titleNumberOfLines}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: scene.title }, subtitleStyle]} numberOfLines={subtitleNumberOfLines}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 18,
  },
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  flowerImage: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '43%' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  copy: { zIndex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5, marginTop: 6 },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 5, opacity: 0.9 },
  accessory: { position: 'absolute', top: 16, right: 16, zIndex: 2 },
});
