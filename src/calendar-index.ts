import { taskParts } from './doc';
import type { Doc } from './doc';
import { addDays, mondayOf, weekdayIndex } from './dates';
import { parseDayHeader, parseWeekHeader } from './headers';

export interface TaskView {
  index: number;
  raw: string;
  done: boolean;
  text: string;
  minutes: number | null;
  hoursUnrecognized: boolean;
  depth: number;
  empty: boolean;
}

/** `endIndex` est exclu. */
export interface DayBlock {
  headerIndex: number;
  startIndex: number;
  endIndex: number;
}

export interface DayView {
  date: string;
  blocks: DayBlock[];
  tasks: TaskView[];
  freeLines: { index: number; raw: string }[];
}

export interface WeekView {
  monday: string;
  headerIndex: number;
  endIndex: number;
}

export interface Diagnostic {
  /** Numero de ligne, a partir de 1. */
  line: number;
  kind:
    | 'week-header-not-monday'
    | 'day-date-mismatch'
    | 'duplicate-week'
    | 'duplicate-day'
    | 'ambiguous-hours'
    | 'unplaced-block';
  /** Valeurs a inserer dans le message traduit (cle `diag.msg.<kind>`) ; pas de texte ici. */
  params: Record<string, string>;
}

export interface CalendarIndex {
  days: Map<string, DayView>;
  weeks: WeekView[];
  diagnostics: Diagnostic[];
}

interface RawDay {
  headerIndex: number;
  endIndex: number;
  weekday: number;
  typedDate: string | null;
}

interface RawWeek {
  headerIndex: number;
  endIndex: number;
  headerDate: string | null;
  days: RawDay[];
  /** Repetitions d'un jour deja ouvert dans la semaine : traitees comme du texte libre, mais signalees. */
  duplicateDays: RawDay[];
}

/** Passe 1 : reperer en-tetes de semaine et de jour, et leurs plages. */
function scanStructure(doc: Doc): { weeks: RawWeek[]; orphanDays: RawDay[] } {
  const weeks: RawWeek[] = [];
  const orphanDays: RawDay[] = [];
  let currentWeek: RawWeek | null = null;
  let currentDay: RawDay | null = null;

  doc.lines.forEach((line, index) => {
    if (line.kind !== 'other') return;
    const weekHeader = parseWeekHeader(line.raw);
    if (weekHeader) {
      if (currentDay) currentDay.endIndex = index;
      if (currentWeek) currentWeek.endIndex = index;
      currentWeek = {
        headerIndex: index,
        endIndex: doc.lines.length,
        headerDate: weekHeader.date,
        days: [],
        duplicateDays: [],
      };
      weeks.push(currentWeek);
      currentDay = null;
      return;
    }
    const header = parseDayHeader(line.raw);
    if (!header) return;
    const candidate: RawDay = {
      headerIndex: index,
      endIndex: doc.lines.length,
      weekday: header.weekday,
      typedDate: header.typedDate,
    };
    // Un nom de jour deja ouvert dans la semaine (ex. "Mardi" seul dans les notes de fin de fichier)
    // n'ouvre pas de nouveau bloc : le premier en-tete fait foi, la ligne reste du texte libre.
    if (currentWeek?.days.some((day) => day.weekday === header.weekday)) {
      currentWeek.duplicateDays.push(candidate);
      return;
    }
    if (currentDay) currentDay.endIndex = index;
    currentDay = candidate;
    (currentWeek ? currentWeek.days : orphanDays).push(currentDay);
  });
  return { weeks, orphanDays };
}

/** Lundi de la semaine : en-tete s'il en est un, sinon premier jour date coherent avec son nom. */
function resolveMonday(week: RawWeek): string | null {
  if (week.headerDate && weekdayIndex(week.headerDate) === 0) return week.headerDate;
  for (const day of week.days) {
    if (day.typedDate && weekdayIndex(day.typedDate) === day.weekday) {
      return mondayOf(day.typedDate);
    }
  }
  return null;
}

