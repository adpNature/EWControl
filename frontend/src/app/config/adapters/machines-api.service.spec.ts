import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MachinesApiService } from './machines-api.service';

describe('MachinesApiService', () => {
  let service: MachinesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MachinesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list llama a GET /machines con la paginación', () => {
    service.list({ limit: 20, offset: 0 }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('list añade companyId solo cuando se indica explícitamente', () => {
    service.list({ limit: 20, offset: 0, companyId: 'company-1' }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines?limit=20&offset=0&companyId=company-1');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('get llama a GET /machines/:id', () => {
    service.get('machine-1').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create llama a POST /machines con el body', () => {
    service.create({ name: 'Bobinadora 1' }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Bobinadora 1' });
    req.flush({});
  });

  it('update llama a PATCH /machines/:id', () => {
    service.update('machine-1', { name: 'Nuevo nombre' }).subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('remove llama a DELETE /machines/:id', () => {
    service.remove('machine-1').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getConnection llama a GET /machines/:machineId/connection', () => {
    service.getConnection('machine-1').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/connection');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('replaceConnection llama a PUT /machines/:machineId/connection', () => {
    const request = {
      providerType: 'Simulator' as const,
      connectionConfig: { seedProfile: 'demo', signals: [] },
    };
    service.replaceConnection('machine-1', request).subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/connection');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('testOpcUaConnection llama a POST /machines/:machineId/connection/opcua/test (spec 18)', () => {
    service.testOpcUaConnection('machine-1', 'opc.tcp://192.168.1.1:4840').subscribe();

    const req = httpMock.expectOne('/api/v1/machines/machine-1/connection/opcua/test');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ endpointUrl: 'opc.tcp://192.168.1.1:4840' });
    req.flush({ reachable: true });
  });

  it('browseOpcUaNodes envía nodeId solo si se indica (spec 18)', () => {
    service.browseOpcUaNodes('machine-1', 'opc.tcp://192.168.1.1:4840').subscribe();
    service
      .browseOpcUaNodes('machine-1', 'opc.tcp://192.168.1.1:4840', 'ns=3;s="Lectura"')
      .subscribe();

    const [root, child] = httpMock.match('/api/v1/machines/machine-1/connection/opcua/browse');
    expect(root.request.method).toBe('POST');
    expect(root.request.body).toEqual({ endpointUrl: 'opc.tcp://192.168.1.1:4840' });
    expect(child.request.body).toEqual({
      endpointUrl: 'opc.tcp://192.168.1.1:4840',
      nodeId: 'ns=3;s="Lectura"',
    });
    root.flush({ nodes: [] });
    child.flush({ nodes: [] });
  });
});
