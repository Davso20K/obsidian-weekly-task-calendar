# Task Calendar — plugin Obsidian de planification des tâches

Date : 2026-11-09 · Statut : en attente de relecture

## 1. Objectif

Supprimer la corvée de recopier chaque semaine le gabarit de `Tâches/Toutes les tâches.md`. L'utilisateur
veut un **grand calendrier** dans Obsidian : il clique sur un jour, saisit ses tâches, coche celles qui sont
faites et renseigne les heures une fois la tâche terminée. Le plugin produit automatiquement, dans le fichier
Markdown existant, la vue habituelle :

```
#### Semaine du 26/10/2026

Lundi 26/10/2026
- [x] Déblocage deux services plateforme flux 6h
- [x] Poffinement du rapport projet agent pc 3h
```

**Critères de réussite**
- Créer une journée complète (ajout des tâches, cochage, heures) sans jamais copier un gabarit à la main.
- Le fichier `.md` reste la source de vérité : une modification à la main apparaît dans le calendrier, et
  inversement.
- Aucune perte ni altération des notes libres ni de l'historique (6 mois de semaines) présents dans le fichier.

**Hors périmètre v1** : glisser-déposer, rappels/notifications, plusieurs fichiers cibles, mobile, export.

## 2. Décisions de conception

| Sujet | Décision |
|---|---|
| Source de vérité | Le fichier `Tâches/Toutes les tâches.md` (chemin réglable). Pas de base de données séparée. |
| Format de fichier | Inchangé : pas de balises ni de front-matter ajoutés. |
| Saisie | Panneau latéral du jour, à côté du calendrier (pas de popup). |
| Fonctions v1 | Totaux d'heures, sous-tâches, reporter une tâche, copier vers d'autres jours. |
| Technologie | TypeScript, API Obsidian, build esbuild, tests Vitest. |
| Emplacement | Code dans `C:\Users\LENOVO\Documents\task-calendar` (dépôt git propre) ; build copié dans `<coffre>/.obsidian/plugins/task-calendar/`. |

## 3. Architecture

Cinq unités à frontières nettes. Seules les vues et le store dépendent de l'API Obsidian.

| Unité | Rôle | Dépend de |
|---|---|---|
| `parser` | Texte `.md` → modèle (semaines, jours, tâches, lignes libres) et modèle → texte. Code pur. | rien |
| `store` | Lecture/écriture atomique du fichier via `vault.process`. Expose les opérations (ajouter, éditer, cocher, supprimer, indenter, reporter, copier). Recharge le modèle sur modification externe. | `parser` |
| `CalendarView` | `ItemView` principale : grille mensuelle, résumés par jour, total hebdomadaire. | `store` |
| `DayPanel` | `ItemView` latérale : liste éditable des tâches du jour. | `store` |
| `settings` | Chemin du fichier cible (seul réglage en v1 : le format de date `JJ/MM/AAAA` et la semaine lundi→dimanche sont fixes). | rien |

## 4. Parseur et sérialiseur

### 4.1 Reconnaissance

- **Semaine** : ligne `#{1,6} Semaine du JJ/MM/AAAA`. Les écarts de saisie sont tolérés (`013/07/2026` lu
  comme 13/07/2026).
- **Jour** : ligne qui ne contient **que** un nom de jour (insensible à la casse et aux accents), suivi
  éventuellement d'une date, d'espaces ou de `:` final. `Lundi : Test studdio… 3h` n'est donc **pas** un jour.
- **Tâche** : `^(\s*)- \[( |x|X)\] (.*)$`. Une indentation (tabulation ou 2/4 espaces) plus profonde que
  la tâche précédente en fait une sous-tâche de celle-ci.
- **Ligne libre** : toute autre ligne (notes, liens, paragraphes, lignes vides, continuations indentées).
  Elle est conservée telle quelle, à sa position, et n'est jamais modifiée.

### 4.2 Date réelle d'un jour

La date d'un jour vient de sa **position** : début de semaine + décalage du nom du jour. La date tapée sur
la ligne du jour n'est jamais utilisée pour le placement.

Début de semaine :
1. La date de l'en-tête, si c'est un lundi.
2. Sinon, la première ligne de jour dont la date est cohérente avec son nom (exemple du fichier :
   `Semaine du 05/09/2026` — un samedi — suivie de `Lundi 05/10/2026` donne la semaine du 05/10/2026).
3. Sinon, le bloc est ignoré par le calendrier et signalé par le diagnostic.

Si deux blocs résolvent au même lundi, les deux sont conservés dans le modèle, le calendrier les affiche
fusionnés, un avertissement est signalé, et les écritures vont vers le **dernier** bloc.

Une commande « Diagnostic » liste les incohérences détectées (dates qui ne correspondent pas à leur nom
de jour, semaines en double, heures ambiguës). Elle ne corrige rien.

### 4.3 Heures

Une durée est extraite **uniquement** si elle termine le texte de la tâche, éventuellement entre parenthèses
ou précédée de `:` :

