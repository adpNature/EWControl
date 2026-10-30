import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ApiError } from '../../../core/http/api-error.model';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { OpcUaBrowseNode } from '../../entities/machine-connection.model';
import { opcUaApiErrorMessage } from '../../use-cases/opc-ua-error-messages';
import { isMappableNode } from '../../use-cases/opc-ua-mapping';

/** Un nodo visible del árbol. `key` es la ruta desde la raíz: un NodeId puede colgar de varios padres. */
export interface VisibleTreeItem {
  key: string;
  parentKey: string | null;
  node: OpcUaBrowseNode;
  level: number;
  expanded: boolean;
  loading: boolean;
  error: string | null;
}

let nextBrowserId = 0;

/**
 * Árbol de exploración del espacio de direcciones OPC UA (docs/specs/18-integracion-opc-ua.md,
 * criterio frontend 3). Angular Component (docs/12-convenciones-frontend.md, 12.4):
 * tiene estado (nodos cargados, expandidos, en carga) y comportamiento (carga
 * bajo demanda, navegación por teclado del patrón WAI-ARIA "Tree View").
 * Solo pide los hijos de un nodo al expandirlo.
 */
@Component({
  selector: 'app-opc-ua-node-browser',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './opc-ua-node-browser.component.html',
  styleUrl: './opc-ua-node-browser.component.scss',
})
export class OpcUaNodeBrowserComponent implements OnChanges {
  @Input({ required: true }) machineId!: string;
  @Input({ required: true }) endpointUrl!: string;
  /** NodeIds ya presentes en la tabla de mapeo: su botón "Añadir" queda deshabilitado. */
  @Input() mappedNodeIds: ReadonlySet<string> = new Set();

  @Output() nodeAdded = new EventEmitter<OpcUaBrowseNode>();

  private readonly machinesApi = inject(MachinesApiService);
  private readonly browserId = nextBrowserId++;
  private readonly domIdByKey = new Map<string, string>();

  readonly rootLoading = signal(false);
  readonly rootError = signal<string | null>(null);
  private readonly rootNodes = signal<OpcUaBrowseNode[]>([]);
  private readonly childrenByKey = signal(new Map<string, OpcUaBrowseNode[]>());
  private readonly expandedKeys = signal(new Set<string>());
  private readonly loadingKeys = signal(new Set<string>());
  private readonly errorByKey = signal(new Map<string, string>());
  readonly activeKey = signal<string | null>(null);

  readonly visibleItems = computed<VisibleTreeItem[]>(() => {
    const items: VisibleTreeItem[] = [];
    const visit = (nodes: OpcUaBrowseNode[], parentKey: string | null, level: number) => {
      for (const node of nodes) {
        const key = parentKey === null ? node.nodeId : `${parentKey}/${node.nodeId}`;
        const expanded = this.expandedKeys().has(key);
        items.push({
          key,
          parentKey,
          node,
          level,
          expanded,
          loading: this.loadingKeys().has(key),
          error: this.errorByKey().get(key) ?? null,
        });
        const children = this.childrenByKey().get(key);
        if (expanded && children) {
          visit(children, key, level + 1);
        }
      }
    };
    visit(this.rootNodes(), null, 1);
    return items;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['endpointUrl'] || changes['machineId']) {
      this.loadRoot();
    }
  }

  /** Id DOM estable por ruta del nodo (no por posición), para mover el foco tras expandir. */
  itemId(item: VisibleTreeItem): string {
    let id = this.domIdByKey.get(item.key);
    if (!id) {
      id = `opc-ua-node-${this.browserId}-${this.domIdByKey.size}`;
      this.domIdByKey.set(item.key, id);
    }
    return id;
  }

  isMappable(node: OpcUaBrowseNode): boolean {
    return isMappableNode(node);
  }

  isMapped(node: OpcUaBrowseNode): boolean {
    return this.mappedNodeIds.has(node.nodeId);
  }

  isActive(item: VisibleTreeItem): boolean {
    const activeKey = this.activeKey() ?? this.visibleItems()[0]?.key;
    return item.key === activeKey;
  }

  add(event: Event, node: OpcUaBrowseNode): void {
    event.stopPropagation();
    if (!this.isMapped(node)) {
      this.nodeAdded.emit(node);
    }
  }

