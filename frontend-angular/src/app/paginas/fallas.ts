import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../api';
import { Catalogos, Falla, Maquina, Tipo } from '../modelos';
import { FallaDetalle } from '../componentes/falla-detalle';
import { FallaForm } from '../componentes/falla-form';
import { Modal } from '../componentes/modal';
import { Paginador } from '../componentes/paginador';
import { POR_PAGINA } from '../limites';
import { PERIODOS, conPausa, consulta, fechaLarga, haceCuanto, rangoPeriodo, slugCategoria } from '../util';

const FILTROS_VACIOS = {
  q: '',
  maquina_id: '',
  tipo_id: '',
  categoria: '',
  estado: '',
  periodo: '',
  desde: '',
  hasta: '',
};

const SEGMENTOS = [
  { valor: '', texto: 'Todas', clave: 'todas' },
  { valor: 'Resuelta', texto: 'Con solución', clave: 'con' },
  { valor: 'abiertas', texto: 'Sin solución', clave: 'sin' },
];

@Component({
  selector: 'app-fallas-page',
  imports: [FormsModule, RouterLink, FallaDetalle, FallaForm, Modal, Paginador],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Operaciones / Mantenimiento</span>
        <h1>Fallas técnicas</h1>
        <p>Cada falla con la solución que se aplicó. Haz clic en una fila para ver el detalle completo.</p>
      </div>
      <div class="row-actions">
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

    <section class="module-card panel-filtros">
      <div class="filtros-fila">
        <label class="buscador-icono">
          <svg class="icon" aria-hidden="true"><use href="#i-search"></use></svg>
          <input type="search" placeholder="Buscar por código (FAL-0001, AM-015-01), falla o solución…"
                 aria-label="Buscar fallas" [(ngModel)]="f.q" (ngModelChange)="buscarConPausa()">
        </label>
        <div class="segmento" role="radiogroup" aria-label="Filtrar por solución">
          @for (s of segmentos; track s.valor) {
            <button type="button" role="radio" [attr.aria-checked]="f.estado === s.valor"
                    [class.activo]="f.estado === s.valor" [attr.data-tipo]="s.clave" (click)="f.estado = s.valor; buscar()">
              {{ s.texto }} <span class="segmento-n">{{ conteo[s.clave] ?? '·' }}</span>
            </button>
          }
        </div>
      </div>
      <div class="filtros-fila">
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
        <div class="rango-fechas">
          <svg class="icon" aria-hidden="true"><use href="#i-calendar"></use></svg>
          <select aria-label="Período" [(ngModel)]="f.periodo" (ngModelChange)="elegirPeriodo($event)">
            @for (p of periodos; track p.id) {
              <option [value]="p.id">{{ p.texto }}</option>
            }
          </select>
          @if (f.periodo === 'personalizado') {
            <input type="date" aria-label="Desde" [attr.max]="f.hasta || null" [(ngModel)]="f.desde" (ngModelChange)="buscar()">
            <span aria-hidden="true">a</span>
            <input type="date" aria-label="Hasta" [attr.min]="f.desde || null" [(ngModel)]="f.hasta" (ngModelChange)="buscar()">
          }
        </div>
        @if (hayFiltros) {
          <button class="quiet" type="button" (click)="limpiar()">Limpiar filtros</button>
        }
      </div>
    </section>

    <section class="module-card tabla-card">
      <div class="tabla-scroll">
        <table class="data-table tabla-fallas">
          <thead>
            <tr>
              <th>Código</th>
              <th class="opcional">Fecha</th>
              <th>Máquina</th>
              <th class="th-falla">Falla / error</th>
              <th class="opcional">Categoría</th>
              <th class="th-solucion">Solución aplicada</th>
            </tr>
          </thead>
          <tbody>
            @for (x of items; track x.id) {
              <tr class="clicable" tabindex="0" [attr.data-estado]="estadoFila(x)" [class.abierta]="abiertaId === x.id"
                  [attr.aria-expanded]="abiertaId === x.id" (click)="alternar(x)" (keydown.enter)="alternar(x)">
                <td class="codigo">{{ x.codigo }}</td>
                <td class="fecha opcional">
                  {{ larga(x.fecha_deteccion) }}
                  <small class="subline">{{ hace(x.fecha_deteccion) }}</small>
                </td>
                <td>
                  <a class="codigo" [routerLink]="['/maquinaria', x.maquina_id]" (click)="$event.stopPropagation()">
                    {{ x.maquina_codigo }}
                  </a>
                  <small class="subline">{{ x.maquina_nombre }}</small>
                </td>
                <td>
                  <div class="celda-falla">
                    <svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg>
                    <strong>{{ x.titulo }}</strong>
                  </div>
                </td>
                <td class="opcional"><span class="cat" [attr.data-cat]="slug(x.categoria)">{{ x.categoria }}</span></td>
                <td class="solucion-celda">
                  @switch (estadoFila(x)) {
                    @case ('resuelta') {
                      <div class="sol-caja sol-ok">
                        <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
                        <span class="recorte">{{ x.ultima_solucion }}</span>
                      </div>
                    }
                    @case ('intento') {
                      <div class="sol-caja sol-intento" title="Se intentó una solución, pero no resolvió la falla">
                        <svg class="icon" aria-hidden="true"><use href="#i-wrench"></use></svg>
                        <span class="recorte">{{ x.ultima_solucion }}</span>
                      </div>
                    }
                    @default {
                      <span class="sol-pendiente">
                        <svg class="icon" aria-hidden="true"><use href="#i-clock"></use></svg>Sin solución
                      </span>
                    }
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
      <app-paginador [total]="total" [pagina]="pagina" [porPagina]="porPagina" (cambio)="cambiarPagina($event.pagina, $event.porPagina)" />
    </section>
  `,
})
export class FallasPage implements OnInit {
  protected readonly api = inject(Api);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  f = { ...FILTROS_VACIOS };
  items: Falla[] = [];
  total = 0;
  conteo: Record<string, number> = {};
  pagina = 1;
  porPagina = POR_PAGINA[1];
  maquinas: Maquina[] = [];
  tipos: Tipo[] = [];
  cat?: Catalogos;
  abiertaId: number | null = null;
  error = '';
  cargando = true;
  creando = false;
  private pedido = 0;

  readonly segmentos = SEGMENTOS;
  readonly periodos = PERIODOS;
  readonly larga = fechaLarga;
  readonly hace = haceCuanto;
  readonly slug = slugCategoria;
  readonly buscarConPausa = conPausa(() => this.buscar());

  get hayFiltros() {
    return Object.values(this.f).some((v) => v);
  }

  estadoFila(x: Falla) {
    if (x.estado === 'Resuelta') return 'resuelta';
    return x.ultima_solucion ? 'intento' : 'pendiente';
  }

  async ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    for (const k of Object.keys(FILTROS_VACIOS) as (keyof typeof FILTROS_VACIOS)[]) {
      this.f[k] = qp.get(k) ?? '';
    }
    if ((this.f.desde || this.f.hasta) && !this.f.periodo) this.f.periodo = 'personalizado';
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

  elegirPeriodo(id: string) {
    const rango = rangoPeriodo(id);
    if (rango) Object.assign(this.f, rango);
    this.buscar();
  }

  cambiarPagina(pagina: number, porPagina: number) {
    this.pagina = pagina;
    this.porPagina = porPagina;
    void this.cargar();
  }

  buscar() {
    this.pagina = 1;
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
      const { periodo: _periodo, ...filtros } = this.f;
      const r = await this.api.lista<Falla>(`/fallas${consulta({ ...filtros, limite: this.porPagina, pagina: this.pagina })}`);
      if (pedido === this.pedido) {
        this.items = r.items;
        this.total = r.total;
        this.conteo = r.conteo;
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

}
