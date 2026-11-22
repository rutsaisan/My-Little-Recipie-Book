import { createContext, useContext } from 'react';
import type { CharacterId } from '../assets/characters';
import type { AchievementDef, BookStats } from '../domain/achievements';

export interface AchievementsContextValue {
  /** Insignias conseguidas: id → fecha. */
  unlocked: ReadonlyMap<string, number>;
  stats: BookStats;
  /** Pegatinas disponibles para decorar (las de las insignias conseguidas). */
  stickers: CharacterId[];
  /** Insignia que se está celebrando ahora mismo (si hay). */
  celebration: AchievementDef | null;
  dismissCelebration: () => void;
}

export const AchievementsContext = createContext<AchievementsContextValue | null>(null);

export function useAchievements(): AchievementsContextValue {
  const value = useContext(AchievementsContext);
  if (!value) throw new Error('useAchievements debe usarse dentro de <AchievementsProvider>');
  return value;
}
