// Textes de l'interface en anglais (langue par defaut) et en francais.
// Les cles sont verifiees par le type : un texte oublie dans une langue ne compile pas.

export type Lang = 'fr' | 'en';

export const EN = {
  'calendar.title': 'Task calendar',
  'calendar.prevMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.today': 'Today',
  'calendar.total': 'Total',
  'calendar.fileMissing': 'Task file not found: {path}',
  'calendar.createFile': 'Create file',

  'day.title': "Day's tasks",
  'day.done': '{done}/{total} done',
  'day.none': 'No tasks this day.',
  'day.add': '+ Add a task',
  'day.notes': 'Day notes ({count} lines, read-only)',
  'day.taskPlaceholder': 'Task…',
  'day.hoursLabel': 'Hours (e.g. 2h30)',
  'day.hoursUnrecognized': 'Hours not recognized: left in the text, excluded from totals.',
  'day.indent': 'Make sub-task',
  'day.outdent': 'Move to top level',
  'day.more': 'More actions',
  'day.menuMove': 'Move…',
  'day.menuCopy': 'Copy to…',
  'day.menuDelete': 'Delete',
  'day.invalidHours': 'Invalid hours. Examples: 2h30, 1.5, 45min.',
  'day.noParent': 'Cannot indent: there must be a task right above.',
  'day.opFailed': 'Weekly Task Calendar: operation failed (see the console).',
  'day.confirmDelete': 'This task has sub-tasks: they will be deleted with it.',

  'pick.moveTitle': 'Move the task',
  'pick.copyTitle': 'Copy the task to…',
  'pick.tomorrow': 'Tomorrow ({day})',
  'pick.other': 'Another day:',
  'pick.cancel': 'Cancel',
  'pick.copy': 'Copy',
  'pick.move': 'Move',
  'pick.datePlaceholder': 'DD/MM/YYYY',
  'pick.invalidDate': 'Invalid date. Expected format: DD/MM/YYYY.',
  'pick.pickOne': 'Pick at least one day.',

  'diag.title': 'Weekly Task Calendar: diagnostic',
  'diag.none': 'no issues.',
  'diag.some': '{count} issue(s). The file is not modified.',
  'diag.colLine': 'Line',
  'diag.colKind': 'Type',
  'diag.colDetail': 'Details',
  'diag.kind.week-header-not-monday': 'Week header is not a Monday',
  'diag.kind.day-date-mismatch': 'Day date does not match',
  'diag.kind.duplicate-week': 'Duplicate week',
  'diag.kind.duplicate-day': 'Repeated day',
  'diag.kind.ambiguous-hours': 'Hours not recognized',
  'diag.kind.unplaced-block': 'Unplaced block',
  'diag.msg.week-header-not-monday': 'The header is not a Monday; week placed on Monday {date}.',
  'diag.msg.day-date-mismatch': 'Typed date {typed} differs from the date deduced from its position, {date}.',
  'diag.msg.duplicate-week': 'Week of {date} appears several times: its days are merged.',
  'diag.msg.duplicate-day': 'Day {date} is repeated in the week: this line is treated as free text.',
  'diag.msg.ambiguous-hours': 'Hours not recognized: left in the text, excluded from totals.',
  'diag.msg.unplaced-block.day': 'Day found before any week header: ignored by the calendar.',
  'diag.msg.unplaced-block.week': 'Week date not found: this week is ignored by the calendar.',

  'store.noFile': 'Weekly Task Calendar: task file not found.',
  'store.stale': 'Weekly Task Calendar: the file changed, action cancelled. View reloaded.',

  'main.ribbon': 'Open task calendar',
  'main.cmdOpen': 'Open task calendar',
  'main.cmdDiagnostic': 'Diagnose the task file',
  'main.backupOk': 'Weekly Task Calendar: backup of the task file created.',
  'main.backupFail': 'Weekly Task Calendar: backup failed (see the console).',

  'settings.file': 'Task file',
  'settings.fileDesc':
    'Path of the Markdown file read and written by the calendar, relative to the vault root. Only week, day and checkbox lines are modified.',
  'settings.lang': 'Language of headings in the file',
  'settings.langDesc':
    'Words written when a week or a day is created ("Week of" / "Semaine du"). Auto follows the existing file, then the interface language.',
  'settings.langAuto': 'Auto',
} as const;

export type TKey = keyof typeof EN;

