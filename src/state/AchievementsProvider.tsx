import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CharacterId } from '../assets/characters';
import { dataSource } from '../data';
import {
  ACHIEVEMENTS,
  computeStats,
  newlyUnlocked,
  type AchievementDef,
  type UnlockedAchievement,
} from '../domain/achievements';
import { playChime } from '../services/music/ambientMusic';
import { AchievementsContext, type AchievementsContextValue } from './achievementsContext';
import { useCategories } from './categoriesContext';
import { usePreferences } from './preferencesContext';
import { useRecipes } from './recipesContext';
import { useToast } from './toastContext';

/**
 * Vigila las recetas, el historial de cocina y las secciones propias; cuando
 * se cumple una insignia la guarda, coloca su pegatina en un hueco libre de la
 * portada y la celebra (si la persona no ha desactivado las celebraciones).
 */
export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { recipes, cooks, status } = useRecipes();
  const { custom, loaded: categoriesLoaded } = useCategories();
  const { prefs, loaded: prefsLoaded, setPref } = usePreferences();
  const toast = useToast();
  const [unlocked, setUnlocked] = useState<Map<string, number> | null>(null);
  const [queue, setQueue] = useState<AchievementDef[]>([]);
  const processing = useRef(new Set<string>());
  const firstCheck = useRef(true);
  const latest = useRef({ prefs, setPref, toast });

  useEffect(() => {
    latest.current = { prefs, setPref, toast };
  });

  useEffect(() => {
    let alive = true;
    dataSource.achievements
      .list()
      .then((list) => alive && setUnlocked(new Map(list.map((a) => [a.id, a.unlockedAt]))))
      .catch((error: unknown) => {
        console.error('[insignias] No se pudieron cargar', error);
        if (alive) setUnlocked(new Map());
      });
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => computeStats(recipes, cooks, custom.length), [recipes, cooks, custom.length]);

  useEffect(() => {
    if (!unlocked || status !== 'ready' || !prefsLoaded || !categoriesLoaded) return;
    const fresh = newlyUnlocked(stats, new Set([...unlocked.keys(), ...processing.current]));
    const initial = firstCheck.current;
    firstCheck.current = false;
    if (!fresh.length) return;
    fresh.forEach((a) => processing.current.add(a.id));
    const now = Date.now();
    const entries: UnlockedAchievement[] = fresh.map((a) => ({ id: a.id, unlockedAt: now }));

    void dataSource.achievements
      .unlock(entries)
      .then(() => {
        const { prefs: current, setPref: save, toast: notify } = latest.current;
        setUnlocked((map) => {
          const next = new Map(map);
          entries.forEach((e) => next.set(e.id, e.unlockedAt));
          return next;
        });

        // Las pegatinas nuevas se pegan solas en los huecos libres de la portada.
        const cover = [...current.coverStickers];
        const placed = new Set(cover);
        for (const a of fresh) {
          const slot = cover.indexOf(null);
          if (slot === -1) break;
          if (!placed.has(a.character)) {
            cover[slot] = a.character;
            placed.add(a.character);
          }
        }
        if (cover.some((c, i) => c !== current.coverStickers[i])) save('coverStickers', cover);

        if (!current.celebrations) return;
        if (initial) {
          // Insignias ganadas con recetas de antes: un aviso, sin fiesta.
          notify.show(
            fresh.length === 1
              ? `Tus recetas ya te han dado una insignia: «${fresh[0].title}». Está en tu álbum.`
              : `Tus recetas ya te han dado ${fresh.length} insignias. Están en tu álbum.`,
            { tone: 'success', character: fresh[0].character, duration: 6500 },
          );
        } else {
          setQueue((q) => [...q, ...fresh]);
          playChime();
        }
      })
      .catch((error: unknown) => console.error('[insignias] No se pudieron guardar', error))
      .finally(() => fresh.forEach((a) => processing.current.delete(a.id)));
  }, [stats, unlocked, status, prefsLoaded, categoriesLoaded]);

  const dismissCelebration = useCallback(() => setQueue((q) => q.slice(1)), []);

  const stickers = useMemo<CharacterId[]>(
    () => (unlocked ? ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).map((a) => a.character) : []),
    [unlocked],
  );

  const value = useMemo<AchievementsContextValue>(
    () => ({
      unlocked: unlocked ?? new Map(),
      stats,
      stickers,
      celebration: queue[0] ?? null,
      dismissCelebration,
    }),
    [unlocked, stats, stickers, queue, dismissCelebration],
  );

  return <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>;
}
