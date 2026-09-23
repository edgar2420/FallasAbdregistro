import { Component, OnChanges, inject, input, output } from '@angular/core';
import { Api } from '../api';
import { Falla, Solucion } from '../modelos';
import { claseEstadoFalla, claseSeveridad, fechaCorta } from '../util';
import { FallaForm } from './falla-form';
import { Galeria } from './galeria';
import { SolucionForm } from './solucion-form';

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
  imports: [FallaForm, SolucionForm, Galeria],
  template: `
    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }
    @if (!f) {
      <p class="muted">Cargando detalle…</p>
    } @else if (editando) {
      <app-falla-form [falla]="f" (guardado)="editando = false; recargar()" (cancelar)="editando = false" />
    } @else {
      <div class="detalle">
        <div class="detalle-head">
          <div>
            <span class="issue-id">{{ f.codigo }}</span>
            <h3>{{ f.titulo }}</h3>
            <small class="subline">{{ f.maquina_codigo }} · {{ f.maquina_nombre }}</small>
          </div>
          <div class="chips">
            <span class="priority" [class]="'priority ' + sev(f.severidad)">{{ f.severidad }}</span>
            <span class="tag" [class]="'tag ' + est(f.estado)">{{ f.estado }}</span>
            <span class="tag">{{ f.categoria }}</span>
          </div>
        </div>

        <dl class="ficha">
          <div><dt>Detectada</dt><dd>{{ fecha(f.fecha_deteccion) }}</dd></div>
          <div><dt>Resuelta</dt><dd>{{ fecha(f.fecha_resolucion) }}</dd></div>
          <div><dt>Turno</dt><dd>{{ f.turno || '—' }}</dd></div>
          <div><dt>Minutos de paro</dt><dd>{{ f.paro_minutos }}</dd></div>
          <div><dt>Reportado por</dt><dd>{{ f.reportado_por || '—' }}</dd></div>
          <div><dt>Responsable</dt><dd>{{ f.responsable || '—' }}</dd></div>
          @if (f.sintomas) {
            <div class="wide"><dt>Síntomas</dt><dd class="texto">{{ f.sintomas }}</dd></div>
          }
          @if (f.descripcion) {
            <div class="wide"><dt>Descripción</dt><dd class="texto">{{ f.descripcion }}</dd></div>
          }
          @if (f.causa_raiz) {
            <div class="wide"><dt>Causa raíz</dt><dd class="texto">{{ f.causa_raiz }}</dd></div>
          }
        </dl>

        @if (api.esAdmin()) {
          <div class="row-actions">
            <button type="button" (click)="editando = true">Editar falla</button>
            <button type="button" (click)="nuevaSolucion = true; editandoSolucion = null">Registrar solución</button>
            <button type="button" class="danger" (click)="borrar()">Borrar falla</button>
          </div>
        }

        <h4>Soluciones aplicadas ({{ f.soluciones_lista?.length ?? 0 }})</h4>
        @if (nuevaSolucion) {
          <app-solucion-form [fallaId]="f.id" (guardado)="nuevaSolucion = false; recargar()"
                             (cancelar)="nuevaSolucion = false" />
        }
        @for (s of f.soluciones_lista ?? []; track s.id) {
          @if (editandoSolucion === s.id) {
            <app-solucion-form [fallaId]="f.id" [solucion]="s" (guardado)="editandoSolucion = null; recargar()"
                               (cancelar)="editandoSolucion = null" />
          } @else {
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
                  <button type="button" (click)="editandoSolucion = s.id; nuevaSolucion = false">Editar</button>
                  <button type="button" class="danger" (click)="borrarSolucion(s)">Borrar</button>
                </div>
              }
            </article>
          }
        } @empty {
          <p class="muted">Todavía no se registró ninguna solución.</p>
        }

        <h4>Fotos de la falla ({{ f.adjuntos_lista?.length ?? 0 }})</h4>
        <app-galeria [adjuntos]="f.adjuntos_lista ?? []" [fallaId]="f.id" [maquinaId]="f.maquina_id"
                     [categoriaInicial]="catFoto(f.categoria)" [conPestanas]="false" (cambio)="recargar()" />
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
  editandoSolucion: number | null = null;

  readonly fecha = fechaCorta;
  readonly sev = claseSeveridad;
  readonly est = claseEstadoFalla;
  readonly catFoto = categoriaFoto;

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
