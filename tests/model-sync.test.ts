import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyEdit } from '../src/apply-edit';
import { StaleLineError, addTask, updateTask } from '../src/ops';

const sample = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8');

describe('applyEdit', () => {
  it('une edition neutre renvoie exactement le texte d\'origine', () => {
    expect(applyEdit(sample, (doc) => doc)).toBe(sample);
  });

  it('applique une operation et rend le texte complet', () => {
    const result = applyEdit('#### Semaine du 26/10/2026\nLundi\n- [ ] a\n', (doc) =>
      addTask(doc, '2026-10-26', { text: 'b', minutes: 60 }),
    );
    expect(result).toBe('#### Semaine du 26/10/2026\nLundi\n- [ ] a\n- [ ] b 1h\n');
  });

  it('une ligne perimee leve StaleLineError sans resultat partiel', () => {
    expect(() =>
      applyEdit(sample, (doc) => updateTask(doc, { index: 3, raw: '- [x] ligne qui a bouge' }, { done: false })),
    ).toThrow(StaleLineError);
  });

  it('choisit la langue des en-tetes : celle detectee, ou le repli donne', () => {
    const seen: (string | null)[] = [];
    const resolve = (detected: 'fr' | 'en' | null): 'fr' | 'en' => {
      seen.push(detected);
      return detected ?? 'fr';
    };
    const empty = applyEdit('', (doc) => addTask(doc, '2026-10-26', { text: 'a', minutes: null }), resolve);
    expect(empty).toBe('#### Semaine du 26/10/2026\n\nLundi 26/10/2026\n- [ ] a\n');
    const english = applyEdit(
      '#### Week of 26/10/2026\nMonday\n- [ ] a\n',
      (doc) => addTask(doc, '2026-10-27', { text: 'b', minutes: null }),
      resolve,
    );
    expect(english).toContain('Tuesday 27/10/2026');
    expect(seen).toEqual([null, 'en']);
  });

  it('repart du texte recu : une modification manuelle concurrente est conservee', () => {
    const edited = sample.replace('Texte libre avant toute semaine.', 'Texte modifie a la main.');
    const result = applyEdit(edited, (doc) => addTask(doc, '2026-10-27', { text: 'x', minutes: null }));
    expect(result).toContain('Texte modifie a la main.');
    expect(result).toContain('- [ ] x');
  });
});
