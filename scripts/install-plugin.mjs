// Copie le build du plugin dans le coffre Obsidian. N'active pas le plugin et ne touche
// ni a community-plugins.json ni aux donnees du plugin (data.json, backup/).
import { copyFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vault = process.env.OBSIDIAN_VAULT ?? 'C:/Users/LENOVO/Documents/Obsidian Vault';
const target = join(vault, '.obsidian', 'plugins', 'task-calendar');
const files = ['main.js', 'manifest.json', 'styles.css'];

for (const file of files) {
  try {
    await access(join(root, file));
  } catch {
    console.error(`Fichier manquant : ${file}. Lancez d'abord "npm run build".`);
    process.exit(1);
  }
}

await mkdir(target, { recursive: true });
for (const file of files) {
  await copyFile(join(root, file), join(target, file));
  console.log(`copie : ${file} -> ${target}`);
}
console.log('Installe. Activez "Task Calendar" dans Parametres > Plugins communautaires.');
