import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/calendar-index';
import type { TaskView } from '../src/calendar-index';
import { parseDoc, serializeDoc } from '../src/doc';
import type { Doc } from '../src/doc';
import {
  StaleLineError,
  addTask,
  copyTask,
  moveTask,
  removeTask,
  setDepth,
  updateTask,
} from '../src/ops';
import type { LineRef } from '../src/ops';

const sample = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8');
const lines = (text: string): string[] => text.split(/\r?\n/);

/** Fenetre minimale qui differe entre deux textes (prefixe et suffixe communs retires). */
function changedWindow(before: string, after: string): { removed: string[]; added: string[] } {
  const a = lines(before);
  const b = lines(after);
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }
  return { removed: a.slice(prefix, a.length - suffix), added: b.slice(prefix, b.length - suffix) };
}

const sorted = (values: string[]): string[] => [...values].sort();

function taskOf(doc: Doc, date: string, startsWith: string): TaskView {
  const task = buildIndex(doc).days.get(date)?.tasks.find((t) => t.text.startsWith(startsWith));
  if (!task) throw new Error(`tache introuvable: ${date} ${startsWith}`);
  return task;
}
const refOf = (task: TaskView): LineRef => ({ index: task.index, raw: task.raw });

describe('addTask', () => {
  it('ajoute apres la derniere tache d\'un jour existant, sans toucher au reste', () => {
    const doc = parseDoc(sample);
    const result = serializeDoc(addTask(doc, '2026-10-27', { text: 'Nouvelle tache', minutes: 120 }));
    const win = changedWindow(sample, result);
    expect(win.removed).toEqual([]);
    expect(win.added).toEqual(['- [ ] Nouvelle tache 2h']);
    const out = lines(result);
    expect(out.indexOf('- [ ] Nouvelle tache 2h')).toBe(out.indexOf('- [ ] Projet alpha') + 1);
  });

  it('cree un jour absent dans une semaine existante, apres le jour precedent', () => {
    const result = serializeDoc(
      addTask(parseDoc(sample), '2026-10-31', { text: 'Week-end', minutes: null }),
    );
    const win = changedWindow(sample, result);
    expect(win.removed).toEqual([]);
    expect(sorted(win.added)).toEqual(sorted(['', 'Samedi 31/10/2026', '- [ ] Week-end']));
    const out = lines(result);
    const saturday = out.indexOf('Samedi 31/10/2026');
    expect(saturday).toBeGreaterThan(out.indexOf('- [x] Data games 6h'));
    expect(saturday).toBeLessThan(out.indexOf('Lundi : Test studdio IQ suivi 3h'));
  });

  it('cree une semaine absente avant les notes libres de fin de fichier', () => {
    const result = serializeDoc(
      addTask(parseDoc(sample), '2026-11-04', { text: 'Tache', minutes: null }),
    );
    const win = changedWindow(sample, result);
    expect(win.removed).toEqual([]);
    expect(sorted(win.added)).toEqual(
      sorted(['', '#### Semaine du 02/11/2026', '', 'Mercredi 04/11/2026', '- [ ] Tache']),
    );
    const out = lines(result);
    const header = out.indexOf('#### Semaine du 02/11/2026');
    expect(header).toBeGreaterThan(out.indexOf('- [x] Data games 6h'));
    expect(header).toBeLessThan(out.indexOf('Rapport de stage'));
    expect(buildIndex(parseDoc(result)).days.get('2026-11-04')?.tasks).toHaveLength(1);
  });

  it('cree une semaine anterieure avant la premiere semaine du fichier', () => {
    const result = serializeDoc(
      addTask(parseDoc(sample), '2026-06-01', { text: 'Tache', minutes: null }),
    );
    const out = lines(result);
    expect(out.indexOf('#### Semaine du 01/06/2026')).toBeLessThan(
      out.indexOf('#### Semaine du 013/07/2026'),
    );
    expect(out.indexOf('Texte libre avant toute semaine.')).toBeLessThan(
      out.indexOf('#### Semaine du 01/06/2026'),
    );
  });

  it('cree semaine + jour + tache dans un fichier vide', () => {
    const result = serializeDoc(
      addTask(parseDoc(''), '2026-10-26', { text: 'Premiere tache', minutes: 180 }),
    );
    expect(result).toBe('#### Semaine du 26/10/2026\n\nLundi 26/10/2026\n- [ ] Premiere tache 3h\n');
  });

  it('en CRLF, toutes les lignes creees finissent par CRLF', () => {
    const crlf = '#### Semaine du 26/10/2026\r\n\r\nLundi 26/10/2026\r\n- [ ] a\r\n';
    const result = serializeDoc(addTask(parseDoc(crlf), '2026-10-27', { text: 'b', minutes: null }));
    expect(/(?<!\r)\n/.test(result)).toBe(false);
    expect(result).toContain('Mardi 27/10/2026\r\n- [ ] b\r\n');
  });

  it('conserve l\'absence de retour final', () => {
    const text = '#### Semaine du 26/10/2026\nLundi\n- [ ] a';
    const result = serializeDoc(addTask(parseDoc(text), '2026-10-26', { text: 'b', minutes: null }));
    expect(result).toBe('#### Semaine du 26/10/2026\nLundi\n- [ ] a\n- [ ] b');
  });

  it('un jour repete dans les notes de fin ne detourne pas l\'insertion (cas reel)', () => {
    const text =
      '#### Semaine du 26/10/2026\nLundi\n- [ ] a\nMardi\n- [ ] b\nMercredi\n- [ ] c\n\nMardi\nplan de mardi\nMercredi\nnote\n';
    const doc = parseDoc(text);
    const added = serializeDoc(addTask(doc, '2026-10-28', { text: 'd', minutes: null }));
    expect(lines(added).indexOf('- [ ] d')).toBe(lines(added).indexOf('- [ ] c') + 1);
    const week = serializeDoc(addTask(doc, '2026-11-02', { text: 'e', minutes: null }));
    const out = lines(week);
    expect(out.indexOf('#### Semaine du 02/11/2026')).toBeGreaterThan(out.indexOf('- [ ] c'));
    expect(out.indexOf('#### Semaine du 02/11/2026')).toBeLessThan(out.lastIndexOf('Mardi'));
  });

  it('ne modifie pas le Doc recu', () => {
    const doc = parseDoc(sample);
    addTask(doc, '2026-10-27', { text: 'x', minutes: null });
    expect(serializeDoc(doc)).toBe(sample);
  });
});

