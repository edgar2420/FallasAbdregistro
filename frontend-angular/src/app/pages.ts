import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from './api';

const CATEGORIAS = [
  'Mecánica',
  'Eléctrica',
  'Neumática',
  'Hidráulica',
  'Electrónica / Control',
  'Software / HMI',
  'Operativa',
  'Calidad de producto',
  'Servicios (agua/vapor/aire)',
  'Otra',
];

const ESTADOS = ['Abierta', 'En proceso', 'Resuelta', 'Recurrente', 'Anulada'];

function clasePorSeveridad(severidad: string) {
  if (severidad === 'Crítica' || severidad === 'Alta') return 'red';
  return severidad === 'Media' ? 'orange' : 'green';
}

function contiene(texto: string, consulta: string) {
  return texto.toLowerCase().includes(consulta.trim().toLowerCase());
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <span class="eyebrow">Operaciones / Tablero</span>
    <h1>Centro de mando</h1>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    <section class="metrics">
      <article>
        <span>FALLAS ABIERTAS</span>
        <strong>{{ abiertas }}</strong>
        <em class="negative">Pendientes de atención</em>
      </article>
      <article>
        <span>EN PROCESO</span>
        <strong>{{ enProceso }}</strong>
        <em class="warning">Seguimiento activo</em>
      </article>
      <article>
        <span>RESUELTAS</span>
        <strong>{{ resueltas }}</strong>
        <em class="positive">Soluciones registradas</em>
      </article>
      <article>
        <span>MÁQUINAS</span>
        <strong>{{ machines.length }}</strong>
        <em class="positive">Equipos registrados</em>
      </article>
    </section>

    <section class="section-head">
      <div>
        <span class="eyebrow">Flujo de trabajo</span>
        <h2>Tablero de incidencias</h2>
      </div>
      <span class="live"><i class="online-dot"></i>Datos del sistema</span>
    </section>

    <section class="kanban">
      @for (col of columns; track col.status) {
        <div class="kanban-column">
          <div class="column-head">
            <strong><i class="status-dot" [class]="'status-dot ' + col.color"></i>{{ col.title }}</strong>
            <span class="count">{{ col.items.length }}</span>
          </div>
          @for (f of col.items; track f.id) {
            <article class="issue-card">
              <div class="issue-top">
                <span class="issue-id">{{ f.codigo }}</span>
                <span class="priority" [class]="'priority ' + severityClass(f.severidad)">
                  {{ f.severidad }}
                </span>
              </div>
              <h3>{{ f.titulo }}</h3>
              <p>{{ f.maquina_codigo }} · {{ f.maquina_nombre }}</p>
              <div class="issue-foot">
                <span>{{ f.categoria }}</span>
                <span>{{ f.responsable || 'Sin asignar' }}</span>
              </div>
            </article>
          } @empty {
            <p class="muted">{{ cargando ? 'Cargando…' : 'Sin fallas' }}</p>
          }
        </div>
      }
    </section>
  `,
})
export class DashboardPage implements OnInit {
  private api = inject(Api);
  failures: any[] = [];
  machines: any[] = [];
  error = '';
  cargando = true;
  abiertas = 0;
  enProceso = 0;
  resueltas = 0;
  columns = [
    { status: 'Abierta', title: 'Por atender', color: 'red', items: [] as any[] },
    { status: 'En proceso', title: 'En proceso', color: 'orange', items: [] as any[] },
    { status: 'Resuelta', title: 'Resueltas', color: 'green', items: [] as any[] },
  ];

  async ngOnInit() {
    try {
      [this.failures, this.machines] = await Promise.all([
        this.api.get<any[]>('/fallas'),
        this.api.get<any[]>('/maquinas'),
      ]);
      this.resumir();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar los datos');
    } finally {
      this.cargando = false;
    }
  }

  /** Recorre las fallas una sola vez en lugar de filtrar en cada ciclo de render. */
  private resumir() {
    const cuenta = (estado: string) => this.failures.filter((f) => f.estado === estado).length;
    this.abiertas = cuenta('Abierta') + cuenta('Recurrente');
    this.enProceso = cuenta('En proceso');
    this.resueltas = cuenta('Resuelta');
    for (const col of this.columns) {
      col.items = this.failures
        .filter((f) => f.estado === col.status || (col.status === 'Abierta' && f.estado === 'Recurrente'))
        .slice(0, 20);
    }
  }

  severityClass = clasePorSeveridad;
}

@Component({
  selector: 'app-failures-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Operaciones / Mantenimiento</span>
        <h1>Fallas técnicas</h1>
        <p>Registra el incidente asociado al equipo afectado y sigue su resolución.</p>
      </div>
      @if (isAdmin) {
        <button class="primary" type="button" (click)="startNew()">
          <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>Registrar falla
        </button>
      }
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    <section class="module-card filter-row">
      <input
        type="search"
        placeholder="Buscar por código, máquina o falla"
        aria-label="Buscar fallas"
        [(ngModel)]="query"
        (ngModelChange)="aplicarFiltro()">
      <select aria-label="Filtrar por estado" [(ngModel)]="state" (ngModelChange)="aplicarFiltro()">
        <option value="">Todos los estados</option>
        @for (s of states; track s) {
          <option>{{ s }}</option>
        }
      </select>
      <span>{{ filtered.length }} registros</span>
    </section>

    @if (editing) {
      <section class="module-card">
        <h2>{{ draft.id ? 'Editar' : 'Nueva' }} falla</h2>
        <div class="crud-grid">
          <label>
            Máquina afectada *
            <select [(ngModel)]="draft.maquina_id">
              <option [ngValue]="null">Selecciona una máquina</option>
              @for (m of machines; track m.id) {
                <option [ngValue]="m.id">{{ m.codigo }} · {{ m.nombre }}</option>
              }
            </select>
          </label>
          <label>Título *<input [(ngModel)]="draft.titulo"></label>
          <label>
            Categoría
            <select [(ngModel)]="draft.categoria">
              @for (c of categories; track c) {
                <option>{{ c }}</option>
              }
            </select>
          </label>
          <label>
            Severidad
            <select [(ngModel)]="draft.severidad">
              <option>Baja</option>
              <option>Media</option>
              <option>Alta</option>
              <option>Crítica</option>
            </select>
          </label>
          <label>
            Estado
            <select [(ngModel)]="draft.estado">
              @for (s of states; track s) {
                <option>{{ s }}</option>
              }
            </select>
          </label>
          <label>Responsable<input [(ngModel)]="draft.responsable"></label>
          <label class="wide">Síntomas<textarea [(ngModel)]="draft.sintomas"></textarea></label>
          <label class="wide">Descripción<textarea [(ngModel)]="draft.descripcion"></textarea></label>
        </div>
        <div class="form-actions">
          <button class="ghost" type="button" (click)="editing = false">Cancelar</button>
          <button class="primary" type="button" [disabled]="guardando" (click)="save()">
            {{ guardando ? 'Guardando…' : 'Guardar falla' }}
          </button>
        </div>
      </section>
    }

    <section class="module-card table-card">
      <div class="table-head">
        <span>CÓDIGO</span>
        <span>FALLA / MÁQUINA</span>
        <span>SEVERIDAD</span>
        <span>ESTADO</span>
        <span>ACCIONES</span>
      </div>
      @for (f of filtered; track f.id) {
        <div class="table-row">
          <b>{{ f.codigo }}</b>
          <div>
            <strong>{{ f.titulo }}</strong>
            <small class="subline">{{ f.maquina_codigo }} · {{ f.maquina_nombre }}</small>
          </div>
          <span class="priority" [class]="'priority ' + severityClass(f.severidad)">{{ f.severidad }}</span>
          <span class="tag">{{ f.estado }}</span>
          <div class="row-actions">
            <button type="button" title="Registrar solución" (click)="solution(f)">Solución</button>
            @if (isAdmin) {
              <button type="button" (click)="edit(f)">Editar</button>
              <button type="button" class="danger" (click)="remove(f)">Borrar</button>
            }
          </div>
        </div>
      } @empty {
        <p class="muted">{{ cargando ? 'Cargando fallas…' : 'No hay fallas para mostrar' }}</p>
      }
    </section>

    @if (solutionTarget) {
      <section class="module-card">
        <h2>Solución para {{ solutionTarget.codigo }} · {{ solutionTarget.maquina_codigo }}</h2>
        <label>Intervención<textarea [(ngModel)]="solutionDraft.descripcion"></textarea></label>
        <div class="crud-grid">
          <label>Repuestos<input [(ngModel)]="solutionDraft.repuestos"></label>
          <label>Técnico<input [(ngModel)]="solutionDraft.tecnico"></label>
          <label>Tiempo (min)<input type="number" min="0" [(ngModel)]="solutionDraft.tiempo_minutos"></label>
          <label class="check-label">
            <input type="checkbox" [(ngModel)]="solutionDraft.efectiva"> Solución efectiva
          </label>
        </div>
        <div class="form-actions">
          <button class="ghost" type="button" (click)="solutionTarget = null">Cerrar</button>
          @if (isAdmin) {
            <button class="primary" type="button" [disabled]="guardando" (click)="saveSolution()">
              {{ guardando ? 'Guardando…' : 'Guardar solución' }}
            </button>
          }
        </div>
      </section>
    }
  `,
})
export class FailuresPage implements OnInit {
  private api = inject(Api);
  machines: any[] = [];
  items: any[] = [];
  filtered: any[] = [];
  query = '';
  state = '';
  error = '';
  cargando = true;
  guardando = false;
  editing = false;
  solutionTarget: any = null;
  solutionDraft: any = this.nuevaSolucion();
  draft: any = this.nuevaFalla();
  states = ESTADOS;
  categories = CATEGORIAS;
  severityClass = clasePorSeveridad;