`6h` · `2h30` · `1h55` · `0h30min` · `30min` · `2,5h` · `(3h)` · `: 4h` · `4H`

Une durée de plus de 12 h pour une seule tâche est traitée comme ambiguë (souvent une heure de rendez-vous,
ex. `Reunion 17h30` dans le fichier réel).

Les cas ambigus (`2 + 5h`, `8h-10h20`, un `4` isolé, une durée au milieu du texte) restent dans le texte. Le
champ heures de la tâche est vide et le panneau affiche un indicateur « heures non reconnues ». Ces tâches ne
comptent pas dans les totaux.

### 4.4 Écriture

- Une tâche non modifiée n'est **jamais réécrite** : sa ligne d'origine est conservée octet pour octet.
- Une tâche modifiée est écrite `- [x] texte 6h` (heures au format `Xh` ou `XhMM`).
- Un jour absent est inséré à sa place chronologique dans sa semaine, au format `Lundi JJ/MM/AAAA`.
- Une semaine absente est insérée en `#### Semaine du JJ/MM/AAAA`, **juste après le dernier bloc de tâches de
  la semaine précédente** (donc avant les notes libres de fin de fichier), et non en fin de fichier. S'il
  n'existe aucune semaine antérieure, elle est insérée avant la première semaine existante ; si le fichier ne
  contient aucune semaine, elle est ajoutée à la fin.
- Les fins de ligne (LF/CRLF) du fichier sont conservées.

## 5. Interface

### 5.1 CalendarView

- Ouverte par une icône de la barre latérale et la commande « Ouvrir le calendrier des tâches ».
- Grille mensuelle lundi→dimanche, navigation mois précédent/suivant, bouton « Aujourd'hui ».
- Chaque case : jour du mois, `faites/total ✓ · Xh`, jour courant et jour sélectionné mis en évidence.
- Colonne de droite : total d'heures de la semaine.
- Clic sur un jour : le sélectionne et ouvre/active le `DayPanel`.

### 5.2 DayPanel

- En-tête : `Lundi 26/10/2026 · 9h`.
- Une ligne par tâche : case, texte, champ heures (accepte `6h`, `2h30`, `1,5`), boutons indenter/désindenter,
  menu `⋯`.
- Cocher une tâche **sans heures** place le curseur dans son champ heures.
- `Entrée` dans la dernière ligne crée la tâche suivante ; bouton « + Ajouter une tâche » en bas.
- Menu `⋯` :
  - **Reporter** : déplace la tâche et ses sous-tâches vers « Demain » ou un jour choisi.
  - **Copier vers…** : copie la tâche **avec ses sous-tâches**, décochées et sans heures, sur un ou plusieurs
    jours en une opération.
  - Reporter et Copier vers un jour qui n'existe pas encore dans le fichier créent le jour (et la semaine si
    besoin) selon les règles d'insertion du §4.4.
  - **Supprimer**.
- Les lignes libres du jour ne sont pas éditables dans le panneau ; elles sont affichées en lecture seule et
  restent intactes dans le fichier.

### 5.3 Synchronisation

Le store écoute les modifications du fichier. Une édition manuelle met à jour le calendrier et le panneau.
Un champ en cours de saisie n'est jamais écrasé par cette mise à jour.

## 6. Fiabilité et protection des données

- **Test de non-régression** : `serialize(parse(texte)) === texte` sur le vrai fichier de l'utilisateur
  (copié en fixture). Échec = rien n'est livré.
- Écritures via `vault.process` : chaque opération part de la dernière version du fichier et est atomique.
- **Sauvegarde** : copie de `Toutes les tâches.md` dans `<plugin>/backup/` à la première activation.
- Ligne non comprise : laissée intacte et signalée, jamais d'échec bloquant.
- Fichier cible introuvable : le calendrier s'affiche vide avec un message et un bouton « Créer le fichier ».

## 7. Tests

**Automatisés (Vitest, sans Obsidian)**
- Cas issus du fichier réel : `013/07/2026`, `Semaine du 05/09/2026` (=05/10), jour sans date, jour avec date
  incohérente, heures ambiguës, sous-tâches, jour multi-lignes (29/10/2026), `Lundi : …` non reconnu comme
  jour.
- Propriété sur chaque opération (ajouter, cocher, éditer, supprimer, reporter, copier) : tout le texte hors
  de la zone ciblée est identique avant/après.
- Insertion d'une nouvelle semaine : placée avant les notes libres de fin de fichier.

**Manuels** : contrôle dans l'Obsidian réel de l'utilisateur, avec captures d'écran.

## 8. Livraison par étapes

Chaque étape est utilisable seule.

1. Parseur, sérialiseur, test de non-régression sur le fichier réel.
2. `CalendarView` en lecture seule, avec totaux.
3. `DayPanel` : ajout, édition, cochage, heures.
4. Sous-tâches, reporter, copier.
