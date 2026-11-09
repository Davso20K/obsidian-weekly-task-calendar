// Operations d'edition pures : chacune renvoie un NOUVEAU Doc et ne modifie jamais son entree.
// Les lignes non concernees ne sont jamais reecrites ; les lignes creees utilisent doc.eol.

import { buildIndex } from './calendar-index';
import type { CalendarIndex } from './calendar-index';
import { addDays, formatFrDate, mondayOf, weekdayIndex, weekdayName } from './dates';
import type { Lang } from './i18n';
import { makeTaskLine, parseDoc, taskParts } from './doc';
import type { Doc, DocLine, TaskLine } from './doc';
import { formatHours } from './hours';

/** Reference a une ligne telle que l'UI l'a vue : `raw` sert de garde contre un decalage. */
export interface LineRef {
  index: number;
  raw: string;
}

export class StaleLineError extends Error {
  constructor(message = 'La ligne a change depuis son affichage.') {
    super(message);
    this.name = 'StaleLineError';
  }
}

const leadOf = (raw: string): string => /^\s*/.exec(raw)?.[0] ?? '';
const isBlank = (line: DocLine | undefined): boolean => line?.kind === 'other' && line.raw.trim() === '';

function requireTask(doc: Doc, ref: LineRef): TaskLine {
  const line = doc.lines[ref.index];
  if (!line || line.kind !== 'task' || line.raw !== ref.raw) throw new StaleLineError();
  return line;
}

/** Fin (exclue) de la tache et de ses sous-taches contigues. */
function subtreeEnd(doc: Doc, index: number): number {
  const root = doc.lines[index] as TaskLine;
  let end = index + 1;
  for (; end < doc.lines.length; end++) {
    const line = doc.lines[end];
    if (line.kind !== 'task' || line.indent <= root.indent) break;
  }
  return end;
}

/** Relit `raw` pour garder `indent`, `done` et `body` coherents avec le texte. */
function withRaw(line: DocLine, raw: string, eol = line.eol): TaskLine {
  const reparsed = parseDoc(raw).lines[0];
  if (!reparsed || reparsed.kind !== 'task') throw new Error(`ligne de tache invalide: ${raw}`);
  return { ...reparsed, eol };
}

function spliceLines(doc: Doc, start: number, deleteCount: number, inserted: DocLine[]): Doc {
  const lines = doc.lines.slice();
  let toInsert = inserted;
  if (start === lines.length && start > 0 && inserted.length > 0 && lines[start - 1].eol === '') {
    // Fichier sans retour final : on ajoute le separateur manquant et on garde l'absence de retour final.
    lines[start - 1] = { ...lines[start - 1], eol: doc.eol };
    toInsert = inserted.map((line, i) => (i === inserted.length - 1 ? { ...line, eol: '' } : line));
  }
  lines.splice(start, deleteCount, ...toInsert);
  return { ...doc, lines };
}

const dayHeaderText = (date: string, lang: Lang): string =>
  `${weekdayName(weekdayIndex(date), lang)} ${formatFrDate(date)}`;
const weekHeaderText = (monday: string, lang: Lang): string =>
  `#### ${lang === 'fr' ? 'Semaine du' : 'Week of'} ${formatFrDate(monday)}`;

function lastTaskIndex(doc: Doc, startIndex: number, endIndex: number): number {
  for (let i = endIndex - 1; i >= startIndex; i--) if (doc.lines[i].kind === 'task') return i;
  return -1;
}

/** Etend `from` sur les lignes libres non vides contigues (notes collees a leur tache). */
function attachedEnd(doc: Doc, from: number, limit: number): number {
  let pos = from;
  while (pos < limit && doc.lines[pos].kind === 'other' && !isBlank(doc.lines[pos])) pos++;
  return pos;
}

function insertIntoMissingDay(doc: Doc, idx: CalendarIndex, date: string, tasks: TaskLine[]): Doc {
  const eol = doc.eol;
  const lang: Lang = doc.headerLang ?? 'en';
  const blank = (): DocLine => ({ kind: 'other', raw: '', eol });
  const header = (raw: string): DocLine => ({ kind: 'other', raw, eol });
  const monday = mondayOf(date);
  const week = idx.weeks.filter((w) => w.monday === monday).pop();

  if (week) {
    for (let offset = weekdayIndex(date) - 1; offset >= 0; offset--) {
      const previous = idx.days.get(addDays(monday, offset));
      const block = previous?.blocks
        .filter((b) => b.headerIndex > week.headerIndex && b.headerIndex < week.endIndex)
        .pop();
      if (!block) continue;
      const lastTask = lastTaskIndex(doc, block.startIndex, block.endIndex);
      const from = lastTask >= 0 ? lastTask + 1 : block.headerIndex + 1;
      const pos = attachedEnd(doc, from, block.endIndex);
      return spliceLines(doc, pos, 0, [blank(), header(dayHeaderText(date, lang)), ...tasks]);
    }
    // Aucun jour precedent dans la semaine : juste apres l'en-tete (et la ligne vide qui le suit).
    let pos = week.headerIndex + 1;
    if (isBlank(doc.lines[pos])) pos++;
    const created: DocLine[] = [header(dayHeaderText(date, lang)), ...tasks];
    if (pos < doc.lines.length) created.push(blank());
    return spliceLines(doc, pos, 0, created);
  }

  const dayHeaderLines = new Set<number>();
  for (const day of idx.days.values()) for (const block of day.blocks) dayHeaderLines.add(block.headerIndex);
  const earlier = idx.weeks
    .filter((w) => w.monday < monday)
    .sort((a, b) => (a.monday < b.monday ? 1 : -1))[0];

  if (earlier) {
    let last = earlier.headerIndex;
    for (let i = earlier.headerIndex + 1; i < earlier.endIndex; i++) {
      if (doc.lines[i].kind === 'task' || dayHeaderLines.has(i)) last = i;
    }
    const pos = attachedEnd(doc, last + 1, earlier.endIndex);
    return spliceLines(doc, pos, 0, [
      blank(),
      header(weekHeaderText(monday, lang)),
      blank(),
      header(dayHeaderText(date, lang)),
      ...tasks,
    ]);
  }

  if (idx.weeks.length > 0) {
    const first = Math.min(...idx.weeks.map((w) => w.headerIndex));
    return spliceLines(doc, first, 0, [
      header(weekHeaderText(monday, lang)),
      blank(),
      header(dayHeaderText(date, lang)),
      ...tasks,
      blank(),
    ]);
  }

  const created: DocLine[] = [
    header(weekHeaderText(monday, lang)),
    blank(),
    header(dayHeaderText(date, lang)),
    ...tasks,
  ];
  if (doc.lines.length > 0 && !isBlank(doc.lines[doc.lines.length - 1])) created.unshift(blank());
  return spliceLines(doc, doc.lines.length, 0, created);
}

