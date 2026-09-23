import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../api';
import { Catalogos, Falla, Maquina, Tipo } from '../modelos';
import { FallaDetalle } from '../componentes/falla-detalle';
import { FallaForm } from '../componentes/falla-form';
import { Modal } from '../componentes/modal';
import { conPausa, consulta, fechaCorta } from '../util';

const FILTROS_VACIOS = {
  q: '',
  maquina_id: '',
  tipo_id: '',
  categoria: '',
  estado: '',
  desde: '',
  hasta: '',
};

@Component({
  selector: 'app-fallas-page',
  imports: [FormsModule, RouterLink, FallaDetalle, FallaForm, Modal],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Operaciones / Mantenimiento</span>
        <h1>Fallas técnicas</h1>
        <p>Busca por código de falla o de máquina, por la falla o por la solución, y filtra por categoría y fechas.</p>
      </div>
      <div class="row-actions">
        <button class="ghost" type="button" [disabled]="exportando" (click)="exportar()">
          {{ exportando ? 'Exportando…' : 'Exportar a Excel (CSV)' }}
        </button>
        @if (api.esAdmin()) {
          <button class="primary" type="button" (click)="creando = true">
            <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>Registrar falla
          </button>
        }
      </div>
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    @if (creando) {
      <app-modal titulo="Registrar falla" subtitulo="Nueva falla técnica" (cerrar)="creando = false">
        <app-falla-form (guardado)="creada($event)" (cancelar)="creando = false" />
      </app-modal>
    }

    <section class="module-card filtros">
      <input type="search" class="buscador" placeholder="Código (FAL-0001, AM-015-01), falla o solución…"
             aria-label="Buscar fallas" [(ngModel)]="f.q" (ngModelChange)="buscarConPausa()">
      <select aria-label="Máquina" [(ngModel)]="f.maquina_id" (ngModelChange)="buscar()">
        <option value="">Todas las máquinas</option>
        @for (m of maquinas; track m.id) {
          <option [value]="m.id">{{ m.codigo }} · {{ m.nombre }}</option>
        }
      </select>
      <select aria-label="Tipo de máquina" [(ngModel)]="f.tipo_id" (ngModelChange)="buscar()">
        <option value="">Todos los tipos</option>
        @for (t of tipos; track t.id) {
          <option [value]="t.id">{{ t.nombre }}</option>
        }
      </select>
      <select aria-label="Categoría" [(ngModel)]="f.categoria" (ngModelChange)="buscar()">
        <option value="">Todas las categorías</option>
        @for (c of cat?.categorias ?? []; track c) {
          <option>{{ c }}</option>
        }
      </select>
      <select aria-label="Solución" [(ngModel)]="f.estado" (ngModelChange)="buscar()">
        <option value="">Con y sin solución</option>
        <option value="abiertas">Sin solución</option>
        <option value="Resuelta">Con solución</option>
      </select>
      <label class="rango">Desde<input type="date" [(ngModel)]="f.desde" (ngModelChange)="buscar()"></label>
      <label class="rango">Hasta<input type="date" [(ngModel)]="f.hasta" (ngModelChange)="buscar()"></label>
      <button class="quiet" type="button" (click)="limpiar()">Limpiar filtros</button>
      <span class="contador">{{ items.length }} fallas</span>
    </section>

    <section class="module-card tabla-card">
      <div class="tabla-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th class="opcional">Fecha</th>
              <th>Máquina</th>
              <th>Falla / error</th>
              <th class="opcional">Categoría</th>
              <th>Solución aplicada</th>
            </tr>
          </thead>
          <tbody>
            @for (x of items; track x.id) {
              <tr class="clicable" tabindex="0" [class.abierta]="abiertaId === x.id"
                  [attr.aria-expanded]="abiertaId === x.id" (click)="alternar(x)" (keydown.enter)="alternar(x)">
                <td class="codigo">{{ x.codigo }}</td>
                <td class="fecha opcional">{{ fecha(x.fecha_deteccion, false) }}</td>
                <td>
                  <a class="codigo" [routerLink]="['/maquinaria', x.maquina_id]" (click)="$event.stopPropagation()">
                    {{ x.maquina_codigo }}
                  </a>
                  <small class="subline">{{ x.maquina_nombre }}</small>
                </td>
                <td><strong>{{ x.titulo }}</strong></td>
                <td class="opcional">{{ x.categoria }}</td>
                <td class="solucion-celda">
                  @if (x.ultima_solucion) {
                    <span class="recorte">{{ x.ultima_solucion }}</span>
                  } @else {
                    <span class="pendiente">Sin solución registrada</span>
                  }
                </td>
              </tr>
              @if (abiertaId === x.id) {
                <tr class="fila-detalle">
                  <td colspan="6"><app-falla-detalle [fallaId]="x.id" (cambio)="cargar()" /></td>
                </tr>
              }
            } @empty {
              <tr><td colspan="6" class="muted">{{ cargando ? 'Buscando…' : 'No hay fallas con esos filtros' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class FallasPage implements OnInit {
  protected readonly api = inject(Api);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  f = { ...FILTROS_VACIOS };
  items: Falla[] = [];
  maquinas: Maquina[] = [];
  tipos: Tipo[] = [];
  cat?: Catalogos;
  abiertaId: number | null = null;
  error = '';
  cargando = true;
  creando = false;
  exportando = false;
  private pedido = 0;

  readonly fecha = fechaCorta;
  readonly buscarConPausa = conPausa(() => this.buscar());

  async ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    for (const k of Object.keys(FILTROS_VACIOS) as (keyof typeof FILTROS_VACIOS)[]) {
      this.f[k] = qp.get(k) ?? '';
    }
    this.abiertaId = Number(qp.get('falla')) || null;
    void this.cargar();
    try {
      [this.maquinas, this.tipos, this.cat] = await Promise.all([
        this.api.get<Maquina[]>('/maquinas'),
        this.api.get<Tipo[]>('/tipos'),
        this.api.catalogos(),
      ]);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar los filtros');
    }
  }

  buscar() {
    const queryParams = Object.fromEntries(Object.entries(this.f).filter(([, v]) => v));
    void this.router.navigate([], { queryParams, replaceUrl: true });
    void this.cargar();
  }

  limpiar() {
    this.f = { ...FILTROS_VACIOS };
    this.buscar();
  }

  async cargar() {
    const pedido = ++this.pedido;
    this.cargando = true;
    try {
      const r = await this.api.get<Falla[]>(`/fallas${consulta(this.f)}`);
      if (pedido === this.pedido) {
        this.items = r;
        this.error = '';
      }
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar las fallas');
    } finally {
      if (pedido === this.pedido) this.cargando = false;
    }
  }

  alternar(x: Falla) {
    this.abiertaId = this.abiertaId === x.id ? null : x.id;
  }

  async creada(x: Falla) {
    this.creando = false;
    await this.cargar();
    this.abiertaId = x.id;
  }

  async exportar() {
    this.exportando = true;
    try {
      await this.api.descargar('/export/fallas.csv', `fallas-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo exportar');
    } finally {
      this.exportando = false;
    }
  }
}
