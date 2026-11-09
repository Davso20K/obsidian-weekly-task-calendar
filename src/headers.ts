// Reconnaissance des en-tetes de semaine et de jour, en francais et en anglais.
import { parseFrDate, weekdayFromName, weekdayLang } from './dates';
import type { Lang } from './i18n';

/** "Semaine du 26/10/2026", "Week of 26/10/2026" ou "Week 26/10/2026", sous un titre # a ######. */
export const WEEK_HEADER = /^\s*#{1,6}\s*(Semaine\s+du|Week\s+of|Week)\b(.*)$/i;

/** Une ligne qui ne contient que un nom de jour, une date optionnelle et ":" final optionnel. */
const DAY_HEADER =
  /^\s*(?:#{1,6}\s*)?([A-Za-zÀ-ÿ]+)\s*(?:(\d{1,3}\/\d{1,2}\/\d{4}))?\s*:?\s*$/;

export function parseDayHeader(
  raw: string,
): { weekday: number; typedDate: string | null; lang: Lang } | null {
  const match = DAY_HEADER.exec(raw);
  if (!match) return null;
  const weekday = weekdayFromName(match[1]);
  const lang = weekdayLang(match[1]);
  if (weekday === null || lang === null) return null;
  return { weekday, typedDate: match[2] ? parseFrDate(match[2]) : null, lang };
}

export function parseWeekHeader(raw: string): { date: string | null; lang: Lang } | null {
  const match = WEEK_HEADER.exec(raw);
  if (!match) return null;
  const token = /\d{1,3}\/\d{1,2}\/\d{4}/.exec(match[2]);
  return {
    date: token ? parseFrDate(token[0]) : null,
    lang: /^semaine/i.test(match[1]) ? 'fr' : 'en',
  };
}