function buildTasks(doc: Doc, block: DayBlock): { tasks: TaskView[]; free: DayView['freeLines'] } {
  const tasks: TaskView[] = [];
  const free: DayView['freeLines'] = [];
  const openIndents: number[] = [];
  for (let i = block.startIndex; i < block.endIndex; i++) {
    const line = doc.lines[i];
    if (line.kind !== 'task') {
      free.push({ index: i, raw: line.raw });
      continue;
    }
    while (openIndents.length > 0 && openIndents[openIndents.length - 1] >= line.indent) {
      openIndents.pop();
    }
    const parts = taskParts(line);
    tasks.push({
      index: i,
      raw: line.raw,
      done: line.done,
      text: parts.text,
      minutes: parts.minutes,
      hoursUnrecognized: parts.hoursUnrecognized,
      depth: openIndents.length,
      empty: parts.text.trim() === '' && parts.minutes === null,
    });
    openIndents.push(line.indent);
  }
  return { tasks, free };
}

export function buildIndex(doc: Doc): CalendarIndex {
  const { weeks: rawWeeks, orphanDays } = scanStructure(doc);
  const days = new Map<string, DayView>();
  const weeks: WeekView[] = [];
  const diagnostics: Diagnostic[] = [];
  const seenMondays = new Set<string>();

  for (const day of orphanDays) {
    diagnostics.push({
      line: day.headerIndex + 1,
      kind: 'unplaced-block',
      params: { reason: 'day' },
    });
  }

  for (const week of rawWeeks) {
    const monday = resolveMonday(week);
    if (monday === null) {
      diagnostics.push({
        line: week.headerIndex + 1,
        kind: 'unplaced-block',
        params: { reason: 'week' },
      });
      continue;
    }
    if (week.headerDate && weekdayIndex(week.headerDate) !== 0) {
      diagnostics.push({
        line: week.headerIndex + 1,
        kind: 'week-header-not-monday',
        params: { date: monday },
      });
    }
    if (seenMondays.has(monday)) {
      diagnostics.push({
        line: week.headerIndex + 1,
        kind: 'duplicate-week',
        params: { date: monday },
      });
    }
    seenMondays.add(monday);
    weeks.push({ monday, headerIndex: week.headerIndex, endIndex: week.endIndex });

    for (const duplicate of week.duplicateDays) {
      diagnostics.push({
        line: duplicate.headerIndex + 1,
        kind: 'duplicate-day',
        params: { date: addDays(monday, duplicate.weekday) },
      });
    }

    for (const rawDay of week.days) {
      const date = addDays(monday, rawDay.weekday);
      if (rawDay.typedDate && rawDay.typedDate !== date) {
        diagnostics.push({
          line: rawDay.headerIndex + 1,
          kind: 'day-date-mismatch',
          params: { typed: rawDay.typedDate, date },
        });
      }
      const block: DayBlock = {
        headerIndex: rawDay.headerIndex,
        startIndex: rawDay.headerIndex + 1,
        endIndex: rawDay.endIndex,
      };
      const view = days.get(date) ?? { date, blocks: [], tasks: [], freeLines: [] };
      const { tasks, free } = buildTasks(doc, block);
      view.blocks.push(block);
      view.tasks.push(...tasks);
      view.freeLines.push(...free);
      days.set(date, view);
    }
  }

  for (const day of days.values()) {
    for (const task of day.tasks) {
      if (task.hoursUnrecognized) {
        diagnostics.push({
          line: task.index + 1,
          kind: 'ambiguous-hours',
          params: {},
        });
      }
    }
  }

  diagnostics.sort((a, b) => a.line - b.line);
  return { days, weeks, diagnostics };
}

export function daySummary(day: DayView | undefined): {
  total: number;
  done: number;
  minutes: number;
} {
  const summary = { total: 0, done: 0, minutes: 0 };
  if (!day) return summary;
  for (const task of day.tasks) {
    if (task.empty) continue;
    summary.total += 1;
    if (task.done) summary.done += 1;
    summary.minutes += task.minutes ?? 0;
  }
  return summary;
}

export function weekMinutes(index: CalendarIndex, monday: string): number {
  let total = 0;
  for (let offset = 0; offset < 7; offset++) {
    total += daySummary(index.days.get(addDays(monday, offset))).minutes;
  }
  return total;
}
