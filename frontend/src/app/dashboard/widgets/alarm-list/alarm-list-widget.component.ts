import { Component, Input } from '@angular/core';
import { DashboardWidget } from '../../entities/dashboard.model';

/**
 * Widget ALARM_LIST (docs/specs/07-dashboard-tiempo-real.md, "Contexto" punto 4):
 * no existen todavía `AlarmDefinition`/`AlarmState` (spec futura de Alarmas),
 * así que este widget es un estado vacío fijo, sin petición REST ni suscripción
 * WebSocket — evita implicar una funcionalidad que aún no existe.
 */
@Component({
  selector: 'app-alarm-list-widget',
  standalone: true,
  templateUrl: './alarm-list-widget.component.html',
  styleUrl: './alarm-list-widget.component.scss',
})
export class AlarmListWidgetComponent {
  @Input({ required: true }) widget!: DashboardWidget;
}
