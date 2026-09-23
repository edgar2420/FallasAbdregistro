import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../api';
import { Maquina, Tipo } from '../modelos';
import { MaquinaForm } from '../componentes/maquina-form';
import { Modal } from '../componentes/modal';
import { Paginador } from '../componentes/paginador';
import { LIMITES, POR_PAGINA } from '../limites';
import { conPausa, consulta } from '../util';

@Component({
  selector: 'app-maquinaria-page',
  imports: [FormsModule, RouterLink, MaquinaForm, Modal, Paginador],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Activos / Planta</span>
        <h1>Maquinaria</h1>
        <p>Haz clic en una máquina para ver su ficha técnica, sus fotos y la tabla de fallas con su solución.</p>
      </div>
      @if (api.esAdmin()) {
        <div class="row-actions">
          <button class="ghost" type="button" (click)="verTipos = true">Tipos de máquina</button>
          <button class="primary" type="button" (click)="creando = true">
            <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>Nueva máquina
          </button>
        </div>
      }
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    @if (creando) {
      <app-modal titulo="Nueva máquina" subtitulo="Datos de la placa y ficha técnica" (cerrar)="creando = false">
        <app-maquina-form (guardado)="creada($event)" (cancelar)="creando = false" />
      </app-modal>
    }

    @if (verTipos && api.esAdmin()) {
      <app-modal titulo="Tipos de máquina" subtitulo="Agrupan equipos similares" tamano="mediano" (cerrar)="verTipos = false">
        <div class="tipos-lista">
          @for (t of tipos; track t.id) {
            <div class="user-row">
              @if (editandoTipo === t.id) {
                <input aria-label="Nombre del tipo" [maxlength]="LT.nombre" [(ngModel)]="tipoDraft.nombre">
                <input aria-label="Descripción del tipo" [maxlength]="LT.descripcion" [(ngModel)]="tipoDraft.descripcion" placeholder="Descripción">
                <button type="button" (click)="guardarTipo(t)">Guardar</button>
                <button type="button" (click)="editandoTipo = null">Cancelar</button>
              } @else {
                <div>
                  <strong>{{ t.nombre }}</strong>
                  <small>{{ t.descripcion || 'Sin descripción' }} · {{ t.maquinas }} máquinas</small>
                </div>
                <button type="button" (click)="editarTipo(t)">Editar</button>
                <button type="button" (click)="borrarTipo(t)">Borrar</button>
              }
            </div>
          }
        </div>
        <form class="filter-row nuevo-tipo" (submit)="$event.preventDefault(); crearTipo()">
          <input aria-label="Nuevo tipo" placeholder="Nuevo tipo (ej. Ósmosis inversa)" name="nt" [maxlength]="LT.nombre" [(ngModel)]="nuevoTipo.nombre">
          <input aria-label="Descripción" placeholder="Descripción" name="nd" [maxlength]="LT.descripcion" [(ngModel)]="nuevoTipo.descripcion">
          <button class="primary" type="submit">Agregar tipo</button>
        </form>
      </app-modal>
    }

    <section class="module-card filtros">
      <input type="search" class="buscador" placeholder="Buscar por código, equipo, área o Ref. POE"
             aria-label="Buscar máquina por código o nombre" [(ngModel)]="q" (ngModelChange)="buscarConPausa()">
      <select aria-label="Filtrar por departamento" [(ngModel)]="departamento" (ngModelChange)="buscar()">
        <option value="">Todos los departamentos</option>
        @for (d of departamentos; track d) {
          <option>{{ d }}</option>
        }
      </select>
      <select aria-label="Filtrar por tipo" [(ngModel)]="tipoId" (ngModelChange)="buscar()">
        <option [ngValue]="null">Todos los tipos</option>
        @for (t of tipos; track t.id) {
          <option [ngValue]="t.id">{{ t.nombre }}</option>
        }
      </select>
      <select aria-label="Filtrar por área" [(ngModel)]="area" (ngModelChange)="buscar()">
        <option value="">Todas las áreas</option>
        @for (a of areas; track a) {
          <option>{{ a }}</option>
        }
      </select>
      <span class="contador">{{ total }} {{ total === 1 ? 'máquina' : 'máquinas' }}</span>
    </section>

    <section class="module-card tabla-card">
      <div class="tabla-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Equipo</th>
              <th class="opcional">Departamento</th>
              <th>Área</th>
              <th class="opcional">Capacidad</th>
              <th class="opcional">Ref. (POE)</th>
              <th class="num">Fallas</th>
            </tr>
          </thead>
          <tbody>
            @for (m of items; track m.id) {
              <tr class="clicable" tabindex="0" (click)="abrir(m)" (keydown.enter)="abrir(m)">
                <td><a class="codigo" [routerLink]="['/maquinaria', m.id]" (click)="$event.stopPropagation()">{{ m.codigo }}</a></td>
                <td>
                  <strong>{{ m.nombre }}</strong>
                  <small class="subline">Modelo {{ m.modelo || '—' }} · Marca {{ m.marca || '—' }}</small>
                </td>
                <td class="opcional">{{ m.departamento || '—' }}</td>
                <td>{{ m.area || '—' }}</td>
                <td class="opcional">{{ m.capacidad || '—' }}</td>
                <td class="poe opcional">{{ m.poe || '—' }}</td>
                <td class="num">{{ m.total_fallas }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="muted">
                  {{ cargando ? 'Cargando maquinaria…' : 'No hay máquinas que coincidan con la búsqueda' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <app-paginador [total]="total" [pagina]="pagina" [porPagina]="porPagina"
                     (cambio)="cambiarPagina($event.pagina, $event.porPagina)" />
    </section>
  `,
})
export class MaquinariaPage implements OnInit {
  protected readonly api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  items: Maquina[] = [];
  tipos: Tipo[] = [];
  areas: string[] = [];
  departamentos: string[] = [];
  total = 0;
  private pedido = 0;
  q = '';
  tipoId: number | null = null;
  area = '';
  departamento = '';
  pagina = 1;
  porPagina = POR_PAGINA[1];
  readonly LT = LIMITES.tipo;
  error = '';
  cargando = true;
  creando = false;
  verTipos = false;
  editandoTipo: number | null = null;
  tipoDraft = { nombre: '', descripcion: '' };
  nuevoTipo = { nombre: '', descripcion: '' };


  readonly buscarConPausa = conPausa(() => this.buscar());

  /** Cualquier cambio de filtro vuelve a la primera página y vuelve a pedir al servidor. */
  buscar() {
    this.pagina = 1;
    void this.cargar();
  }

  cambiarPagina(pagina: number, porPagina: number) {
    this.pagina = pagina;
    this.porPagina = porPagina;
    void this.cargar();
  }

  async ngOnInit() {
    this.q = this.route.snapshot.queryParamMap.get('q') ?? '';
    await this.cargar();
  }

  async cargar() {
    const pedido = ++this.pedido;
    this.cargando = true;
    try {
      const filtros = {
        q: this.q, tipo_id: this.tipoId, area: this.area, departamento: this.departamento,
        limite: this.porPagina, pagina: this.pagina,
      };
      const [lista, tipos, opciones] = await Promise.all([
        this.api.lista<Maquina>(`/maquinas${consulta(filtros)}`),
        this.api.get<Tipo[]>('/tipos'),
        this.api.get<{ areas: string[]; departamentos: string[] }>('/maquinas/filtros'),
      ]);
      // Una respuesta vieja que llega tarde no debe pisar a la última.
      if (pedido !== this.pedido) return;
      this.items = lista.items;
      this.total = lista.total;
      this.tipos = tipos;
      this.areas = opciones.areas;
      this.departamentos = opciones.departamentos;
      this.error = '';
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cargar la maquinaria');
    } finally {
      if (pedido === this.pedido) this.cargando = false;
    }
  }

  abrir(m: Maquina) {
    void this.router.navigate(['/maquinaria', m.id]);
  }

  creada(m: Maquina) {
    this.creando = false;
    this.abrir(m);
  }

  editarTipo(t: Tipo) {
    this.editandoTipo = t.id;
    this.tipoDraft = { nombre: t.nombre, descripcion: t.descripcion ?? '' };
  }

  async guardarTipo(t: Tipo) {
    try {
      await this.api.put(`/tipos/${t.id}`, this.tipoDraft);
      this.editandoTipo = null;
      await this.cargar();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar el tipo');
    }
  }

  async crearTipo() {
    if (!this.nuevoTipo.nombre.trim()) return;
    try {
      await this.api.post('/tipos', this.nuevoTipo);
      this.nuevoTipo = { nombre: '', descripcion: '' };
      await this.cargar();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo crear el tipo');
    }
  }

  async borrarTipo(t: Tipo) {
    const aviso = t.maquinas ? ` Sus ${t.maquinas} máquinas quedarán "Sin tipo".` : '';
    if (!confirm(`¿Borrar el tipo "${t.nombre}"?${aviso}`)) return;
    try {
      await this.api.delete(`/tipos/${t.id}`);
      await this.cargar();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo borrar el tipo');
    }
  }
}
