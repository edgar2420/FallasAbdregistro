import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../api';
import { Catalogos, Solucion, Tipo } from '../modelos';
import { SolucionForm } from '../componentes/solucion-form';
import { conPausa, consulta, fechaCorta } from '../util';

@Component({
  selector: 'app-soluciones-page',
  imports: [FormsModule, RouterLink, SolucionForm],
  template: `
    <div class="module-title">
      <div>
        <span class="eyebrow">Conocimiento / Historial</span>
        <h1>Base de soluciones</h1>
        <p>Escribe un síntoma («fuga de aceite», «torque», «sellado») y mira qué se hizo antes, con qué repuestos y cuánto tomó.</p>
      </div>
    </div>

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }

    <section class="module-card filtros">
      <input type="search" class="buscador" placeholder="Buscar síntoma, causa, falla, máquina o repuesto"
             aria-label="Buscar soluciones" [(ngModel)]="f.q" (ngModelChange)="cargarConPausa()">
      <select aria-label="Tipo de máquina" [(ngModel)]="f.tipo_id" (ngModelChange)="cargar()">
        <option value="">Todos los tipos</option>
        @for (t of tipos; track t.id) {
          <option [value]="t.id">{{ t.nombre }}</option>
        }
      </select>
      <select aria-label="Categoría" [(ngModel)]="f.categoria" (ngModelChange)="cargar()">
        <option value="">Todas las categorías</option>
        @for (c of cat?.categorias ?? []; track c) {
          <option>{{ c }}</option>
        }
      </select>
      <label class="check-label">
        <input type="checkbox" [(ngModel)]="f.solo_efectivas" (ngModelChange)="cargar()"> Sólo efectivas
      </label>
      <span class="contador">{{ items.length }} soluciones</span>
    </section>

    <section class="module-grid">
      @for (s of items; track s.id) {
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
            <a class="tag" [routerLink]="['/maquinaria', s.maquina_id]" [queryParams]="{ falla: s.falla_id }">
              {{ s.falla_codigo }} · {{ s.maquina_codigo }}
            </a>
          </div>
          <h2>{{ s.falla_titulo }}</h2>
          <p>{{ s.maquina_nombre }} · {{ s.maquina_tipo || 'Sin tipo' }} · {{ s.categoria }}</p>
          <div class="solution-body">{{ s.descripcion }}</div>
          @if (s.preventivo) {
            <p class="preventivo"><b>Preventivo:</b> {{ s.preventivo }}</p>
          }
          <p class="subline">
            {{ s.repuestos || 'Sin repuestos' }} · {{ s.tecnico || 'Técnico no indicado' }} ·
            {{ s.tiempo_minutos }} min · {{ fecha(s.fecha, false) }}
          </p>
          @if (api.esAdmin()) {
            @if (editandoId === s.id) {
              <app-solucion-form [fallaId]="s.falla_id" [solucion]="s"
                                 (guardado)="editandoId = null; cargar()" (cancelar)="editandoId = null" />
            } @else {
              <div class="row-actions">
                <button type="button" (click)="editandoId = s.id">Editar</button>
                <button type="button" class="danger" (click)="borrar(s)">Borrar</button>
              </div>
            }
          }
        </article>
      } @empty {
        <p class="muted">{{ cargando ? 'Cargando soluciones…' : 'No hay soluciones con esos filtros' }}</p>
      }
    </section>
  `,
})
export class SolucionesPage implements OnInit {
  protected readonly api = inject(Api);
  items: Solucion[] = [];
  tipos: Tipo[] = [];
  cat?: Catalogos;
  f = { q: '', tipo_id: '', categoria: '', solo_efectivas: false };
  error = '';
  cargando = true;
  editandoId: number | null = null;
  private pedido = 0;

  readonly fecha = fechaCorta;
  readonly cargarConPausa = conPausa(() => this.cargar());

  async ngOnInit() {
    void this.cargar();
    try {
      [this.tipos, this.cat] = await Promise.all([this.api.get<Tipo[]>('/tipos'), this.api.catalogos()]);
    } catch {
      /* los filtros quedan vacíos */
    }
  }

  async cargar() {
    const pedido = ++this.pedido;
    this.cargando = true;
    try {
      const r = await this.api.get<Solucion[]>(
        `/soluciones${consulta({ ...this.f, solo_efectivas: this.f.solo_efectivas ? 1 : null })}`,
      );
      if (pedido === this.pedido) {
        this.items = r;
        this.error = '';
      }
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudieron cargar las soluciones');
    } finally {
      if (pedido === this.pedido) this.cargando = false;
    }
  }

  async borrar(s: Solucion) {
    if (!confirm(`¿Eliminar la solución de ${s.falla_codigo} (${s.maquina_codigo})?`)) return;
    try {
      await this.api.delete(`/soluciones/${s.id}`);
      await this.cargar();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo eliminar la solución');
    }
  }
}
