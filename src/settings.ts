import { PluginSettingTab } from 'obsidian';
import type { App, SettingDefinitionItem } from 'obsidian';
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

const isHeaderLang = (value: unknown): value is HeaderLangSetting =>
  value === 'auto' || value === 'fr' || value === 'en';

/** Onglet de reglages declaratif : les reglages apparaissent aussi dans la recherche d'Obsidian. */
export class TaskCalendarSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TaskCalendarPlugin,
  ) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: t('settings.file'),
        desc: t('settings.fileDesc'),
        control: {
          type: 'text',
          key: 'filePath',
          placeholder: DEFAULT_SETTINGS.filePath,
          defaultValue: DEFAULT_SETTINGS.filePath,
        },
      },
      {
        name: t('settings.lang'),
        desc: t('settings.langDesc'),
        control: {
          type: 'dropdown',
          key: 'headerLang',
          defaultValue: DEFAULT_SETTINGS.headerLang,
          options: { auto: t('settings.langAuto'), en: 'English', fr: 'Français' },
        },
      },
    ];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'filePath' && typeof value === 'string') {
      this.plugin.settings.filePath = value.trim() || DEFAULT_SETTINGS.filePath;
      await this.plugin.saveSettings();
      await this.plugin.store.load();
    } else if (key === 'headerLang' && isHeaderLang(value)) {
      this.plugin.settings.headerLang = value;
      await this.plugin.saveSettings();
    }
  }
}