  get isAdmin() {
    return this.api.usuario()?.rol === 'admin';
  }

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.cargando = true;
    try {
      [this.items, this.machines] = await Promise.all([
        this.api.get<any[]>('/fallas'),
        this.api.get<any[]>('/maquinas'),
      ]);
      this.aplicarFiltro();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar las fallas');
    } finally {
      this.cargando = false;
    }
  }

  aplicarFiltro() {
    this.filtered = this.items.filter(
      (f) =>
        (!this.state || f.estado === this.state) &&
        (!this.query ||
          contiene(`${f.codigo} ${f.titulo} ${f.maquina_codigo} ${f.maquina_nombre}`, this.query)),
    );
  }

  startNew() {
    this.draft = this.nuevaFalla();
    this.editing = true;
  }

  edit(f: any) {
    this.draft = { ...f };
    this.editing = true;
  }

  async save() {
    if (!this.draft.maquina_id || !this.draft.titulo?.trim()) {
      this.error = 'Selecciona la máquina y escribe el título de la falla';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      if (this.draft.id) await this.api.put(`/fallas/${this.draft.id}`, this.draft);
      else await this.api.post('/fallas', this.draft);
      this.editing = false;
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la falla');
    } finally {
      this.guardando = false;
    }
  }

  async remove(f: any) {
    if (!confirm(`¿Eliminar ${f.codigo} de ${f.maquina_codigo}?`)) return;
    try {
      await this.api.delete(`/fallas/${f.id}`);
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo eliminar la falla');
    }
  }

  solution(f: any) {
    this.solutionTarget = f;
    this.solutionDraft = this.nuevaSolucion();
  }

  async saveSolution() {
    if (!this.solutionDraft.descripcion?.trim()) {
      this.error = 'Describe la intervención antes de guardarla';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      await this.api.post(`/fallas/${this.solutionTarget.id}/soluciones`, this.solutionDraft);
      this.solutionTarget = null;
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la solución');
    } finally {
      this.guardando = false;
    }
  }

  private nuevaFalla() {
    return {
      maquina_id: null,
      titulo: '',
      categoria: 'Mecánica',
      severidad: 'Media',
      estado: 'Abierta',
      responsable: '',
      sintomas: '',
      descripcion: '',
    };
  }

  private nuevaSolucion() {
    return {
      descripcion: '',
      repuestos: '',
      tecnico: this.api.usuario()?.nombre || '',
      tiempo_minutos: 0,
      efectiva: true,
    };
  }
}

