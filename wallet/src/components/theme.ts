import { useColorScheme } from 'react-native';

// Light, friendly base with Slovenian landscape colours carried by the documents:
// Triglav sky blue, Soča turquoise, alpine meadow green and Lake Bled blue.
// Text/background pairs meet WCAG AA (checked in the PR notes).
const light = {
  bg: '#F6F8FC',
  surface: '#FFFFFF',
  sunken: '#EEF2F9',
  text: '#121A2B',
  muted: '#5A6478',
  border: '#E3E8F2',
  primary: '#2350D8', // alpine blue
  primaryText: '#FFFFFF',
  blueTint: '#E8EEFF',
  green: '#127A45', // meadow
  greenTint: '#E3F6EA',
  danger: '#C0262D',
  warnBg: '#FFF4DE',
  warnText: '#6A4A00',
  okBg: '#E3F6EA',
  okText: '#0F6B3C',
  gateBg: '#FFFFFF',
};

const dark: typeof light = {
  bg: '#0E121A',
  surface: '#171C27',
  sunken: '#1E2431',
  text: '#EEF2F8',
  muted: '#A3ADC2',
  border: '#283041',
  primary: '#7FA2FF',
  primaryText: '#0E121A',
  blueTint: '#1C2742',
  green: '#7FD8A4',
  greenTint: '#16302A',
  danger: '#FF8A8F',
  warnBg: '#33280F',
  warnText: '#F4D58D',
  okBg: '#16302A',
  okText: '#9EE6BD',
  gateBg: '#0E121A',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Card gradients (top-left → bottom-right). White text sits on the darker start (≥5.8:1). */
export const kindGradients: Record<string, [string, string]> = {
  pid: ['#1F3FBF', '#4C7DFF'], // Triglav sky
  mdl: ['#0B6F7E', '#16A89C'], // Soča
  diploma: ['#1B6E3A', '#4FAE45'], // alpine meadow
  ehic: ['#0E568F', '#2496CC'], // Lake Bled
  other: ['#434B63', '#76819E'],
};

export const fonts = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  display: 'PlusJakartaSans_800ExtraBold',
  heading: 'PlusJakartaSans_700Bold',
};

export const radius = { card: 24, tile: 22, control: 999, small: 14 };
