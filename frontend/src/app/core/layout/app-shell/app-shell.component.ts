import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BreadcrumbComponent } from '../../../shared/ui/breadcrumb/breadcrumb.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

/**
 * Layout route de la zona privada (docs/specs/12-navegacion-shell.md): monta la
 * sidebar y el breadcrumb una única vez alrededor de `<router-outlet>`. Sin
 * lógica propia — es puramente de composición.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, BreadcrumbComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {}