  toggle(item: VisibleTreeItem): void {
    this.activeKey.set(item.key);
    if (!item.node.hasChildren) {
      return;
    }
    if (item.expanded) {
      this.updateSet(this.expandedKeys, item.key, false);
      return;
    }
    this.expand(item);
  }

  /** Patrón WAI-ARIA "Tree View": flechas, Inicio/Fin, Enter/Espacio. */
  onKeydown(event: KeyboardEvent): void {
    const items = this.visibleItems();
    const index = items.findIndex((item) => this.isActive(item));
    const current = items[index];
    if (!current) {
      return;
    }
    const handled = this.handleKey(event.key, current, index, items);
    if (handled) {
      event.preventDefault();
    }
  }

  private handleKey(
    key: string,
    current: VisibleTreeItem,
    index: number,
    items: VisibleTreeItem[],
  ): boolean {
    switch (key) {
      case 'ArrowDown':
        this.focusItem(items[Math.min(index + 1, items.length - 1)]);
        return true;
      case 'ArrowUp':
        this.focusItem(items[Math.max(index - 1, 0)]);
        return true;
      case 'Home':
        this.focusItem(items[0]);
        return true;
      case 'End':
        this.focusItem(items[items.length - 1]);
        return true;
      case 'ArrowRight':
        if (current.node.hasChildren && !current.expanded) {
          this.expand(current);
        } else if (current.expanded && items[index + 1]?.parentKey === current.key) {
          this.focusItem(items[index + 1]);
        }
        return true;
      case 'ArrowLeft':
        if (current.expanded) {
          this.updateSet(this.expandedKeys, current.key, false);
        } else if (current.parentKey) {
          this.focusItem(items.find((item) => item.key === current.parentKey));
        }
        return true;
      case 'Enter':
      case ' ':
        // Acción por defecto de una Variable mapeable (hoja): añadirla al mapeo,
        // para que el botón "Añadir" no sea la única vía (solo ratón).
        if (isMappableNode(current.node) && !current.node.hasChildren) {
          this.add(new Event('keydown'), current.node);
        } else {
          this.toggle(current);
        }
        return true;
      default:
        return false;
    }
  }

  private focusItem(item: VisibleTreeItem | undefined): void {
    if (!item) {
      return;
    }
    this.activeKey.set(item.key);
    const id = this.itemId(item);
    queueMicrotask(() => document.getElementById(id)?.focus());
  }

  private loadRoot(): void {
    this.domIdByKey.clear();
    this.rootNodes.set([]);
    this.childrenByKey.set(new Map());
    this.expandedKeys.set(new Set());
    this.loadingKeys.set(new Set());
    this.errorByKey.set(new Map());
    this.activeKey.set(null);
    this.rootError.set(null);
    this.rootLoading.set(true);
    this.machinesApi.browseOpcUaNodes(this.machineId, this.endpointUrl).subscribe({
      next: ({ nodes }) => {
        this.rootLoading.set(false);
        this.rootNodes.set(nodes);
      },
      error: (error: ApiError) => {
        this.rootLoading.set(false);
        this.rootError.set(opcUaApiErrorMessage(error));
      },
    });
  }

  private expand(item: VisibleTreeItem): void {
    this.updateSet(this.expandedKeys, item.key, true);
    if (this.childrenByKey().has(item.key) || item.loading) {
      return;
    }
    this.updateSet(this.loadingKeys, item.key, true);
    this.errorByKey.update((errors) => {
      const next = new Map(errors);
      next.delete(item.key);
      return next;
    });
    this.machinesApi
      .browseOpcUaNodes(this.machineId, this.endpointUrl, item.node.nodeId)
      .subscribe({
        next: ({ nodes }) => {
          this.updateSet(this.loadingKeys, item.key, false);
          this.childrenByKey.update((children) => new Map(children).set(item.key, nodes));
        },
        error: (error: ApiError) => {
          this.updateSet(this.loadingKeys, item.key, false);
          this.updateSet(this.expandedKeys, item.key, false);
          this.errorByKey.update((errors) =>
            new Map(errors).set(item.key, opcUaApiErrorMessage(error)),
          );
        },
      });
  }

  private updateSet(target: WritableSignal<Set<string>>, key: string, present: boolean): void {
    target.update((current) => {
      const next = new Set(current);
      if (present) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }
}