@Component({
  selector: 'app-machines-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Activos / Planta</span>
        <h1>Maquinaria</h1>
        <p>El detalle de cada equipo incluye sus fallas asociadas.</p>
      </div>
      @if (isAdmin) {
        <button class="primary" type="button" (click)="startNew()">
          <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>Nueva máquina
        </button>
      }
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    @if (editing) {
      <section class="module-card">
        <h2>{{ draft.id ? 'Editar' : 'Nueva' }} máquina</h2>
        <div class="crud-grid">
          <label>Código *<input [(ngModel)]="draft.codigo"></label>
          <label>Nombre *<input [(ngModel)]="draft.nombre"></label>
          <label>
            Tipo
            <select [(ngModel)]="draft.tipo_id">
              <option [ngValue]="null">Sin tipo</option>
              @for (t of types; track t.id) {
                <option [ngValue]="t.id">{{ t.nombre }}</option>
              }
            </select>
          </label>
          <label>Área<input [(ngModel)]="draft.area"></label>
          <label>Marca<input [(ngModel)]="draft.marca"></label>
          <label>Modelo<input [(ngModel)]="draft.modelo"></label>
          <label>
            Estado
            <select [(ngModel)]="draft.estado">
              <option>Operativa</option>
              <option>En falla</option>
              <option>Mantenimiento</option>
              <option>Fuera de servicio</option>
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button class="ghost" type="button" (click)="editing = false">Cancelar</button>
          <button class="primary" type="button" [disabled]="guardando" (click)="save()">
            {{ guardando ? 'Guardando…' : 'Guardar máquina' }}
          </button>
        </div>
      </section>
    }

    <section class="module-grid">
      @for (m of items; track m.id) {
        <article class="module-card machine-card">
          <div class="card-head">
            <span class="machine-icon">
              <svg class="icon" aria-hidden="true"><use href="#i-machine"></use></svg>
            </span>
            <span class="tag" [class.green]="m.estado === 'Operativa'">{{ m.estado }}</span>
          </div>
          <h2>{{ m.nombre }}</h2>
          <p><b>{{ m.codigo }}</b> · {{ m.tipo || 'Sin tipo' }} · {{ m.area || 'Área no indicada' }}</p>
          <small>{{ m.total_fallas }} fallas · {{ m.fallas_abiertas }} abiertas</small>
          @if (isAdmin) {
            <div class="row-actions">
              <button type="button" (click)="edit(m)">Editar</button>
              <button type="button" class="danger" (click)="remove(m)">Borrar</button>
            </div>
          }
          @if (openId === m.id) {
            <div class="machine-failures">
              @for (f of detail?.fallas || []; track f.id) {
                <p><b>{{ f.codigo }}</b> · {{ f.titulo }} <span class="tag">{{ f.estado }}</span></p>
              } @empty {
                <p class="muted">Sin fallas registradas</p>
              }
            </div>
          }
          <button class="link-button" type="button" (click)="toggle(m)">
            {{ openId === m.id ? 'Ocultar fallas' : 'Ver fallas de esta máquina' }}
          </button>
        </article>
      } @empty {
        <p class="muted">{{ cargando ? 'Cargando maquinaria…' : 'No hay maquinaria registrada' }}</p>
      }
    </section>
  `,
})
export class MachinesPage implements OnInit {
  private api = inject(Api);
  items: any[] = [];
  types: any[] = [];
  draft: any = { codigo: '', nombre: '', estado: 'Operativa' };
  editing = false;
  error = '';
  cargando = true;
  guardando = false;
  openId: number | null = null;
  detail: any = null;

  get isAdmin() {
    return this.api.usuario()?.rol === 'admin';
  }

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.cargando = true;
    try {
      [this.items, this.types] = await Promise.all([
        this.api.get<any[]>('/maquinas'),
        this.api.get<any[]>('/tipos'),
      ]);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cargar la maquinaria');
    } finally {
      this.cargando = false;
    }
  }

  startNew() {
    this.draft = { codigo: '', nombre: '', estado: 'Operativa' };
    this.editing = true;
  }

  edit(m: any) {
    this.draft = { ...m };
    this.editing = true;
  }

  async save() {
    if (!this.draft.codigo?.trim() || !this.draft.nombre?.trim()) {
      this.error = 'El código y el nombre de la máquina son obligatorios';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      if (this.draft.id) await this.api.put(`/maquinas/${this.draft.id}`, this.draft);
      else await this.api.post('/maquinas', this.draft);
      this.editing = false;
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la máquina');
    } finally {
      this.guardando = false;
    }
  }

  async remove(m: any) {
    if (!confirm(`¿Eliminar la máquina ${m.codigo} y sus fallas asociadas?`)) return;
    try {
      await this.api.delete(`/maquinas/${m.id}`);
      if (this.openId === m.id) this.openId = null;
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo eliminar la máquina');
    }
  }

  async toggle(m: any) {
    if (this.openId === m.id) {
      this.openId = null;
      return;
    }
    try {
      this.detail = await this.api.get(`/maquinas/${m.id}`);
      this.openId = m.id;
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cargar el detalle de la máquina');
    }
  }
}

@Component({
  selector: 'app-solutions-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Conocimiento / Historial</span>
        <h1>Soluciones técnicas</h1>
        <p>Cada intervención muestra la máquina y la falla a la que pertenece.</p>
      </div>
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    <section class="module-card filter-row">
      <input
        type="search"
        placeholder="Buscar causa, falla, máquina o repuesto"
        aria-label="Buscar soluciones"
        [(ngModel)]="query"
        (ngModelChange)="aplicarFiltro()">
      <span>{{ filtered.length }} soluciones</span>
    </section>

    <section class="module-grid">
      @for (s of filtered; track s.id) {
        <article class="module-card solution-card">
          <div class="card-head">
            <span class="solution-mark" [class.pending]="!s.efectiva"
                  [title]="s.efectiva ? 'Solución efectiva' : 'Solución no efectiva'">
              @if (s.efectiva) {
                <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
              } @else {
                <svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg>
              }
            </span>
            <span class="tag">{{ s.falla_codigo }} · {{ s.maquina_codigo }}</span>
          </div>
          <h2>{{ s.falla_titulo }}</h2>
          <p>{{ s.maquina_nombre }} · {{ s.maquina_tipo || 'Sin tipo' }} · {{ s.categoria }}</p>
          <div class="solution-body">{{ s.descripcion }}</div>
          <p class="subline">
            {{ s.repuestos || 'Sin repuestos' }} · {{ s.tecnico || 'Técnico no indicado' }} ·
            {{ s.tiempo_minutos }} min
          </p>
          @if (isAdmin) {
            <div class="row-actions">
              <button type="button" (click)="edit(s)">Editar</button>
              <button type="button" class="danger" (click)="remove(s)">Borrar</button>
            </div>
          }
        </article>
      } @empty {
        <p class="muted">
          {{ cargando ? 'Cargando soluciones…' : 'Todavía no hay soluciones registradas' }}
        </p>
      }
    </section>

    @if (editing) {
      <section class="module-card">
        <h2>Editar solución · {{ draft.falla_codigo }} · {{ draft.maquina_codigo }}</h2>
        <label>Descripción<textarea [(ngModel)]="draft.descripcion"></textarea></label>
        <div class="crud-grid">
          <label>Repuestos<input [(ngModel)]="draft.repuestos"></label>
          <label>Técnico<input [(ngModel)]="draft.tecnico"></label>
          <label>Tiempo (min)<input type="number" min="0" [(ngModel)]="draft.tiempo_minutos"></label>
          <label class="check-label"><input type="checkbox" [(ngModel)]="draft.efectiva"> Efectiva</label>
        </div>
        <div class="form-actions">
          <button class="ghost" type="button" (click)="editing = false">Cancelar</button>
          <button class="primary" type="button" [disabled]="guardando" (click)="save()">
            {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </section>
    }
  `,
})
export class SolutionsPage implements OnInit {
  private api = inject(Api);
  items: any[] = [];
  filtered: any[] = [];
  query = '';
  error = '';
  cargando = true;
  guardando = false;
  editing = false;
  draft: any = {};

