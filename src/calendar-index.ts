import { taskParts } from './doc';
import type { Doc } from './doc';
import { addDays, mondayOf, parseFrDate, weekdayFromName, weekdayIndex } from './dates';

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
  message: string;
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
}

const WEEK_HEADER = /^\s*#{1,6}\s*Semaine du\b(.*)$/i;
const DAY_HEADER =
  /^\s*(?:#{1,6}\s*)?([A-Za-zÀ-ÿ]+)\s*(?:(\d{1,3}\/\d{1,2}\/\d{4}))?\s*:?\s*$/;

function parseDayHeader(raw: string): { weekday: number; typedDate: string | null } | null {
  const match = DAY_HEADER.exec(raw);
  if (!match) return null;
  const weekday = weekdayFromName(match[1]);
  if (weekday === null) return null;
  return { weekday, typedDate: match[2] ? parseFrDate(match[2]) : null };
}

function parseWeekHeaderDate(raw: string): string | null {
  const match = WEEK_HEADER.exec(raw);
  const token = /\d{1,3}\/\d{1,2}\/\d{4}/.exec(match?.[1] ?? '');
  return token ? parseFrDate(token[0]) : null;
}

/** Passe 1 : reperer en-tetes de semaine et de jour, et leurs plages. */
function scanStructure(doc: Doc): { weeks: RawWeek[]; orphanDays: RawDay[] } {
  const weeks: RawWeek[] = [];
  const orphanDays: RawDay[] = [];
  let currentWeek: RawWeek | null = null;
  let currentDay: RawDay | null = null;

  doc.lines.forEach((line, index) => {
    if (line.kind !== 'other') return;
    if (WEEK_HEADER.test(line.raw)) {
      if (currentDay) currentDay.endIndex = index;
      if (currentWeek) currentWeek.endIndex = index;
      currentWeek = {
        headerIndex: index,
        endIndex: doc.lines.length,
        headerDate: parseWeekHeaderDate(line.raw),
        days: [],
      };
      weeks.push(currentWeek);
      currentDay = null;
      return;
    }
    const header = parseDayHeader(line.raw);
    if (!header) return;
    if (currentDay) currentDay.endIndex = index;
    currentDay = { headerIndex: index, endIndex: doc.lines.length, ...header };
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
      message: 'Jour situe avant toute en-tete de semaine : ignore par le calendrier.',
    });
  }

  for (const week of rawWeeks) {
    const monday = resolveMonday(week);
    if (monday === null) {
      diagnostics.push({
        line: week.headerIndex + 1,
        kind: 'unplaced-block',
        message: 'Date de semaine introuvable : cette semaine est ignoree par le calendrier.',
      });
      continue;
    }
    if (week.headerDate && weekdayIndex(week.headerDate) !== 0) {
      diagnostics.push({
        line: week.headerIndex + 1,
        kind: 'week-header-not-monday',
        message: `L'en-tete n'est pas un lundi ; semaine placee au lundi ${monday}.`,
      });
    }
    if (seenMondays.has(monday)) {
      diagnostics.push({
        line: week.headerIndex + 1,
        kind: 'duplicate-week',
        message: `Semaine du ${monday} presente plusieurs fois : les jours sont fusionnes.`,
      });
    }
    seenMondays.add(monday);
    weeks.push({ monday, headerIndex: week.headerIndex, endIndex: week.endIndex });

    const weekdaysSeen = new Set<number>();
    for (const rawDay of week.days) {
      const date = addDays(monday, rawDay.weekday);
      if (weekdaysSeen.has(rawDay.weekday)) {
        diagnostics.push({
          line: rawDay.headerIndex + 1,
          kind: 'duplicate-day',
          message: `Jour ${date} present plusieurs fois dans la semaine : fusionne.`,
        });
      }
      weekdaysSeen.add(rawDay.weekday);
      if (rawDay.typedDate && rawDay.typedDate !== date) {
        diagnostics.push({
          line: rawDay.headerIndex + 1,
          kind: 'day-date-mismatch',
          message: `Date saisie ${rawDay.typedDate} differente de la date deduite ${date}.`,
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
          message: 'Heures non reconnues : laissees dans le texte, exclues des totaux.',
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
