import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex, daySummary, weekMinutes } from '../src/calendar-index';
import { parseDoc, serializeDoc } from '../src/doc';

// docs/demo/Tasks.md : jeu de donnees fictif pour les captures d'ecran du README.
const text = readFileSync(new URL('../docs/demo/Tasks.md', import.meta.url), 'utf8');
const doc = parseDoc(text);
const index = buildIndex(doc);

describe('jeu de donnees de demonstration', () => {
  it('se relit et se reecrit a l\'identique', () => {
    expect(serializeDoc(doc)).toBe(text);
  });

  it('est en anglais, sur trois semaines consecutives', () => {
    expect(doc.headerLang).toBe('en');
    expect(index.weeks.map((w) => w.monday)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
  });

  it('ne contient qu\'une seule anomalie voulue : des heures ambigues pour montrer le avertissement', () => {
    expect(index.diagnostics.map((d) => d.kind)).toEqual(['ambiguous-hours']);
  });

  it('les totaux sont ceux attendus', () => {
    expect(weekMinutes(index, '2026-10-26')).toBe(28.5 * 60);
    expect(daySummary(index.days.get('2026-10-27'))).toEqual({ total: 4, done: 4, minutes: 270 });
    expect(daySummary(index.days.get('2026-11-10'))).toEqual({ total: 4, done: 0, minutes: 0 });
  });

  it('la note libre du mercredi est conservee en lecture seule', () => {
    const free = index.days.get('2026-11-04')?.freeLines.map((l) => l.raw) ?? [];
    expect(free).toContain('Notes from the workshop: the new onboarding flow was well received.');
  });

  it('ne contient aucune donnee personnelle connue', () => {
    expect(text).not.toMatch(/jeremiah|geraud|bidoun|@|http/i);
  });
});
