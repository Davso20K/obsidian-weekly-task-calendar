import { describe, expect, it } from 'vitest';
import {
  WEEKDAYS_FR,
  addDays,
  formatFrDate,
  mondayOf,
  monthGrid,
  parseFrDate,
  todayIso,
  weekdayFromName,
  weekdayIndex,
  weekdayLang,
  weekdayName,
} from '../src/dates';

describe('dates', () => {
  it('parse une date francaise, meme avec un zero en trop', () => {
    expect(parseFrDate('13/07/2026')).toBe('2026-07-13');
    expect(parseFrDate('013/07/2026')).toBe('2026-07-13');
    expect(parseFrDate('5/9/2026')).toBe('2026-09-05');
  });

  it('refuse les dates impossibles ou mal formees', () => {
    expect(parseFrDate('31/02/2026')).toBeNull();
    expect(parseFrDate('13/13/2026')).toBeNull();
    expect(parseFrDate('abc')).toBeNull();
    expect(parseFrDate('')).toBeNull();
  });

  it('formate en JJ/MM/AAAA', () => {
    expect(formatFrDate('2026-07-03')).toBe('03/07/2026');
  });

  it('ajoute des jours en franchissant les mois et annees', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('donne lundi=0 comme index de jour', () => {
    expect(weekdayIndex('2026-10-26')).toBe(0);
    expect(weekdayIndex('2026-11-01')).toBe(6);
  });

  it('retrouve le lundi de la semaine', () => {
    expect(mondayOf('2026-09-05')).toBe('2026-08-31');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
  });

  it('reconnait les noms de jours sans casse ni accent', () => {
    expect(weekdayFromName('mercredi')).toBe(2);
    expect(weekdayFromName('LUNDI')).toBe(0);
    expect(weekdayFromName('Dimanche')).toBe(6);
    expect(weekdayFromName('Lundis')).toBeNull();
    expect(WEEKDAYS_FR[4]).toBe('Vendredi');
  });

  it('reconnait aussi les noms de jours anglais', () => {
    expect(weekdayFromName('Monday')).toBe(0);
    expect(weekdayFromName('FRIDAY')).toBe(4);
    expect(weekdayFromName('sunday')).toBe(6);
    expect(weekdayLang('Mardi')).toBe('fr');
    expect(weekdayLang('tuesday')).toBe('en');
    expect(weekdayLang('nimporte')).toBeNull();
  });

  it('nomme un jour dans la langue demandee', () => {
    expect(weekdayName(2, 'fr')).toBe('Mercredi');
    expect(weekdayName(2, 'en')).toBe('Wednesday');
  });

  it('todayIso utilise la date locale', () => {
    expect(todayIso(new Date(2026, 9, 26, 23, 59))).toBe('2026-10-26');
    expect(todayIso(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('construit la grille du mois en semaines de 7 jours, lundi en premier', () => {
    const grid = monthGrid(2026, 10);
    expect(grid[0][0]).toBe('2026-10-26');
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat()).toContain('2026-11-30');
    expect(grid.flat()).toContain('2026-11-01');
    expect(weekdayIndex(grid[0][0])).toBe(0);
  });
});
