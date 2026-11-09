import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/calendar-index';
import { buildMonthModel, cellSummaryText } from '../src/calendar-model';
import { parseDoc } from '../src/doc';

const sample = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8');
const index = buildIndex(parseDoc(sample));
const model = buildMonthModel(index, 2026, 9, '2026-10-27');
const cells = model.weeks.flatMap((w) => w.cells);
const cell = (date: string) => {
  const found = cells.find((c) => c.date === date);
  if (!found) throw new Error(`cellule absente: ${date}`);
  return found;
};

describe('buildMonthModel', () => {
  it('libelle en francais et semaines de 7 cellules', () => {
    expect(model.label).toBe('octobre 2026');
    expect(model.weeks).toHaveLength(5);
    expect(model.weeks.every((w) => w.cells.length === 7)).toBe(true);
    expect(model.weeks[0].monday).toBe('2026-09-28');
  });

  it('marque les cellules hors mois et le jour courant (une seule)', () => {
    expect(cell('2026-09-30').inMonth).toBe(false);
    expect(cell('2026-10-01').inMonth).toBe(true);
    expect(cells.filter((c) => c.isToday).map((c) => c.date)).toEqual(['2026-10-27']);
    expect(cell('2026-10-27').dayOfMonth).toBe(27);
  });

  it('resume chaque jour : faites / total / heures', () => {
    expect(cell('2026-10-26')).toMatchObject({ total: 2, done: 2, minutes: 540 });
    expect(cell('2026-10-27')).toMatchObject({ total: 3, done: 2, minutes: 540 });
    expect(cell('2026-10-31')).toMatchObject({ total: 0, done: 0, minutes: 0 });
  });

  it('le total hebdomadaire est la somme des cellules', () => {
    const week = model.weeks.find((w) => w.monday === '2026-10-26');
    expect(week?.minutes).toBe(2400);
    expect(week?.minutes).toBe(week?.cells.reduce((sum, c) => sum + c.minutes, 0));
  });

  it('un mois sans donnees est vide mais complet', () => {
    const empty = buildMonthModel(index, 2027, 1, '2026-10-27');
    expect(empty.label).toBe('février 2027');
    expect(empty.weeks.flatMap((w) => w.cells).every((c) => c.total === 0)).toBe(true);
  });
});

describe('cellSummaryText', () => {
  it('affiche faites/total et heures', () => {
    expect(cellSummaryText(cell('2026-10-26'))).toBe('2/2 ✓ · 9h');
    expect(cellSummaryText(cell('2026-10-27'))).toBe('2/3 ✓ · 9h');
  });

  it('masque tout pour un jour sans tache et les heures quand il n\'y en a pas', () => {
    expect(cellSummaryText(cell('2026-10-31'))).toBe('');
    expect(cellSummaryText({ ...cell('2026-10-26'), minutes: 0 })).toBe('2/2 ✓');
  });
});
