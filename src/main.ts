import { Notice, Plugin, normalizePath } from 'obsidian';
import { todayIso } from './dates';
import { DEFAULT_SETTINGS, TaskCalendarSettingTab } from './settings';
import type { TaskCalendarSettings } from './settings';
import { TaskStore } from './store';
import { CALENDAR_VIEW, CalendarView } from './views/calendar-view';
import { DAY_VIEW, DayPanel } from './views/day-panel';

export default class TaskCalendarPlugin extends Plugin {
  settings: TaskCalendarSettings = { ...DEFAULT_SETTINGS };
  store!: TaskStore;
  selectedDate = todayIso();

  private selectListeners = new Set<(date: string) => void>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new TaskStore(this.app, () => this.settings.filePath);
    this.store.attach(this);

    this.registerView(CALENDAR_VIEW, (leaf) => new CalendarView(leaf, this));
    this.registerView(DAY_VIEW, (leaf) => new DayPanel(leaf, this));
    this.addSettingTab(new TaskCalendarSettingTab(this.app, this));

    this.addRibbonIcon('calendar-days', 'Ouvrir le calendrier des tâches', () => {
      void this.openCalendar();
    });
    this.addCommand({
      id: 'open-calendar',
      name: 'Ouvrir le calendrier des tâches',
      callback: () => {
        void this.openCalendar();
      },
    });

    this.app.workspace.onLayoutReady(() => {
      void this.start();
    });
  }

  private async start(): Promise<void> {
    await this.store.load();
    await this.backupOnce();
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** S'abonne aux changements de jour selectionne. Renvoie la fonction de desabonnement. */
  onSelect(callback: (date: string) => void): () => void {
    this.selectListeners.add(callback);
    return () => this.selectListeners.delete(callback);
  }

  selectDate(date: string): void {
    this.selectedDate = date;
    for (const listener of [...this.selectListeners]) listener(date);
  }

  async openCalendar(): Promise<void> {
    const { workspace } = this.app;
    const leaf = workspace.getLeavesOfType(CALENDAR_VIEW)[0] ?? workspace.getLeaf(true);
    await leaf.setViewState({ type: CALENDAR_VIEW, active: true });
    await workspace.revealLeaf(leaf);
  }

  async openDayPanel(): Promise<void> {
    const { workspace } = this.app;
    const leaf = workspace.getLeavesOfType(DAY_VIEW)[0] ?? workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: DAY_VIEW, active: true });
    await workspace.revealLeaf(leaf);
  }

  /** Copie de securite du fichier de taches a la toute premiere activation. */
  private async backupOnce(): Promise<void> {
    if (this.settings.backupDone || !this.store.fileExists || !this.manifest.dir) return;
    try {
      const adapter = this.app.vault.adapter;
      const dir = normalizePath(`${this.manifest.dir}/backup`);
      if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = this.store.path().split('/').pop()?.replace(/\.md$/, '') ?? 'taches';
      await adapter.write(normalizePath(`${dir}/${name}.${stamp}.md`), await adapter.read(this.store.path()));
      this.settings.backupDone = true;
      await this.saveSettings();
      new Notice('Task Calendar : copie de sécurité du fichier de tâches créée.');
    } catch (error) {
      console.error('Task Calendar : sauvegarde impossible', error);
      new Notice('Task Calendar : la copie de sécurité a échoué (voir la console).');
    }
  }
}