describe('updateTask', () => {
  it('efface les heures', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-28', 'Corpus data'));
    const win = changedWindow(sample, serializeDoc(updateTask(doc, ref, { minutes: null })));
    expect(win).toEqual({ removed: ['- [x] Corpus data 9h'], added: ['- [x] Corpus data'] });
  });

  it('cocher conserve le format d\'origine des heures', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-07-14', 'Plateforme formation test'));
    const win = changedWindow(sample, serializeDoc(updateTask(doc, ref, { done: false })));
    expect(win).toEqual({
      removed: ['- [x] Plateforme formation test (4h)'],
      added: ['- [ ] Plateforme formation test (4h)'],
    });
  });

  it('modifie texte et heures, en gardant l\'indentation', () => {
    const doc = parseDoc(sample);
    const parent = refOf(taskOf(doc, '2026-10-27', 'Projet'));
    expect(
      changedWindow(
        sample,
        serializeDoc(updateTask(doc, parent, { text: 'Projet alpha v2', minutes: 90 })),
      ).added,
    ).toEqual(['- [ ] Projet alpha v2 1h30']);
    const sub = refOf(taskOf(doc, '2026-07-14', 'Sous-tache'));
    expect(
      changedWindow(sample, serializeDoc(updateTask(doc, sub, { text: 'X' }))).added,
    ).toEqual(['\t- [ ] X']);
  });

  it('un patch sans effet ne reecrit rien', () => {
    const doc = parseDoc(sample);
    const task = taskOf(doc, '2026-07-14', 'Plateforme formation test');
    const result = updateTask(doc, refOf(task), { text: task.text, minutes: 240, done: true });
    expect(serializeDoc(result)).toBe(sample);
  });

  it('on peut enchainer deux editions de la meme ligne avec la ligne predite (contrat du panneau)', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-27', 'Projet'));
    const first = updateTask(doc, ref, { text: 'Projet v2' });
    const predicted: LineRef = { index: ref.index, raw: first.lines[ref.index].raw };
    const second = updateTask(first, predicted, { done: true });
    expect(second.lines[ref.index].raw).toBe('- [x] Projet v2');
  });

  it('refuse une ligne perimee et laisse le document intact', () => {
    const doc = parseDoc(sample);
    const task = taskOf(doc, '2026-10-28', 'Corpus data');
    expect(() => updateTask(doc, { index: task.index, raw: '- [x] autre chose' }, { done: false })).toThrow(
      StaleLineError,
    );
    expect(() => updateTask(doc, { index: 9999, raw: 'x' }, { done: false })).toThrow(StaleLineError);
    expect(serializeDoc(doc)).toBe(sample);
  });
});

