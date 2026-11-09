import { ItemView, setIcon } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { buildMonthModel, cellSummaryText } from '../calendar-model';
import { todayIso, weekdayName } from '../dates';
import { formatHours } from '../hours';
import { getLang, t } from '../i18n';
import type TaskCalendarPlugin from '../main';

export const CALENDAR_VIEW = 'weekly-task-calendar-view';

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
    return t('calendar.title');
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
    root.addClass('wtc-calendar');

    if (!store.fileExists) {
      const empty = root.createDiv({ cls: 'wtc-empty' });
      empty.createEl('p', { text: t('calendar.fileMissing', { path: store.path() }) });
      empty
        .createEl('button', { text: t('calendar.createFile'), cls: 'mod-cta' })
        .addEventListener('click', () => void store.createFile());
      return;
    }

    const model = buildMonthModel(store.index, this.year, this.month0, todayIso());

    const header = root.createDiv({ cls: 'wtc-header' });
    const previous = header.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': t('calendar.prevMonth') } });
    setIcon(previous, 'chevron-left');
    previous.addEventListener('click', () => this.shiftMonth(-1));
    header.createEl('h2', { text: model.label, cls: 'wtc-title' });
    const next = header.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': t('calendar.nextMonth') } });
    setIcon(next, 'chevron-right');
    next.addEventListener('click', () => this.shiftMonth(1));
    header
      .createEl('button', { text: t('calendar.today'), cls: 'wtc-today-button' })
      .addEventListener('click', () => this.goToToday());

    const grid = root.createDiv({ cls: 'wtc-grid' });
    const weekdayLabels = Array.from({ length: 7 }, (_, i) => weekdayName(i, getLang()).slice(0, 3));
    for (const label of [...weekdayLabels, t('calendar.total')]) {
      grid.createDiv({ text: label, cls: 'wtc-weekday' });
    }

    for (const week of model.weeks) {
      week.cells.forEach((cellModel, column) => {
        const cell = grid.createDiv({ cls: 'wtc-cell', attr: { role: 'button', tabindex: '0' } });
        if (!cellModel.inMonth) cell.addClass('is-outside');
        if (column >= 5) cell.addClass('is-weekend');
        if (cellModel.isToday) cell.addClass('is-today');
        if (cellModel.date === this.plugin.selectedDate) cell.addClass('is-selected');
        if (cellModel.total > 0 && cellModel.done === cellModel.total) cell.addClass('is-complete');

        cell.createDiv({ text: String(cellModel.dayOfMonth), cls: 'wtc-day-number' });
        cell.createDiv({ text: cellSummaryText(cellModel), cls: 'wtc-summary' });

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
        cls: 'wtc-week-total',
      });
    }
  }
}
