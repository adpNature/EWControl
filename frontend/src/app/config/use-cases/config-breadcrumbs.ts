import { inject } from '@angular/core';
import { ParamMap } from '@angular/router';
import { map, of } from 'rxjs';
import { BreadcrumbCrumb, BreadcrumbResolver } from '../../shared/ui/breadcrumb/breadcrumb.model';
import { CompaniesApiService } from '../adapters/companies-api.service';
import { MachinesApiService } from '../adapters/machines-api.service';
import { SignalsApiService } from '../adapters/signals-api.service';
import { UsersApiService } from '../adapters/users-api.service';
import { CompaniesState } from './companies.state';
import { MachinesState } from './machines.state';
import { SignalsState } from './signals.state';
import { UsersState } from './users.state';

/**
 * Datos de breadcrumb de `config.routes.ts` (docs/specs/12-navegacion-shell.md, AC5).
 * Los resolvers son cache-first (reutilizan el estado ya cargado por la página
 * correspondiente, ej. `MachineDetailPage`) con fallback a una llamada HTTP puntual
 * si se llega directo por URL sin haber cargado antes la lista.
 */
export const machinesCrumb: BreadcrumbCrumb = {
  label: 'Machines',
  link: () => ['/config/machines'],
};
export const usersCrumb: BreadcrumbCrumb = { label: 'Users', link: () => ['/config/users'] };
export const companiesCrumb: BreadcrumbCrumb = {
  label: 'Companies',
  link: () => ['/config/companies'],
};
export const newCrumb: BreadcrumbCrumb = { label: 'Nueva' };
export const editCrumb: BreadcrumbCrumb = { label: 'Editar' };
/** No existe una pantalla propia de listado de Signals (se gestionan desde el detalle de Machine). */
export const signalsPseudoCrumb: BreadcrumbCrumb = { label: 'Signals' };
export const alarmDefinitionsPseudoCrumb: BreadcrumbCrumb = { label: 'Alarm definitions' };

export const machineNameResolver: BreadcrumbResolver = (paramMap) => {
  const id = paramMap.get('machineId')!;
  const cached = inject(MachinesState)
    .machines()
    .find((machine) => machine.id === id);
  if (cached) return of(cached.name);
  return inject(MachinesApiService)
    .get(id)
    .pipe(map((machine) => machine.name));
};

export const signalNameResolver: BreadcrumbResolver = (paramMap) => {
  const machineId = paramMap.get('machineId')!;
  const signalId = paramMap.get('signalId')!;
  const cached = inject(SignalsState)
    .signals()
    .find((signal) => signal.id === signalId);
  if (cached) return of(cached.name);
  return inject(SignalsApiService)
    .get(machineId, signalId)
    .pipe(map((signal) => signal.name));
};

export const companyNameResolver: BreadcrumbResolver = (paramMap) => {
  const id = paramMap.get('companyId')!;
  const cached = inject(CompaniesState)
    .companies()
    .find((company) => company.id === id);
  if (cached) return of(cached.name);
  return inject(CompaniesApiService)
    .get(id)
    .pipe(map((company) => company.name));
};

export const userNameResolver: BreadcrumbResolver = (paramMap) => {
  const id = paramMap.get('userId')!;
  const cached = inject(UsersState)
    .users()
    .find((user) => user.id === id);
  if (cached) return of(cached.email);
  return inject(UsersApiService)
    .get(id)
    .pipe(map((user) => user.email));
};

const machineLink = (paramMap: ParamMap) => ['/config/machines', paramMap.get('machineId')!];

const signalLink = (paramMap: ParamMap) => [
  '/config/machines',
  paramMap.get('machineId')!,
  'signals',
  paramMap.get('signalId')!,
  'edit',
];

export const machinesListBreadcrumb: BreadcrumbCrumb[] = [machinesCrumb];
export const usersListBreadcrumb: BreadcrumbCrumb[] = [usersCrumb];
export const companiesListBreadcrumb: BreadcrumbCrumb[] = [companiesCrumb];

export const machineDetailBreadcrumb: BreadcrumbCrumb[] = [
  machinesCrumb,
  { label: machineNameResolver },
];

export const machineFormNewBreadcrumb: BreadcrumbCrumb[] = [machinesCrumb, newCrumb];

/** docs/specs/18-integracion-opc-ua.md: pantalla de conexión de una Machine. */
export const machineConnectionBreadcrumb: BreadcrumbCrumb[] = [
  machinesCrumb,
  { label: machineNameResolver, link: machineLink },
  { label: 'Conexión' },
];

export const machineFormEditBreadcrumb: BreadcrumbCrumb[] = [
  machinesCrumb,
  { label: machineNameResolver, link: machineLink },
  editCrumb,
];

export const signalFormNewBreadcrumb: BreadcrumbCrumb[] = [
  machinesCrumb,
  { label: machineNameResolver, link: machineLink },
  signalsPseudoCrumb,
  newCrumb,
];

export const signalFormEditBreadcrumb: BreadcrumbCrumb[] = [
  machinesCrumb,
  { label: machineNameResolver, link: machineLink },
  signalsPseudoCrumb,
  { label: signalNameResolver },
  editCrumb,
];

export const alarmDefinitionFormNewBreadcrumb: BreadcrumbCrumb[] = [
  machinesCrumb,
  { label: machineNameResolver, link: machineLink },
  signalsPseudoCrumb,
  { label: signalNameResolver, link: signalLink },
  alarmDefinitionsPseudoCrumb,
  newCrumb,
];

export const alarmDefinitionFormEditBreadcrumb: BreadcrumbCrumb[] = [
  machinesCrumb,
  { label: machineNameResolver, link: machineLink },
  signalsPseudoCrumb,
  { label: signalNameResolver, link: signalLink },
  alarmDefinitionsPseudoCrumb,
  editCrumb,
];

export const companyFormNewBreadcrumb: BreadcrumbCrumb[] = [companiesCrumb, newCrumb];

export const companyFormEditBreadcrumb: BreadcrumbCrumb[] = [
  companiesCrumb,
  { label: companyNameResolver },
  editCrumb,
];

export const userFormNewBreadcrumb: BreadcrumbCrumb[] = [usersCrumb, newCrumb];

export const userFormEditBreadcrumb: BreadcrumbCrumb[] = [
  usersCrumb,
  { label: userNameResolver },
  editCrumb,
];
