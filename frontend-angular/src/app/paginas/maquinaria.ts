import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../api';
import { Maquina, Tipo } from '../modelos';
import { MaquinaForm } from '../componentes/maquina-form';
import { claseEstadoMaquina, contiene } from '../util';

@Component({
  selector: 'app-maquinaria-page',
  imports: [FormsModule, RouterLink, MaquinaForm],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Activos / Planta</span>
        <h1>Maquinaria</h1>
        <p>Selecciona una máquina para ver su ficha técnica, fotos y la tabla de fallas con su solución.</p>
      </div>
      @if (api.esAdmin()) {
        <div class="row-actions">
          <button class="ghost" type="button" (click)="verTipos = !verTipos">Tipos de máquina</button>
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
      <app-maquina-form (guardado)="creada($event)" (cancelar)="creando = false" />
    }

    @if (verTipos && api.esAdmin()) {
      <section class="module-card">
        <h2>Tipos de máquina</h2>
        <div class="tipos-lista">
          @for (t of tipos; track t.id) {
            <div class="user-row">
              @if (editandoTipo === t.id) {
                <input aria-label="Nombre del tipo" [(ngModel)]="tipoDraft.nombre">
                <input aria-label="Descripción del tipo" [(ngModel)]="tipoDraft.descripcion" placeholder="Descripción">
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
          <input aria-label="Nuevo tipo" placeholder="Nuevo tipo (ej. Ósmosis inversa)" name="nt" [(ngModel)]="nuevoTipo.nombre">
          <input aria-label="Descripción" placeholder="Descripción" name="nd" [(ngModel)]="nuevoTipo.descripcion">
          <button class="primary" type="submit">Agregar tipo</button>
        </form>
      </section>
    }

    <section class="module-card filtros">
      <input type="search" class="buscador" placeholder="Buscar por código o nombre de máquina"
             aria-label="Buscar máquina por código o nombre" [(ngModel)]="q">
      <select aria-label="Filtrar por tipo" [(ngModel)]="tipoId">
        <option [ngValue]="null">Todos los tipos</option>
        @for (t of tipos; track t.id) {
          <option [ngValue]="t.id">{{ t.nombre }}</option>
        }
      </select>
      <select aria-label="Filtrar por área" [(ngModel)]="area">
        <option value="">Todas las áreas</option>
        @for (a of areas; track a) {
          <option>{{ a }}</option>
        }
      </select>
      <select aria-label="Filtrar por estado" [(ngModel)]="estado">
        <option value="">Todos los estados</option>
        <option>Operativa</option>
        <option>En falla</option>
        <option>Mantenimiento</option>
        <option>Fuera de servicio</option>
      </select>
      <span class="contador">{{ filtradas.length }} de {{ items.length }}</span>
    </section>

    <section class="module-card tabla-card">
      <div class="tabla-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Máquina</th>
              <th>Tipo</th>
              <th>Área</th>
              <th>POE</th>
              <th>Estado</th>
              <th class="num">Fallas abiertas / total</th>
            </tr>
          </thead>
          <tbody>
            @for (m of filtradas; track m.id) {
              <tr class="clicable" tabindex="0" (click)="abrir(m)" (keydown.enter)="abrir(m)">
                <td><a class="codigo" [routerLink]="['/maquinaria', m.id]" (click)="$event.stopPropagation()">{{ m.codigo }}</a></td>
                <td>
                  <strong>{{ m.nombre }}</strong>
                  <small class="subline">{{ m.marca || '' }} {{ m.modelo || '' }}</small>
                </td>
                <td>{{ m.tipo || '—' }}</td>
                <td>{{ m.area || '—' }}</td>
                <td class="poe">{{ m.poe || '—' }}</td>
                <td><span class="tag" [class]="'tag ' + claseEstado(m.estado)">{{ m.estado }}</span></td>
                <td class="num">
                  <b [class.alerta]="m.fallas_abiertas">{{ m.fallas_abiertas }}</b> / {{ m.total_fallas }}
                </td>
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
    </section>
  `,
})
export class MaquinariaPage implements OnInit {
  protected readonly api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  items: Maquina[] = [];
  tipos: Tipo[] = [];
  q = '';
  tipoId: number | null = null;
  area = '';
  estado = '';
  error = '';
  cargando = true;
  creando = false;
  verTipos = false;
  editandoTipo: number | null = null;
  tipoDraft = { nombre: '', descripcion: '' };
  nuevoTipo = { nombre: '', descripcion: '' };

  readonly claseEstado = claseEstadoMaquina;

  get areas() {
    return [...new Set(this.items.map((m) => m.area).filter((a): a is string => !!a))].sort();
  }

  get filtradas() {
    return this.items.filter(
      (m) =>
        (!this.tipoId || m.tipo_id === this.tipoId) &&
        (!this.area || m.area === this.area) &&
        (!this.estado || m.estado === this.estado) &&
        contiene(`${m.codigo} ${m.nombre} ${m.poe ?? ''} ${m.marca ?? ''} ${m.modelo ?? ''} ${m.area ?? ''}`, this.q),
    );
  }

  async ngOnInit() {
    this.q = this.route.snapshot.queryParamMap.get('q') ?? '';
    await this.cargar();
  }

  async cargar() {
    this.cargando = true;
    try {
      [this.items, this.tipos] = await Promise.all([
        this.api.get<Maquina[]>('/maquinas'),
        this.api.get<Tipo[]>('/tipos'),
      ]);
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cargar la maquinaria');
    } finally {
      this.cargando = false;
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
