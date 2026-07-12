import { Component, Input } from '@angular/core';
import { SignalQuality } from '../../../../core/websocket/realtime-events.model';

function labelFor(quality: SignalQuality): string {
  switch (quality) {
    case 'GOOD':
      return 'OK';
    case 'BAD':
      return 'Error';
    case 'UNCERTAIN':
      return 'Incierto';
    case 'OFFLINE':
      return 'Sin comunicación';
  }
}

/**
 * Indicador de calidad compartido por los widgets VALUE/GAUGE/TABLE/CHART
 * (docs/12-convenciones-frontend.md, apartado 12.4): evita duplicar 4 veces
 * el mismo tratamiento visual GOOD/BAD/UNCERTAIN/OFFLINE.
 */
@Component({
  selector: 'app-signal-quality-badge',
  standalone: true,
  templateUrl: './signal-quality-badge.component.html',
  styleUrl: './signal-quality-badge.component.scss',
})
export class SignalQualityBadgeComponent {
  @Input({ required: true }) quality!: SignalQuality;

  get label(): string {
    return labelFor(this.quality);
  }

  get modifierClass(): string {
    return `quality-badge--${this.quality.toLowerCase()}`;
  }
}
