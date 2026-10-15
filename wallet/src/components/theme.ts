import { useColorScheme } from 'react-native';

// Palette drawn from Slovenian landscape rather than the flag: Pohorje/Kočevje forest green
// (the "I feel Slovenia" green, deepened for contrast), alpine blue, Soča emerald and
// Karst limestone white. Every text/background pair below meets WCAG AA.
const light = {
  bg: '#F3F5F1', // limestone
  surface: '#FFFFFF',
  sunken: '#E9EEE8',
  text: '#10261D', // forest ink
  muted: '#55665E',
  border: '#D6DED7',
  primary: '#1D5A3E', // forest green
  primaryText: '#FFFFFF',
  accent: '#0B4C87', // alpine blue
  emerald: '#0B7A6E', // Soča
  danger: '#A8261D',
  warnBg: '#FBF1DC',
  warnText: '#5E4300',
  okBg: '#DFF1EB',
  okText: '#0A5247',
};

const dark: typeof light = {
  bg: '#0B1511',
  surface: '#13201A',
  sunken: '#0F1B16',
  text: '#E5EEE8',
  muted: '#98AAA1',
  border: '#24362D',
  primary: '#6CC495',
  primaryText: '#062014',
  accent: '#8DBBEA',
  emerald: '#5ED1BF',
  danger: '#FF8F86',
  warnBg: '#33280F',
  warnText: '#F4D58D',
  okBg: '#0F2C25',
  okText: '#9EE3D2',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Document colours, one landscape per kind; white text passes AA on all of them. */
export const kindColors: Record<string, string> = {
  pid: '#0B4C87', // alpine sky over Triglav
  mdl: '#1D5A3E', // forest
  diploma: '#0A6B61', // Soča emerald
  ehic: '#1F5873', // Bohinj lake
  other: '#4A5751', // limestone shade
};

export const fonts = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  serif: 'SourceSerif4_600SemiBold',
};

export const radius = { card: 22, control: 16, small: 10 };
