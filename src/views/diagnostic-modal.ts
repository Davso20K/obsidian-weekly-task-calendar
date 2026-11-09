import { Modal } from 'obsidian';
import type { App } from 'obsidian';
import type { Diagnostic } from '../calendar-index';

const KIND_LABELS: Record<Diagnostic['kind'], string> = {
  'week-header-not-monday': 'En-tête de semaine hors lundi',
  'day-date-mismatch': 'Date de jour incohérente',
  'duplicate-week': 'Semaine en double',
  'duplicate-day': 'Jour en double',
  'ambiguous-hours': 'Heures non reconnues',
  'unplaced-block': 'Bloc non placé',
};

/** Liste les incoherences du fichier. Ne corrige rien. */
export class DiagnosticModal extends Modal {
  constructor(
    app: App,
    private readonly path: string,
    private readonly diagnostics: Diagnostic[],
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tc-diagnostic');
    contentEl.createEl('h2', { text: 'Task Calendar : diagnostic' });
    contentEl.createEl('p', {
      text: `${this.path} — ${
        this.diagnostics.length === 0
          ? 'aucune anomalie.'
          : `${this.diagnostics.length} anomalie(s). Le fichier n'est pas modifié.`
      }`,
      cls: 'tc-diagnostic-intro',
    });
    if (this.diagnostics.length === 0) return;

    const table = contentEl.createEl('table');
    const head = table.createEl('thead').createEl('tr');
    for (const title of ['Ligne', 'Nature', 'Détail']) head.createEl('th', { text: title });
    const body = table.createEl('tbody');
    for (const diagnostic of this.diagnostics) {
      const row = body.createEl('tr');
      row.createEl('td', { text: String(diagnostic.line) });
      row.createEl('td', { text: KIND_LABELS[diagnostic.kind] });
      row.createEl('td', { text: diagnostic.message });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
