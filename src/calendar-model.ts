import { daySummary, weekMinutes } from './calendar-index';
import type { CalendarIndex } from './calendar-index';
import { WEEKDAYS_FR, formatFrDate, monthGrid, weekdayIndex } from './dates';
import { formatHours } from './hours';
import type { LineRef } from './ops';

export const MONTHS_FR: readonly string[] = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export interface CellModel {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  total: number;
  done: number;
  minutes: number;
}

export interface MonthModel {
  label: string;
  weeks: { monday: string; cells: CellModel[]; minutes: number }[];
}

export function buildMonthModel(
  index: CalendarIndex,
  year: number,
  month0: number,
  todayIso: string,
): MonthModel {
  const monthPrefix = `${String(year).padStart(4, '0')}-${String(month0 + 1).padStart(2, '0')}-`;
  const weeks = monthGrid(year, month0).map((dates) => ({
    monday: dates[0],
    minutes: weekMinutes(index, dates[0]),
    cells: dates.map((date): CellModel => ({
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      inMonth: date.startsWith(monthPrefix),
      isToday: date === todayIso,
      ...daySummary(index.days.get(date)),
    })),
  }));
  return { label: `${MONTHS_FR[month0]} ${year}`, weeks };
}

/** Ex. "2/3 ✓ · 9h" ; vide s'il n'y a aucune tache ; sans heures si aucune n'est renseignee. */
export function cellSummaryText(cell: Pick<CellModel, 'total' | 'done' | 'minutes'>): string {
  if (cell.total === 0) return '';
  const base = `${cell.done}/${cell.total} ✓`;
  return cell.minutes > 0 ? `${base} · ${formatHours(cell.minutes)}` : base;
}

export interface DayRowModel {
  ref: LineRef;
  done: boolean;
  text: string;
  hoursText: string;
  hoursUnrecognized: boolean;
  depth: number;
  empty: boolean;
}

export interface DayModel {
  title: string;
  summary: { total: number; done: number; minutes: number };
  rows: DayRowModel[];
  freeLines: string[];
}

/** Ce que le panneau du jour affiche : une ligne par tache, et les notes libres en lecture seule. */
export function buildDayModel(index: CalendarIndex, date: string): DayModel {
  const day = index.days.get(date);
  const summary = daySummary(day);
  const base = `${WEEKDAYS_FR[weekdayIndex(date)]} ${formatFrDate(date)}`;
  return {
    title: summary.minutes > 0 ? `${base} · ${formatHours(summary.minutes)}` : base,
    summary,
    rows: (day?.tasks ?? []).map((task) => ({
      ref: { index: task.index, raw: task.raw },
      done: task.done,
      text: task.text,
      hoursText: task.minutes ? formatHours(task.minutes) : '',
      hoursUnrecognized: task.hoursUnrecognized,
      depth: task.depth,
      empty: task.empty,
    })),
    freeLines: (day?.freeLines ?? []).map((line) => line.raw).filter((raw) => raw.trim() !== ''),
  };
}
