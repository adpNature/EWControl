import { WidgetConfig } from './widget-config.model';

/** Documento 3, apartado 3.5. `PACKAGE`: docs/specs/20-paquetes-escritura-opc-ua.md. */
export type WidgetType = 'VALUE' | 'CHART' | 'GAUGE' | 'TABLE' | 'ALARM_LIST' | 'PACKAGE';

/** Signal ya resuelta de un widget (docs/specs/07-dashboard-tiempo-real.md, criterio backend 5). */
export interface WidgetSignal {
  id: string;
  name: string;
  unit: string;
  machineId: string;
}

export interface DashboardWidget {
  id: string;
  widgetType: WidgetType;
  widgetConfig: WidgetConfig;
  position: number;
  signals: WidgetSignal[];
}

export interface Dashboard {
  id: string;
  companyId: string;
  name: string;
}

export interface DashboardDetail extends Dashboard {
  widgets: DashboardWidget[];
}

export interface CreateDashboardRequest {
  name: string;
}

export interface CreateWidgetRequest {
  widgetType: WidgetType;
  signalIds: string[];
  config: WidgetConfig;
  position?: number;
}

export type UpdateWidgetRequest = Partial<Omit<CreateWidgetRequest, 'widgetType'>>;