function insertTasks(doc: Doc, date: string, tasks: TaskLine[]): Doc {
  const idx = buildIndex(doc);
  const day = idx.days.get(date);
  const block = day?.blocks[day.blocks.length - 1];
  if (!day || !block) return insertIntoMissingDay(doc, idx, date, tasks);
  const lastTask = lastTaskIndex(doc, block.startIndex, block.endIndex);
  const pos = lastTask >= 0 ? lastTask + 1 : block.startIndex;
  return spliceLines(doc, pos, 0, tasks);
}

export function addTask(
  doc: Doc,
  date: string,
  task: { text: string; minutes: number | null; depth?: number },
): Doc {
  return insertTasks(doc, date, [makeTaskLine(task.depth ?? 0, false, task.text, task.minutes, doc.eol)]);
}

export function updateTask(
  doc: Doc,
  ref: LineRef,
  patch: { text?: string; minutes?: number | null; done?: boolean },
): Doc {
  const line = requireTask(doc, ref);
  const parts = taskParts(line);
  const text = patch.text ?? parts.text;
  const minutes = patch.minutes !== undefined ? patch.minutes : parts.minutes;
  const done = patch.done ?? line.done;

  let raw: string;
  if (text !== parts.text || minutes !== parts.minutes) {
    const content = [text, minutes ? formatHours(minutes) : ''].filter((p) => p !== '').join(' ');
    raw = `${leadOf(line.raw)}- [${done ? 'x' : ' '}] ${content}`;
  } else if (done !== line.done) {
    // Seule la case change : on garde le reste de la ligne tel quel (ex. "(4h)").
    raw = line.raw.replace(/^(\s*- \[)[ xX](\])/, `$1${done ? 'x' : ' '}$2`);
  } else {
    return doc;
  }
  return spliceLines(doc, ref.index, 1, [withRaw(line, raw)]);
}

export function removeTask(doc: Doc, ref: LineRef): Doc {
  requireTask(doc, ref);
  return spliceLines(doc, ref.index, subtreeEnd(doc, ref.index) - ref.index, []);
}

export function setDepth(doc: Doc, ref: LineRef, depth: 0 | 1): Doc {
  const root = requireTask(doc, ref);
  const rootLead = leadOf(root.raw);
  let newLead = '';
  if (depth === 1) {
    const previous = doc.lines[ref.index - 1];
    if (!previous || previous.kind !== 'task') throw new Error('no-parent');
    newLead = previous.indent > 0 ? leadOf(previous.raw) : '\t';
  }
  if (newLead === rootLead) return doc;

  const end = subtreeEnd(doc, ref.index);
  const shifted = doc.lines.slice(ref.index, end).map((line) => {
    const rest = line.raw.startsWith(rootLead) ? line.raw.slice(rootLead.length) : line.raw;
    return withRaw(line, newLead + rest);
  });
  return spliceLines(doc, ref.index, end - ref.index, shifted);
}

export function moveTask(doc: Doc, ref: LineRef, toDate: string): Doc {
  const root = requireTask(doc, ref);
  if (buildIndex(doc).days.get(toDate)?.tasks.some((t) => t.index === ref.index)) return doc;

  const end = subtreeEnd(doc, ref.index);
  const rootLead = leadOf(root.raw);
  const moved = doc.lines.slice(ref.index, end).map((line) => {
    const raw = line.raw.startsWith(rootLead) ? line.raw.slice(rootLead.length) : line.raw;
    return withRaw(line, raw, doc.eol);
  });
  return insertTasks(spliceLines(doc, ref.index, end - ref.index, []), toDate, moved);
}

export function copyTask(doc: Doc, ref: LineRef, toDates: string[]): Doc {
  const root = requireTask(doc, ref);
  const end = subtreeEnd(doc, ref.index);
  const copies = (doc.lines.slice(ref.index, end) as TaskLine[]).map((line, i) => {
    const depth = i === 0 ? 0 : Math.max(1, Math.ceil((line.indent - root.indent) / 4));
    return makeTaskLine(depth, false, taskParts(line).text, null, doc.eol);
  });
  let result = doc;
  for (const date of toDates) result = insertTasks(result, date, copies);
  return result;
}
