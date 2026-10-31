import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  isNumericDataType,
  isWritableDataType,
} from '../../../write-packages/use-cases/write-package-rules';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { OpcUaNodeBrowserComponent } from '../../components/opc-ua-node-browser/opc-ua-node-browser.component';
import {
  OpcUaBrowseNode,
  OpcUaNodeMapping,
  ProviderType,
  ReplaceConnectionRequest,
  SimulatorConnectionConfig,
  isOpcUaConnectionConfig,
} from '../../entities/machine-connection.model';
import {
  opcUaApiErrorMessage,
  opcUaTestResultMessage,
} from '../../use-cases/opc-ua-error-messages';
import {
  MappingRowError,
  OPCUA_ENDPOINT_PATTERN,
  deriveVariableName,
  validateMapping,
} from '../../use-cases/opc-ua-mapping';

interface MappingRow {
  nodeId: string;
  signalVariableName: string;
  dataType?: string;
  /** docs/specs/20-paquetes-escritura-opc-ua.md: escribible por paquetes, con límites opcionales. */
  writable?: boolean;
  min?: number;
  max?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_SAMPLING_INTERVAL_MS = 1000;
/** Config con la que vuelve al Simulador una Machine que antes era OPC UA (sin semillas). */
const EMPTY_SIMULATOR_CONFIG: SimulatorConnectionConfig = { seedProfile: 'empty', signals: [] };

const ROW_ERROR_MESSAGES: Record<MappingRowError, string> = {
  empty: 'El nombre es obligatorio.',
  invalid: 'Solo letras, números y _, sin empezar por número.',
  duplicated: 'Nombre repetido en otra fila.',
};

/**
 * docs/specs/18-integracion-opc-ua.md: configuración de la conexión de una
 * Machine. Permite elegir Simulador u OPC UA; para OPC UA, probar el endpoint,
 * explorar sus nodos y mapear Variables escalares a nombres de variable.
 */
@Component({
  selector: 'app-machine-connection-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ConfirmDialogComponent, OpcUaNodeBrowserComponent],
  templateUrl: './machine-connection-page.html',
  styleUrl: './machine-connection-page.scss',
})
export class MachineConnectionPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly machinesApi = inject(MachinesApiService);
  private readonly toastService = inject(ToastService);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;

  readonly loading = signal(true);
  readonly savedProvider = signal<ProviderType | null>(null);
  readonly providerType = signal<ProviderType>('Simulator');
  readonly mapping = signal<MappingRow[]>([]);
  readonly browseEndpoint = signal<string | null>(null);
  readonly testing = signal(false);
  readonly saving = signal(false);
  readonly confirmOpen = signal(false);