  get isAdmin() {
    return this.api.usuario()?.rol === 'admin';
  }

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.cargando = true;
    try {
      this.items = await this.api.get<any[]>('/soluciones');
      this.aplicarFiltro();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar las soluciones');
    } finally {
      this.cargando = false;
    }
  }

  aplicarFiltro() {
    this.filtered = this.items.filter((s) =>
      contiene(
        `${s.falla_titulo} ${s.maquina_codigo} ${s.maquina_nombre} ${s.descripcion} ${s.repuestos}`,
        this.query,
      ),
    );
  }

  edit(s: any) {
    this.draft = { ...s };
    this.editing = true;
  }

  async save() {
    this.guardando = true;
    try {
      await this.api.put(`/soluciones/${this.draft.id}`, this.draft);
      this.editing = false;
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo guardar la solución');
    } finally {
      this.guardando = false;
    }
  }

  async remove(s: any) {
    if (!confirm(`¿Eliminar la solución de ${s.falla_codigo} (${s.maquina_codigo})?`)) return;
    try {
      await this.api.delete(`/soluciones/${s.id}`);
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo eliminar la solución');
    }
  }
}

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Administración / Accesos</span>
        <h1>Usuarios y actividad</h1>
        <p>Alta de cuentas y registro real de consultas autenticadas.</p>
      </div>
      <button class="primary" type="button" (click)="createOpen = !createOpen">
        <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>Crear usuario
      </button>
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    @if (createOpen) {
      <section class="module-card">
        <h2>Nuevo usuario</h2>
        <div class="crud-grid">
          <label>Nombre<input [(ngModel)]="draft.nombre"></label>
          <label>Nombre de usuario<input autocomplete="off" [(ngModel)]="draft.email"></label>
          <label>
            Contraseña inicial
            <input type="password" autocomplete="new-password" [(ngModel)]="draft.password">
          </label>
          <label>
            Rol
            <select [(ngModel)]="draft.rol">
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button class="ghost" type="button" (click)="createOpen = false">Cancelar</button>
          <button class="primary" type="button" [disabled]="guardando" (click)="create()">
            {{ guardando ? 'Creando…' : 'Crear cuenta' }}
          </button>
        </div>
      </section>
    }

    <section class="module-card">
      <h2>Usuarios</h2>
      @for (u of users; track u.id) {
        <div class="user-row">
          <span class="avatar" aria-hidden="true">{{ u.nombre.slice(0, 2).toUpperCase() }}</span>
          <div>
            <strong>{{ u.nombre }}</strong>
            <small>{{ u.email }} · {{ u.ultimo_acceso || 'Sin acceso registrado' }}</small>
          </div>
          <select [attr.aria-label]="'Rol de ' + u.nombre" [ngModel]="u.rol"
                  (ngModelChange)="role(u, $event)">
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
          <button type="button" (click)="toggle(u)">{{ u.activo ? 'Desactivar' : 'Activar' }}</button>
          <button type="button" (click)="reset(u)">Cambiar contraseña</button>
        </div>
      } @empty {
        <p class="muted">{{ cargando ? 'Cargando usuarios…' : 'No hay usuarios registrados' }}</p>
      }
    </section>

    <section class="module-card table-card">
      <h2>Consultas y actividad reciente</h2>
      <div class="table-head table-4">
        <span>USUARIO</span>
        <span>ACCIÓN</span>
        <span>RUTA CONSULTADA</span>
        <span>FECHA</span>
      </div>
      @for (a of activity; track a.id) {
        <div class="table-row table-4">
          <strong>{{ a.nombre || 'Cuenta eliminada' }}</strong>
          <span>{{ a.accion }}</span>
          <span>{{ a.ruta }}</span>
          <span>{{ a.creado_en }}</span>
        </div>
      } @empty {
        <p class="muted">Sin actividad registrada</p>
      }
    </section>
  `,
})
export class UsersPage implements OnInit {
  private api = inject(Api);
  users: any[] = [];
  activity: any[] = [];
  error = '';
  cargando = true;
  guardando = false;
  createOpen = false;
  draft: any = this.nuevoUsuario();

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.cargando = true;
    try {
      [this.users, this.activity] = await Promise.all([
        this.api.get<any[]>('/auth/usuarios'),
        this.api.get<any[]>('/auth/actividad'),
      ]);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar los usuarios');
    } finally {
      this.cargando = false;
    }
  }

  async create() {
    if (!this.draft.nombre?.trim() || !this.draft.email?.trim() || !this.draft.password) {
      this.error = 'Completa nombre, usuario y contraseña inicial';
      return;
    }
    this.error = '';
    this.guardando = true;
    try {
      await this.api.post('/auth/usuarios', this.draft);
      this.createOpen = false;
      this.draft = this.nuevoUsuario();
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo crear la cuenta');
    } finally {
      this.guardando = false;
    }
  }

  async role(u: any, rol: string) {
    try {
      await this.api.patch(`/auth/usuarios/${u.id}`, { rol });
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cambiar el rol');
    }
  }

  async toggle(u: any) {
    try {
      await this.api.patch(`/auth/usuarios/${u.id}`, { activo: !u.activo });
      await this.load();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cambiar el estado de la cuenta');
    }
  }

  async reset(u: any) {
    const password = prompt(`Nueva contraseña para ${u.nombre}`);
    if (!password) return;
    try {
      await this.api.patch(`/auth/usuarios/${u.id}`, { password });
      this.error = 'Contraseña actualizada';
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo actualizar la contraseña');
    }
  }

  private nuevoUsuario() {
    return { nombre: '', email: '', password: '', rol: 'operador' };
  }
}
