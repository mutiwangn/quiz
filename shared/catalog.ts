import type { Catalog } from './types.ts';

export function selectedLessonNames(catalog: Catalog, selected: string[]): string[] {
  const ids = new Set(selected);
  return catalog.units.flatMap(unit => unit.lessons.filter(lesson => ids.has(lesson.id)).map(lesson => `${unit.name} · ${lesson.name}`));
}