export const FR: Record<TKey, string> = {
  'calendar.title': 'Calendrier des tâches',
  'calendar.prevMonth': 'Mois précédent',
  'calendar.nextMonth': 'Mois suivant',
  'calendar.today': "Aujourd'hui",
  'calendar.total': 'Total',
  'calendar.fileMissing': 'Fichier de tâches introuvable : {path}',
  'calendar.createFile': 'Créer le fichier',

  'day.title': 'Tâches du jour',
  'day.done': '{done}/{total} faites',
  'day.none': 'Aucune tâche ce jour.',
  'day.add': '+ Ajouter une tâche',
  'day.notes': 'Notes du jour ({count} lignes, lecture seule)',
  'day.taskPlaceholder': 'Tâche…',
  'day.hoursLabel': 'Heures (ex. 2h30)',
  'day.hoursUnrecognized': 'Heures non reconnues : laissées dans le texte, exclues des totaux.',
  'day.indent': 'Mettre en sous-tâche',
  'day.outdent': 'Remonter au premier niveau',
  'day.more': "Plus d'actions",
  'day.menuMove': 'Reporter…',
  'day.menuCopy': 'Copier vers…',
  'day.menuDelete': 'Supprimer',
  'day.invalidHours': 'Heures invalides. Exemples : 2h30, 1,5, 45min.',
  'day.noParent': "Impossible d'indenter : il faut une tâche juste au-dessus.",
  'day.opFailed': 'Weekly Task Calendar : opération impossible (voir la console).',
  'day.confirmDelete': 'Cette tâche a des sous-tâches : elles seront supprimées avec elle.',

  'pick.moveTitle': 'Reporter la tâche',
  'pick.copyTitle': 'Copier la tâche vers…',
  'pick.tomorrow': 'Demain ({day})',
  'pick.other': 'Autre jour :',
  'pick.cancel': 'Annuler',
  'pick.copy': 'Copier',
  'pick.move': 'Reporter',
  'pick.datePlaceholder': 'JJ/MM/AAAA',
  'pick.invalidDate': 'Date invalide. Format attendu : JJ/MM/AAAA.',
  'pick.pickOne': 'Choisissez au moins un jour.',

  'diag.title': 'Weekly Task Calendar : diagnostic',
  'diag.none': 'aucune anomalie.',
  'diag.some': "{count} anomalie(s). Le fichier n'est pas modifié.",
  'diag.colLine': 'Ligne',
  'diag.colKind': 'Nature',
  'diag.colDetail': 'Détail',
  'diag.kind.week-header-not-monday': 'En-tête de semaine hors lundi',
  'diag.kind.day-date-mismatch': 'Date de jour incohérente',
  'diag.kind.duplicate-week': 'Semaine en double',
  'diag.kind.duplicate-day': 'Jour répété',
  'diag.kind.ambiguous-hours': 'Heures non reconnues',
  'diag.kind.unplaced-block': 'Bloc non placé',
  'diag.msg.week-header-not-monday': "L'en-tête n'est pas un lundi ; semaine placée au lundi {date}.",
  'diag.msg.day-date-mismatch': 'Date saisie {typed} différente de la date déduite de sa position, {date}.',
  'diag.msg.duplicate-week': 'Semaine du {date} présente plusieurs fois : ses jours sont fusionnés.',
  'diag.msg.duplicate-day': 'Jour {date} répété dans la semaine : cette ligne est traitée comme du texte libre.',
  'diag.msg.ambiguous-hours': 'Heures non reconnues : laissées dans le texte, exclues des totaux.',
  'diag.msg.unplaced-block.day': 'Jour situé avant toute en-tête de semaine : ignoré par le calendrier.',
  'diag.msg.unplaced-block.week': 'Date de semaine introuvable : cette semaine est ignorée par le calendrier.',

  'store.noFile': 'Weekly Task Calendar : fichier de tâches introuvable.',
  'store.stale': 'Weekly Task Calendar : le fichier a changé, action annulée. Vue rechargée.',

  'main.ribbon': 'Ouvrir le calendrier des tâches',
  'main.cmdOpen': 'Ouvrir le calendrier des tâches',
  'main.cmdDiagnostic': 'Diagnostic du fichier de tâches',
  'main.backupOk': 'Weekly Task Calendar : copie de sécurité du fichier de tâches créée.',
  'main.backupFail': 'Weekly Task Calendar : la copie de sécurité a échoué (voir la console).',

  'settings.file': 'Fichier des tâches',
  'settings.fileDesc':
    'Chemin du fichier Markdown lu et écrit par le calendrier, relatif à la racine du coffre. Seuls les blocs semaine, jour et cases à cocher sont modifiés.',
  'settings.lang': 'Langue des en-têtes dans le fichier',
  'settings.langDesc':
    'Mots écrits quand une semaine ou un jour est créé (« Semaine du » / « Week of »). Auto suit le fichier existant, puis la langue de l\'interface.',
  'settings.langAuto': 'Auto',
};

const DICTIONARIES: Record<Lang, Record<TKey, string>> = { en: EN, fr: FR };

let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** Texte de l'interface dans la langue courante ; `{nom}` est remplace par `vars.nom` s'il existe. */
export function t(key: TKey, vars?: Record<string, string | number>): string {
  const text = DICTIONARIES[current][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (marker, name: string) =>
    name in vars ? String(vars[name]) : marker,
  );
}

const MONTHS: Record<Lang, readonly string[]> = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export function monthName(month0: number, lang: Lang): string {
  return MONTHS[lang][month0];
}
