import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, waitFor } from '@testing-library/angular';
import { IconComponent } from './icon.component';

function flushIcon(httpMock: HttpTestingController, svg = '<svg width="24" height="24"></svg>') {
  httpMock.match(() => true).forEach((req) => req.flush(svg));
}

describe('IconComponent', () => {
  it('mantiene el 24x24 original del SVG cuando no se indica `size`', async () => {
    const { container } = await render(IconComponent, {
      inputs: { name: 'chart' },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flushIcon(TestBed.inject(HttpTestingController));

    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('sobrescribe el ancho/alto del SVG cuando se indica `size`', async () => {
    const { container } = await render(IconComponent, {
      inputs: { name: 'chart', size: 80 },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flushIcon(TestBed.inject(HttpTestingController));

    await waitFor(() => expect(container.querySelector('svg')).toHaveAttribute('width', '80'));
    expect(container.querySelector('svg')).toHaveAttribute('height', '80');
  });
});
