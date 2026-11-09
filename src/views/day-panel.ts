import { ItemView } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type TaskCalendarPlugin from '../main';

export const DAY_VIEW = 'task-calendar-day';

// Squelette : remplace par le vrai panneau a la tache 7.
export class DayPanel extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: TaskCalendarPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return DAY_VIEW;
  }

  getDisplayText(): string {
    return 'Tâches du jour';
  }

  getIcon(): string {
    return 'list-checks';
  }

  async onOpen(): Promise<void> {
    this.render();
    this.register(this.plugin.onSelect(() => this.render()));
    this.register(this.plugin.store.onChange(() => this.render()));
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.createEl('p', { text: `Jour sélectionné : ${this.plugin.selectedDate}` });
  }
}
