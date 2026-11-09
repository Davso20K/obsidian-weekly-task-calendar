import { parseDoc, serializeDoc } from './doc';
import type { Doc } from './doc';

/**
 * Coeur de toute ecriture : on repart toujours du texte recu (la derniere version du fichier),
 * jamais d'un etat memorise. Une StaleLineError de `edit` se propage : aucun texte partiel.
 */
export function applyEdit(text: string, edit: (doc: Doc) => Doc): string {
  return serializeDoc(edit(parseDoc(text)));
}
