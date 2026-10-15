import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Abstract line drawing of Triglav's three peaks above two river waves (Soča, Sava).
// Deliberately not the state coat of arms, whose use is restricted by law.
const PEAKS =
  'M0 120 L52 78 L74 92 L118 38 L138 54 L160 24 L188 60 L206 50 L250 96 L280 84 L320 120';
const WAVE_1 = 'M0 136 C40 126 80 146 120 136 S200 126 240 136 S300 146 320 136';
const WAVE_2 = 'M0 152 C40 142 80 162 120 152 S200 142 240 152 S300 162 320 152';

type Props = {
  width: number;
  height?: number;
  color?: string;
  /** Two-stop horizontal gradient instead of a flat colour. */
  colors?: [string, string];
  opacity?: number;
  strokeWidth?: number;
  fillPeaks?: boolean;
  /** Solid colour for the mountain body instead of a tint of the line colour. */
  fill?: string;
};

export function TriglavMotif({ width, height, color = '#FFFFFF', colors, opacity = 0.18, strokeWidth = 2.5, fillPeaks = false, fill }: Props) {
  // With an explicit height the drawing is stretched to fit, which keeps the ridge readable
  // as a low band instead of a tall mountain.
  const h = height ?? (width * 160) / 320;
  const paint = colors ? 'url(#motif)' : color;
  return (
    <Svg width={width} height={h} viewBox="0 0 320 160" preserveAspectRatio={height ? 'none' : 'xMidYMax meet'} pointerEvents="none">
      {colors ? (
        <Defs>
          <LinearGradient id="motif" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
      ) : null}
      {fill ? <Path d={`${PEAKS} L320 160 L0 160 Z`} fill={fill} /> : null}
      {fillPeaks && !fill ? <Path d={`${PEAKS} L320 160 L0 160 Z`} fill={paint} opacity={opacity * 0.6} /> : null}
      <Path d={PEAKS} stroke={paint} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" opacity={opacity * 1.6} />
      <Path d={WAVE_1} stroke={paint} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" opacity={opacity * 1.3} />
      <Path d={WAVE_2} stroke={paint} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" opacity={opacity} />
    </Svg>
  );
}
