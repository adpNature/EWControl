import { Component, EventEmitter, Input, Output } from '@angular/core';

export type HistoryRangePreset = 'hour' | 'day' | 'week' | 'month';

export type HistoryRange = { from: Date; to: Date };

const PRESET_HOURS: Record<HistoryRangePreset, number> = {
  hour: 1,
  day: 24,
  week: 24 * 7,
  month: 24 * 30,
};

const PRESETS: { value: HistoryRangePreset; label: string }[] = [
  { value: 'hour', label: 'Última hora' },
  { value: 'day', label: 'Último día' },
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mes' },
];

/**
 * Selector de rango temporal (docs/08-frontend-dashboard.md §8.7): emite
 * `from`/`to` calculados a partir de un preset; nunca calcula ni envía
 * `resolution` — esa decisión es siempre del Backend.
 */
@Component({
  selector: 'app-range-selector',
  standalone: true,
  templateUrl: './range-selector.component.html',
  styleUrl: './range-selector.component.scss',
})
export class RangeSelectorComponent {
  @Input() selected: HistoryRangePreset = 'hour';
  @Output() rangeChange = new EventEmitter<HistoryRange>();

  readonly presets = PRESETS;

  select(preset: HistoryRangePreset): void {
    this.selected = preset;
    const to = new Date();
    const from = new Date(to.getTime() - PRESET_HOURS[preset] * 60 * 60 * 1000);
    this.rangeChange.emit({ from, to });
  }
}
