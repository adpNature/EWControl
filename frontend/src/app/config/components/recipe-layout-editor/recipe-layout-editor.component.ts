import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { RecipeTemplateVariable } from '../../../recipes/entities/recipe-template.model';
import {
  EditorItem,
  EditorRow,
  LAYOUT_COLUMNS,
  MAX_LAYOUT_TEXT_LENGTH,
  MAX_LAYOUT_TITLE_LENGTH,
  SPAN_OPTIONS,
  TemplateErrors,
  addItem,
  moveRow,
  moveToAdjacentRow,
  moveWithinRow,
  removeItem,
  rowWidth,
  spanLabel,
  transferItem,
  updateItem,
} from '../../../recipes/use-cases/recipe-template-rules';
import { variableLabel } from '../../../recipes/use-cases/recipe-rules';

const TYPE_LABELS: ReadonlyMap<EditorItem['type'], string> = new Map([
  ['VARIABLE', 'Variable'],
  ['TITLE', 'Título'],
  ['TEXT', 'Texto'],
  ['SPACER', 'Hueco'],
]);

/**
 * Pestaña «Disposición» de la receta base (docs/specs/26-receta-base.md):
 * filas de 12 columnas con sus elementos al ancho real, para ver la forma del
 * formulario mientras se edita. Cada elemento se mueve con botones (teclado y
 * lector de pantalla, con aviso en una región `aria-live`) o arrastrándolo
 * (`@angular/cdk/drag-drop`). No guarda nada: emite las filas cambiadas.
 */
@Component({
  selector: 'app-recipe-layout-editor',
  standalone: true,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, IconComponent],
  templateUrl: './recipe-layout-editor.component.html',
  styleUrl: './recipe-layout-editor.component.scss',
})
export class RecipeLayoutEditorComponent {
  @Input({ required: true }) rows: EditorRow[] = [];
  @Input({ required: true }) variables: RecipeTemplateVariable[] = [];
  @Input() errors: TemplateErrors | null = null;

  @Output() rowsChange = new EventEmitter<EditorRow[]>();

  readonly spanOptions = SPAN_OPTIONS;
  readonly columns = LAYOUT_COLUMNS;
  readonly titleMaxLength = MAX_LAYOUT_TITLE_LENGTH;
  readonly textMaxLength = MAX_LAYOUT_TEXT_LENGTH;
  /** Último movimiento, para anunciarlo a los lectores de pantalla. */
  readonly announcement = signal('');

  width(row: EditorRow): number {
    return rowWidth(row);
  }

  widthPercent(row: EditorRow): number {
    return Math.round((rowWidth(row) / LAYOUT_COLUMNS) * 100);
  }

  meterWidth(row: EditorRow): string {
    return `${Math.min(100, this.widthPercent(row))}%`;
  }

  spanText(span: number): string {
    return spanLabel(span);
  }

  itemName(item: EditorItem): string {
    if (item.type === 'VARIABLE') {
      const variable = this.variables.find(
        (candidate) => candidate.signalVariableName === item.signalVariableName,
      );
      return variable
        ? variableLabel({
            signalVariableName: variable.signalVariableName,
            label: variable.config.label,
          })
        : (item.signalVariableName ?? '');
    }
    if (item.type === 'TITLE') {
      return item.text?.trim() ? `Título «${item.text.trim()}»` : 'Título';
    }
    return item.type === 'TEXT' ? 'Texto' : 'Hueco';
  }

  typeLabel(item: EditorItem): string {
    return TYPE_LABELS.get(item.type) ?? item.type;
  }

  rowError(row: EditorRow): string | null {
    return this.errors?.rows[row.uid] ?? null;
  }

  itemError(item: EditorItem): string | null {
    return this.errors?.items[item.uid] ?? null;
  }

  // --- Cambios ---

  setSpan(item: EditorItem, event: Event): void {
    const span = Number((event.target as HTMLSelectElement).value);
    this.emit(
      updateItem(this.rows, item.uid, { span }),
      `${this.itemName(item)}: ${spanLabel(span)}.`,
    );
  }

  setText(item: EditorItem, event: Event): void {
    this.rowsChange.emit(
      updateItem(this.rows, item.uid, { text: (event.target as HTMLInputElement).value }),
    );
  }

  moveWithin(rowIndex: number, itemIndex: number, delta: -1 | 1): void {
    const item = this.rows[rowIndex].items[itemIndex];
    const rows = moveWithinRow(this.rows, rowIndex, itemIndex, delta);
    this.emit(rows, this.positionMessage(item, rows));
  }

  moveToRow(rowIndex: number, itemIndex: number, delta: -1 | 1): void {
    const item = this.rows[rowIndex].items[itemIndex];
    const rows = moveToAdjacentRow(this.rows, rowIndex, itemIndex, delta);
    this.emit(rows, this.positionMessage(item, rows));
  }

  moveRowBy(rowIndex: number, delta: -1 | 1): void {
    this.emit(
      moveRow(this.rows, rowIndex, delta),
      `Fila movida a la posición ${rowIndex + delta + 1}.`,
    );
  }

  remove(item: EditorItem): void {
    this.emit(removeItem(this.rows, item.uid), `${this.itemName(item)} quitado.`);
  }

  add(type: 'TITLE' | 'TEXT' | 'SPACER'): void {
    this.emit(addItem(this.rows, type), `${TYPE_LABELS.get(type)} añadido al final.`);
  }

  /** Arrastrar y soltar: `container.data` es el índice de la fila (o `rows.length` para una nueva). */
  drop(event: CdkDragDrop<number>): void {
    const from = { row: event.previousContainer.data, index: event.previousIndex };
    const to = { row: event.container.data, index: event.currentIndex };
    if (from.row === to.row && from.index === to.index) {
      return;
    }
    const item = this.rows[from.row]?.items[from.index];
    const rows = transferItem(this.rows, from, to);
    this.emit(rows, item ? this.positionMessage(item, rows) : '');
  }

  isFirstRow(index: number): boolean {
    return index === 0;
  }

  isLastRow(index: number): boolean {
    return index === this.rows.length - 1;
  }

  private positionMessage(item: EditorItem, rows: EditorRow[]): string {
    const rowIndex = rows.findIndex((row) =>
      row.items.some((candidate) => candidate.uid === item.uid),
    );
    const itemIndex =
      rows[rowIndex]?.items.findIndex((candidate) => candidate.uid === item.uid) ?? -1;
    return `${this.itemName(item)}: fila ${rowIndex + 1}, posición ${itemIndex + 1}.`;
  }

  private emit(rows: EditorRow[], message: string): void {
    this.rowsChange.emit(rows);
    this.announcement.set(message);
  }
}
