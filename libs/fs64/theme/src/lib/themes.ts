export type Fs64ThemeName = 'c64-dark' | 'amber' | 'vader' | 'mono';

export type Fs64Theme = {
  name: Fs64ThemeName;
  label: string;
  background: string;
  panel: string;
  panelAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  brandLine1: string;
  brandLine2: string;
  brandLine3: string;
  floppyCase: string;
  floppyStroke: string;
  floppyDisk: string;
  floppyDetail: string;
  diskLabelBg: string;
  diskLabelBorder: string;
  diskLabelText: string;
};

export const FS64_THEME_STORAGE_KEY = 'fs64-theme';

export const FS64_THEMES: Record<Fs64ThemeName, Fs64Theme> = {
  'c64-dark': {
    name: 'c64-dark',
    label: 'C64 Dark',
    background: '#050814',
    panel: 'rgba(10, 18, 36, 0.9)',
    panelAlt: 'rgba(6, 12, 24, 0.92)',
    border: '#00d9ff',
    text: '#eefaff',
    muted: '#9ed6e4',
    accent: '#00d9ff',
    brandLine1: '#00d9ff',
    brandLine2: '#0bc8f4',
    brandLine3: '#158db7',
    floppyCase: '#071120',
    floppyStroke: '#00d9ff',
    floppyDisk: '#01070f',
    floppyDetail: '#9ed6e4',
    diskLabelBg: '#04101b',
    diskLabelBorder: '#00d9ff',
    diskLabelText: '#eefaff',
  },
  amber: {
    name: 'amber',
    label: 'Amber',
    background: '#140f06',
    panel: 'rgba(34, 22, 10, 0.92)',
    panelAlt: 'rgba(26, 16, 7, 0.94)',
    border: '#ffb454',
    text: '#ffe7c2',
    muted: '#e2bf89',
    accent: '#ffb454',
    brandLine1: '#ffb454',
    brandLine2: '#ff9c1f',
    brandLine3: '#9f5f00',
    floppyCase: '#1a1200',
    floppyStroke: '#ffb454',
    floppyDisk: '#ffb454',
    floppyDetail: '#ffb454',
    diskLabelBg: '#140f00',
    diskLabelBorder: '#ffb454',
    diskLabelText: '#ffb454',
  },
  vader: {
    name: 'vader',
    label: 'Vader',
    background: '#0f0606',
    panel: 'rgba(20, 0, 0, 0.62)',
    panelAlt: 'rgba(16, 0, 0, 0.84)',
    border: '#ff3b30',
    text: '#ffe8e6',
    muted: '#ff968e',
    accent: '#ff3b30',
    brandLine1: '#ff3b30',
    brandLine2: '#ff5a52',
    brandLine3: '#89211d',
    floppyCase: '#140707',
    floppyStroke: '#ff3b30',
    floppyDisk: '#0a0202',
    floppyDetail: '#ff3b30',
    diskLabelBg: '#120606',
    diskLabelBorder: '#ff3b30',
    diskLabelText: '#ff5a52',
  },
  mono: {
    name: 'mono',
    label: 'Mono',
    background: '#d8d8d8',
    panel: 'rgba(245, 245, 245, 0.94)',
    panelAlt: 'rgba(226, 226, 226, 0.96)',
    border: '#161616',
    text: '#0d0d0d',
    muted: '#4c4c4c',
    accent: '#161616',
    brandLine1: '#111111',
    brandLine2: '#555555',
    brandLine3: '#8a8a8a',
    floppyCase: '#e5e5e5',
    floppyStroke: '#111111',
    floppyDisk: '#cccccc',
    floppyDetail: '#cccccc',
    diskLabelBg: '#f2f2f2',
    diskLabelBorder: '#000000',
    diskLabelText: '#000000',
  },
};

export const FS64_THEME_OPTIONS = Object.values(FS64_THEMES).map(({ name, label }) => ({ name, label }));

export const DEFAULT_THEME_NAME: Fs64ThemeName = 'c64-dark';

export function isFs64ThemeName(value: unknown): value is Fs64ThemeName {
  return typeof value === 'string' && value in FS64_THEMES;
}

export function resolveFs64ThemeName(value: unknown): Fs64ThemeName {
  return isFs64ThemeName(value) ? value : DEFAULT_THEME_NAME;
}

export function getFs64Theme(themeName: Fs64ThemeName = DEFAULT_THEME_NAME): Fs64Theme {
  return FS64_THEMES[resolveFs64ThemeName(themeName)];
}

export function readStoredFs64Theme(): Fs64ThemeName {
  if (typeof window === 'undefined') return DEFAULT_THEME_NAME;
  return resolveFs64ThemeName(window.localStorage.getItem(FS64_THEME_STORAGE_KEY));
}

export function writeStoredFs64Theme(themeName: Fs64ThemeName) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FS64_THEME_STORAGE_KEY, themeName);
  window.dispatchEvent(new CustomEvent('fs64-theme-change', { detail: themeName }));
}