describe('removeTask', () => {
  it('retire la tache et ses sous-taches', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-07-14', 'Plateforme formation test'));
    const win = changedWindow(sample, serializeDoc(removeTask(doc, ref)));
    expect(win.added).toEqual([]);
    expect(win.removed).toEqual(['- [x] Plateforme formation test (4h)', '\t- [ ] Sous-tache de test']);
  });
});

describe('moveTask', () => {
  it('deplace une tache vers un jour absent (le jour est cree)', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-27', 'Projet'));
    const result = moveTask(doc, ref, '2026-10-31');
    const index = buildIndex(parseDoc(serializeDoc(result)));
    expect(index.days.get('2026-10-27')?.tasks.some((t) => t.text.startsWith('Projet'))).toBe(false);
    expect(index.days.get('2026-10-31')?.tasks.map((t) => t.raw)).toEqual(['- [ ] Projet alpha']);
  });

  it('deplace aussi les sous-taches', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-05', 'Plateforme flux'));
    const index = buildIndex(parseDoc(serializeDoc(moveTask(doc, ref, '2026-10-06'))));
    expect(index.days.get('2026-10-06')?.tasks.map((t) => [t.text, t.depth])).toEqual([
      ['Plateforme flux', 0],
      ['Pouvoir arreter le job', 1],
    ]);
    expect(index.days.get('2026-10-05')?.tasks.map((t) => t.text)).toEqual(['Verif (2 + 5h)']);
  });

  it('une sous-tache deplacee devient une tache de premier niveau', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-07-14', 'Sous-tache'));
    const index = buildIndex(parseDoc(serializeDoc(moveTask(doc, ref, '2026-07-13'))));
    const moved = index.days.get('2026-07-13')?.tasks.find((t) => t.text === 'Sous-tache de test');
    expect(moved?.depth).toBe(0);
  });

  it('deplacer vers le meme jour ne change rien', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-27', 'Projet'));
    expect(serializeDoc(moveTask(doc, ref, '2026-10-27'))).toBe(sample);
  });
});

describe('copyTask', () => {
  it('copie decochee et sans heures sur plusieurs jours, la source reste intacte', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-28', 'Corpus data'));
    const index = buildIndex(parseDoc(serializeDoc(copyTask(doc, ref, ['2026-10-29', '2026-10-30', '2026-10-31']))));
    for (const date of ['2026-10-29', '2026-10-30', '2026-10-31']) {
      const copy = index.days.get(date)?.tasks.find((t) => t.text === 'Corpus data');
      expect(copy, date).toBeDefined();
      expect(copy?.done).toBe(false);
      expect(copy?.minutes).toBeNull();
    }
    const source = index.days.get('2026-10-28')?.tasks.find((t) => t.text === 'Corpus data');
    expect(source?.done).toBe(true);
    expect(source?.minutes).toBe(540);
  });

  it('copie les sous-taches', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-05', 'Plateforme flux'));
    const index = buildIndex(parseDoc(serializeDoc(copyTask(doc, ref, ['2026-10-06']))));
    expect(index.days.get('2026-10-06')?.tasks.map((t) => [t.text, t.depth, t.done])).toEqual([
      ['Plateforme flux', 0, false],
      ['Pouvoir arreter le job', 1, false],
    ]);
  });
});

