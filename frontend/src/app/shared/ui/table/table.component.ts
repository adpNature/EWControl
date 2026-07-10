import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';

export interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => string;
}

export type SortDirection = 'ascending' | 'descending';

export interface TableSortEvent {
  key: string;
  direction: SortDirection;
}

/**
 * Angular Component con estado (orden) y lógica de renderizado por columnas
 * (docs/12-convenciones-frontend.md, apartado 12.4). `<table>` semántica con
 * `aria-sort` en cabeceras ordenables (apartado 12.7) — no usa `.table-flex`
 * (layout.scss), reservado para listas genéricas sin semántica tabular.
 */
@Component({
  selector: 'app-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class TableComponent<T> {
  @Input({ required: true }) columns: TableColumn<T>[] = [];
  @Input({ required: true }) rows: T[] = [];
  @Input({ required: true }) rowKey!: (row: T) => string;
  @Input() emptyMessage = 'No hay elementos.';
  @Input() sortKey: string | null = null;
  @Input() sortDirection: SortDirection | null = null;
  @Input() actionsTemplate?: TemplateRef<{ $implicit: T }>;

  @Output() sortChange = new EventEmitter<TableSortEvent>();

  get totalColumns(): number {
    return this.columns.length + (this.actionsTemplate ? 1 : 0);
  }

  cellValue(column: TableColumn<T>, row: T): string {
    if (column.cell) {
      return column.cell(row);
    }
    const value = (row as Record<string, unknown>)[column.key];
    return value == null ? '' : String(value);
  }

  ariaSortFor(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortKey !== key || !this.sortDirection) {
      return 'none';
    }
    return this.sortDirection;
  }

  onSort(key: string): void {
    const nextDirection: SortDirection =
      this.sortKey === key && this.sortDirection === 'ascending' ? 'descending' : 'ascending';
    this.sortChange.emit({ key, direction: nextDirection });
  }
}
