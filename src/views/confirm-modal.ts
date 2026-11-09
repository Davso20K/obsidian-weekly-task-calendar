import { Modal } from 'obsidian';
import type { App } from 'obsidian';

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly message: string,
    private readonly confirmLabel: string,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('p', { text: this.message });
    const footer = contentEl.createDiv({ cls: 'tc-pick-footer' });
    footer.createEl('button', { text: 'Annuler' }).addEventListener('click', () => this.close());
    footer.createEl('button', { text: this.confirmLabel, cls: 'mod-warning' }).addEventListener('click', () => {
      this.close();
      this.onConfirm();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
