import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type TaskCalendarPlugin from './main';

export interface TaskCalendarSettings {
  filePath: string;
  backupDone: boolean;
}

export const DEFAULT_SETTINGS: TaskCalendarSettings = {
  filePath: 'Tâches/Toutes les tâches.md',
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
      .setName('Fichier des tâches')
      .setDesc(
        'Chemin du fichier Markdown lu et écrit par le calendrier, relatif à la racine du coffre. ' +
          'Seuls les blocs « Semaine du … » / jours / cases à cocher sont modifiés.',
      )
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
  }
}
