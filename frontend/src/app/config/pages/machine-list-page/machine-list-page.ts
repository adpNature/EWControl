import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';
import { Machine } from '../../entities/machine.model';
import { canConfigure } from '../../use-cases/config-permissions';
import { MachinesState } from '../../use-cases/machines.state';

const COLUMNS: TableColumn<Machine>[] = [
  { key: 'name', header: 'Nombre' },
  { key: 'connection', header: 'Conexión', cell: () => 'Simulator' },
];

/** docs/specs/06-gestion-machines-signals.md: listado de Machines de la Company del usuario. */
@Component({
  selector: 'app-machine-list-page',
  standalone: true,
  imports: [RouterLink, TableComponent],
  templateUrl: './machine-list-page.html',
  styleUrl: './machine-list-page.scss',
})
export class MachineListPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  protected readonly machinesState = inject(MachinesState);

  readonly columns = COLUMNS;
  readonly rowKey = (machine: Machine): string => machine.id;

  ngOnInit(): void {
    this.machinesState.load().subscribe();
  }

  canConfigure(): boolean {
    return canConfigure(this.authState.currentUser()?.role);
  }
}
