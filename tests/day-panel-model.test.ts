import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/calendar-index';
import { buildDayModel } from '../src/calendar-model';
import { parseDoc } from '../src/doc';

import { setLang } from '../src/i18n';
setLang('fr');
const sample = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8');
const doc = parseDoc(sample);
const index = buildIndex(doc);

describe('buildDayModel', () => {
  it('titre avec jour, date et total d\'heures', () => {
    expect(buildDayModel(index, '2026-10-27').title).toBe('Mardi 27/10/2026 · 9h');
    expect(buildDayModel(index, '2026-10-27').summary).toEqual({ total: 3, done: 2, minutes: 540 });
  });

  it('une ligne par tache, avec une reference exacte a la ligne d\'origine', () => {
    const model = buildDayModel(index, '2026-10-27');
    expect(model.rows.map((r) => [r.done, r.text, r.hoursText, r.depth])).toEqual([
      [true, 'Continuer notebook monte competence', '2h', 0],
      [true, 'Corpus data', '7h', 0],
      [false, 'Projet alpha', '', 0],
    ]);
    for (const row of model.rows) {
      expect(row.ref.raw).toBe(doc.lines[row.ref.index].raw);
    }
  });

  it('formate les heures en Xh ou XhMM', () => {
    const row = buildDayModel(index, '2026-07-14').rows[0];
    expect(row.hoursText).toBe('4h');
  });

  it('signale les heures non reconnues et laisse le champ vide', () => {
    const rows = buildDayModel(index, '2026-10-07').rows;
    const documentation = rows.find((r) => r.text.startsWith('Documentation'));
    expect(documentation).toMatchObject({ hoursText: '', hoursUnrecognized: true });
    expect(rows.find((r) => r.text === 'Data games')?.hoursUnrecognized).toBe(false);
  });

  it('conserve les sous-taches (profondeur) et les taches vides', () => {
    const rows = buildDayModel(index, '2026-07-14').rows;
    expect(rows.map((r) => [r.depth, r.empty])).toEqual([
      [0, false],
      [1, false],
      [0, true],
    ]);
  });

  it('expose les lignes libres non vides du jour', () => {
    const free = buildDayModel(index, '2026-10-29').freeLines;
    expect(free).toContain('Texte libre multi-lignes');
    expect(free).toContain('  sous le jeudi.');
    expect(free.every((line) => line.trim() !== '')).toBe(true);
  });

  it('un jour absent : aucune ligne, titre sans duree', () => {
    const model = buildDayModel(index, '2026-10-31');
    expect(model.rows).toEqual([]);
    expect(model.title).toBe('Samedi 31/10/2026');
    expect(model.summary).toEqual({ total: 0, done: 0, minutes: 0 });
  });
});

describe('langue de l\'interface', () => {
  it('titre du jour en anglais', () => {
    expect(buildDayModel(index, '2026-10-27', 'en').title).toBe('Tuesday 27/10/2026 · 9h');
    expect(buildDayModel(index, '2026-10-27', 'fr').title).toBe('Mardi 27/10/2026 · 9h');
  });
});
