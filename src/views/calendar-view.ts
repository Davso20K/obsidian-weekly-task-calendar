import { ItemView, setIcon } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { buildMonthModel, cellSummaryText } from '../calendar-model';
import { todayIso } from '../dates';
import { formatHours } from '../hours';
import type TaskCalendarPlugin from '../main';

export const CALENDAR_VIEW = 'task-calendar-view';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export class CalendarView extends ItemView {
  private year: number;
  private month0: number;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: TaskCalendarPlugin,
  ) {
    super(leaf);
    const [year, month] = plugin.selectedDate.split('-').map(Number);
    this.year = year;
    this.month0 = month - 1;
  }

  getViewType(): string {
    return CALENDAR_VIEW;
  }

  getDisplayText(): string {
    return 'Calendrier des tâches';
  }

  getIcon(): string {
    return 'calendar-days';
  }

  async onOpen(): Promise<void> {
    this.render();
    this.register(this.plugin.store.onChange(() => this.render()));
    this.register(this.plugin.onSelect(() => this.render()));
  }

  private shiftMonth(delta: number): void {
    const moved = new Date(this.year, this.month0 + delta, 1);
    this.year = moved.getFullYear();
    this.month0 = moved.getMonth();
    this.render();
  }

  private goToToday(): void {
    const today = todayIso();
    const [year, month] = today.split('-').map(Number);
    this.year = year;
    this.month0 = month - 1;
    this.plugin.selectDate(today);
  }

  private render(): void {
    const { store } = this.plugin;
    const root = this.contentEl;
    root.empty();
    root.addClass('task-calendar');

    if (!store.fileExists) {
      const empty = root.createDiv({ cls: 'tc-empty' });
      empty.createEl('p', { text: `Fichier de tâches introuvable : ${store.path()}` });
      empty
        .createEl('button', { text: 'Créer le fichier', cls: 'mod-cta' })
        .addEventListener('click', () => void store.createFile());
      return;
    }

    const model = buildMonthModel(store.index, this.year, this.month0, todayIso());

    const header = root.createDiv({ cls: 'tc-header' });
    const previous = header.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Mois précédent' } });
    setIcon(previous, 'chevron-left');
    previous.addEventListener('click', () => this.shiftMonth(-1));
    header.createEl('h2', { text: model.label, cls: 'tc-title' });
    const next = header.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Mois suivant' } });
    setIcon(next, 'chevron-right');
    next.addEventListener('click', () => this.shiftMonth(1));
    header
      .createEl('button', { text: "Aujourd'hui", cls: 'tc-today-button' })
      .addEventListener('click', () => this.goToToday());

    const grid = root.createDiv({ cls: 'tc-grid' });
    for (const label of [...WEEKDAY_LABELS, 'Total']) {
      grid.createDiv({ text: label, cls: 'tc-weekday' });
    }

    for (const week of model.weeks) {
      week.cells.forEach((cellModel, column) => {
        const cell = grid.createDiv({ cls: 'tc-cell', attr: { role: 'button', tabindex: '0' } });
        if (!cellModel.inMonth) cell.addClass('is-outside');
        if (column >= 5) cell.addClass('is-weekend');
        if (cellModel.isToday) cell.addClass('is-today');
        if (cellModel.date === this.plugin.selectedDate) cell.addClass('is-selected');
        if (cellModel.total > 0 && cellModel.done === cellModel.total) cell.addClass('is-complete');

        cell.createDiv({ text: String(cellModel.dayOfMonth), cls: 'tc-day-number' });
        cell.createDiv({ text: cellSummaryText(cellModel), cls: 'tc-summary' });

        const choose = (): void => {
          if (!cellModel.inMonth) {
            const [year, month] = cellModel.date.split('-').map(Number);
            this.year = year;
            this.month0 = month - 1;
          }
          this.plugin.selectDate(cellModel.date);
          void this.plugin.openDayPanel();
        };
        cell.addEventListener('click', choose);
        cell.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            choose();
          }
        });
      });
      grid.createDiv({
        text: week.minutes > 0 ? formatHours(week.minutes) : '',
        cls: 'tc-week-total',
      });
    }
  }
}
