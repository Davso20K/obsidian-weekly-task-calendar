import { Modal, Notice } from 'obsidian';
import type { App } from 'obsidian';
import { WEEKDAYS_FR, addDays, formatFrDate, parseFrDate, weekdayIndex } from '../dates';

export interface PickDateOptions {
  title: string;
  /** true : plusieurs jours (copie) ; false : un seul jour (report). */
  multiple: boolean;
  /** Lundi de la semaine proposee. */
  weekMonday: string;
  /** Jour d'origine : propose « Demain » et ne peut pas etre choisi en mode simple. */
  fromDate: string;
  onSubmit: (dates: string[]) => void;
}

export class PickDateModal extends Modal {
  private readonly selected = new Set<string>();
  private freeInput: HTMLInputElement | null = null;

  constructor(
    app: App,
    private readonly opts: PickDateOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tc-pick-date');
    contentEl.createEl('h2', { text: this.opts.title });

    if (!this.opts.multiple) {
      const tomorrow = addDays(this.opts.fromDate, 1);
      contentEl
        .createEl('button', {
          text: `Demain (${WEEKDAYS_FR[weekdayIndex(tomorrow)]} ${formatFrDate(tomorrow)})`,
          cls: 'mod-cta',
        })
        .addEventListener('click', () => this.finish([tomorrow]));
    }

    const days = contentEl.createDiv({ cls: 'tc-pick-days' });
    for (let offset = 0; offset < 7; offset++) {
      const date = addDays(this.opts.weekMonday, offset);
      const label = `${WEEKDAYS_FR[offset]} ${formatFrDate(date)}`;
      if (this.opts.multiple) {
        const row = days.createEl('label', { cls: 'tc-pick-day' });
        const box = row.createEl('input', { type: 'checkbox' });
        row.createSpan({ text: label });
        box.addEventListener('change', () => {
          if (box.checked) this.selected.add(date);
          else this.selected.delete(date);
        });
      } else {
        const button = days.createEl('button', { text: label, cls: 'tc-pick-day' });
        if (date === this.opts.fromDate) button.disabled = true;
        button.addEventListener('click', () => this.finish([date]));
      }
    }

    const free = contentEl.createDiv({ cls: 'tc-pick-free' });
    free.createSpan({ text: 'Autre jour :' });
    this.freeInput = free.createEl('input', { type: 'text', placeholder: 'JJ/MM/AAAA' });
    this.freeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.submit();
      }
    });

    const footer = contentEl.createDiv({ cls: 'tc-pick-footer' });
    footer.createEl('button', { text: 'Annuler' }).addEventListener('click', () => this.close());
    footer
      .createEl('button', { text: this.opts.multiple ? 'Copier' : 'Reporter', cls: 'mod-cta' })
      .addEventListener('click', () => this.submit());
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private submit(): void {
    const dates = new Set(this.selected);
    const raw = this.freeInput?.value.trim() ?? '';
    if (raw !== '') {
      const parsed = parseFrDate(raw);
      if (parsed === null) {
        new Notice('Date invalide. Format attendu : JJ/MM/AAAA.');
        return;
      }
      dates.add(parsed);
    }
    if (dates.size === 0) {
      new Notice('Choisissez au moins un jour.');
      return;
    }
    this.finish([...dates].sort());
  }

  private finish(dates: string[]): void {
    this.close();
    this.opts.onSubmit(dates);
  }
}
