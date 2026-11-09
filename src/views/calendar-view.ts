import { ItemView } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type TaskCalendarPlugin from '../main';

export const CALENDAR_VIEW = 'task-calendar-view';

// Squelette : remplace par le vrai calendrier a la tache 6.
export class CalendarView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: TaskCalendarPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return CALENDAR_VIEW;
  }

  getDisplayText(): string {
    return 'Calendrier des tâches';
  }

  getIcon(): string {
    return 'calendar-days';
  }

  async onOpen(): Promise<void> {
    this.render();
    this.register(this.plugin.store.onChange(() => this.render()));
  }

  private render(): void {
    const { store } = this.plugin;
    this.contentEl.empty();
    this.contentEl.createEl('p', {
      text: store.fileExists
        ? `${store.path()} : ${store.index.days.size} jours indexés.`
        : `Fichier introuvable : ${store.path()}`,
    });
  }
}
