import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const starPath = 'M12 2.5 14.9 8.3 21.3 9.2 16.7 13.8 17.8 20.5 12 17.3 6.2 20.5 7.3 13.8 2.7 9.2 9.1 8.3Z';

type StarFill = 0 | 0.5 | 1;

type RatingStarsProps = {
  rating: number | null;
  size: number;
  color: string;
  emptyColor: string;
  onSelect?: (rating: number | null) => void;
};

export function RatingStars({ rating, size, color, emptyColor, onSelect }: RatingStarsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: 5 }, (_, index) => {
        const starNumber = index + 1;
        const fill: StarFill = rating !== null && rating >= starNumber
          ? 1
          : rating !== null && rating >= starNumber - 0.5
            ? 0.5
            : 0;
        const icon = <RatingStar fill={fill} size={size} color={color} emptyColor={emptyColor} />;

        if (!onSelect) {
          return <View key={starNumber}>{icon}</View>;
        }

        const halfRating = starNumber - 0.5;
        const selectRating = (value: number) => onSelect(rating === value ? null : value);

        return (
          <View key={starNumber} style={styles.touchTarget}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ratingLabel(halfRating)}
              accessibilityState={{ selected: rating === halfRating }}
              accessibilityHint={rating === halfRating ? 'Toque novamente para remover a avaliação.' : undefined}
              onPress={() => selectRating(halfRating)}
              style={[styles.halfTarget, styles.leftTarget]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ratingLabel(starNumber)}
              accessibilityState={{ selected: rating === starNumber }}
              accessibilityHint={rating === starNumber ? 'Toque novamente para remover a avaliação.' : undefined}
              onPress={() => selectRating(starNumber)}
              style={[styles.halfTarget, styles.rightTarget]}
            />
            <View pointerEvents="none" style={styles.starVisual}>{icon}</View>
          </View>
        );
      })}
    </View>
  );
}

export function formatRatingValue(rating: number) {
  return rating.toLocaleString('pt-BR');
}

function ratingLabel(rating: number) {
  return `Avaliar com ${formatRatingValue(rating)} ${rating === 1 ? 'estrela' : 'estrelas'}`;
}

function RatingStar({ fill, size, color, emptyColor }: { fill: StarFill; size: number; color: string; emptyColor: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={starPath}
          fill={fill === 1 ? color : 'none'}
          stroke={fill === 1 ? color : emptyColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </Svg>
      {fill === 0.5 && (
        <View pointerEvents="none" style={[styles.halfFill, { width: size / 2 }]}>
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path d={starPath} fill={color} />
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  touchTarget: { width: 44, height: 44, position: 'relative' },
  halfTarget: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  leftTarget: { left: 0 },
  rightTarget: { right: 0 },
  starVisual: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  halfFill: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
});
