import { describe, expect, it } from 'vitest';
import { formatHours, parseHoursInput, parseTrailingHours } from '../src/hours';

describe('parseTrailingHours', () => {
  it.each([
    ['Corpus data 7h', 'Corpus data', 420],
    ['Memoire (0h30min)', 'Memoire', 30],
    ['Udate memoire (2h)', 'Udate memoire', 120],
    ['Prod SRS+BPMN (MJDH,INH) : 3h', 'Prod SRS+BPMN (MJDH,INH)', 180],
    ['x 2,5h', 'x', 150],
    ['x 30min', 'x', 30],
    ['x 4H', 'x', 240],
    ['Correction 1h55', 'Correction', 115],
    ['Update 2h30', 'Update', 150],
    ['7h', '', 420],
    ['x 12h', 'x', 720],
  ])('reconnait la duree de %j', (input, text, minutes) => {
    expect(parseTrailingHours(input)).toEqual({ text, minutes });
  });

  it.each([
    'Verif (2 + 5h)',
    'Test (8h- 10h20)',
    'Amelioration : 4',
    'a 8h-10h20',
    'reunion 4h puis suite',
    'Plateforme angelo (2h : 17h-19h)',
    'Reunion 17h30', // heure de rendez-vous, pas une duree : > 12h par tache = ambigu
    'x 13h',
    'sans duree',
    '',
  ])('laisse %j intact (duree ambigue ou absente)', (input) => {
    expect(parseTrailingHours(input)).toBeNull();
  });
});

describe('formatHours', () => {
  it('ecrit Xh ou XhMM', () => {
    expect(formatHours(360)).toBe('6h');
    expect(formatHours(150)).toBe('2h30');
    expect(formatHours(55)).toBe('0h55');
    expect(formatHours(95)).toBe('1h35');
  });
});

describe('parseHoursInput', () => {
  it('lit les saisies usuelles', () => {
    expect(parseHoursInput('2h30')).toBe(150);
    expect(parseHoursInput('6h')).toBe(360);
    expect(parseHoursInput('1,5')).toBe(90);
    expect(parseHoursInput('1.5')).toBe(90);
    expect(parseHoursInput('90min')).toBe(90);
    expect(parseHoursInput(' 3H ')).toBe(180);
  });

  it('refuse vide, zero et invalide (jamais de 0h)', () => {
    expect(parseHoursInput('')).toBeNull();
    expect(parseHoursInput('0')).toBeNull();
    expect(parseHoursInput('0h')).toBeNull();
    expect(parseHoursInput('abc')).toBeNull();
    expect(parseHoursInput('-2')).toBeNull();
  });
});
