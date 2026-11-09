import { Notice, TFile, normalizePath } from 'obsidian';
import type { App, Plugin } from 'obsidian';
import { applyEdit } from './apply-edit';
import { buildIndex } from './calendar-index';
import type { CalendarIndex } from './calendar-index';
import { parseDoc } from './doc';
import type { Doc } from './doc';
import { t } from './i18n';
import type { Lang } from './i18n';
import { StaleLineError } from './ops';

/** Acces au fichier de taches : lecture, ecriture atomique, rechargement sur modification externe. */
export class TaskStore {
  doc: Doc = parseDoc('');
  index: CalendarIndex = buildIndex(this.doc);
  fileExists = false;

  private listeners = new Set<() => void>();
  private lastText: string | null = null;

  constructor(
    private readonly app: App,
    private readonly getPath: () => string,
    /** Langue des en-tetes a ecrire, a partir de celle detectee dans le fichier (ou null). */
    private readonly resolveHeaderLang: (detected: Lang | null) => Lang,
  ) {}

  /** Recharge le modele quand le fichier cible est cree, modifie, renomme ou supprime. */
  attach(plugin: Plugin): void {
    const reloadIfTarget = (path: string): void => {
      if (path === this.path()) void this.load();
    };
    const { vault } = this.app;
    plugin.registerEvent(vault.on('modify', (file) => reloadIfTarget(file.path)));
    plugin.registerEvent(vault.on('create', (file) => reloadIfTarget(file.path)));
    plugin.registerEvent(vault.on('delete', (file) => reloadIfTarget(file.path)));
    plugin.registerEvent(
      vault.on('rename', (file, oldPath) => {
        if (file.path === this.path() || oldPath === this.path()) void this.load();
      }),
    );
  }

  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  path(): string {
    return normalizePath(this.getPath());
  }

  private file(): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(this.path());
    return file instanceof TFile ? file : null;
  }

  async load(): Promise<void> {
    const file = this.file();
    const text = file ? await this.app.vault.read(file) : '';
    const exists = file !== null;
    if (exists === this.fileExists && text === this.lastText) return;
    this.fileExists = exists;
    this.lastText = text;
    this.doc = parseDoc(text);
    this.index = buildIndex(this.doc);
    for (const listener of [...this.listeners]) listener();
  }

  /**
   * Applique `edit` sur la derniere version du fichier. Renvoie false (et previent l'utilisateur)
   * si une ligne a bouge entre l'affichage et l'action : rien n'est alors ecrit.
   */
  async edit(edit: (doc: Doc) => Doc): Promise<boolean> {
    const file = this.file();
    if (!file) {
      new Notice(t('store.noFile'));
      return false;
    }
    try {
      await this.app.vault.process(file, (text) => applyEdit(text, edit, this.resolveHeaderLang));
    } catch (error) {
      if (error instanceof StaleLineError) {
        new Notice(t('store.stale'));
        await this.load();
        return false;
      }
      throw error;
    }
    await this.load();
    return true;
  }

  async createFile(): Promise<void> {
    const path = this.path();
    const slash = path.lastIndexOf('/');
    if (slash > 0) {
      const folder = path.slice(0, slash);
      if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    }
    if (!this.app.vault.getAbstractFileByPath(path)) await this.app.vault.create(path, '');
    await this.load();
  }
}
