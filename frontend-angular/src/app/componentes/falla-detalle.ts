import { Component, OnChanges, inject, input, output } from '@angular/core';
import { Api } from '../api';
import { Falla, Solucion } from '../modelos';
import { fechaCorta, fechaLarga, haceCuanto } from '../util';
import { FallaForm } from './falla-form';
import { Modal } from './modal';
import { Galeria } from './galeria';
import { SolucionForm } from './solucion-form';
import { LIMITES } from '../limites';

/** Categoría de foto sugerida según el tipo de falla. */
function categoriaFoto(categoria: string) {
  if (categoria === 'Eléctrica') return 'Eléctrica';
  if (categoria === 'Electrónica / Control' || categoria === 'Software / HMI') return 'Electrónica';
  if (['Mecánica', 'Neumática', 'Hidráulica'].includes(categoria)) return 'Mecánica';
  return 'Otra';
}

/** Ficha completa de una falla: datos, soluciones aplicadas y fotos. */
@Component({
  selector: 'app-falla-detalle',
  imports: [FallaForm, SolucionForm, Galeria, Modal],
  template: `
    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }
    @if (!f) {
      <p class="muted">Cargando detalle…</p>
    } @else {
      @if (editando) {
        <app-modal [titulo]="'Editar falla ' + f.codigo" [subtitulo]="f.maquina_codigo + ' · ' + f.maquina_nombre"
                   (cerrar)="editando = false">
          <app-falla-form [falla]="f" (guardado)="editando = false; recargar()" (cancelar)="editando = false" />
        </app-modal>
      }
      @if (nuevaSolucion) {
        <app-modal titulo="Registrar solución" [subtitulo]="f.codigo + ' · ' + f.titulo" tamano="mediano"
                   (cerrar)="nuevaSolucion = false">
          <app-solucion-form [fallaId]="f.id" (guardado)="nuevaSolucion = false; recargar()"
                             (cancelar)="nuevaSolucion = false" />
        </app-modal>
      }
      @if (solucionEditada; as s) {
        <app-modal titulo="Editar solución" [subtitulo]="f.codigo + ' · ' + f.titulo" tamano="mediano"
                   (cerrar)="solucionEditada = null">
          <app-solucion-form [fallaId]="f.id" [solucion]="s" (guardado)="solucionEditada = null; recargar()"
                             (cancelar)="solucionEditada = null" />
        </app-modal>
      }
      <div class="detalle">
        @switch (estado(f)) {
          @case ('resuelta') {
            <p class="estado-banda" data-estado="resuelta">
              <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
              Solucionada{{ f.fecha_resolucion ? ' el ' + larga(f.fecha_resolucion) : '' }}
            </p>
          }
          @case ('intento') {
            <p class="estado-banda" data-estado="intento">
              <svg class="icon" aria-hidden="true"><use href="#i-wrench"></use></svg>
              Se intentó una solución, pero la falla sigue sin resolverse
            </p>
          }
          @default {
            <p class="estado-banda" data-estado="pendiente">
              <svg class="icon" aria-hidden="true"><use href="#i-clock"></use></svg>
              Todavía no tiene solución registrada
              @if (api.esAdmin()) {
                <button type="button" class="primary" (click)="nuevaSolucion = true">Registrar solución</button>
              }
            </p>
          }
        }
        <div class="detalle-head">
          <div>
            <span class="issue-id">{{ f.codigo }}</span>
            <h3 class="titulo-falla">
              <svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg>{{ f.titulo }}
            </h3>
            <small class="subline">{{ f.maquina_codigo }} · {{ f.maquina_nombre }}</small>
          </div>
          <div class="chips">
            <span class="tag">{{ f.categoria }}</span>
          </div>
        </div>

        <dl class="ficha">
          <div><dt>Fecha</dt><dd>{{ larga(f.fecha_deteccion) }} <small class="subline">{{ hace(f.fecha_deteccion) }}</small></dd></div>
          <div><dt>Categoría</dt><dd>{{ f.categoria }}</dd></div>
          @if (f.descripcion) {
            <div class="wide"><dt>Descripción</dt><dd class="texto">{{ f.descripcion }}</dd></div>
          }
          @if (f.causa_raiz) {
            <div class="wide"><dt>Causa</dt><dd class="texto">{{ f.causa_raiz }}</dd></div>
          }
        </dl>

        @if (api.esAdmin()) {
          <div class="row-actions">
            <button type="button" (click)="editando = true">Editar falla</button>
            <button type="button" (click)="nuevaSolucion = true">Registrar solución</button>
            <button type="button" class="danger" (click)="borrar()">Borrar falla</button>
          </div>
        }

        <h4 class="titulo-solucion">
          <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
          Soluciones aplicadas ({{ f.soluciones_lista?.length ?? 0 }})
        </h4>
        @for (s of f.soluciones_lista ?? []; track s.id) {
            <article class="solucion" [class.no-efectiva]="!s.efectiva">
              <div class="solucion-head">
                <span class="tag" [class.green]="s.efectiva">{{ s.efectiva ? 'Efectiva' : 'No efectiva' }}</span>
                <small>{{ fecha(s.fecha) }} · {{ s.tecnico || 'Técnico no indicado' }} · {{ s.tiempo_minutos }} min
                  @if (s.costo) { · Costo {{ s.costo }} }
                </small>
              </div>
              <p class="texto">{{ s.descripcion }}</p>
              @if (s.repuestos) { <p><b>Repuestos:</b> {{ s.repuestos }}</p> }
              @if (s.herramientas) { <p><b>Herramientas:</b> {{ s.herramientas }}</p> }
              @if (s.preventivo) { <p class="preventivo"><b>Preventivo:</b> {{ s.preventivo }}</p> }
              @if (api.esAdmin()) {
                <div class="row-actions">
                  <button type="button" (click)="solucionEditada = s">Editar</button>
                  <button type="button" class="danger" (click)="borrarSolucion(s)">Borrar</button>
                </div>
              }
            </article>
        } @empty {
          <p class="muted">Todavía no se registró ninguna solución.</p>
        }

        <h4>Fotos de la falla ({{ f.adjuntos_lista?.length ?? 0 }})</h4>
        <app-galeria [adjuntos]="f.adjuntos_lista ?? []" [fallaId]="f.id" [maquinaId]="f.maquina_id"
                     [categoriaInicial]="catFoto(f.categoria)" [conPestanas]="false" [maximo]="maxFotos" (cambio)="recargar()" />
      </div>
    }
  `,
})
export class FallaDetalle implements OnChanges {
  protected readonly api = inject(Api);
  readonly fallaId = input.required<number>();
  readonly cambio = output<void>();