describe('setDepth', () => {
  it('refuse d\'indenter sans tache parent juste avant', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-26', 'Deblocage'));
    expect(() => setDepth(doc, ref, 1)).toThrow('no-parent');
  });

  it('indente puis desindente en retrouvant le texte d\'origine', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-27', 'Corpus data'));
    const indented = setDepth(doc, ref, 1);
    expect(changedWindow(sample, serializeDoc(indented)).added).toEqual(['\t- [x] Corpus data 7h']);
    const again = refOf(taskOf(indented, '2026-10-27', 'Corpus data'));
    expect(serializeDoc(setDepth(indented, again, 0))).toBe(sample);
  });

  it('une tache indentee est vue en profondeur 1 par l\'index (epingle le rendu de l\'UI)', () => {
    const doc = parseDoc(sample);
    const ref = refOf(taskOf(doc, '2026-10-27', 'Corpus data'));
    const indented = setDepth(doc, ref, 1);
    const view = taskOf(indented, '2026-10-27', 'Corpus data');
    expect(view.depth).toBe(1);
    expect(view.raw).toBe('\t- [x] Corpus data 7h');
  });

  it('decale aussi les sous-taches', () => {
    const doc = parseDoc('#### Semaine du 26/10/2026\nLundi\n- [ ] A\n- [ ] B\n\t- [ ] C\n');
    const ref = refOf(taskOf(doc, '2026-10-26', 'B'));
    const result = setDepth(doc, ref, 1);
    expect(serializeDoc(result)).toBe('#### Semaine du 26/10/2026\nLundi\n- [ ] A\n\t- [ ] B\n\t\t- [ ] C\n');
    expect(buildIndex(result).days.get('2026-10-26')?.tasks.map((t) => t.depth)).toEqual([0, 1, 2]);
  });
});

describe('propriete : aucune operation ne perd de texte libre ni ne casse l\'aller-retour', () => {
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const freeCounts = (doc: Doc): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const line of doc.lines) {
      if (line.kind === 'other' && line.raw.trim() !== '') {
        counts.set(line.raw, (counts.get(line.raw) ?? 0) + 1);
      }
    }
    return counts;
  };

  it('200 operations aleatoires reproductibles', () => {
    const random = mulberry32(2026);
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
    const dates = Array.from({ length: 27 }, (_, i) => `2026-10-${String(5 + i).padStart(2, '0')}`).filter(
      (d) => d <= '2026-10-31',
    ).concat(['2026-11-02', '2026-11-03', '2026-06-02']);
    let doc = parseDoc(sample);
    for (let step = 0; step < 200; step++) {
      const before = serializeDoc(doc);
      const beforeFree = freeCounts(doc);
      const tasks = [...buildIndex(doc).days.values()].flatMap((d) => d.tasks);
      const ref: LineRef | null = tasks.length ? refOf(pick(tasks)) : null;
      const op = Math.floor(random() * 7);
      let next: Doc = doc;
      try {
        if (op === 0 || !ref) next = addTask(doc, pick(dates), { text: `t${step}`, minutes: random() < 0.5 ? 60 : null });
        else if (op === 1) next = updateTask(doc, ref, { text: `u${step}`, minutes: 30 });
        else if (op === 2) next = updateTask(doc, ref, { done: random() < 0.5 });
        else if (op === 3) next = removeTask(doc, ref);
        else if (op === 4) next = moveTask(doc, ref, pick(dates));
        else if (op === 5) next = copyTask(doc, ref, [pick(dates), pick(dates)]);
        else next = setDepth(doc, ref, random() < 0.5 ? 0 : 1);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'no-parent') throw error;
      }
      expect(serializeDoc(doc)).toBe(before); // l'entree n'est jamais modifiee
      const text = serializeDoc(next);
      expect(serializeDoc(parseDoc(text))).toBe(text);
      const afterFree = freeCounts(next);
      for (const [raw, count] of beforeFree) {
        expect(afterFree.get(raw) ?? 0, `ligne libre perdue: ${raw}`).toBeGreaterThanOrEqual(count);
      }
      doc = next;
    }
  });
});
