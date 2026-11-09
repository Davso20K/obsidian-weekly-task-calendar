// Durees : 6h, 2h30, 1h55, 0h30min, 30min, 2,5h (insensible a la casse).
// Une duree n'est reconnue en fin de texte que si elle est sans ambiguite.

const DURATION = String.raw`(?:\d+(?:[.,]\d+)?h(?:\d{1,2}(?:min)?)?|\d+\s?min)`;

// "(3h)" : la parenthese finale contient uniquement la duree.
const IN_PARENS = new RegExp(String.raw`^(.*?)\s*\(\s*(${DURATION})\s*\)\s*$`, 'i');
// "texte 6h", "texte : 4h" ou "6h" seul.
const BARE = new RegExp(String.raw`^(?:(.*?)(?:\s*:\s*|\s+))?(${DURATION})\s*$`, 'i');

function durationToMinutes(duration: string): number | null {
  const value = duration.trim().toLowerCase();
  const minutesOnly = /^(\d+)\s?min$/.exec(value);
  if (minutesOnly) return Number(minutesOnly[1]);
  const hoursAndMinutes = /^(\d+(?:[.,]\d+)?)h(\d{1,2})?(?:min)?$/.exec(value);
  if (!hoursAndMinutes) return null;
  const hours = Number(hoursAndMinutes[1].replace(',', '.'));
  const minutes = hoursAndMinutes[2] ? Number(hoursAndMinutes[2]) : 0;
  return Math.round(hours * 60) + minutes;
}

export function parseTrailingHours(text: string): { text: string; minutes: number } | null {
  const match = IN_PARENS.exec(text) ?? BARE.exec(text);
  if (!match) return null;
  const minutes = durationToMinutes(match[2]);
  if (minutes === null) return null;
  return { text: (match[1] ?? '').trim(), minutes };
}

export function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

/** Saisie du champ heures. Vide, 0 ou invalide -> null (jamais de "0h"). */
export function parseHoursInput(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (value === '') return null;
  let minutes: number | null;
  if (/^\d+(?:[.,]\d+)?$/.test(value)) {
    minutes = Math.round(Number(value.replace(',', '.')) * 60);
  } else {
    minutes = durationToMinutes(value);
  }
  return minutes !== null && minutes > 0 ? minutes : null;
}
