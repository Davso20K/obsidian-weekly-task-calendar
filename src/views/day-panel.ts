import { ItemView, Menu, Notice, setIcon } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { buildDayModel } from '../calendar-model';
import type { DayRowModel } from '../calendar-model';
import { mondayOf } from '../dates';
import type { Doc } from '../doc';
import { parseHoursInput } from '../hours';
import { t } from '../i18n';
import type TaskCalendarPlugin from '../main';
import { addTask, copyTask, moveTask, removeTask, setDepth, updateTask } from '../ops';
import { ConfirmModal } from './confirm-modal';
import { PickDateModal } from './pick-date-modal';

export const DAY_VIEW = 'weekly-task-calendar-day';

type Field = 'text' | 'hours' | 'done';
interface FocusTarget {
  index: number | 'last';
  field: Field;
  start?: number | null;
  end?: number | null;
}

const ZERO_HOURS = /^0+(?:[.,]0+)?\s*(?:h|min)?$/i;

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** `instanceof` ne fonctionne pas entre fenetres (popout) : on teste la balise. */
function asTextField(element: Element | null): TextField | null {
  if (!element) return null;
  if (element.tagName === 'TEXTAREA') return element as HTMLTextAreaElement;
  if (element.tagName === 'INPUT') return element as HTMLInputElement;
  return null;
}

/** Champ de saisie de texte (et non une case a cocher). */
const isTextual = (field: TextField): boolean => field.tagName === 'TEXTAREA' || field.type === 'text';

/** Le texte d'une tache passe a la ligne : la hauteur suit le contenu. */
function fitTextarea(field: HTMLTextAreaElement): void {
  field.addClass('wtc-measuring'); // hauteur automatique le temps de mesurer le contenu
  const height = field.scrollHeight;
  field.removeClass('wtc-measuring');
  field.setCssProps({ height: `${height}px` });
}

