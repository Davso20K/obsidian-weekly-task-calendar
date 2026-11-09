import { ItemView, Notice } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { buildDayModel } from '../calendar-model';
import type { DayRowModel } from '../calendar-model';
import type { Doc } from '../doc';
import { parseHoursInput } from '../hours';
import type TaskCalendarPlugin from '../main';
import { addTask, updateTask } from '../ops';

export const DAY_VIEW = 'task-calendar-day';

type Field = 'text' | 'hours' | 'done';
interface FocusTarget {
  index: number | 'last';
  field: Field;
  start?: number | null;
  end?: number | null;
}

const ZERO_HOURS = /^0+(?:[.,]0+)?\s*(?:h|min)?$/i;

export class DayPanel extends ItemView {
  private pendingFocus: FocusTarget | null = null;
  private renderDeferred = false;

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
    this.contentEl.addClass('task-calendar-day');
    this.render();
    this.register(this.plugin.onSelect(() => this.render()));
    this.register(this.plugin.store.onChange(() => this.render()));
    // Une mise a jour externe differee pendant une saisie est rejouee quand le champ perd le focus.
    this.registerDomEvent(this.contentEl, 'focusout', () => {
      window.setTimeout(() => {
        if (this.renderDeferred && !this.isTyping()) {
          this.renderDeferred = false;
          this.render();
        }
      }, 0);
    });
  }

  /** Vrai si l'utilisateur est en train de saisir dans un champ du panneau (valeur non validee). */
  private isTyping(): boolean {
    const active = document.activeElement;
    return (
      active instanceof HTMLInputElement &&
      this.contentEl.contains(active) &&
      active.type === 'text' &&
      active.value !== active.dataset.initial
    );
  }

  private captureFocus(): FocusTarget | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement) || !this.contentEl.contains(active)) return null;
    const { row, field } = active.dataset;
    if (row === undefined || field === undefined) return null;
    return {
      index: Number(row),
      field: field as Field,
      start: active.type === 'text' ? active.selectionStart : null,
      end: active.type === 'text' ? active.selectionEnd : null,
    };
  }

  private restoreFocus(target: FocusTarget | null): void {
    if (!target) return;
    const candidates = Array.from(
      this.contentEl.querySelectorAll<HTMLInputElement>(`input[data-field="${target.field}"]`),
    );
    const element =
      target.index === 'last'
        ? candidates[candidates.length - 1]
        : candidates.find((input) => input.dataset.row === String(target.index));
    if (!element) return;
    element.focus();
    if (element.type === 'text' && target.start != null && target.end != null) {
      element.setSelectionRange(target.start, target.end);
    }
  }

  private async run(focus: FocusTarget | null, edit: (doc: Doc) => Doc): Promise<void> {
    this.pendingFocus = focus;
    try {
      await this.plugin.store.edit(edit);
    } finally {
      this.pendingFocus = null;
    }
  }

  private async addNew(): Promise<void> {
    const date = this.plugin.selectedDate;
    await this.run({ index: 'last', field: 'text' }, (doc) =>
      addTask(doc, date, { text: '', minutes: null }),
    );
  }

  private render(): void {
    if (this.isTyping()) {
      this.renderDeferred = true;
      return;
    }
    const focus = this.pendingFocus ?? this.captureFocus();
    this.pendingFocus = null;

    const { store } = this.plugin;
    const root = this.contentEl;
    root.empty();

    if (!store.fileExists) {
      root.createEl('p', { text: `Fichier de tâches introuvable : ${store.path()}` });
      return;
    }

    const model = buildDayModel(store.index, this.plugin.selectedDate);
    root.createEl('h3', { text: model.title, cls: 'tc-day-title' });
    if (model.summary.total > 0) {
      root.createDiv({
        text: `${model.summary.done}/${model.summary.total} faites`,
        cls: 'tc-day-summary',
      });
    }

    const list = root.createDiv({ cls: 'tc-rows' });
    if (model.rows.length === 0) {
      list.createDiv({ text: 'Aucune tâche ce jour.', cls: 'tc-no-task' });
    }
    model.rows.forEach((row, position) => {
      this.renderRow(list, row, position === model.rows.length - 1);
    });

    root.createEl('button', { text: '+ Ajouter une tâche', cls: 'tc-add' }).addEventListener('click', () => {
      void this.addNew();
    });

    if (model.freeLines.length > 0) {
      const notes = root.createEl('details', { cls: 'tc-notes' });
      notes.createEl('summary', { text: `Notes du jour (${model.freeLines.length} lignes, lecture seule)` });
      notes.createEl('pre', { text: model.freeLines.join('\n') });
    }

    this.restoreFocus(focus);
  }

  private renderRow(list: HTMLElement, row: DayRowModel, isLast: boolean): void {
    const rowEl = list.createDiv({ cls: 'tc-row' });
    rowEl.style.paddingLeft = `${row.depth * 1.5}rem`;
    if (row.done) rowEl.addClass('is-done');
    const key = String(row.ref.index);

    const box = rowEl.createEl('input', { type: 'checkbox', attr: { 'data-row': key, 'data-field': 'done' } });
    box.checked = row.done;
    box.addEventListener('change', () => {
      // Cocher une tache sans heures place le curseur sur ses heures : on quantifie en finissant.
      const needsHours = box.checked && row.hoursText === '' && !row.hoursUnrecognized && !row.empty;
      void this.run(needsHours ? { index: row.ref.index, field: 'hours' } : null, (doc) =>
        updateTask(doc, row.ref, { done: box.checked }),
      );
    });

    const text = rowEl.createEl('input', {
      type: 'text',
      cls: 'tc-text',
      value: row.text,
      placeholder: 'Tâche…',
      attr: { 'data-row': key, 'data-field': 'text' },
    });
    text.dataset.initial = row.text;

    const hours = rowEl.createEl('input', {
      type: 'text',
      cls: 'tc-hours',
      value: row.hoursText,
      placeholder: 'h',
      attr: { 'data-row': key, 'data-field': 'hours', 'aria-label': 'Heures (ex. 2h30)' },
    });
    hours.dataset.initial = row.hoursText;

    if (row.hoursUnrecognized) {
      rowEl.createSpan({
        text: '⚠',
        cls: 'tc-warning',
        attr: { title: 'Heures non reconnues : laissées dans le texte, exclues des totaux.' },
      });
    }

    const commitText = async (): Promise<void> => {
      const value = text.value.trim();
      text.dataset.initial = text.value;
      if (value === row.text) return;
      row.text = value;
      await this.run(null, (doc) => updateTask(doc, row.ref, { text: value }));
    };

    const commitHours = async (): Promise<void> => {
      const raw = hours.value.trim();
      hours.dataset.initial = hours.value;
      if (raw === row.hoursText) return;
      let minutes: number | null = null;
      if (raw !== '' && !ZERO_HOURS.test(raw)) {
        minutes = parseHoursInput(raw);
        if (minutes === null) {
          new Notice('Heures invalides. Exemples : 2h30, 1,5, 45min.');
          hours.value = row.hoursText;
          hours.dataset.initial = row.hoursText;
          return;
        }
      }
      if (minutes === null && row.hoursText === '') {
        hours.value = '';
        hours.dataset.initial = '';
        return;
      }
      row.hoursText = raw;
      await this.run(null, (doc) => updateTask(doc, row.ref, { minutes }));
    };

    text.addEventListener('blur', () => void commitText());
    text.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        text.value = row.text;
        text.dataset.initial = row.text;
        text.blur();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void (async () => {
          await commitText();
          if (isLast && text.value.trim() !== '') await this.addNew();
          else text.blur();
        })();
      }
    });

    hours.addEventListener('blur', () => void commitHours());
    hours.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hours.value = row.hoursText;
        hours.dataset.initial = row.hoursText;
        hours.blur();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void commitHours().then(() => hours.blur());
      }
    });
  }
}
