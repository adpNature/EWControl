import { Component, Input } from '@angular/core';
import { AlarmPriority } from '../../../core/websocket/realtime-events.model';

function labelFor(priority: AlarmPriority): string {
  switch (priority) {
    case 'LOW':
      return 'Baja';
    case 'MEDIUM':
      return 'Media';
    case 'HIGH':
      return 'Alta';
    case 'CRITICAL':
      return 'Crítica';
  }
}

/**
 * Indicador de prioridad de alarma, compartido por el widget ALARM_LIST y el
 * panel de alarmas (docs/specs/09-alarmas.md; docs/12-convenciones-frontend.md,
 * apartado 12.4): mismo patrón de "clase modificadora por valor de enum" que
 * `SignalQualityBadgeComponent`.
 */
@Component({
  selector: 'app-alarm-priority-badge',
  standalone: true,
  templateUrl: './alarm-priority-badge.component.html',
  styleUrl: './alarm-priority-badge.component.scss',
})
export class AlarmPriorityBadgeComponent {
  @Input({ required: true }) priority!: AlarmPriority;

  get label(): string {
    return labelFor(this.priority);
  }

  get modifierClass(): string {
    return `priority-badge--${this.priority.toLowerCase()}`;
  }
}
