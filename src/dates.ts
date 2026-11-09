// Dates ISO (YYYY-MM-DD). Toute l'arithmetique passe par Date.UTC pour eviter
// les decalages de fuseau et d'heure d'ete.
import type { Lang } from './i18n';

export const WEEKDAYS_FR: readonly string[] = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

function toIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function fromIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function utcMs(iso: string): number {
  const { y, m, d } = fromIso(iso);
  return Date.UTC(y, m - 1, d);
}

function isoFromMs(ms: number): string {
  const date = new Date(ms);
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Date du jour dans le fuseau local de l'utilisateur (et non en UTC). */
export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** '13/07/2026' ou '013/07/2026' -> '2026-07-13' ; null si invalide (ex. 31/02). */
export function parseFrDate(s: string): string | null {
  const match = /^\s*(\d{1,3})\/(\d{1,2})\/(\d{4})\s*$/.exec(s);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return valid ? toIso(year, month, day) : null;
}

export function formatFrDate(iso: string): string {
  const { y, m, d } = fromIso(iso);
  return `${pad(d)}/${pad(m)}/${pad(y, 4)}`;
}

export function addDays(iso: string, n: number): string {
  return isoFromMs(utcMs(iso) + n * 86_400_000);
}

/** Lundi = 0 ... Dimanche = 6. */
export function weekdayIndex(iso: string): number {
  return (new Date(utcMs(iso)).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export const WEEKDAYS_EN: readonly string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const WEEKDAYS: Record<Lang, readonly string[]> = { fr: WEEKDAYS_FR, en: WEEKDAYS_EN };
const NORMALIZED_WEEKDAYS: Record<Lang, string[]> = {
  fr: WEEKDAYS_FR.map(normalizeName),
  en: WEEKDAYS_EN.map(normalizeName),
};

export function weekdayName(index: number, lang: Lang): string {
  return WEEKDAYS[lang][index];
}

/** Langue (fr/en) d'un nom de jour, ou null si ce n'en est pas un. */
export function weekdayLang(name: string): Lang | null {
  const normalized = normalizeName(name);
  if (NORMALIZED_WEEKDAYS.fr.includes(normalized)) return 'fr';
  if (NORMALIZED_WEEKDAYS.en.includes(normalized)) return 'en';
  return null;
}

/** Lundi = 0 ... Dimanche = 6, pour un nom francais ou anglais (casse et accents ignores). */
export function weekdayFromName(name: string): number | null {
  const lang = weekdayLang(name);
  return lang === null ? null : NORMALIZED_WEEKDAYS[lang].indexOf(normalizeName(name));
}

/** Semaines de 7 jours ISO (lundi en premier) couvrant tout le mois (month0 : 0-11). */
export function monthGrid(year: number, month0: number): string[][] {
  const first = toIso(year, month0 + 1, 1);
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const last = toIso(year, month0 + 1, lastDay);
  const weeks: string[][] = [];
  let monday = mondayOf(first);
  while (monday <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
    monday = addDays(monday, 7);
  }
  return weeks;
}
