import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TableColumn, TableComponent, TableSortEvent } from './table.component';

interface Row {
  id: string;
  name: string;
}

const COLUMNS: TableColumn<Row>[] = [{ key: 'name', header: 'Nombre', sortable: true }];

@Component({
  standalone: true,
  imports: [TableComponent],
  template: `
    <app-table
      [columns]="columns"
      [rows]="rows"
      [rowKey]="rowKey"
      [emptyMessage]="emptyMessage"
      [sortKey]="sortKey"
      [sortDirection]="sortDirection"
      [actionsTemplate]="withActions ? actions : undefined"
      (sortChange)="onSortChange($event)"
    />
    <ng-template #actions let-row>
      <button type="button">Eliminar {{ row.name }}</button>
    </ng-template>
  `,
})
class HostComponent {
  columns = COLUMNS;
  rows: Row[] = [];
  rowKey = (row: Row) => row.id;
  emptyMessage = 'No hay elementos.';
  sortKey: string | null = null;
  sortDirection: 'ascending' | 'descending' | null = null;
  withActions = false;
  lastSort: TableSortEvent | null = null;

  onSortChange(event: TableSortEvent): void {
    this.lastSort = event;
  }
}

describe('TableComponent', () => {
  it('renderiza una fila por elemento y sus columnas', async () => {
    await render(HostComponent, {
      componentProperties: { rows: [{ id: '1', name: 'Bobinadora 1' }] },
    });

    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Bobinadora 1' })).toBeInTheDocument();
  });

  it('muestra emptyMessage cuando no hay filas', async () => {
    await render(HostComponent, { componentProperties: { rows: [] } });

    expect(screen.getByText('No hay elementos.')).toBeInTheDocument();
  });

  it('al pulsar una cabecera ordenable emite sortChange y refleja aria-sort', async () => {
    const { fixture, rerender } = await render(HostComponent, {
      componentProperties: { rows: [{ id: '1', name: 'Bobinadora 1' }] },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Nombre' }));
    expect(fixture.componentInstance.lastSort).toEqual({ key: 'name', direction: 'ascending' });

    await rerender({
      componentProperties: {
        rows: [{ id: '1', name: 'Bobinadora 1' }],
        sortKey: 'name',
        sortDirection: 'ascending',
      },
    });
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('proyecta actionsTemplate por fila', async () => {
    await render(HostComponent, {
      componentProperties: { rows: [{ id: '1', name: 'Bobinadora 1' }], withActions: true },
    });

    expect(screen.getByRole('button', { name: 'Eliminar Bobinadora 1' })).toBeInTheDocument();
  });
});
