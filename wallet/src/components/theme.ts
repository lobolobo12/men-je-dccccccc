import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  text: '#0E1726',
  muted: '#5B6578',
  border: '#DDE2EB',
  primary: '#0B3D91',
  primaryText: '#FFFFFF',
  danger: '#B42318',
  warnBg: '#FFF4E5',
  warnText: '#7A4100',
  okBg: '#E7F6EC',
  okText: '#1B5E20',
};

const dark: typeof light = {
  bg: '#0B0F17',
  surface: '#151B26',
  text: '#E8ECF3',
  muted: '#9AA4B5',
  border: '#273041',
  primary: '#7FA7FF',
  primaryText: '#0B0F17',
  danger: '#FF8A80',
  warnBg: '#3A2A12',
  warnText: '#FFD8A8',
  okBg: '#12301B',
  okText: '#A5D6A7',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Card colours per credential kind, readable in both themes (white text). */
export const kindColors: Record<string, string> = {
  pid: '#0B3D91',
  mdl: '#7A2E8E',
  diploma: '#1F6F43',
  ehic: '#0E5E8C',
  other: '#4A5568',
};
