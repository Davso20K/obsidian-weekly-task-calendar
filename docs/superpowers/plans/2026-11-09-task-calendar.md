# Task Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plugin Obsidian qui affiche un grand calendrier et un panneau du jour, et lit/écrit les tâches directement dans `Tâches/Toutes les tâches.md` sans altérer le reste du fichier.

**Architecture:** Un noyau pur (dates, heures, document, index calendrier, opérations d'édition) testé sans Obsidian, puis une couche Obsidian fine (store, vues, plugin). Toute écriture est `texte → parse → opération → sérialise` dans `vault.process`, avec une garde « ligne périmée » (`LineRef`).

**Tech Stack:** TypeScript, Obsidian API, esbuild, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-task-calendar-design.md`

## Global Constraints

- Fichier cible par défaut : `Tâches/Toutes les tâches.md`. Format inchangé : aucune balise ni front-matter ajouté.
- Semaine = `#{1,6} Semaine du JJ/MM/AAAA` ; jour = ligne contenant **seulement** un nom de jour + date optionnelle + `:` final optionnel ; tâche = `- [ ]` / `- [x]`.
- La date d'un jour vient de sa **position** (début de semaine + nom du jour), jamais de la date tapée.
- Heures reconnues seulement en fin de ligne : `6h`, `2h30`, `1h55`, `0h30min`, `30min`, `2,5h`, `(3h)`, `: 4h`, `4H`. Cas ambigus (`2 + 5h`, `8h-10h20`, `4` seul) : texte intact, champ heures vide, hors totaux.
- Une tâche non modifiée n'est jamais réécrite (octet pour octet) ; fins de ligne LF/CRLF conservées ; une tâche modifiée s'écrit `- [x] texte 6h` (heures `Xh` ou `XhMM`).
- Dates en chaînes ISO `YYYY-MM-DD`, arithmétique en UTC uniquement. Semaine lundi→dimanche, format `JJ/MM/AAAA` fixes en v1 (seul le chemin du fichier est réglable : écart assumé par rapport au §3 de la spec, la spec est mise à jour en Task 9).
- Le vrai fichier de l'utilisateur n'est **jamais** commité (il contient des identifiants). Le test de non-régression le lit depuis le coffre et s'ignore s'il est absent ; le dépôt contient une fixture synthétique.
- Commits : adresse noreply déjà configurée, **aucun** trailer `Co-Authored-By`, aucune mention « Generated with Claude Code ».
- Le plugin n'est copié dans le coffre que par `npm run install-plugin` ; il n'active pas le plugin (pas de modification de `community-plugins.json`).

## Review Focus

- Fichier en CRLF ou sans retour final → l'écriture ne mélange pas les fins de ligne (Task 4).
- Fichier vide ou sans aucune semaine → ajouter une tâche crée semaine + jour (Task 4).
- Tâches vides `- [ ] ` (placeholders très fréquents dans le vrai fichier) → conservées, exclues des totaux (Task 3).
- Ligne décalée par une édition manuelle entre l'affichage et le clic → l'opération échoue proprement (`StaleLineError`), rien n'est écrit (Task 4).
- Heures saisies `0`, vide ou invalide → heures effacées / saisie refusée, jamais `0h` écrit (Task 1).

---

## File Structure

```
package.json, tsconfig.json, vitest.config.ts, esbuild.config.mjs, manifest.json, styles.css, .gitignore
scripts/install-plugin.mjs        copie main.js/manifest.json/styles.css dans le coffre
src/dates.ts                      dates ISO pures
src/hours.ts                      heures pures
src/doc.ts                        Doc : parse / serialize / lignes de tâche
src/calendar-index.ts             semaines, jours, TaskView, diagnostics, totaux
src/ops.ts                        opérations d'édition pures
src/calendar-model.ts             modèle du mois pour la vue calendrier
src/store.ts                      accès fichier Obsidian + événements
src/settings.ts                   réglages + onglet
src/main.ts                       plugin : vues, commandes, sauvegarde
src/views/calendar-view.ts        grand calendrier
src/views/day-panel.ts            panneau du jour
src/views/pick-date-modal.ts      choix de jours (reporter / copier)
tests/*.test.ts, tests/fixtures/sample.md
```

---

### Task 1: Scaffold, dates et heures

**Files:**
- Create: `package.json` (scripts `build`, `dev`, `test`, `typecheck`, `install-plugin`), `tsconfig.json` (strict), `vitest.config.ts`, `esbuild.config.mjs` (entrée `src/main.ts` → `main.js`, cjs, externals `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, modules Node), `manifest.json` (`id: task-calendar`, `name: Task Calendar`, `minAppVersion: 1.5.0`, `isDesktopOnly: false`), `.gitignore` (`node_modules`, `main.js`, `tests/fixtures/real/`), `src/dates.ts`, `src/hours.ts`
- Test: `tests/dates.test.ts`, `tests/hours.test.ts`

**Interfaces:**
- Produces (`src/dates.ts`): `WEEKDAYS_FR: readonly string[]` (Lundi…Dimanche) · `parseFrDate(s: string): string | null` · `formatFrDate(iso: string): string` · `addDays(iso: string, n: number): string` · `weekdayIndex(iso: string): number` (lundi=0) · `mondayOf(iso: string): string` · `weekdayFromName(name: string): number | null` (insensible casse/accents) · `monthGrid(year: number, month0: number): string[][]` (lignes de 7 jours ISO, lundi d'abord, couvrant le mois)
- Produces (`src/hours.ts`): `parseTrailingHours(text: string): { text: string; minutes: number } | null` · `parseHoursInput(input: string): number | null` · `formatHours(minutes: number): string`

- [ ] **Step 1: Write failing tests.** `dates.test.ts` : `parseFrDate('013/07/2026') === '2026-07-13'` ; `parseFrDate('31/02/2026') === null` ; `weekdayIndex('2026-10-26') === 0` ; `mondayOf('2026-09-05') === '2026-08-31'` ; `addDays('2026-10-31', 1) === '2026-11-01'` ; `weekdayFromName('mercredi') === 2` ; `monthGrid(2026, 10)[0][0] === '2026-10-26'` et chaque ligne a 7 jours. `hours.test.ts` : `parseTrailingHours('Corpus data 7h')` → `{text:'Corpus data', minutes:420}` ; `'Mémoire (0h30min)'` → 30 ; `'Udate memoire (2h)'` → 120 ; `'Prod SRS+BPMN (MJDH,INH) : 3h'` → texte `'Prod SRS+BPMN (MJDH,INH)'`, 180 ; `'x 2,5h'` → 150 ; `'x 30min'` → 30 ; `'x 4H'` → 240 ; et **null** pour `'Verif (2 + 5h)'`, `'Test (8h- 10h20)'`, `'Amélioration : 4'`, `'a 8h-10h20'`, `'réunion 4h puis suite'`. `formatHours(360)==='6h'`, `(150)==='2h30'`, `(55)==='0h55'`. `parseHoursInput('2h30')===150`, `('1,5')===90` (nombre nu = heures), `('90min')===90`, et **null** pour `''`, `'0'`, `'abc'`, `'-2'` (focus : jamais de `0h`).
- [ ] **Step 2: Run** `npm install` puis `npx vitest run` — Expected: FAIL (modules absents).
- [ ] **Step 3: Implement** `src/dates.ts` et `src/hours.ts` (UTC via `Date.UTC`; une durée finale n'est reconnue que précédée du début de texte, d'un espace ou de `:`, ou entourant exactement une parenthèse finale).
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: scaffold, dates et heures`.

---

### Task 2: Document et aller-retour octet pour octet

**Files:**
- Create: `src/doc.ts`, `tests/fixtures/sample.md` (synthétique : semaine `013/07/2026`, `Semaine du 05/09/2026` suivie de `Lundi 05/10/2026`, jour sans date, `Lundi : Test … 3h` en texte libre, tâches vides `- [ ] `, sous-tâche indentée à la tabulation, paragraphe multi-lignes sous un jour, section de notes en fin de fichier)
- Test: `tests/doc.test.ts`

**Interfaces:**
- Produces: `type DocLine = { kind: 'task'; raw: string; eol: string; indent: number; done: boolean; body: string } | { kind: 'other'; raw: string; eol: string }` (`raw` sans fin de ligne, `eol` ∈ `'\n' | '\r\n' | ''`, `indent` = espaces de tête avec tabulation = 4, `body` = texte après `] `) · `interface Doc { lines: DocLine[]; eol: string }` (`eol` = première fin de ligne rencontrée, défaut `'\n'`) · `parseDoc(text: string): Doc` · `serializeDoc(doc: Doc): string` · `makeTaskLine(depth: number, done: boolean, text: string, minutes: number | null, eol: string): DocLine` (indentation = `depth` tabulations) · `taskParts(line: DocLine & {kind:'task'}): { text: string; minutes: number | null; hoursUnrecognized: boolean }` (`hoursUnrecognized` = pas de durée reconnue mais la ligne contient `\d\s*h` ou `\d\s*min`)

- [ ] **Step 1: Write failing tests.** (a) `serializeDoc(parseDoc(t)) === t` pour : `sample.md`, `''`, `'\n'`, texte en CRLF, texte mixte LF/CRLF, texte sans retour final ; (b) test **réel** : lit `process.env.TASK_FILE ?? 'C:/Users/LENOVO/Documents/Obsidian Vault/Tâches/Toutes les tâches.md'` et vérifie l'aller-retour, `it.skipIf(!existsSync(path))` ; (c) `parseDoc('- [x] Corpus data 9h\n').lines[0]` est une tâche `done:true`, `body:'Corpus data 9h'` ; `taskParts` → `{text:'Corpus data', minutes:540, hoursUnrecognized:false}` ; `taskParts` de `- [ ] a 8h-10h20` → `hoursUnrecognized:true` ; `- [ ] ` vide est une tâche (`body:''`).
- [ ] **Step 2: Run** `npx vitest run tests/doc.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `src/doc.ts` (découpage sur `/\r?\n/` en conservant chaque séparateur ; tâche = `/^(\s*)- \[( |x|X)\] ?(.*)$/`).
- [ ] **Step 4: Run** la même commande — Expected: PASS, y compris le test réel.
- [ ] **Step 5: Commit** `feat: parseur de document avec aller-retour exact`.

---

### Task 3: Index calendrier, résolution des dates, totaux, diagnostics

**Files:**
- Create: `src/calendar-index.ts`
- Test: `tests/calendar-index.test.ts`

**Interfaces:**
- Consumes: `Doc`, `taskParts` (Task 2) ; `parseFrDate`, `weekdayFromName`, `weekdayIndex`, `mondayOf`, `addDays` (Task 1)
- Produces:
  - `interface TaskView { index: number; raw: string; done: boolean; text: string; minutes: number | null; hoursUnrecognized: boolean; depth: number; empty: boolean }` (`depth` : nombre d'indentations strictement plus petites parmi les tâches parentes ouvertes ; `empty` : texte vide après `trim`)
  - `interface DayBlock { headerIndex: number; startIndex: number; endIndex: number }` (`endIndex` exclu)
  - `interface DayView { date: string; blocks: DayBlock[]; tasks: TaskView[]; freeLines: { index: number; raw: string }[] }`
  - `interface WeekView { monday: string; headerIndex: number; endIndex: number }`
  - `interface Diagnostic { line: number; kind: 'week-header-not-monday' | 'day-date-mismatch' | 'duplicate-week' | 'duplicate-day' | 'ambiguous-hours' | 'unplaced-block'; message: string }`
  - `interface CalendarIndex { days: Map<string, DayView>; weeks: WeekView[]; diagnostics: Diagnostic[] }`
  - `buildIndex(doc: Doc): CalendarIndex` · `daySummary(day: DayView | undefined): { total: number; done: number; minutes: number }` (tâches `empty` exclues, sous-tâches incluses) · `weekMinutes(index: CalendarIndex, monday: string): number`

- [ ] **Step 1: Write failing tests** sur `sample.md` et des cas inline : en-tête `013/07/2026` → lundi `2026-07-13` ; `Semaine du 05/09/2026` (samedi) suivie de `Lundi 05/10/2026` → lundi `2026-10-05` ; `Mercredi 08/07/2026` sous la semaine du 13/07 → date `2026-07-15` avec diagnostic `day-date-mismatch` ; deux semaines au même lundi → `duplicate-week` et jours fusionnés ; `Lundi : Test studdio 3h` n'est pas un jour et reste dans `freeLines` du jour courant ; `##### Lundi` est un jour ; tâches vides exclues de `daySummary` mais présentes dans `tasks` avec `empty:true` ; sous-tâche tabulée → `depth:1` ; `- [ ] a 8h-10h20` → `ambiguous-hours` et `minutes:null` ; jour avant tout en-tête de semaine → `unplaced-block` ; `weekMinutes` somme les 7 jours.
- [ ] **Step 2: Run** `npx vitest run tests/calendar-index.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `buildIndex` en deux passes : (1) repérer en-têtes de semaine/jour et plages ; (2) résoudre le lundi de chaque semaine (en-tête s'il est lundi, sinon première ligne de jour datée dont le nom correspond à sa date, sinon bloc `unplaced-block`), puis placer chaque jour à `addDays(monday, weekdayFromName)`. Plage d'un jour = de son en-tête au prochain en-tête de jour/semaine ; `freeLines` = lignes non-tâche de cette plage hors en-tête.
- [ ] **Step 4: Run** la même commande — Expected: PASS.
- [ ] **Step 5: Commit** `feat: index calendrier et totaux`.

---

### Task 4: Opérations d'édition pures

**Files:**
- Create: `src/ops.ts`
- Test: `tests/ops.test.ts`

**Interfaces:**
- Consumes: `Doc`, `DocLine`, `makeTaskLine`, `serializeDoc`, `parseDoc` (Task 2) ; `buildIndex`, `DayView`, `TaskView` (Task 3) ; `formatFrDate`, `WEEKDAYS_FR`, `weekdayIndex`, `mondayOf` (Task 1)
- Produces: `interface LineRef { index: number; raw: string }` · `class StaleLineError extends Error` · toutes les fonctions retournent un **nouveau** `Doc` :
  - `addTask(doc: Doc, date: string, task: { text: string; minutes: number | null; depth?: number }): Doc`
  - `updateTask(doc: Doc, ref: LineRef, patch: { text?: string; minutes?: number | null; done?: boolean }): Doc`
  - `removeTask(doc: Doc, ref: LineRef): Doc` (tâche + sous-tâches)
  - `setDepth(doc: Doc, ref: LineRef, depth: 0 | 1): Doc` (refuse depth 1 s'il n'y a pas de tâche parent juste avant : lève `Error('no-parent')`, distinct de `StaleLineError`)
  - `moveTask(doc: Doc, ref: LineRef, toDate: string): Doc` · `copyTask(doc: Doc, ref: LineRef, toDates: string[]): Doc` (tâche + sous-tâches ; copie décochée, sans heures)
- Règles d'insertion (spec §4.4) : tâche ajoutée après la dernière tâche du **dernier** bloc du jour, sinon juste après l'en-tête du jour ; jour absent inséré chronologiquement dans sa semaine (après la dernière ligne non vide du jour précédent, une ligne vide de séparation ; sinon juste après l'en-tête de semaine) ; semaine absente (`#### Semaine du JJ/MM/AAAA`, séparée par une ligne vide) insérée juste après la dernière ligne de tâche/en-tête de jour de la semaine existante la plus proche **antérieure**, sinon avant la première semaine, sinon en fin de fichier. Les lignes créées utilisent `doc.eol`.

- [ ] **Step 1: Write failing tests** (écrire d'abord un helper `onlyLinesChanged(before, after, allowedRange)`) : ajout dans un jour existant n'altère aucune autre ligne ; ajout dans un jour absent d'une semaine existante ; ajout dans une semaine absente → placée **avant** les notes libres de fin de fichier de `sample.md` ; ajout dans un fichier `''` crée `#### Semaine du …`, `Lundi …`, la tâche ; fichier CRLF → toutes les lignes créées finissent par `\r\n` et le texte ne contient aucun `\n` seul ; `updateTask` sur `- [x] Corpus data 9h` avec `minutes:null` → `- [x] Corpus data` ; `done:true` sur tâche non cochée → `- [x] …` ; tâche non modifiée reste identique octet pour octet après un `updateTask` sans changement ; `removeTask` retire aussi les sous-tâches ; `moveTask` vers un jour absent crée le jour ; `copyTask` vers 3 jours crée 3 copies décochées sans heures avec sous-tâches ; `LineRef` périmé (`raw` différent) → `StaleLineError` et doc original inchangé ; `setDepth(…,1)` sur la première tâche d'un jour → erreur `no-parent`. Propriété (boucle sur 200 opérations aléatoires reproductibles, graine fixe) : `serializeDoc(parseDoc(serializeDoc(result))) === serializeDoc(result)` et le nombre de lignes `other` avant/après est identique.
- [ ] **Step 2: Run** `npx vitest run tests/ops.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `src/ops.ts` ; chaque fonction vérifie `doc.lines[ref.index]?.raw === ref.raw`, copie `lines` (jamais de mutation du `Doc` reçu), recalcule l'index avec `buildIndex` si nécessaire.
- [ ] **Step 4: Run** la même commande + `npx vitest run` — Expected: tous PASS.
- [ ] **Step 5: Commit** `feat: opérations d'édition (ajout, édition, déplacement, copie)`.

---

### Task 5: Store, réglages, plugin, sauvegarde

**Files:**
- Create: `src/store.ts`, `src/settings.ts`, `src/main.ts`
- Test: `tests/model-sync.test.ts` (logique pure de `applyEdit`, voir Interfaces)

**Interfaces:**
- Consumes: `parseDoc`, `serializeDoc` (Task 2) ; `buildIndex`, `CalendarIndex` (Task 3) ; `StaleLineError` (Task 4)
- Produces:
  - `src/store.ts` : `applyEdit(text: string, edit: (doc: Doc) => Doc): string` (pur : parse → edit → serialize) · `class TaskStore { constructor(app: App, getPath: () => string); doc: Doc; index: CalendarIndex; fileExists: boolean; load(): Promise<void>; edit(fn: (doc: Doc) => Doc): Promise<boolean>; createFile(): Promise<void>; onChange(cb: () => void): () => void }` — `edit` utilise `app.vault.process`, renvoie `false` et affiche un `Notice` en cas de `StaleLineError` (puis recharge) ; écoute `vault.on('modify')` sur le fichier cible et recharge ; chemin introuvable → `fileExists=false`, doc vide.
  - `src/settings.ts` : `interface TaskCalendarSettings { filePath: string; backupDone: boolean }` (défaut `Tâches/Toutes les tâches.md`, `false`) · `class TaskCalendarSettingTab extends PluginSettingTab`
  - `src/main.ts` : `export default class TaskCalendarPlugin extends Plugin { store: TaskStore; settings: TaskCalendarSettings; selectedDate: string; selectDate(iso: string): void }` — `selectDate` met à jour l'état et déclenche `app.workspace.trigger('task-calendar:select', iso)` ; enregistre les vues (types `task-calendar-view`, `task-calendar-day`), l'icône de ruban `calendar-days`, les commandes `open-calendar` (« Ouvrir le calendrier des tâches ») et `diagnostic` (« Task Calendar : diagnostic ») ; à la première activation, copie le fichier cible dans `<plugin>/backup/Toutes les tâches.<horodatage>.md` puis `backupDone=true`.

- [ ] **Step 1: Write failing test** `applyEdit` : sur `sample.md`, `applyEdit(text, d => d)` renvoie exactement `text` ; une édition qui lève `StaleLineError` se propage sans résultat partiel.
- [ ] **Step 2: Run** `npx vitest run tests/model-sync.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `applyEdit`, `TaskStore`, réglages, `main.ts` (vues branchées en Tasks 6-7 ; ici enregistrement avec des vues minimales qui affichent le nom du fichier lu et le nombre de jours indexés).
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck && npm run build` — Expected: PASS, `main.js` produit sans erreur.
- [ ] **Step 5: Commit** `feat: store, réglages et squelette du plugin`.

---

### Task 6: Vue calendrier (lecture seule)

**Files:**
- Create: `src/calendar-model.ts`, `src/views/calendar-view.ts`, `styles.css`
- Modify: `src/main.ts` (brancher `CalendarView`)
- Test: `tests/calendar-model.test.ts`

**Interfaces:**
- Consumes: `CalendarIndex`, `daySummary`, `weekMinutes` (Task 3) ; `monthGrid`, `mondayOf` (Task 1) ; `TaskCalendarPlugin.store`, `selectDate` (Task 5)
- Produces: `interface CellModel { date: string; dayOfMonth: number; inMonth: boolean; isToday: boolean; total: number; done: number; minutes: number }` · `interface MonthModel { label: string; weeks: { monday: string; cells: CellModel[]; minutes: number }[] }` · `buildMonthModel(index: CalendarIndex, year: number, month0: number, todayIso: string): MonthModel` (`label` ex. `novembre 2026`) · `class CalendarView extends ItemView` (type `task-calendar-view`)

- [ ] **Step 1: Write failing test** : sur un index construit depuis `sample.md`, `buildMonthModel(…, 2026, 9, '2026-10-27')` a 5 ou 6 semaines de 7 cellules, `label === 'octobre 2026'`, `isToday` vrai pour une seule cellule, `minutes` de semaine = somme de ses cellules, cellule hors mois `inMonth:false`.
- [ ] **Step 2: Run** `npx vitest run tests/calendar-model.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `buildMonthModel` ; `CalendarView` rend en-tête (précédent / `Aujourd'hui` / suivant, libellé du mois), grille 7 colonnes + colonne « Total » par semaine, cellule `done/total ✓ · Xh` (masquée si 0 tâche), classes CSS `is-today`, `is-selected`, `is-outside` ; clic → `plugin.selectDate` et ouverture/activation du `DayPanel` dans le volet droit ; se redessine sur `store.onChange` et sur `task-calendar:select`. Message + bouton « Créer le fichier » si `!store.fileExists`. `styles.css` n'utilise que les variables de thème Obsidian (`--background-modifier-border`, `--interactive-accent`, etc.).
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: vue calendrier avec totaux`.

---

### Task 7: Panneau du jour (ajout, édition, cochage, heures)

**Files:**
- Create: `src/views/day-panel.ts`
- Modify: `src/main.ts` (brancher `DayPanel`), `styles.css`
- Test: `tests/day-panel-model.test.ts` + extension de `src/calendar-model.ts` avec `buildDayModel`

**Interfaces:**
- Consumes: `CalendarIndex`, `DayView`, `TaskView`, `daySummary` (Task 3) ; `addTask`, `updateTask`, `removeTask`, `LineRef` (Task 4) ; `formatHours`, `parseHoursInput` (Task 1) ; `store.edit` (Task 5)
- Produces: `interface DayRowModel { ref: LineRef; done: boolean; text: string; hoursText: string; hoursUnrecognized: boolean; depth: number; empty: boolean }` · `interface DayModel { title: string; summary: { total: number; done: number; minutes: number }; rows: DayRowModel[]; freeLines: string[] }` · `buildDayModel(index: CalendarIndex, date: string): DayModel` (`title` ex. `Lundi 26/10/2026 · 9h`, `hoursText` ex. `6h`) · `class DayPanel extends ItemView` (type `task-calendar-day`)

- [ ] **Step 1: Write failing test** : `buildDayModel` sur un jour de `sample.md` → `title` conforme (`Mardi 27/10/2026 · 9h`), `rows[i].ref.raw` égal à la ligne d'origine, `hoursText:''` quand non reconnues, `hoursUnrecognized:true` pour `8h-10h20`, `freeLines` contient le paragraphe libre ; jour absent → `rows: []` et titre sans durée.
- [ ] **Step 2: Run** `npx vitest run tests/day-panel-model.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `buildDayModel` et `DayPanel` : une ligne par tâche (case, champ texte, champ heures, indentation visuelle), `Entrée` dans le dernier champ ajoute une tâche, bouton « + Ajouter une tâche », indicateur ⚠ pour heures non reconnues, lignes libres en lecture seule repliées. Écriture au `blur`/`change`, jamais à chaque frappe ; saisie d'heures invalide → champ remis à sa valeur, `0` ou vide → heures effacées. **Cocher une tâche sans heures place le focus dans son champ heures.** Une mise à jour externe ne remplace pas un champ ayant le focus.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: panneau du jour`.

---

### Task 8: Sous-tâches, reporter, copier, diagnostic

**Files:**
- Create: `src/views/pick-date-modal.ts`
- Modify: `src/views/day-panel.ts`, `src/main.ts`, `styles.css`
- Test: `tests/ops.test.ts` (compléments si besoin)

**Interfaces:**
- Consumes: `setDepth`, `moveTask`, `copyTask`, `removeTask` (Task 4) ; `CalendarIndex.diagnostics` (Task 3)
- Produces: `class PickDateModal extends Modal { constructor(app: App, opts: { title: string; multiple: boolean; weekMonday: string; onSubmit: (dates: string[]) => void }) }` (jours de la semaine affichée en cases, plus un champ date libre `JJ/MM/AAAA`, boutons « Demain » en mode simple)

- [ ] **Step 1:** Vérifier par test (ajout à `ops.test.ts`) le comportement de `setDepth` ↔ rendu : tâche passée en depth 1 s'écrit avec une tabulation et `buildIndex` la voit en `depth:1`.
- [ ] **Step 2: Run** `npx vitest run tests/ops.test.ts` — Expected: PASS ou FAIL à corriger.
- [ ] **Step 3: Implement** boutons indenter/désindenter ; menu `⋯` (Reporter → `PickDateModal` simple avec « Demain » ; Copier vers… → `PickDateModal` multiple ; Supprimer avec confirmation si sous-tâches) ; commande « Task Calendar : diagnostic » qui ouvre une `Modal` listant `diagnostics` (ligne, nature, message) sans rien corriger.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: sous-tâches, reporter, copier, diagnostic`.

---

### Task 9: Installation, vérification finale, documentation

**Files:**
- Create: `scripts/install-plugin.mjs`, `README.md`
- Modify: `docs/superpowers/specs/2026-11-09-task-calendar-design.md` (§3 : réglages = chemin du fichier uniquement en v1 ; format de date et début de semaine fixes), `package.json`

**Interfaces:**
- Produces: `npm run install-plugin` copie `main.js`, `manifest.json`, `styles.css` vers `${OBSIDIAN_VAULT ?? 'C:/Users/LENOVO/Documents/Obsidian Vault'}/.obsidian/plugins/task-calendar/` (crée le dossier, n'écrase rien d'autre, ne touche pas à `community-plugins.json`).

- [ ] **Step 1: Run** `npx vitest run && npm run typecheck && npm run build` — Expected: tout PASS ; le test d'aller-retour sur le vrai fichier est exécuté (non ignoré) et PASS.
- [ ] **Step 2: Implement** le script d'installation et le `README.md` (installation, activation dans Paramètres → Plugins communautaires, usage, limites connues dont l'absence de vérification visuelle automatisée).
- [ ] **Step 3: Run** `npm run install-plugin` — Expected: les trois fichiers présents dans le dossier du coffre ; `git status` du coffre n'est pas concerné (pas de dépôt).
- [ ] **Step 4:** Vérifier que le vrai fichier de tâches est inchangé (`git`-indépendant : comparer son empreinte SHA-256 avant/après l'installation et les tests).
- [ ] **Step 5: Commit** `docs: README, script d'installation et mise à jour de la spec`.