  f: Falla | null = null;
  error = '';
  editando = false;
  nuevaSolucion = false;
  solucionEditada: Solucion | null = null;

  readonly fecha = fechaCorta;
  readonly larga = fechaLarga;
  readonly hace = haceCuanto;

  estado(f: Falla) {
    if (f.estado === 'Resuelta') return 'resuelta';
    return f.soluciones_lista?.length ? 'intento' : 'pendiente';
  }
  readonly catFoto = categoriaFoto;
  readonly maxFotos = LIMITES.adjunto.por_falla;

  ngOnChanges() {
    void this.cargar();
  }

  private async cargar() {
    try {
      this.f = await this.api.get<Falla>(`/fallas/${this.fallaId()}`);
      this.error = '';
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo cargar la falla');
    }
  }

  async recargar() {
    await this.cargar();
    this.cambio.emit();
  }

  async borrar() {
    if (!this.f || !confirm(`¿Eliminar la falla ${this.f.codigo}, sus soluciones y fotos?`)) return;
    try {
      await this.api.delete(`/fallas/${this.f.id}`);
      this.f = null;
      this.cambio.emit();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo eliminar la falla');
    }
  }

  async borrarSolucion(s: Solucion) {
    if (!confirm('¿Eliminar esta solución?')) return;
    try {
      await this.api.delete(`/soluciones/${s.id}`);
      await this.recargar();
    } catch (e: unknown) {
      this.error = Api.mensaje(e, 'No se pudo eliminar la solución');
    }
  }
}
