import { render, screen } from '@testing-library/angular';
import { DashboardWidget } from '../../entities/dashboard.model';
import { AlarmListWidgetComponent } from './alarm-list-widget.component';

const WIDGET: DashboardWidget = {
  id: 'widget-1',
  widgetType: 'ALARM_LIST',
  widgetConfig: {},
  position: 0,
  signals: [],
};

describe('AlarmListWidgetComponent', () => {
  it('muestra siempre el estado vacío fijo (sin inyectar ApiService ni RealtimeSocketService)', async () => {
    await render(AlarmListWidgetComponent, { inputs: { widget: WIDGET } });

    expect(screen.getByText('Las alarmas estarán disponibles próximamente.')).toBeInTheDocument();
  });
});
