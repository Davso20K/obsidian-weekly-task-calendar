// Copie le build du plugin dans le coffre Obsidian. N'active pas le plugin et ne touche
// pas a community-plugins.json. Si un ancien dossier "task-calendar" (ancien identifiant)
// existe avec des reglages, ils sont repris une seule fois dans le nouveau dossier.
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vault = process.env.OBSIDIAN_VAULT ?? 'C:/Users/LENOVO/Documents/Obsidian Vault';
const plugins = join(vault, '.obsidian', 'plugins');
const target = join(plugins, 'weekly-task-calendar');
const legacyData = join(plugins, 'task-calendar', 'data.json');
const files = ['main.js', 'manifest.json', 'styles.css'];

const exists = (path) => access(path).then(() => true, () => false);

for (const file of files) {
  if (!(await exists(join(root, file)))) {
    console.error(`Fichier manquant : ${file}. Lancez d'abord "npm run build".`);
    process.exit(1);
  }
}

await mkdir(target, { recursive: true });
for (const file of files) {
  await copyFile(join(root, file), join(target, file));
  console.log(`copie : ${file} -> ${target}`);
}

const newData = join(target, 'data.json');
if (!(await exists(newData)) && (await exists(legacyData))) {
  await writeFile(newData, await readFile(legacyData));
  console.log('reglages repris depuis l\'ancien dossier task-calendar');
}

console.log('Installe. Activez "Weekly Task Calendar" dans Parametres > Plugins communautaires.');
console.log('Si l\'ancien "Task Calendar" est encore actif, desactivez-le puis supprimez-le.');
