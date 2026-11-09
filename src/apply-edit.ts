import { parseDoc, serializeDoc } from './doc';
import type { Doc } from './doc';
import type { Lang } from './i18n';

/**
 * Coeur de toute ecriture : on repart toujours du texte recu (la derniere version du fichier),
 * jamais d'un etat memorise. Une StaleLineError de `edit` se propage : aucun texte partiel.
 *
 * `resolveLang` recoit la langue des en-tetes detectee dans le fichier (ou null) et renvoie celle a
 * utiliser pour les semaines et jours crees (reglage de l'utilisateur, sinon langue de l'interface).
 */
export function applyEdit(
  text: string,
  edit: (doc: Doc) => Doc,
  resolveLang?: (detected: Lang | null) => Lang,
): string {
  const doc = parseDoc(text);
  if (resolveLang) doc.headerLang = resolveLang(doc.headerLang);
  return serializeDoc(edit(doc));
}
