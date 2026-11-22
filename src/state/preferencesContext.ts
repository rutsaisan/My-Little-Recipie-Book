import { createContext, useContext } from 'react';
import { CHARACTERS, type CharacterId } from '../assets/characters';
import type { Settings } from '../data';
import { COVER_SLOTS, isRibbonColor, isTablecloth, type RibbonColorId, type TableclothId } from '../domain/decorations';

/** Preferencias del libro, siempre completas (con valores por defecto). */
export interface Preferences {
  bookmark: string | null;
  bookStartedAt: number | null;
  ownerName: string;
  dedication: string;
  coverStickers: (CharacterId | null)[];
  tablecloth: TableclothId;
  ribbonColor: RibbonColorId;
  music: { enabled: boolean; volume: number };
  celebrations: boolean;
  recentRecipes: string[];
  assistantVoice: boolean;
}

export const DEFAULT_DEDICATION = 'recetas hechas con cariño';

export const DEFAULT_PREFERENCES: Preferences = {
  bookmark: null,
  bookStartedAt: null,
  ownerName: '',
  dedication: DEFAULT_DEDICATION,
  coverStickers: Array<CharacterId | null>(COVER_SLOTS).fill(null),
  tablecloth: 'vichy',
  ribbonColor: 'caramelo',
  music: { enabled: false, volume: 0.6 },
  celebrations: true,
  recentRecipes: [],
  assistantVoice: true,
};

const isCharacter = (id: unknown): id is CharacterId => typeof id === 'string' && id in CHARACTERS;
const text = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.slice(0, max) : fallback);

/** Lectura defensiva de lo guardado. */
export function readPreferences(raw: Partial<Settings>): Preferences {
  const d = DEFAULT_PREFERENCES;
  const stickers = Array.isArray(raw.coverStickers) ? raw.coverStickers : [];
  const music = typeof raw.music === 'object' && raw.music !== null ? raw.music : d.music;
  return {
    bookmark: typeof raw.bookmark === 'string' ? raw.bookmark : null,
    bookStartedAt: typeof raw.bookStartedAt === 'number' ? raw.bookStartedAt : null,
    ownerName: text(raw.ownerName, 40, d.ownerName),
    dedication: text(raw.dedication, 50, d.dedication),
    coverStickers: Array.from({ length: COVER_SLOTS }, (_, i) => (isCharacter(stickers[i]) ? stickers[i] : null)),
    tablecloth: isTablecloth(raw.tablecloth) ? raw.tablecloth : d.tablecloth,
    ribbonColor: isRibbonColor(raw.ribbonColor) ? raw.ribbonColor : d.ribbonColor,
    music: {
      enabled: music.enabled === true,
      volume: typeof music.volume === 'number' ? Math.min(1, Math.max(0, music.volume)) : d.music.volume,
    },
    celebrations: raw.celebrations !== false,
    recentRecipes: Array.isArray(raw.recentRecipes)
      ? raw.recentRecipes.filter((id): id is string => typeof id === 'string').slice(0, 12)
      : [],
    assistantVoice: raw.assistantVoice !== false,
  };
}

export interface PreferencesContextValue {
  prefs: Preferences;
  loaded: boolean;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences debe usarse dentro de <PreferencesProvider>');
  return value;
}
