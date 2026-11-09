import { Notice, Plugin, moment, normalizePath } from 'obsidian';
import { todayIso } from './dates';
import { setLang, t } from './i18n';
import type { Lang } from './i18n';
import { DEFAULT_SETTINGS, TaskCalendarSettingTab } from './settings';
import type { TaskCalendarSettings } from './settings';
import { TaskStore } from './store';
import { CALENDAR_VIEW, CalendarView } from './views/calendar-view';
import { DAY_VIEW, DayPanel } from './views/day-panel';
import { DiagnosticModal } from './views/diagnostic-modal';

/** Langue de l'interface d'Obsidian : francais si elle commence par "fr", anglais sinon. */
function detectUiLang(): Lang {
  return moment.locale().toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export default class TaskCalendarPlugin extends Plugin {
  settings: TaskCalendarSettings = { ...DEFAULT_SETTINGS };
  store!: TaskStore;
  selectedDate = todayIso();
  private uiLang: Lang = 'en';

  private selectListeners = new Set<(date: string) => void>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.uiLang = detectUiLang();
    setLang(this.uiLang);
    this.store = new TaskStore(
      this.app,
      () => this.settings.filePath,
      (detected) => (this.settings.headerLang === 'auto' ? (detected ?? this.uiLang) : this.settings.headerLang),
    );
    this.store.attach(this);

    this.registerView(CALENDAR_VIEW, (leaf) => new CalendarView(leaf, this));
    this.registerView(DAY_VIEW, (leaf) => new DayPanel(leaf, this));
    this.addSettingTab(new TaskCalendarSettingTab(this.app, this));

    this.addRibbonIcon('calendar-days', t('main.ribbon'), () => {
      void this.openCalendar();
    });
    this.addCommand({
      id: 'open-calendar',
      name: t('main.cmdOpen'),
      callback: () => {
        void this.openCalendar();
      },
    });

    this.addCommand({
      id: 'diagnostic',
      name: t('main.cmdDiagnostic'),
      callback: () => {
        new DiagnosticModal(this.app, this.store.path(), this.store.index.diagnostics).open();
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
      new Notice(t('main.backupOk'));
    } catch (error) {
      console.error('Weekly Task Calendar: backup failed', error);
      new Notice(t('main.backupFail'));
    }
  }
}
