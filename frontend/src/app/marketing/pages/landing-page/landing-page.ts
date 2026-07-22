import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { LandingHeaderComponent } from './landing-header/landing-header.component';

/** docs/specs/17-landing-page.md: landing pública de bienvenida, montada en `/`. */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, IconComponent, LandingHeaderComponent],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
})
export class LandingPage {
  readonly ventajas = [
    {
      icon: 'chart',
      title: 'Todo a la vista, en directo y en el tiempo',
      description:
        'Consulta cómo están tus máquinas ahora mismo y cómo se han comportado en el pasado, sin salir de la misma pantalla.',
    },
    {
      icon: 'notification-bing',
      title: 'Te avisamos antes de que sea un problema',
      description:
        'En cuanto algo se sale de lo normal, recibes un aviso en la web y por email, con quién y cuándo lo revisó.',
    },
    {
      icon: 'setting',
      title: 'Se adapta a ti, sin programar nada',
      description:
        'Añade máquinas, señales y paneles desde la propia plataforma. Nada de desarrollos a medida por cada equipo nuevo.',
    },
    {
      icon: 'home',
      title: 'Tu empresa, tu propio espacio',
      description:
        'Cada cliente ve únicamente sus máquinas y sus datos, completamente separados de los del resto.',
    },
  ];

  readonly publico = [
    {
      title: 'Empresas industriales',
      description: 'que quieren vigilar su maquinaria sin complicarse.',
    },
    {
      title: 'Equipos de mantenimiento',
      description: 'que necesitan anticiparse a las averías.',
    },
    {
      title: 'Fabricantes de maquinaria',
      description: 'que quieren ofrecer esto mismo a sus clientes.',
    },
    {
      title: 'Ingenierías e integradores',
      description: 'que dan servicio a plantas industriales.',
    },
  ];
}
