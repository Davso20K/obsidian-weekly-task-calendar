import { afterEach, describe, expect, it } from 'vitest';
import { EN, FR, getLang, monthName, setLang, t } from '../src/i18n';

afterEach(() => setLang('en'));

describe('i18n', () => {
  it('anglais par defaut', () => {
    expect(getLang()).toBe('en');
    expect(t('calendar.today')).toBe('Today');
  });

  it('bascule en francais', () => {
    setLang('fr');
    expect(t('calendar.today')).toBe("Aujourd'hui");
  });

  it('interpole les variables', () => {
    expect(t('day.done', { done: 2, total: 3 })).toBe('2/3 done');
    setLang('fr');
    expect(t('day.done', { done: 2, total: 3 })).toBe('2/3 faites');
  });

  it('laisse un marqueur inconnu intact plutot que de planter', () => {
    expect(t('day.done', { done: 1 })).toBe('1/{total} done');
  });

  it('les deux dictionnaires ont exactement les memes cles', () => {
    expect(Object.keys(FR).sort()).toEqual(Object.keys(EN).sort());
  });

  it('aucune traduction vide et memes marqueurs {x} dans les deux langues', () => {
    const markers = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(EN) as (keyof typeof EN)[]) {
      expect(EN[key].trim(), `EN ${key}`).not.toBe('');
      expect(FR[key].trim(), `FR ${key}`).not.toBe('');
      expect(markers(FR[key]), key).toEqual(markers(EN[key]));
    }
  });

  it('noms de mois', () => {
    expect(monthName(9, 'fr')).toBe('octobre');
    expect(monthName(9, 'en')).toBe('October');
  });
});
