import { useEffect, useState } from 'react';

export const PALETTES = [
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
  { id: 'ink', label: 'Ink' },
  { id: 'paper', label: 'Paper' },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

const KEY = 'orbit.palette';

const listeners = new Set<(id: PaletteId) => void>();

export function readPalette(): PaletteId {
  try {
    const saved = localStorage.getItem(KEY);
    if (PALETTES.some((item) => item.id === saved)) return saved as PaletteId;
  } catch {
    /* ignore */
  }
  return 'green';
}

export function applyPalette(id: PaletteId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.palette = id;
  listeners.forEach((listener) => listener(id));
}

export function subscribePalette(listener: (id: PaletteId) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePalette(): PaletteId {
  const [id, setId] = useState(readPalette);
  useEffect(() => subscribePalette(setId), []);
  return id;
}