  readonly endpointControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(OPCUA_ENDPOINT_PATTERN)],
  });

  readonly mappingErrors = computed(() => validateMapping(this.mapping()));
  readonly mappedNodeIds = computed(() => new Set(this.mapping().map((row) => row.nodeId)));

  private savedSimulatorConfig: SimulatorConnectionConfig | null = null;
  private timeoutMs = DEFAULT_TIMEOUT_MS;
  private samplingIntervalMs = DEFAULT_SAMPLING_INTERVAL_MS;

  ngOnInit(): void {
    this.machinesApi.getConnection(this.machineId).subscribe({
      next: (connection) => {
        this.loading.set(false);
        this.savedProvider.set(connection.providerType);
        this.providerType.set(connection.providerType);
        const config = connection.connectionConfig;
        if (isOpcUaConnectionConfig(config)) {
          this.endpointControl.setValue(config.endpointUrl);
          this.mapping.set(config.nodeMapping.map((entry) => ({ ...entry })));
          this.timeoutMs = config.timeoutMs;
          this.samplingIntervalMs = config.samplingIntervalMs;
        } else {
          this.savedSimulatorConfig = config;
        }
      },
      error: () => {
        this.loading.set(false);
        this.toastService.show({
          type: 'danger',
          message: 'No se ha podido cargar la conexión de la Machine.',
        });
      },
    });
  }

  selectProvider(providerType: ProviderType): void {
    this.providerType.set(providerType);
  }

  endpointError(): string | null {
    const control = this.endpointControl;
    return control.touched && control.invalid
      ? 'El endpoint debe tener la forma opc.tcp://host:puerto.'
      : null;
  }

  testConnection(): void {
    if (!this.ensureValidEndpoint()) {
      return;
    }
    this.testing.set(true);
    this.machinesApi.testOpcUaConnection(this.machineId, this.endpointControl.value).subscribe({
      next: (result) => {
        this.testing.set(false);
        this.toastService.show({
          type: result.reachable ? 'success' : 'danger',
          message: opcUaTestResultMessage(result),
        });
      },
      error: (error: ApiError) => {
        this.testing.set(false);
        this.toastService.show({ type: 'danger', message: opcUaApiErrorMessage(error) });
      },
    });
  }

  exploreNodes(): void {
    if (this.ensureValidEndpoint()) {
      this.browseEndpoint.set(this.endpointControl.value);
    }
  }

  addNode(node: OpcUaBrowseNode): void {
    if (this.mappedNodeIds().has(node.nodeId)) {
      return;
    }
    this.mapping.update((rows) => [
      ...rows,
      {
        nodeId: node.nodeId,
        signalVariableName: deriveVariableName(node),
        dataType: node.dataType,
      },
    ]);
  }

  renameRow(index: number, event: Event): void {
    const signalVariableName = (event.target as HTMLInputElement).value;
    this.mapping.update((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, signalVariableName } : row)),
    );
  }

  removeRow(index: number): void {
    this.mapping.update((rows) => rows.filter((row, rowIndex) => rowIndex !== index));
  }

  /** spec 20, criterio frontend 1: solo se puede marcar como escribible un tipo escalar soportado. */
  canBeWritable(row: MappingRow): boolean {
    return isWritableDataType(row.dataType);
  }

  isNumericRow(row: MappingRow): boolean {
    return isNumericDataType(row.dataType);
  }

  toggleWritable(index: number, event: Event): void {
    const writable = (event.target as HTMLInputElement).checked;
    this.mapping.update((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, writable, ...(writable ? {} : { min: undefined, max: undefined }) }
          : row,
      ),
    );
  }

  setLimit(index: number, bound: 'min' | 'max', event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim().replace(',', '.');
    const value = raw === '' ? undefined : Number(raw);
    this.mapping.update((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [bound]: value } : row)),
    );
  }

  limitsError(index: number): string | null {
    const row = this.mapping()[index];
    if (!row?.writable) {
      return null;
    }
    for (const bound of [row.min, row.max]) {
      if (bound !== undefined && !Number.isFinite(bound)) {
        return 'Los límites deben ser números.';
      }
    }
    if (row.min !== undefined && row.max !== undefined && row.min > row.max) {
      return 'El mínimo no puede ser mayor que el máximo.';
    }
    return null;
  }

  rowErrorMessage(index: number): string | null {
    const error = this.mappingErrors()[index];
    return error ? ROW_ERROR_MESSAGES[error] : null;
  }

  canSave(): boolean {
    if (this.saving()) {
      return false;
    }
    if (this.providerType() === 'Simulator') {
      return this.savedProvider() !== 'Simulator';
    }
    return (
      this.endpointControl.valid &&
      this.mapping().length > 0 &&
      this.mappingErrors().every((error) => error === null) &&
      this.mapping().every((row, index) => this.limitsError(index) === null)
    );
  }

  confirmMessage(): string {
    return this.providerType() === 'OpcUa'
      ? 'La Machine dejará de recibir datos simulados y pasará a leer del servidor OPC UA. ' +
          'Su histórico, Signals, Alarmas y Dashboards se conservan. ¿Continuar?'
      : 'La Machine dejará de leer del servidor OPC UA y volverá al Simulador sin variables ' +
          'simuladas. Su histórico, Signals, Alarmas y Dashboards se conservan. ¿Continuar?';
  }

  /** spec 18, criterio frontend 6: un cambio de proveedor pide confirmación antes del PUT. */
  requestSave(): void {
    if (!this.canSave()) {
      this.endpointControl.markAsTouched();
      return;
    }
    if (this.savedProvider() !== this.providerType()) {
      this.confirmOpen.set(true);
      return;
    }
    this.save();
  }

  save(): void {
    this.confirmOpen.set(false);
    this.saving.set(true);
    this.machinesApi.replaceConnection(this.machineId, this.buildRequest()).subscribe({
      next: (connection) => {
        this.saving.set(false);
        this.savedProvider.set(connection.providerType);
        this.toastService.show({ type: 'success', message: 'Conexión guardada.' });
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.toastService.show({ type: 'danger', message: opcUaApiErrorMessage(error) });
      },
    });
  }

  private buildRequest(): ReplaceConnectionRequest {
    if (this.providerType() === 'Simulator') {
      return {
        providerType: 'Simulator',
        connectionConfig: this.savedSimulatorConfig ?? EMPTY_SIMULATOR_CONFIG,
      };
    }
    return {
      providerType: 'OpcUa',
      connectionConfig: {
        endpointUrl: this.endpointControl.value,
        securityMode: 'None',
        securityPolicy: 'None',
        authMode: 'Anonymous',
        timeoutMs: this.timeoutMs,
        samplingIntervalMs: this.samplingIntervalMs,
        nodeMapping: this.mapping().map((row) => toNodeMapping(row)),
      },
    };
  }

  private ensureValidEndpoint(): boolean {
    this.endpointControl.markAsTouched();
    return this.endpointControl.valid;
  }
}

/**
 * Fila de la tabla → entrada de `nodeMapping` (spec 20): el tipo se guarda
 * siempre que se conozca, y `writable`/`min`/`max` solo si la variable es
 * escribible (los límites, además, solo en tipos numéricos).
 */
function toNodeMapping(row: MappingRow): OpcUaNodeMapping {
  const entry: OpcUaNodeMapping = {
    nodeId: row.nodeId,
    signalVariableName: row.signalVariableName,
  };
  if (row.dataType) {
    entry.dataType = row.dataType;
  }
  if (row.writable && isWritableDataType(row.dataType)) {
    entry.writable = true;
    if (isNumericDataType(row.dataType)) {
      if (row.min !== undefined) entry.min = row.min;
      if (row.max !== undefined) entry.max = row.max;
    }
  }
  return entry;
}
