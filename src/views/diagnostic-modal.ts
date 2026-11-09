import { Modal } from 'obsidian';
import type { App } from 'obsidian';
import type { Diagnostic } from '../calendar-index';
import { t } from '../i18n';
import type { TKey } from '../i18n';

function messageOf(diagnostic: Diagnostic): string {
  const suffix = diagnostic.kind === 'unplaced-block' ? `.${diagnostic.params.reason}` : '';
  return t(`diag.msg.${diagnostic.kind}${suffix}` as TKey, diagnostic.params);
}

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
    contentEl.addClass('wtc-diagnostic');
    contentEl.createEl('h2', { text: t('diag.title') });
    contentEl.createEl('p', {
      text: `${this.path} — ${
        this.diagnostics.length === 0 ? t('diag.none') : t('diag.some', { count: this.diagnostics.length })
      }`,
      cls: 'wtc-diagnostic-intro',
    });
    if (this.diagnostics.length === 0) return;

    const table = contentEl.createEl('table');
    const head = table.createEl('thead').createEl('tr');
    for (const title of [t('diag.colLine'), t('diag.colKind'), t('diag.colDetail')]) {
      head.createEl('th', { text: title });
    }
    const body = table.createEl('tbody');
    for (const diagnostic of this.diagnostics) {
      const row = body.createEl('tr');
      row.createEl('td', { text: String(diagnostic.line) });
      row.createEl('td', { text: t(`diag.kind.${diagnostic.kind}` as TKey) });
      row.createEl('td', { text: messageOf(diagnostic) });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