export class DayPanel extends ItemView {
  private pendingFocus: FocusTarget | null = null;
  private renderDeferred = false;
  /** Vrai tant qu'un bouton de souris est enfonce : redessiner maintenant ferait perdre le clic. */
  private pointerDown = false;
  /** Les ecritures s'executent une par une, dans l'ordre ou l'utilisateur les a declenchees. */
  private chain: Promise<void> = Promise.resolve();

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
    return t('day.title');
  }

  getIcon(): string {
    return 'list-checks';
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass('wtc-day-panel');
    this.render();
    this.register(this.plugin.onSelect(() => this.render()));
    this.register(this.plugin.store.onChange(() => this.render()));
    // Un rendu differe (saisie en cours, clic en cours) est rejoue des que c'est possible.
    const { doc, win } = this.contentEl;
    this.registerDomEvent(this.contentEl, 'focusout', () => win.setTimeout(() => this.flushDeferred(), 0));
    this.registerDomEvent(this.contentEl, 'pointerdown', () => {
      this.pointerDown = true;
    });
    const release = (): void => {
      win.setTimeout(() => {
        this.pointerDown = false;
        this.flushDeferred();
      }, 0);
    };
    this.registerDomEvent(doc, 'pointerup', release);
    this.registerDomEvent(doc, 'pointercancel', release);
    // La largeur du panneau change le retour a la ligne : on reajuste la hauteur des champs.
    const observer = new ResizeObserver(() => this.fitTextareas());
    observer.observe(this.contentEl);
    this.register(() => observer.disconnect());
  }

  private fitTextareas(): void {
    this.contentEl.querySelectorAll<HTMLTextAreaElement>('textarea.wtc-text').forEach(fitTextarea);
  }

  private flushDeferred(): void {
    if (this.renderDeferred && !this.pointerDown && !this.isTyping()) {
      this.renderDeferred = false;
      this.render();
    }
  }

  /** Vrai si l'utilisateur est en train de saisir dans un champ du panneau (valeur non validee). */
  private isTyping(): boolean {
    const active = asTextField(this.contentEl.doc.activeElement);
    return (
      active !== null &&
      this.contentEl.contains(active) &&
      isTextual(active) &&
      active.value !== active.dataset.initial
    );
  }

  private captureFocus(): FocusTarget | null {
    const active = asTextField(this.contentEl.doc.activeElement);
    if (!active || !this.contentEl.contains(active)) return null;
    const { row, field } = active.dataset;
    if (row === undefined || field === undefined) return null;
    return {
      index: Number(row),
      field: field as Field,
      start: isTextual(active) ? active.selectionStart : null,
      end: isTextual(active) ? active.selectionEnd : null,
    };
  }

  private restoreFocus(target: FocusTarget | null): void {
    if (!target) return;
    const candidates = Array.from(
      this.contentEl.querySelectorAll<TextField>(`[data-field="${target.field}"]`),
    );
    const element =
      target.index === 'last'
        ? candidates[candidates.length - 1]
        : candidates.find((input) => input.dataset.row === String(target.index));
    if (!element) return;
    element.focus();
    if (isTextual(element) && target.start != null && target.end != null) {
      element.setSelectionRange(target.start, target.end);
    }
  }

  private run(focus: FocusTarget | null, edit: (doc: Doc) => Doc): Promise<void> {
    const task = this.chain.then(async () => {
      this.pendingFocus = focus;
      try {
        await this.plugin.store.edit(edit);
      } catch (error) {
        if (error instanceof Error && error.message === 'no-parent') {
          new Notice(t('day.noParent'));
        } else {
          console.error('Weekly Task Calendar: operation failed', error);
          new Notice(t('day.opFailed'));
        }
      } finally {
        this.pendingFocus = null;
      }
    });
    this.chain = task; // les erreurs sont traitees ci-dessus : la chaine ne rejette jamais
    return task;
  }

  /**
   * Ligne attendue apres une edition de `row`. Permet d'enchainer une seconde action sur la meme ligne
   * (ex. saisir un texte puis cocher) sans attendre le redessin, sans contourner la garde « ligne perimee ».
   */
  private predictRef(row: DayRowModel, patch: { text?: string; minutes?: number | null }): void {
    try {
      const next = updateTask(this.plugin.store.doc, row.ref, patch);
      row.ref = { index: row.ref.index, raw: next.lines[row.ref.index].raw };
    } catch {
      // ligne deja perimee : l'ecriture echouera proprement et rechargera la vue
    }
  }

  private pickMove(row: DayRowModel): void {
    const date = this.plugin.selectedDate;
    new PickDateModal(this.app, {
      title: t('pick.moveTitle'),
      multiple: false,
      weekMonday: mondayOf(date),
      fromDate: date,
      onSubmit: ([target]) => void this.run(null, (doc) => moveTask(doc, row.ref, target)),
    }).open();
  }

  private pickCopy(row: DayRowModel): void {
    const date = this.plugin.selectedDate;
    new PickDateModal(this.app, {
      title: t('pick.copyTitle'),
      multiple: true,
      weekMonday: mondayOf(date),
      fromDate: date,
      onSubmit: (targets) => void this.run(null, (doc) => copyTask(doc, row.ref, targets)),
    }).open();
  }

  private remove(row: DayRowModel, hasChildren: boolean): void {
    const doRemove = (): void => void this.run(null, (doc) => removeTask(doc, row.ref));
    if (!hasChildren) {
      doRemove();
      return;
    }
    new ConfirmModal(this.app, t('day.confirmDelete'), t('day.menuDelete'), doRemove).open();
  }

  private openMenu(event: MouseEvent, row: DayRowModel, hasChildren: boolean): void {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle(t('day.menuMove')).setIcon('arrow-right').onClick(() => this.pickMove(row)));
    menu.addItem((item) => item.setTitle(t('day.menuCopy')).setIcon('copy').onClick(() => this.pickCopy(row)));
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle(t('day.menuDelete')).setIcon('trash-2').onClick(() => this.remove(row, hasChildren)),
    );
    menu.showAtMouseEvent(event);
  }

  private async addNew(): Promise<void> {
    const date = this.plugin.selectedDate;
    await this.run({ index: 'last', field: 'text' }, (doc) =>
      addTask(doc, date, { text: '', minutes: null }),
    );
  }

  private render(): void {
    if (this.pointerDown || this.isTyping()) {
      this.renderDeferred = true;
      return;
    }
    const focus = this.pendingFocus ?? this.captureFocus();
    this.pendingFocus = null;

    const { store } = this.plugin;
    const root = this.contentEl;
    root.empty();

    if (!store.fileExists) {
      root.createEl('p', { text: t('calendar.fileMissing', { path: store.path() }) });
      return;
    }

    const model = buildDayModel(store.index, this.plugin.selectedDate);
    root.createEl('h3', { text: model.title, cls: 'wtc-day-title' });
    if (model.summary.total > 0) {
      root.createDiv({
        text: t('day.done', { done: model.summary.done, total: model.summary.total }),
        cls: 'wtc-day-summary',
      });
    }

    const list = root.createDiv({ cls: 'wtc-rows' });
    if (model.rows.length === 0) {
      list.createDiv({ text: t('day.none'), cls: 'wtc-no-task' });
    }
    model.rows.forEach((row, position) => {
      const hasChildren = (model.rows[position + 1]?.depth ?? 0) > row.depth;
      this.renderRow(list, row, position, position === model.rows.length - 1, hasChildren);
    });

    root.createEl('button', { text: t('day.add'), cls: 'wtc-add' }).addEventListener('click', () => {
      void this.addNew();
    });

    if (model.freeLines.length > 0) {
      const notes = root.createEl('details', { cls: 'wtc-notes' });
      notes.createEl('summary', { text: t('day.notes', { count: model.freeLines.length }) });
      notes.createEl('pre', { text: model.freeLines.join('\n') });
    }

    this.fitTextareas();
    this.restoreFocus(focus);
  }

  private renderRow(
    list: HTMLElement,
    row: DayRowModel,
    position: number,
    isLast: boolean,
    hasChildren: boolean,
  ): void {
    const rowEl = list.createDiv({ cls: 'wtc-row' });
    rowEl.setCssProps({ '--wtc-depth': String(row.depth) });
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

    const text = rowEl.createEl('textarea', {
      cls: 'wtc-text',
      placeholder: t('day.taskPlaceholder'),
      attr: { rows: '1', 'data-row': key, 'data-field': 'text' },
    });
    text.value = row.text;
    text.dataset.initial = row.text;
    text.addEventListener('input', () => fitTextarea(text));

    const hours = rowEl.createEl('input', {
      type: 'text',
      cls: 'wtc-hours',
      value: row.hoursText,
      placeholder: 'h',
      attr: { 'data-row': key, 'data-field': 'hours', 'aria-label': t('day.hoursLabel') },
    });
    hours.dataset.initial = row.hoursText;

    if (row.hoursUnrecognized) {
      rowEl.createSpan({
        text: '⚠',
        cls: 'wtc-warning',
        attr: { title: t('day.hoursUnrecognized') },
      });
    }

    const indent = rowEl.createEl('button', {
      cls: 'clickable-icon wtc-indent',
      attr: { 'aria-label': row.depth === 0 ? t('day.indent') : t('day.outdent') },
    });
    setIcon(indent, row.depth === 0 ? 'indent-increase' : 'indent-decrease');
    if (row.depth === 0 && position === 0) indent.disabled = true;
    indent.addEventListener('click', () => {
      void this.run(null, (doc) => setDepth(doc, row.ref, row.depth === 0 ? 1 : 0));
    });

    const more = rowEl.createEl('button', {
      text: '⋯',
      cls: 'clickable-icon wtc-more',
      attr: { 'aria-label': t('day.more') },
    });
    more.addEventListener('click', (event) => this.openMenu(event, row, hasChildren));

    const commitText = async (): Promise<void> => {
      const value = text.value.replace(/\s*[\r\n]+\s*/g, ' ').trim();
      text.dataset.initial = text.value;
      if (value === row.text) return;
      const before = row.ref;
      row.text = value;
      this.predictRef(row, { text: value });
      await this.run(null, (doc) => updateTask(doc, before, { text: value }));
    };

    const commitHours = async (): Promise<void> => {
      const raw = hours.value.trim();
      hours.dataset.initial = hours.value;
      if (raw === row.hoursText) return;
      let minutes: number | null = null;
      if (raw !== '' && !ZERO_HOURS.test(raw)) {
        minutes = parseHoursInput(raw);
        if (minutes === null) {
          new Notice(t('day.invalidHours'));
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
      const before = row.ref;
      row.hoursText = raw;
      this.predictRef(row, { minutes });
      await this.run(null, (doc) => updateTask(doc, before, { minutes }));
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
