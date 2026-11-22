import Svg, { Circle, Path } from 'react-native-svg';

type ClockIconProps = {
  color: string;
  size?: number;
};

export function ClockIcon({ color, size = 24 }: ClockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
