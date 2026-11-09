import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeTaskLine, parseDoc, serializeDoc, taskParts } from '../src/doc';
import type { DocLine } from '../src/doc';

const sample = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8');

const REAL_FILE =
  process.env.TASK_FILE ?? 'C:/Users/LENOVO/Documents/Obsidian Vault/Tâches/Toutes les tâches.md';

type TaskLine = Extract<DocLine, { kind: 'task' }>;
const asTask = (line: DocLine): TaskLine => {
  if (line.kind !== 'task') throw new Error('not a task line');
  return line;
};

describe('aller-retour octet pour octet', () => {
  it.each([
    ['sample.md', sample],
    ['vide', ''],
    ['un retour a la ligne', '\n'],
    ['CRLF', '- [x] a 2h\r\n\r\nLundi\r\n- [ ] b\r\n'],
    ['mixte LF/CRLF', '- [x] a\r\n- [ ] b\nlibre\r\n'],
    ['sans retour final', '- [x] a\nfin'],
    ['espaces de fin', '- [ ] a  \n   \n'],
  ])('%s', (_name, text) => {
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });

  it.skipIf(!existsSync(REAL_FILE))('le vrai fichier de taches de l\'utilisateur', () => {
    const text = readFileSync(REAL_FILE, 'utf8');
    expect(serializeDoc(parseDoc(text))).toBe(text);
  });
});

describe('parseDoc', () => {
  it('reconnait une tache cochee et son corps', () => {
    const doc = parseDoc('- [x] Corpus data 9h\n');
    const line = asTask(doc.lines[0]);
    expect(line.done).toBe(true);
    expect(line.body).toBe('Corpus data 9h');
    expect(line.indent).toBe(0);
    expect(line.eol).toBe('\n');
  });

  it('une tache vide reste une tache', () => {
    const line = asTask(parseDoc('- [ ] \n').lines[0]);
    expect(line.body).toBe('');
    expect(line.done).toBe(false);
  });

  it('mesure l\'indentation (tabulation = 4)', () => {
    expect(asTask(parseDoc('\t- [ ] a').lines[0]).indent).toBe(4);
    expect(asTask(parseDoc('  - [ ] a').lines[0]).indent).toBe(2);
  });

  it('garde le reste comme lignes libres', () => {
    const doc = parseDoc('Lundi\nnote libre\n');
    expect(doc.lines.map((l) => l.kind)).toEqual(['other', 'other']);
  });

  it('detecte la fin de ligne dominante (premiere rencontree)', () => {
    expect(parseDoc('a\r\nb\n').eol).toBe('\r\n');
    expect(parseDoc('a\nb\r\n').eol).toBe('\n');
    expect(parseDoc('sans retour').eol).toBe('\n');
  });
});

describe('taskParts', () => {
  it('separe texte et heures', () => {
    expect(taskParts(asTask(parseDoc('- [x] Corpus data 9h').lines[0]))).toEqual({
      text: 'Corpus data',
      minutes: 540,
      hoursUnrecognized: false,
    });
  });

  it('signale des heures non reconnues sans toucher au texte', () => {
    expect(taskParts(asTask(parseDoc('- [ ] a 8h-10h20').lines[0]))).toEqual({
      text: 'a 8h-10h20',
      minutes: null,
      hoursUnrecognized: true,
    });
  });

  it('une tache sans heures n\'est pas signalee', () => {
    expect(taskParts(asTask(parseDoc('- [ ] Projet alpha').lines[0]))).toEqual({
      text: 'Projet alpha',
      minutes: null,
      hoursUnrecognized: false,
    });
  });
});

describe('makeTaskLine', () => {
  it('ecrit une ligne normalisee', () => {
    expect(makeTaskLine(0, true, 'Corpus data', 420, '\n').raw).toBe('- [x] Corpus data 7h');
    expect(makeTaskLine(1, false, 'Sous-tache', null, '\n').raw).toBe('\t- [ ] Sous-tache');
    expect(makeTaskLine(0, false, '', null, '\n').raw).toBe('- [ ] ');
    expect(makeTaskLine(0, false, 'a', 150, '\r\n').eol).toBe('\r\n');
  });

  it('produit une ligne relue comme une tache equivalente', () => {
    const made = makeTaskLine(1, true, 'Memoire', 90, '\n');
    const reparsed = asTask(parseDoc(made.raw).lines[0]);
    expect(reparsed.done).toBe(true);
    expect(reparsed.indent).toBe(4);
    expect(taskParts(reparsed)).toEqual({ text: 'Memoire', minutes: 90, hoursUnrecognized: false });
  });
});
