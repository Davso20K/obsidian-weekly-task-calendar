# Weekly Task Calendar

[🇬🇧 English](README.md) · 🇫🇷 Français

Un plugin [Obsidian](https://obsidian.md) pour remplir votre liste de tâches de la semaine depuis un grand
calendrier. Vous cliquez sur un jour, vous saisissez vos tâches, vous les cochez et vous indiquez les heures
quand vous avez fini. Tout est écrit directement dans **un seul fichier Markdown**, dans un format que vous
pouvez toujours lire et modifier à la main :

```markdown
#### Semaine du 26/10/2026

Lundi 26/10/2026
- [x] Déblocage deux services plateforme flux 6h
- [x] Peaufinement du rapport projet 3h

Mardi 27/10/2026
- [x] Continuer notebook montée en compétence 2h
- [x] Corpus data 7h
- [ ] Point avec l'équipe
```

Plus besoin de recopier le gabarit de la semaine précédente ni de retaper les titres.

## Fonctionnalités

- **Calendrier mensuel** avec, pour chaque jour, `faites/total ✓ · heures`, et une colonne de **total de la semaine**.
- **Panneau du jour** à côté du calendrier : case, texte et champ heures pour chaque tâche. Cocher une tâche sans
  heures place le curseur dans son champ heures : vous quantifiez en finissant.
- **Sous-tâches**, **report** d'une tâche à demain ou à un autre jour, **copie** d'une tâche sur plusieurs jours.
- **Dans les deux sens** : modifiez le fichier à la main et le calendrier suit ; utilisez le calendrier et le
  fichier suit.
- **Français et anglais** : l'interface suit la langue d'Obsidian, et les mots écrits dans votre fichier
  (« Semaine du » / « Week of », noms de jours) peuvent être français ou anglais. Les deux sont toujours compris
  à la lecture.
- Commande de **diagnostic** qui liste les incohérences du fichier, sans rien modifier.

## Installation

Pas encore dans la liste des plugins communautaires. Pour l'installer à la main :

1. Téléchargez `main.js`, `manifest.json` et `styles.css` depuis la
   [dernière release](https://github.com/Davso20K/obsidian-task-calendar/releases/latest).
2. Placez-les dans `<votre coffre>/.obsidian/plugins/weekly-task-calendar/`.
3. Dans Obsidian : **Paramètres → Modules complémentaires**, rechargez la liste, activez **Weekly Task Calendar**.

## Utilisation

1. Cliquez sur l'icône **calendrier** de la barre latérale, ou lancez la commande *Ouvrir le calendrier des tâches*.
2. Cliquez sur un jour : le panneau du jour s'ouvre à droite.
3. Ajoutez des tâches, saisissez les heures (`6h`, `2h30`, `1,5` ou `45min`), cochez-les.
4. **⋯** sur une tâche : *Reporter…* (demain ou un autre jour), *Copier vers…* (plusieurs jours), *Supprimer*.

Par défaut, le plugin lit et écrit `Tasks.md` à la racine du coffre. Changez-le dans
**Paramètres → Weekly Task Calendar → Fichier des tâches**. Si le fichier n'existe pas, le calendrier propose
de le créer.

## Comment vos données sont protégées

- Seuls les titres de semaine, les titres de jour et les cases à cocher sont lus et écrits. Notes, liens et
  paragraphes du même fichier sont conservés tels quels, à leur place.
- Une tâche que vous ne modifiez pas n'est jamais réécrite. Cocher ou décocher ne change que la case.
- Chaque écriture repart de la dernière version du fichier (`vault.process`) : une modification manuelle
  simultanée n'est pas écrasée. Si une ligne a bougé entre l'affichage et votre action, l'action est annulée.
- Une copie du fichier de tâches est faite dans le dossier du plugin (`backup/`) au premier lancement.

## Règles de lecture

- Une **semaine** est un titre du type `#### Semaine du JJ/MM/AAAA` (aussi `Week of …` ou `Week …`).
- Un **jour** est une ligne qui ne contient qu'un nom de jour, avec une date facultative : `Lundi`,
  `Mardi 27/10/2026`. Une ligne comme `Lundi : rappeler Alex 3h` est une note normale, pas un jour.
- La date d'un jour vient de sa **position** (début de semaine + jour), pas de la date tapée sur sa ligne :
  les fautes de frappe du fichier ne déplacent donc pas les tâches. Si un nom de jour apparaît deux fois dans
  la même semaine, seul le premier ouvre un jour ; la répétition est traitée comme une note et signalée par la
  commande de diagnostic.
- Les **heures** ne sont reconnues qu'en fin de ligne : `6h`, `2h30`, `1h55`, `30min`, `2,5h`, `(3h)`, `: 4h`.
  Les cas ambigus (`2 + 5h`, `8h-10h20`, un `4` seul) et les durées de plus de 12 h (souvent une heure de
  rendez-vous comme `17h30`) restent dans le texte et ne comptent pas dans les totaux ; le panneau affiche ⚠.
- Les tâches vides (`- [ ]`) sont conservées mais ne sont pas comptées.

## Réglages

| Réglage | Description |
| --- | --- |
| Fichier des tâches | Chemin du fichier Markdown, relatif à la racine du coffre. Par défaut `Tasks.md`. |
| Langue des en-têtes dans le fichier | `Auto` suit le fichier existant, puis la langue d'Obsidian ; ou forcer l'anglais / le français. |

## Limites

- Les dates sont écrites en `JJ/MM/AAAA` et les semaines vont du lundi au dimanche. Les autres formats de date ne
  sont pas encore gérés.
- Le code de l'interface (gestion du focus, fenêtres) n'est pas couvert par des tests automatisés ; le parseur,
  les opérations d'édition et les modèles de vue le sont.

## Développement

```bash
npm install
npm test            # tests unitaires (Vitest)
npm run typecheck
npm run build       # produit main.js
npm run install-plugin   # copie le build dans votre coffre (variable OBSIDIAN_VAULT pour le changer)
```

Le test d'aller-retour lit le vrai fichier de tâches de l'auteur s'il existe (variable `TASK_FILE` pour en
indiquer un autre) et s'ignore sinon. Les releases sont construites par GitHub Actions : pousser un tag égal à la
version de `manifest.json` publie `main.js`, `manifest.json` et `styles.css`.

## Licence

[MIT](LICENSE)
