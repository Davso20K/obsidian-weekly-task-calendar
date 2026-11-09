import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import { t } from './i18n';
import type { Lang } from './i18n';
import type TaskCalendarPlugin from './main';

export type HeaderLangSetting = 'auto' | Lang;

export interface TaskCalendarSettings {
  filePath: string;
  /** Langue des mots ecrits dans le fichier ("Week of" / "Semaine du", noms de jours). */
  headerLang: HeaderLangSetting;
  backupDone: boolean;
}

export const DEFAULT_SETTINGS: TaskCalendarSettings = {
  filePath: 'Tasks.md',
  headerLang: 'auto',
  backupDone: false,
};

export class TaskCalendarSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TaskCalendarPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t('settings.file'))
      .setDesc(t('settings.fileDesc'))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.filePath)
          .setValue(this.plugin.settings.filePath)
          .onChange(async (value) => {
            this.plugin.settings.filePath = value.trim() || DEFAULT_SETTINGS.filePath;
            await this.plugin.saveSettings();
            await this.plugin.store.load();
          }),
      );

    new Setting(containerEl)
      .setName(t('settings.lang'))
      .setDesc(t('settings.langDesc'))
      .addDropdown((dropdown) =>
        dropdown
          .addOption('auto', t('settings.langAuto'))
          .addOption('en', 'English')
          .addOption('fr', 'Français')
          .setValue(this.plugin.settings.headerLang)
          .onChange(async (value) => {
            this.plugin.settings.headerLang = value as HeaderLangSetting;
            await this.plugin.saveSettings();
          }),
      );
  }
}
