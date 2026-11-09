import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex, daySummary, weekMinutes } from '../src/calendar-index';
import { parseDoc } from '../src/doc';

const sample = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8');
const index = buildIndex(parseDoc(sample));
const lineOf = (text: string, needle: string): number =>
  text.split(/\r?\n/).findIndex((l) => l.includes(needle)) + 1;

describe('resolution des semaines', () => {
  it('accepte un en-tete mal tape (013/07/2026)', () => {
    expect(index.weeks.map((w) => w.monday)).toContain('2026-07-13');
  });

  it('utilise le premier jour date coherent quand l\'en-tete n\'est pas un lundi', () => {
    expect(index.weeks.map((w) => w.monday)).toContain('2026-10-05');
    expect(index.weeks.map((w) => w.monday)).not.toContain('2026-09-05');
    const diag = index.diagnostics.find((d) => d.kind === 'week-header-not-monday');
    expect(diag?.line).toBe(lineOf(sample, 'Semaine du 05/09/2026'));
  });

  it('reconnait les semaines par niveau de titre quelconque', () => {
    const doc = buildIndex(parseDoc('## Semaine du 01/06/2026\nLundi\n- [ ] a\n'));
    expect(doc.weeks[0].monday).toBe('2026-06-01');
    expect(doc.days.get('2026-06-01')?.tasks).toHaveLength(1);
  });
});

describe('placement des jours par position', () => {
  it('place un jour par nom + debut de semaine, meme avec une date erronee', () => {
    const wednesday = index.days.get('2026-07-15');
    expect(wednesday?.tasks.map((t) => t.text)).toEqual(['Redaction tdd']);
    const diag = index.diagnostics.find((d) => d.kind === 'day-date-mismatch');
    expect(diag?.line).toBe(lineOf(sample, 'Mercredi 08/07/2026'));
    expect(index.days.has('2026-07-08')).toBe(false);
  });

  it('un jour sans date est place', () => {
    expect(index.days.get('2026-10-30')?.tasks.map((t) => t.text)).toEqual(['Data games']);
  });

  it('un titre ##### est un jour', () => {
    expect(index.days.get('2026-10-07')?.tasks).toHaveLength(3);
  });

  it('"Lundi : texte" n\'est pas un jour et reste une ligne libre', () => {
    const friday = index.days.get('2026-10-30');
    expect(friday?.freeLines.map((l) => l.raw)).toContain('Lundi : Test studdio IQ suivi 3h');
    expect(index.days.get('2026-10-26')?.tasks).toHaveLength(2);
  });

  it('un jour multi-lignes garde ses lignes libres', () => {
    const thursday = index.days.get('2026-10-29');
    expect(thursday?.tasks.map((t) => t.text)).toEqual([
      'Points avec equipe relancer pour deploiement',
      'Agent vocal pc',
    ]);
    const free = thursday?.freeLines.map((l) => l.raw) ?? [];
    expect(free).toContain('Texte libre multi-lignes');
    expect(free).toContain('  sous le jeudi.');
  });

  it('un jour avant toute semaine est signale et non place', () => {
    const doc = buildIndex(parseDoc('Lundi\n- [ ] a\n'));
    expect(doc.days.size).toBe(0);
    expect(doc.diagnostics.map((d) => d.kind)).toContain('unplaced-block');
  });
});

describe('doublons', () => {
  it('deux semaines au meme lundi : fusionnees avec avertissement', () => {
    const doc = buildIndex(
      parseDoc('#### Semaine du 26/10/2026\nLundi\n- [ ] a\n#### Semaine du 26/10/2026\nLundi\n- [ ] b\n'),
    );
    expect(doc.diagnostics.map((d) => d.kind)).toContain('duplicate-week');
    const day = doc.days.get('2026-10-26');
    expect(day?.tasks.map((t) => t.text)).toEqual(['a', 'b']);
    expect(day?.blocks).toHaveLength(2);
  });

  it('un meme jour deux fois dans une semaine : fusionne avec avertissement', () => {
    const doc = buildIndex(
      parseDoc('#### Semaine du 26/10/2026\nVendredi\n- [ ] a\nVendredi 30/10/2026\n- [ ] b\n'),
    );
    expect(doc.diagnostics.map((d) => d.kind)).toContain('duplicate-day');
    expect(doc.days.get('2026-10-30')?.tasks.map((t) => t.text)).toEqual(['a', 'b']);
  });
});

describe('taches', () => {
  it('calcule profondeur, heures et etat', () => {
    const tuesday = index.days.get('2026-07-14');
    expect(tuesday?.tasks.map((t) => [t.text, t.depth, t.done, t.minutes])).toEqual([
      ['Plateforme formation test', 0, true, 240],
      ['Sous-tache de test', 1, false, null],
      ['', 0, false, null],
    ]);
    expect(tuesday?.tasks[2].empty).toBe(true);
    expect(tuesday?.tasks[0].index).toBeGreaterThan(0);
    expect(tuesday?.tasks[0].raw).toBe('- [x] Plateforme formation test (4h)');
  });

  it('les heures ambigues restent dans le texte et sont signalees', () => {
    const monday = index.days.get('2026-10-05');
    const verif = monday?.tasks.find((t) => t.text.startsWith('Verif'));
    expect(verif?.minutes).toBeNull();
    expect(verif?.hoursUnrecognized).toBe(true);
    const kinds = index.diagnostics.filter((d) => d.kind === 'ambiguous-hours').map((d) => d.line);
    expect(kinds).toContain(lineOf(sample, 'Verif (2 + 5h)'));
    expect(kinds).toContain(lineOf(sample, 'Documentation 8h-10h20'));
  });
});

describe('totaux', () => {
  it('exclut les taches vides et inclut les sous-taches', () => {
    expect(daySummary(index.days.get('2026-07-14'))).toEqual({ total: 2, done: 1, minutes: 240 });
  });

  it('un jour absent a des totaux nuls', () => {
    expect(daySummary(undefined)).toEqual({ total: 0, done: 0, minutes: 0 });
  });

  it('cumule les heures de la semaine (lundi a dimanche)', () => {
    // 9h + 9h + 9h + 7h + 6h
    expect(weekMinutes(index, '2026-10-26')).toBe(2400);
    expect(weekMinutes(index, '2026-01-05')).toBe(0);
  });
});
