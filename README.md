# Task Calendar

Plugin Obsidian : un grand calendrier et un panneau du jour pour remplir vos tâches (texte, heures, état)
directement dans votre fichier Markdown `Tâches/Toutes les tâches.md`, au format habituel :

```
#### Semaine du 26/10/2026

Lundi 26/10/2026
- [x] Déblocage deux services plateforme flux 6h
- [x] Poffinement du rapport projet agent pc 3h
```

Plus besoin de recopier le gabarit de la semaine : cliquer un jour crée ce qu'il faut.

## Installation

```bash
npm install
npm run build
npm run install-plugin     # copie main.js, manifest.json, styles.css dans le coffre
```

Le coffre cible est `C:/Users/LENOVO/Documents/Obsidian Vault` ; changez-le avec la variable d'environnement
`OBSIDIAN_VAULT`. Le script **n'active pas** le plugin : dans Obsidian, ouvrez *Paramètres → Plugins
communautaires*, rechargez la liste, puis activez **Task Calendar**.

## Utilisation

- Icône **calendrier** dans la barre latérale, ou la commande *Ouvrir le calendrier des tâches*.
- Un clic sur un jour ouvre le **panneau du jour** (volet de droite).
  - Case à cocher, texte, champ **heures** (`6h`, `2h30`, `1,5`, `45min`).
  - Cocher une tâche sans heures place le curseur dans son champ heures.
  - `Entrée` dans la dernière ligne crée la tâche suivante.
  - Bouton d'indentation : sous-tâche / retour au premier niveau.
  - Menu `⋯` : **Reporter** (demain ou un autre jour), **Copier vers…** (plusieurs jours), **Supprimer**.
- Le calendrier affiche par jour `faites/total ✓ · heures` et le total d'heures de chaque semaine.
- Commande *Diagnostic du fichier de tâches* : liste les incohérences du fichier, sans rien corriger.

Le réglage **Fichier des tâches** permet de changer le chemin du fichier cible.

## Comment ça protège vos données

- Seuls les blocs *Semaine / jour / cases à cocher* sont lus et écrits. Notes, liens et paragraphes sont
  conservés tels quels, à leur place.
- Une tâche que vous ne modifiez pas n'est jamais réécrite. Cocher ou décocher ne change que la case.
- Chaque écriture repart de la dernière version du fichier (`vault.process`) : une édition manuelle
  simultanée n'est pas écrasée. Si la ligne a bougé entre l'affichage et votre action, l'action est annulée.
- Une copie du fichier est faite à la première activation, dans `<plugin>/backup/`.

## Règles de lecture

- La date d'un jour vient de sa **position** (début de semaine + nom du jour), pas de la date tapée. Les
  en-têtes mal tapés (`013/07/2026`, ou un `05/09` qui est en fait un `05/10`) sont tolérés.
- Heures reconnues en fin de ligne seulement : `6h`, `2h30`, `1h55`, `30min`, `2,5h`, `(3h)`, `: 4h`.
  Les cas ambigus (`2 + 5h`, `8h-10h20`, `4`) et les durées de plus de 12 h (souvent une heure de rendez-vous,
  ex. `17h30`) restent dans le texte et ne comptent pas dans les totaux ; le panneau affiche ⚠.
- Les tâches vides (`- [ ] `) sont conservées mais ne comptent pas dans les totaux.

## Développement

```bash
npm test            # tests unitaires (Vitest)
npm run typecheck
npm run build
```

Le test d'aller-retour lit le vrai fichier de tâches de l'utilisateur (variable `TASK_FILE` pour en indiquer un
autre) et s'ignore s'il est absent. Ce fichier n'est jamais commité.

## Limites connues

- La couche d'interface (focus, saisie, modales) n'est pas couverte par des tests automatisés : la logique
  testable est dans le parseur, l'index, les opérations et les modèles de vue.
- Format de date `JJ/MM/AAAA` et semaine lundi→dimanche fixes ; seul le chemin du fichier est réglable.
- Pas de glisser-déposer ni de mobile testé.
